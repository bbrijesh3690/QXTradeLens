// One-off source recovery tool: turns the minified content.js build back into readable source.
//
// Usage: node tools/unminify.mjs <minified.js> <out.js> [rename-map.json]
//
// Every transform here is semantics-preserving by construction (statement-position rewrites only,
// scope-aware renames through Babel). `npm run verify` proves it: the recovered source and the
// original build minify to byte-identical output.
import fs from "node:fs";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import * as prettier from "prettier";

const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

const [, , inFile, outFile, mapFile] = process.argv;
if (!inFile || !outFile) {
  console.error("usage: node tools/unminify.mjs <minified.js> <out.js> [rename-map.json]");
  process.exit(1);
}

const code = fs.readFileSync(inFile, "utf8");
const ast = parse(code, { sourceType: "script", errorRecovery: false });

const isStatementList = (p) =>
  p.parentPath && (p.parentPath.isBlockStatement() || p.parentPath.isProgram() || p.parentPath.isSwitchCase()) &&
  (p.listKey === "body" || p.listKey === "consequent");

// Wrap a single statement that sits in a non-list position (e.g. `if (a) x, y;`) into a block so
// it can be expanded into several statements.
function ensureListPosition(path) {
  if (isStatementList(path)) return path;
  const block = t.blockStatement([path.node]);
  path.replaceWith(block);
  return path.get("body.0");
}

const exprToStatements = (expr) =>
  t.isSequenceExpression(expr) ? expr.expressions.map((e) => t.expressionStatement(e)) : [t.expressionStatement(expr)];

const negate = (expr) =>
  t.isUnaryExpression(expr, { operator: "!" }) ? expr.argument : t.unaryExpression("!", expr);

const toBlock = (stmts) => t.blockStatement(stmts);

let changed = true;
let passes = 0;
while (changed && passes < 20) {
  changed = false;
  passes++;
  traverse(ast, {
    // !0 / !1 -> true / false
    UnaryExpression(path) {
      const { node } = path;
      if (node.operator === "!" && t.isNumericLiteral(node.argument) && (node.argument.value === 0 || node.argument.value === 1)) {
        path.replaceWith(t.booleanLiteral(node.argument.value === 0));
        changed = true;
      } else if (node.operator === "void" && t.isNumericLiteral(node.argument, { value: 0 }) && !path.scope.hasBinding("undefined")) {
        path.replaceWith(t.identifier("undefined"));
        changed = true;
      }
    },
    // 1e3 -> 1000 (print the canonical value instead of the raw minified literal)
    NumericLiteral(path) {
      const { node } = path;
      if (node.extra && /e/i.test(node.extra.raw) && Number.isInteger(node.value) && Math.abs(node.value) < 1e12) {
        delete node.extra;
      }
    },
    // "x" === t  ->  t === "x"
    BinaryExpression(path) {
      const { node } = path;
      if (["===", "!==", "==", "!="].includes(node.operator) && t.isLiteral(node.left) && !t.isTemplateLiteral(node.left) && !t.isLiteral(node.right)) {
        [node.left, node.right] = [node.right, node.left];
        changed = true;
      }
    },
    ExpressionStatement(path) {
      const expr = path.node.expression;
      // a, b, c;  ->  a; b; c;
      if (t.isSequenceExpression(expr)) {
        const p = ensureListPosition(path);
        p.replaceWithMultiple(exprToStatements(expr));
        changed = true;
        return;
      }
      // a && b;  ->  if (a) b;      a || b;  ->  if (!a) b;
      if (t.isLogicalExpression(expr) && (expr.operator === "&&" || expr.operator === "||")) {
        const test = expr.operator === "&&" ? expr.left : negate(expr.left);
        path.replaceWith(t.ifStatement(test, toBlock(exprToStatements(expr.right))));
        changed = true;
        return;
      }
      // a ? b : c;  ->  if (a) b; else c;
      if (t.isConditionalExpression(expr)) {
        path.replaceWith(t.ifStatement(expr.test, toBlock(exprToStatements(expr.consequent)), toBlock(exprToStatements(expr.alternate))));
        changed = true;
      }
    },
    ReturnStatement(path) {
      const arg = path.node.argument;
      // return a, b;  ->  a; return b;
      if (t.isSequenceExpression(arg)) {
        const p = ensureListPosition(path);
        const exprs = arg.expressions;
        p.replaceWithMultiple([...exprs.slice(0, -1).map((e) => t.expressionStatement(e)), t.returnStatement(exprs[exprs.length - 1])]);
        changed = true;
        return;
      }
      // return void f();  ->  f(); return;
      if (t.isUnaryExpression(arg, { operator: "void" }) && !t.isNumericLiteral(arg.argument)) {
        const p = ensureListPosition(path);
        p.replaceWithMultiple([...exprToStatements(arg.argument), t.returnStatement()]);
        changed = true;
        return;
      }
      // return a ? (x, y) : z  where a branch is a sequence  ->  if/else with returns
      if (t.isConditionalExpression(arg) && (t.isSequenceExpression(arg.consequent) || t.isSequenceExpression(arg.alternate))) {
        path.replaceWith(t.ifStatement(arg.test, toBlock([t.returnStatement(arg.consequent)]), toBlock([t.returnStatement(arg.alternate)])));
        changed = true;
      }
    },
    ThrowStatement(path) {
      const arg = path.node.argument;
      if (t.isSequenceExpression(arg)) {
        const p = ensureListPosition(path);
        const exprs = arg.expressions;
        p.replaceWithMultiple([...exprs.slice(0, -1).map((e) => t.expressionStatement(e)), t.throwStatement(exprs[exprs.length - 1])]);
        changed = true;
      }
    },
    // if ((a, b)) ...  ->  a; if (b) ...
    IfStatement(path) {
      const { node } = path;
      if (t.isSequenceExpression(node.test)) {
        const p = ensureListPosition(path);
        const exprs = node.test.expressions;
        p.replaceWithMultiple([...exprs.slice(0, -1).map((e) => t.expressionStatement(e)), t.ifStatement(exprs[exprs.length - 1], node.consequent, node.alternate)]);
        changed = true;
        return;
      }
      if (!t.isBlockStatement(node.consequent)) {
        node.consequent = toBlock([node.consequent]);
        changed = true;
      }
      if (node.alternate && !t.isBlockStatement(node.alternate) && !t.isIfStatement(node.alternate)) {
        node.alternate = toBlock([node.alternate]);
        changed = true;
      }
      // else { if (x) … }  ->  else if (x) …   (block holds nothing else, so no scoping change)
      if (t.isBlockStatement(node.alternate) && node.alternate.body.length === 1 && t.isIfStatement(node.alternate.body[0])) {
        node.alternate = node.alternate.body[0];
        changed = true;
      }
    },
    // x => (a, b)  ->  x => { a; return b; }
    ArrowFunctionExpression(path) {
      const { node } = path;
      if (t.isSequenceExpression(node.body)) {
        const exprs = node.body.expressions;
        node.body = toBlock([...exprs.slice(0, -1).map((e) => t.expressionStatement(e)), t.returnStatement(exprs[exprs.length - 1])]);
        changed = true;
      }
    },
    "ForStatement|WhileStatement|DoWhileStatement|ForInStatement|ForOfStatement"(path) {
      if (!t.isBlockStatement(path.node.body)) {
        path.node.body = toBlock([path.node.body]);
        changed = true;
      }
    },
  });
}

// ── Scope-aware renames ─────────────────────────────────────────────────────────────────────────
// Map format: { "<scopeFunctionName>": { "oldName": "newName", ... } }. "<scopeFunctionName>" is the
// name of the variable/function that owns the scope (e.g. "_tc"), so short names like `t` that are
// reused everywhere are only renamed where intended.
if (mapFile) {
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  const used = new Set();
  traverse(ast, {
    "FunctionExpression|FunctionDeclaration|ArrowFunctionExpression"(path) {
      let owner = null;
      if (path.node.id) owner = path.node.id.name;
      else if (path.parentPath.isVariableDeclarator() && t.isIdentifier(path.parentPath.node.id)) owner = path.parentPath.node.id.name;
      const renames = owner && map[owner];
      if (!renames) return;
      for (const [from, to] of Object.entries(renames)) {
        if (from.startsWith("//")) continue;
        const binding = path.scope.getOwnBinding(from);
        if (!binding) continue;
        if (path.scope.hasBinding(to) && path.scope.getBinding(to) !== binding) {
          throw new Error(`rename ${owner}.${from} -> ${to} collides with an existing binding`);
        }
        path.scope.rename(from, to);
        used.add(`${owner}.${from}`);
      }
    },
  });
  const missing = Object.entries(map).flatMap(([o, r]) => Object.keys(r).filter((k) => !k.startsWith("//")).map((k) => `${o}.${k}`)).filter((k) => !used.has(k));
  if (missing.length) console.warn(`warning: ${missing.length} rename entries had no binding: ${missing.join(", ")}`);
}

const out = generate(ast, { comments: true, jsescOption: { minimal: true } }).code;
const pretty = await prettier.format(out, { parser: "babel", printWidth: 110 });
fs.writeFileSync(outFile, pretty);
console.log(`wrote ${outFile} (${pretty.split("\n").length} lines, ${passes} passes)`);
