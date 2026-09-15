# Changelog

All notable changes to QXTradeLens Controller are recorded here.
Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
The version in `qx-calc-updater/qx-calc-updater/manifest.json` must match the latest entry,
and every release is tagged in git as `vX.Y.Z`.

## [1.20.0] - 2026-09-15

### Source recovery (no behavior change)
- Recovered readable source `src/content.js` (about 6,900 lines) from the minified build. It uses only
  semantics-preserving AST rewrites (`tools/unminify.mjs`) plus scope-aware renames of about 470
  identifiers (`tools/rename-map.json`), with section banners and a file header.
- Added a build step: `npm run build` generates `qx-calc-updater/qx-calc-updater/content.js` with
  whitespace and identifier minification only.
- Added `npm run verify` (`tools/verify-equivalence.mjs`). It proves the build is the same program as the
  v1.19.0 release, and negative tests showed it catches a one-character logic change and a swapped
  statement pair.
- Added `package.json` dev tooling and `.gitattributes` (LF line endings).

## [1.19.0] - 2026-09-15

### Baseline
- First commit of the extension exactly as installed in Chrome (no code changes).
- Added `.gitignore`, `CHANGELOG.md`, root `README.md`, and `docs/ANALYSIS.md`.
