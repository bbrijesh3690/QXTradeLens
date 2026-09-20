// Builds the extension's content script from the readable source.
//
//   npm run build        -> minified   qx-calc-updater/qx-calc-updater/content.js
//   npm run build:dev    -> unminified (easier to debug in DevTools)
//   node tools/build.mjs --out <file>   -> write somewhere else (used by verify)
//
// Also keeps package.json's version in sync with manifest.json, which is the release source of truth.
import fs from "node:fs";
import * as esbuild from "esbuild";

const args = process.argv.slice(2);
const dev = args.includes("--dev");
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : "qx-calc-updater/qx-calc-updater/content.js";

const manifest = JSON.parse(fs.readFileSync("qx-calc-updater/qx-calc-updater/manifest.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (pkg.version !== manifest.version) {
  pkg.version = manifest.version;
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
}

// The running script says which build it is, so a tab that was never refreshed after an extension
// reload can be told apart from a fix that did not work.
const source = fs
  .readFileSync("src/content.js", "utf8")
  .replace("__TC_BUILD_VERSION__", manifest.version);
const result = await esbuild.transform(source, {
  loader: "js",
  // Whitespace + identifier minification only. Syntax minification is off on purpose: it rewrites
  // expressions (e.g. `x == null ? a : x` -> `x ?? a`), so the shipped code would no longer be the
  // literal source and couldn't be checked by tools/verify-equivalence.mjs.
  minifyWhitespace: !dev,
  minifyIdentifiers: !dev,
  minifySyntax: false,
  charset: "utf8",
  target: "chrome110",
  // Keep `catch (e) {}` as written so builds stay directly comparable with tools/verify-equivalence.mjs.
  supported: { "optional-catch-binding": false },
  banner: `/* QXTradeLens Controller v${manifest.version} - GENERATED from src/content.js by tools/build.mjs. Do not edit. */`,
});
fs.writeFileSync(outFile, result.code);
console.log(`built ${outFile} (${dev ? "dev" : "minified"}, ${(result.code.length / 1024).toFixed(1)} KB, v${manifest.version})`);
