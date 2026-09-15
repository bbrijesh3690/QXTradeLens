# Changelog

All notable changes to QXTradeLens Controller are recorded here.
Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
The version in `qx-calc-updater/qx-calc-updater/manifest.json` must match the latest entry,
and every release is tagged in git as `vX.Y.Z`.

## [1.20.1] - 2026-09-15

### Fixed
- **Panel no longer switches itself off on in-app navigation (B1).** The launcher checked for
  `#__tradeCalc` in the document, but the panel lives in a closed shadow root, so every URL change
  toggled the panel (and its SL / payout / trade-cap guards) off, then on again at the next change.
  - Changing the asset query or switching demo ↔ live now keeps the panel.
  - Arriving at a trade page from another Quotex page now starts it. Before, the script quit if the
    first page loaded wasn't a trade page.
  - Leaving the trade pages now removes the panel. Before, it stayed over pages like `/en/balance`.
  - Turning the panel off from the popup now sticks across navigation.
  - A restarted panel no longer leaves the old instance's popup message listener behind, which could
    answer `GET_STATE` with stale settings.
- **Stake is read again (B2).** Quotex removed the separate investment label, which silently disabled
  the "trade would breach stop loss" guard and the ↑win / ↓loss projection. The stake is now read from
  the Investment field (`.deal-amount-input`, falling back to the `<legend>Investment</legend>`
  fieldset, never the Time field). Percent stakes are converted using the balance.
- **Take-profit step shortcut works on Windows (B4).** Ctrl+↑/↓ now works alongside Cmd+↑/↓ on
  macOS. It also stepped from the wrong value on every platform: `"20,000.00"` was read as 20, so
  Cmd+↑ produced 1,020 instead of 21,000.

### Added
- `npm test`: jsdom behavior tests (`tests/`) against a fixture copied from the live Quotex DOM.
  All 11 bug tests fail on v1.19.0 and pass on v1.20.1.

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
