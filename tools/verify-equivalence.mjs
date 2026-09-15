// Proves two JavaScript files are the same program at the syntax level. Both are run through the
// same Terser compress+mangle pass, which normalizes whitespace, local identifier names, `if` vs
// `&&`, `true` vs `!0`, statement sequencing, etc. Identical output means identical program.
// Negative-tested: a `<` -> `<=` change and a swapped pair of statements are both reported.
//
// Usage: node tools/verify-equivalence.mjs [a.js] [b.js]
// Defaults: content.js at git tag v1.19.0 (the original build) vs. a fresh build of src/content.js.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { minify } from "terser";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";

const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

const OPTIONS = {
  compress: {
    passes: 2,
    unused: false,
    dead_code: false,
    reduce_vars: false,
    collapse_vars: false,
    inline: false,
    hoist_funs: false,
    hoist_vars: false,
    evaluate: false,
  },
  mangle: true,
  format: { comments: false },
};

// Printers pick different quote styles for the same string (`"a\"b"` vs `` `a"b` ``), so untagged
// template literals without `${}` are turned into plain string literals of the same cooked value.
function normalizeStrings(code) {
  const ast = parse(code, { sourceType: "script" });
  traverse(ast, {
    TemplateLiteral(p) {
      if (p.node.expressions.length === 0 && !p.parentPath.isTaggedTemplateExpression()) {
        p.replaceWith(t.stringLiteral(p.node.quasis[0].value.cooked));
      }
    },
  });
  return generate(ast, { comments: false }).code;
}

const fingerprint = async (file) => (await minify(normalizeStrings(fs.readFileSync(file, "utf8")), OPTIONS)).code;

let [a, b] = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qxtl-verify-"));
if (!a) {
  a = path.join(tmp, "v1.19.0-content.js");
  fs.writeFileSync(a, execFileSync("git", ["show", "v1.19.0:qx-calc-updater/qx-calc-updater/content.js"]));
}
if (!b) {
  b = path.join(tmp, "rebuilt-content.js");
  execFileSync(process.execPath, ["tools/build.mjs", "--out", b], { stdio: "inherit" });
}

const [fa, fb] = await Promise.all([fingerprint(a), fingerprint(b)]);
if (fa === fb) {
  console.log(`EQUIVALENT: ${path.basename(a)} == ${path.basename(b)} (${fa.length} bytes normalized)`);
  process.exit(0);
}
let i = 0;
while (i < fa.length && fa[i] === fb[i]) i++;
console.error(`DIFFERENT at normalized offset ${i}:`);
console.error("  a: …" + fa.slice(Math.max(0, i - 160), i + 160));
console.error("  b: …" + fb.slice(Math.max(0, i - 160), i + 160));
process.exit(1);
