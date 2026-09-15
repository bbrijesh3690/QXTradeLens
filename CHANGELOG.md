# Changelog

All notable changes to QXTradeLens Controller are recorded here.
Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
The version in `qx-calc-updater/qx-calc-updater/manifest.json` must match the latest entry,
and every release is tagged in git as `vX.Y.Z`.

## [1.24.4] - 2026-09-15

### Fixed
- **Asset selection panel flickered when a pair's payout fell below the minimum.** Auto-close tries to close
  low-payout tabs, but on the current Quotex build tabs have no close button, only a dropdown caret. The
  close-button lookup fell back to guessing (any child whose HTML contained "close", or even just the letter
  "x", such as `xmlns`), matched the tab's own content block, and clicked it every 300 ms and again every 5 s,
  opening the asset panel each time (confirmed live).
  - The lookup now only accepts real close controls: the known close classes, a close/cross icon, or an
    `aria-label` "Close" button. It never clicks the tab itself or a block holding the dropdown caret.
  - Auto-close, and the tab closing in the `R` hotkey, stop when a click didn't close a tab, instead of retrying.
  - Low-payout tabs that do have a close button are still closed.

## [1.24.3] - 2026-09-15

### Fixed
- **Deposit totals no longer mix currencies.** Live data shows Binance Pay deposits in USD ($) while UPI,
  PhonePe and GPay are in INR (₹). v1.24.2 added them all under one symbol. The scanner now shows one
  total per currency (e.g. "₹6,89,030.00 + $4,660.00"), and the per-method breakdown and deposit list
  each keep their own currency. Currencies aren't converted. ₹ amounts use Indian digit grouping.

## [1.24.2] - 2026-09-15

### Changed
- **Deposit scanner counts every successful deposit, of any payment method** (GPay, Binance, cards, …; it
  was UPI and PhonePe only). The result shows a per-method breakdown (count and total, largest first) under
  the grand total, and each listed deposit shows its method. Failed deposits and withdrawals still don't count.
  The button is now "Scan Deposits".

## [1.24.1] - 2026-09-15

### Fixed
- **Deposit scanner stopped after page 1 with 0 deposits.** Right after the Balance page loads, Quotex's store
  holds an empty placeholder (`page 1, pages 1, [], "init"`), and the scanner took it as an empty last page.
  It now only accepts the store's list once `transactionsStatus` is `"loaded"` for the requested page, waits up
  to 2.5 s for that before falling back to the page, and stops at the store's page count instead of loading
  one extra page.

### Removed
- The welcome-bonus / rocket promo banner remover (not needed).

## [1.24.0] - 2026-09-15

### Changed
- **Daily SL setup screen is editable.** It suggests 85% of the balance; type any amount below the
  balance or pick 70 / 75 / 80 / 85 / 90%. Enter confirms. A lower SL also widens that day's trailing
  distance, so the trailing SL no longer pulls it straight back up to 80% of the balance. The default 85%
  trails exactly as before.
- **Trading day follows the Quotex account timezone** (`global.timeZone`), cached for when the store isn't
  ready yet. IST is the fallback. Nothing changes for a UTC+5:30 account.
- **Journal amounts use the account currency** and its number format (were always ₹ / en-IN).
- **Deposit scanner works in any site language** (`/hi/balance`, `/pt-br/balance`, subdomains). It reads
  each page's transactions from Quotex's store (`orderState`, `is_deposit`, `method`), with the old page
  scraping as fallback, and says which source it used. It still counts successful UPI and PhonePe deposits
  only.
- **Non-English Quotex:** the balance and payout-amount lookups fall back to page layout instead of the
  English labels.
- **Less visible to the page (B11).**
  - The `--tc-*` design tokens moved from a `:root` block in the page `<head>` into the panel's shadow root.
    The two chart chips outside it get the tokens inline.
  - The remaining `<head>` styles (font import, Quotex tweaks) no longer carry ids or `--tc-*` references,
    and cleanup removes them.

### Fixed
- The SL setup screen's page blocker checks the whole event path, so clicks inside the form work in open
  and closed shadow roots alike. Page clicks are still blocked while it's open.

### Tests
- Added `tests/popup.test.mjs` for the deposit scanner helpers. 44 tests in total.

## [1.23.0] - 2026-09-15

### Performance (no change to what the panel does)
- **One scheduler** (100 ms tick) runs all periodic work, replacing three `setInterval`s. Visual-only work
  (live balance tag, REQ, trade-timer chips, MTF charts, mobile bar) is skipped while the tab is in the
  background; the tab-title countdown keeps updating.
- **One `MutationObserver`** instead of three, each of which watched every DOM change under `<body>`
  (account-label spoof, recalc scheduling, history "Entry balance" tags).
- **The launcher polls the URL** every 250 ms (plus `popstate`) instead of observing every DOM mutation on
  the whole document.
- **Trade-timer chips redraw at ~20 fps** instead of on every animation frame.
- **Removed `readChartDirect()` (B5).** It tried to read React internals from the isolated world, where they're
  invisible, so it always failed before the bridge was used.

## [1.22.0] - 2026-09-15

### Added
- **Quotex store bridge.** `chart_reader.js` answers a read-only `state` request with values from Quotex's
  own Redux store: current asset and payout, all asset payouts and labels, open and closed deals, currency
  and pair tabs. The stealth rules still apply: pull-only, no globals, no writes, no network.
- **Self-repairing element lookup.** Each key element has a semantic finder: the account label, the
  "Payout" text, `#trade-button`, the Investment `<legend>`, `#graph` and the active tab. When the hashed
  classes fail and the finder succeeds, the element's current class is learned and stored, so later
  lookups stay fast.
- **Health check in the popup.** "Check Quotex compatibility" lists what the panel can read on the open
  trade tab and how: ✅ direct · 🔁 fallback (Quotex changed something) · ❌ missing.

### Changed
- Payout % and pair-tab names/payouts fall back to the store when the page elements are missing. Pair tabs
  are also found through `data-symbol`.
- The max-open-trades cap counts the higher of store and page open trades.
- Currency comes from the store.
- **Loss streak works again (B7).** It counts newly closed deals from the store, because the page rows it
  watched no longer exist. The 3-loss system lock still only applies if you switch the system lock on (off
  by default).

If the store can't be reached, every read falls back to the page, which is the v1.21.1 behavior.

## [1.21.1] - 2026-09-15

### Fixed
- **Daily SL setup no longer reappears when today's SL is saved (B14).** It trusted synced storage only.
  It now uses today's SL from sync or the local backup (the higher one if both), and repairs sync when
  sync had lost it.
- **The popup's "Daily SL Setup" switch applies immediately (B10).** Switching off hides the SL, stops
  trailing and closes an open setup screen. Switching on restores today's SL or shows setup. Before, both
  needed a page reload.
- **Panel runs on Quotex subdomains (B12).** Content scripts now also match `*.qxbroker.com`.

### Removed
- `bookmarklet.js`, an unused 163 KB legacy build (B13, still in git history). Replaced the stale extension
  folder README.

## [1.21.0] - 2026-09-15

### Changed
- **The stop loss no longer blocks trading.** SL is still set, trailed and shown, but it is informational only.
  - Removed the "Trade would breach stop loss" block. After a breach it disabled Up/Down permanently, and the
    trailing SL moved any newly set SL back above the balance, so even reloading and setting a new SL didn't help.
  - Removed the SL-breach lock on Quotex's "Set limit" button, including the 200 ms button scan. A lock date saved
    by an older version is cleared on load.
  - Removed the SL-breach system lock (6 h site block + closing Quotex tabs). The service worker ignores SL-mode
    lock requests.
- Blocking that remains: payout below minimum, max open trades, and the opt-in 3-loss streak lock (off by default).
- Popup: the "Disable System Lock" tooltip now says it only applies to the loss streak.

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
