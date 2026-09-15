# QXTradeLens Controller

A Chrome (Manifest V3) extension that adds a trading-discipline panel to the Quotex web platform
(`qxbroker.com`): take-profit/stop-loss tracking, payout guard, max-open-trade cap, loss-streak lock,
trade timers, multi-timeframe mini charts, a Google Sheets journal and keyboard shortcuts.

## Layout

| Path | What it is |
|---|---|
| `src/content.js` | **Source** of the main panel. Edit this, not the built file |
| `tools/` | `build.mjs` (build), `verify-equivalence.mjs` (proof check), `unminify.mjs` + `rename-map.json` (one-off source recovery) |
| `qx-calc-updater/qx-calc-updater/` | The unpacked extension (load this folder in `chrome://extensions`) |
| `…/manifest.json` | Extension manifest. `version` is the source of truth for releases |
| `…/content.js` | Main panel, **generated** by `npm run build` from `src/content.js` (committed so the folder loads without building) |
| `…/chart_reader.js` | Read-only MAIN-world bridge to Quotex's chart/Redux store |
| `…/service_worker.js` | Background: dev reload, sheet fetch proxy, system lock (network block) |
| `…/popup.html`, `popup.js` | Toolbar popup: settings and the deposit scanner |
| `docs/ANALYSIS.md` | Capability map, known bugs and the refactor plan |
| `CHANGELOG.md` | Version history |

## Install (developer mode)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick `qx-calc-updater/qx-calc-updater`.
3. After pulling changes, click the reload icon on the extension card (or press `Alt+Shift+R`).

## Development

```bash
npm install
```

- `npm run build` rebuilds `content.js` from `src/content.js` (minified).
- `npm run build:dev` builds an unminified `content.js`, which is easier to debug in DevTools.
- `npm test` runs behavior tests in jsdom against `tests/fixtures/trade-page.html`, a copy of the
  live Quotex DOM. `CONTENT_JS=path npm test` tests a different build.
- `npm run verify` checks that the build is the same program as v1.19.0. It's only meaningful for
  refactors that shouldn't change behavior; once a fix lands, a difference is expected.

Other extension files (`popup.*`, `service_worker.js`, `chart_reader.js`, `manifest.json`) are
plain source and are edited in place.

## Release workflow

1. Make the change in `src/` (or the plain files), run `npm run build`, and update `CHANGELOG.md`.
2. Bump `version` in `manifest.json` (patch for fixes, minor for features, major for breaking changes).
3. Commit, tag, and push:

   ```bash
   git commit -am "feat: short description"
   git tag v1.20.0
   git push origin main --tags
   ```
