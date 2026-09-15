# QXTradeLens Controller

A Chrome (Manifest V3) extension that adds a trading-discipline panel to the Quotex web platform
(`qxbroker.com`): take-profit/stop-loss tracking, payout guard, max-open-trade cap, loss-streak lock,
trade timers, multi-timeframe mini charts, a Google Sheets journal and keyboard shortcuts.

## Layout

| Path | What it is |
|---|---|
| `qx-calc-updater/qx-calc-updater/` | The unpacked extension (load this folder in `chrome://extensions`) |
| `…/manifest.json` | Extension manifest. `version` is the source of truth for releases |
| `…/content.js` | Main panel (isolated world, minified build) |
| `…/chart_reader.js` | Read-only MAIN-world bridge to Quotex's chart/Redux store |
| `…/service_worker.js` | Background: dev reload, sheet fetch proxy, system lock (network block) |
| `…/popup.html`, `popup.js` | Toolbar popup: settings and the deposit scanner |
| `…/bookmarklet.js` | Legacy bookmarklet build, not used by the extension |
| `docs/ANALYSIS.md` | Capability map, known bugs and the refactor plan |
| `CHANGELOG.md` | Version history |

## Install (developer mode)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick `qx-calc-updater/qx-calc-updater`.
3. After pulling changes, click the reload icon on the extension card (or press `Alt+Shift+R`).

## Release workflow

1. Make the change and update `CHANGELOG.md`.
2. Bump `version` in `manifest.json` (patch for fixes, minor for features, major for breaking changes).
3. Commit, tag, and push:

   ```bash
   git commit -am "feat: short description"
   git tag v1.20.0
   git push origin main --tags
   ```
