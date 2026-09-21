# QXTradeLens Controller

A Chrome extension (Manifest V3) that adds a trading-discipline panel to the Quotex web platform
(`qxbroker.com`). It shows your targets and risk while you trade, blocks trades that break your own
rules, keeps a journal in Google Sheets, and repairs itself when Quotex changes their site.

It is **read-only towards Quotex**: it never sends anything to the broker, and it only places a trade
if you press a shortcut you switched on yourself.

- Install and daily use: [Quick start](#quick-start)
- Every feature: [The panel](#the-panel) · [On-chart widgets](#on-chart-widgets) · [Shortcuts](#keyboard-shortcuts) · [Popup settings](#popup-settings)
- When Quotex changes something: [Health check and self-repair](#health-check-and-self-repair)
- Version history: [CHANGELOG.md](CHANGELOG.md) · Deeper notes: [docs/ANALYSIS.md](docs/ANALYSIS.md)

## Quick start

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick `qx-calc-updater/qx-calc-updater`.
3. Open a Quotex trade page (`/en/trade` or `/en/demo-trade`). The panel appears along the top.
4. After pulling new changes, press the **reload** icon on the extension card, then refresh the Quotex tab.

The panel runs on the trade pages only, follows you between demo and live, and disappears on other
Quotex pages. Drag it by its left grip; the position is remembered.

## The panel

| Field | Meaning |
|---|---|
| **TP** | Your take-profit target for the day. Type it, or pull today's target from your journal sheet. Locked for the day once set |
| **SL** | Your stop-loss floor for the day. Set once per day, then trails upward as your balance grows |
| **P/L** | Today's profit/loss %, from your journal sheet |
| **PAYOUT** | Minimum payout % you are willing to trade. Trades are blocked below it |
| **MULT** | Multi mode: allows several trades in quick succession (off = one trade per 1.5 s) |
| **REQ** | How many winning trades are still needed to reach TP, at your current stake and payout |
| **RISK** | Your stake as a % of balance — green under 2%, amber to 5%, red above |
| **Goal** | Days and trades to target, from your journal sheet |
| **Sparkline** | Your balance over the last 30 updates, behind the panel |

### What blocks a trade

The Up/Down buttons are disabled, with the reason shown in the panel, when:

- **Payout is below your minimum** — a large "Payout too low" overlay appears.
- **You already have the maximum trades open** (1–4, default 2).
- **A second trade within 1.5 s**, unless MULT is on.

The stop loss never blocks trading (changed in v1.21.0); it is tracked and displayed only.

### Stop loss and take profit

- **Daily setup screen**: once per trading day the panel asks for the day's stop loss. It suggests 85%
  of your balance, and you can type any amount below your balance or pick 70 / 75 / 80 / 85 / 90%.
  Enter confirms.
- **Trailing**: the SL follows your balance upward — normally 20% below the day's peak. If you choose a
  lower SL, that wider gap is kept for the day instead, so your choice sticks.
- **After TP is reached**: the SL tightens to the "post-TP trail gap" (1–15%, default 5%) below the peak,
  and never drops below TP.
- **If the account has no funds**, the screen says so and offers **Close** instead of asking for a number.
- **The trading day** resets at midnight in your Quotex account's timezone.

## On-chart widgets

- **Trade countdown chips** — a countdown per open trade, plus your projected balance. They can follow
  the cursor, sit centred, or stay anchored (popup setting).
- **Win/loss preview** — "↑ win / ↓ loss" balances shown right above the Up/Down buttons.
- **Investment multiplier** — a small box with **×1.5 / 1.5× / ÷1.5**: multiply or divide your trade
  amount, and tap the middle button to switch the factor between 1.3 and 1.5.
- **Multi-timeframe charts** — up to 4 mini candle charts (default 1m, 5m, 15m) drawn from Quotex's own
  candle data. Drag to pan back through older candles, scroll to zoom that chart in or out (kept per timeframe), drag edges to resize, double-click to return to live. The header shows the pair
  and highlights the timeframe your chart is on, and each cell says how many bars it has, with a dashed line and a label at the right edge for the last price. Support and resistance are drawn on each chart (swing levels, strength 3, last three a side) with an S/R
  switch in its header, and an arrow appears in a cell header when that
  timeframe turns, and hovering a bar shows its time, close, high and low in place of the status line — on every chart at once, each marking the bar that holds that moment. Each cell counts down to the close of the bar
  it is drawing, on the chart itself.
  **Click a cell's timeframe label** to put the platform chart on that timeframe. Opening a pair
  **runs that walk for you** — the chart visits each of your timeframes once and comes back (only with the
  tab in front; switch it off in the popup, or set a wait before it starts),
  and the ↻ button does the same on demand. From then on a **rolling 1-minute history**
  per pair keeps the cells current as you trade, and collected candles are kept per pair (last 6) so
  switching pairs does not lose them. Press **C** to show or hide the panel.
- **Entry balance tags** — each row in the trade history is tagged with the balance you had when you
  placed that trade.
- **Tab title** — 🟢/🔴 for winning/losing trades plus the nearest expiry countdown, so you can watch
  from another tab.
- **Marquee** — an optional scrolling reminder across the top of the page.
- **Sounds** — short tones when open trades turn winning or losing.
- **Mobile bar** — on narrow screens, quick controls for timeframe, expiry, stake and minimum payout.

## Keyboard shortcuts

Active on the trade page when you are not typing in a field.

| Key | Action |
|---|---|
| **↑ / ↓** | **Place an Up / Down trade** (off by default; enable in the popup). With **Focus Mode** on, ↑/↓ select the button and your **Enter** places the trade |
| **← / →** | Decrease / increase the trade amount (off by default). With **Focus Mode** on, they select the amount −/+ button and your **Enter** presses it |
| **S / D** | Previous / next chart timeframe |
| **F / Shift+F / G** | Next / previous pair tab |
| **R** | Open the highest-paying OTC pairs (at or above your minimum) and close the rest |
| **Q** | Close every tab paying below your minimum |
| **T** | Switch expiry mode and set a 5 s expiry |
| **X** | Mark the current pair as monitored |
| **V / Shift+V** | Cycle through monitored pairs |
| **C** | Show or hide the multi-timeframe charts |
| **Enter** | Log your balance to the journal sheet |
| **Ctrl+↑ / ↓** (Cmd on macOS) | Step the TP up or down |
| **Middle-click a pair tab** | Close that tab |
| **Alt+Shift+R** | Developer: reload the extension and refresh Quotex tabs |

Tabs paying below your minimum are also closed automatically every 5 s, when Quotex shows a close
button on them.

## Journal and balance log

Point the popup at a Google Apps Script URL (your sheet's web app) and the panel gains:

- **Log button / Enter** — appends today's balance to the sheet.
- **Journal window** — your trading days in a table, with today highlighted. The WDL, Deposit and Notes
  cells are editable in place and save back to the sheet.
- **TP, today's P/L % and Goal** in the panel are read from that sheet.

Amounts use your account's currency and number format.

## Popup settings

| Section | Settings |
|---|---|
| **Display** | Panel scale, journal scale, chip position (cursor / centre / anchored), light–dark theme, show or hide the panel |
| **Risk** | Daily SL setup on/off, post-TP trail gap %, disable system lock, max concurrent trades (1–4) |
| **Hotkeys** | ↑↓ places trades, ←→ changes the trade amount (both off by default), and Hotkey Focus Mode (your Enter does the pressing, so the click comes from the browser) |
| **Sections** | Show or hide the panel's Targets, Protections and Projection groups (the Log group appears once a sheet URL is set) |
| **Marquee** | Message text and scroll speed |
| **Multi-timeframe charts** | Which timeframes (up to 4), how many candles each chart shows, whether a new pair is filled in automatically, and how long a pair must stay on screen first (default 15 s) |
| **Activity log** | Your Google Apps Script URL |
| **Health** | "Check Quotex compatibility" — see below |
| **Deposits** | "Scan Deposits" — see below |

### Loss-streak lock (off by default)

After 3 losing trades in a row, the extension can block `qxbroker.com` for 15 minutes and close your
Quotex tabs. It is disabled by default; turn it on by unticking **Disable System Lock**. There is no
unlock button: it expires on its own.

### Deposit scanner

On the Balance page, **Scan Deposits** walks every page of your transaction history and totals all
**successful deposits of every payment method**, with a per-method breakdown. Totals are kept separate
per currency (for example ₹ and $) and are never converted. Failed deposits and withdrawals are excluded.
It works in any site language, and returns the tab to where it started.

## Health check and self-repair

Quotex's CSS class names change with each of their releases, which is what breaks extensions like this.
Two layers deal with that:

1. **Quotex's own data.** A read-only bridge reads the platform's internal state — current pair and
   payout, every pair's payout, open and closed trades with entry prices, live prices, currency and
   timezone. No CSS involved, so payout %, pair names, open trades, the loss streak, trade countdowns
   and the win/loss markers keep working even if the page markup changes completely.
2. **Self-repairing lookups.** For things that only exist on the page — balance, payout amount, the
   Up/Down buttons, the investment field, the chart, trade rows, the asset list, the timeframe and
   expiry menus — the panel first tries the known class names, then finds the element by what it *is*
   (the account label next to it, the "Payout" text, a pair name beside a countdown, and so on). When
   the fallback works, the element's new class is remembered, so later lookups are fast again.

**Check Quotex compatibility** in the popup reports the current state of each of those:

| Mark | Meaning |
|---|---|
| ✅ | Working directly |
| 🔁 | Working through a fallback — Quotex changed something, but the panel coped |
| ❌ | Missing — that part needs a fix |
| – | Nothing to check right now (no open trades, or the menu is closed) |

If you ever see ❌, send a screenshot of that list; it names exactly what moved.

The list also reports the **charts auto-fill** in plain words (`ready — nothing blank`, `waiting: a
trade is open`, `filled this pair 4m ago`, `switched off in the popup`), and **which build the tab is
running** next to the installed version. If those two differ, the tab was never refreshed after the
extension was reloaded, and it is still running the old code.

## Good to know

- **"Live Account" is displayed as "Demo Account"**, and the tab title says "Demo trading", on every
  account. This is deliberate (screen-sharing cover), so check the balance itself before trading.
- **Your data stays on your machine.** Settings live in Chrome storage and in this site's own storage under
  opaque names; the only outbound traffic is to your own Google Sheet, if you configure one.
- **Footprint on Quotex's page is kept small**: no webfont request, no stylesheet naming their classes, and
  their buttons are never disabled by the panel (blocked trades are stopped before the click reaches them).
  The two cosmetic marks — "Show Live as Demo" and "Entry Balance Tags" — can be switched off in the popup.
  Amount changes are **typed** into Quotex's field through the browser's own editing pipeline, so they look
  like you typing rather than a script writing the value. Trades placed by the ↑/↓ shortcut dispatch a
  scripted click; switch on **Hotkey Focus Mode** and your Enter does the pressing — for the trade buttons
  and for the amount −/+ — leaving nothing scripted about it.
- **Trades are only placed by you** — by clicking Quotex's buttons, or by the ↑/↓ shortcut if you
  enabled it.

## Project layout

| Path | What it is |
|---|---|
| `src/content.js` | **Source** of the main panel. Edit this, not the built file |
| `tools/` | `build.mjs` (build), `verify-equivalence.mjs` (proof check), `unminify.mjs` + `rename-map.json` (one-off source recovery) |
| `tests/` | jsdom behavior specs plus a fixture copied from the live Quotex DOM. `helpers.mjs` holds the shared harness; the specs are split by area (`panel`, `platform`, `mtf`, `mtf-fill`, `chips`, `privacy`, `popup`) so Node can run them in parallel |
| `qx-calc-updater/qx-calc-updater/` | The unpacked extension (load this folder in `chrome://extensions`) |
| `…/manifest.json` | Extension manifest. `version` is the source of truth for releases |
| `…/content.js` | Main panel, **generated** by `npm run build` from `src/content.js` (committed so the folder loads without building) |
| `…/chart_reader.js` | Read-only bridge to Quotex's chart and internal state |
| `…/service_worker.js` | Background: dev reload, sheet fetch proxy, loss-streak lock |
| `…/popup.html`, `popup.js` | Toolbar popup: settings, health check, deposit scanner |
| `CLAUDE.md` | Working notes: the rules a change is judged against, what cannot be verified from outside the browser, and how to pick the work up cold |
| `docs/ANALYSIS.md` | Capability map, known bugs and the refactor plan |
| `CHANGELOG.md` | Version history |

### How it runs

The panel runs in the extension's own sandbox, so it can read and change the page but cannot see
Quotex's JavaScript. `chart_reader.js` runs in the page itself purely to read data and answer the
panel's questions: pull-only, no globals, no patching of built-ins, no network calls.

## Development

```bash
npm install
```

- `npm run build` rebuilds `content.js` from `src/content.js` (minified).
- `npm run build:dev` builds an unminified `content.js`, which is easier to debug in DevTools.
- `npm test` runs the jsdom behavior specs (about 90 s; they are almost entirely waiting on the panel’s
  timers, and Node runs the files in parallel). A single area is quicker: `node --test tests/mtf.test.mjs`,
  or one test by name with `--test-name-pattern`. `CONTENT_JS=path npm test` runs them against another build,
  which is how each fix is shown to fail on the previous version and pass on the new one.
- `npm run verify` checks that a build is the same program as the v1.19.0 release. Useful for refactors
  that should not change behavior; once a fix lands, a difference is expected.

Other extension files (`popup.*`, `service_worker.js`, `chart_reader.js`, `manifest.json`) are plain
source and are edited in place.

## Release workflow

1. Make the change in `src/` (or the plain files), run `npm run build`, and update `CHANGELOG.md`.
2. Bump `version` in `manifest.json` (patch for fixes, minor for features, major for breaking changes).
3. Commit, tag, and push:

   ```bash
   git commit -am "feat: short description"
   git tag v1.25.1
   git push origin main --tags
   ```
