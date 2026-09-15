# QXTradeLens Controller v1.19.0: Analysis

Date: 2026-09-15. Based on a full read of the source and a live check on `qxbroker.com/en/demo-trade`.

## 1. What the extension does

### Top panel (content.js, closed shadow DOM)
| Feature | How it works |
|---|---|
| **TP (take profit)** | Daily target. Can be pulled from the Google Sheet (`TP …` column for today) or typed and locked for the day (IST day) |
| **SL (stop loss)** | Forced setup modal on first load each day (blocks all page clicks until set). Default SL is 85% of balance. A trailing SL ratchets up: 20% under the peak, or after TP is reached, `post-TP gap` % (1–15, default 5) under the peak and never below TP |
| **SL breach** | When balance ≤ SL with no open trades: fires `__tcSLBreach`, locks the native "Set limit" button for the day, and (if the system lock is enabled) asks the service worker to lock the site for 6 h |
| **Payout guard** | If payout % is below the minimum (default 89%), shows the "Payout too low" overlay and disables Up/Down |
| **Max open trades** | 1–4 (default 2). Extra trade clicks are blocked |
| **Double-click guard** | Ignores a second trade click within 1.5 s unless "multi" mode is on |
| **Investment vs SL guard** | Blocks a trade if balance − investment ≤ SL (**currently broken**, see §2) |
| **REQ** | Winning trades needed to reach TP at the current stake and payout (compound formula) |
| **RISK** | Stake as a % of balance, colored green / amber / red at 2% and 5% |
| **Today P/L %** | From the sheet row for today |
| **Goal** | Days and trades to target, from the sheet |
| **Equity sparkline** | Last 30 balance+open-P/L values |
| **Win/loss projection row** | "↑ win / ↓ loss" balances placed above the Up/Down buttons |
| **Entry balance tags** | Adds "Entry ₹X" to each row in trade history |
| **Tab title** | 🟢/🔴 plus the nearest expiry countdown in the browser tab title |
| **Sounds** | Tones when open trades turn winning or losing |
| **Edge flash** | Screen-edge flash when payout % changes |

### Floating widgets
- **Trade timer chips** on the chart show a countdown per open trade plus projected balance. They follow the cursor, stay centered, or stay anchored.
- **Investment multiplier** (×1.3 / ×1.5 / ÷) rewrites the stake input.
- **MTF mini charts** (up to 4 timeframes) are built from Quotex's own candle store through `chart_reader.js`. They can be panned, resized, and synced.
- **Mobile bar** (≤ 640 px) has timeframe, expiry, stake multiplier and minimum-payout quick buttons.
- **Marquee** shows a scrolling motivational message.
- **Journal modal** shows a Google Sheet table with editable WDL/Deposit/Notes cells (Apps Script `update_row`).

### Keyboard shortcuts (when not typing in an input)
| Key | Action |
|---|---|
| `↑` / `↓` | **Place Up / Down trade** (opt-in in popup) |
| `←` / `→` | Stake −/+ (or ÷/× factor) (opt-in) |
| `S` / `D` | Previous / next chart timeframe |
| `F` / `Shift+F` / `G` | Next / previous pair tab |
| `R` | Rebuild OTC tabs: open the highest-payout OTC pairs (≥ min payout), close the rest |
| `Q` | Close all tabs below the minimum payout |
| `T` | Toggle expiry mode (timer/time) and set 5 s |
| `X` / `V` | Mark the pair as "monitored" / cycle through monitored pairs |
| `C` | Toggle MTF charts |
| `Enter` | Log balance to the sheet |
| `Cmd+↑/↓` | TP step ±. **Mac only**: on Windows this is the Win key |
| Middle-click on a tab | Close tab |

Auto-close also runs every 5 s: tabs with payout below the minimum are closed automatically.

### Service worker
- `Alt+Shift+R` does a dev hot-reload and refreshes open Quotex tabs.
- `QX_FETCH` is a sheet fetch proxy.
- **SYS_LOCK**: a declarativeNetRequest block of `qxbroker.com` (15 min for a 3-loss streak, 6 h for an SL breach). It also posts to a local lock daemon on `127.0.0.1:7343` and closes all Quotex tabs. The lock expires by alarm, and there's no unlock path by design. It's **disabled by default** (popup toggle).

### Popup
Theme, panel/journal font size, section visibility, chip position, SL on/off, post-TP gap, system lock toggle, max trades, hotkey opt-ins, marquee, MTF timeframes and candle count, sheet URL, and a **UPI/PhonePe deposit scanner**. The scanner walks every page of `/en/balance`, sums successful UPI/PhonePe deposits, then returns the tab to its original URL.

### Other behavior to be aware of
- **Account label spoof**: every "Live Account" label is rewritten to "Demo Account" with the academy icon, and the tab title "Live trading" becomes "Demo trading". On a real account the screen *looks* like demo. This is intentional (screen-share masking?), but it's risky if you forget it's on.
- Welcome-bonus / rocket banners are removed.
- A second, unrelated extension, **"QX Assistant v1.4.62"**, is also injecting on the page.

## 2. Bugs found

### Confirmed live
| # | Bug | Impact |
|---|---|---|
| B1 | **Panel toggles off on any in-app URL change.** `_tcLaunch` checks `document.getElementById('__tradeCalc')`, but the panel lives in a *closed shadow root*, so it's never found. `_tc()` then sees `__tcCleanup` and **toggles the panel off**. The next URL change turns it back on. (Reproduced with `history.replaceState`.) | Panel and all guards (SL, payout, trade cap) silently disappear |
| B2 | **Investment selectors dead** (`.GmATb span`, `.EalHv span` = 0 matches). The stake is shown in `<legend>Investment</legend>` + input. | "Trade would breach SL" guard never fires. Projection row stays "—" |
| B3 | `tabClose` (`.LtauB`, `.rGA6o`), `nativeLimitBtn` (`.s3gwg`), `.WRS3E`, timeframe `.Dy2a9/.blYud`, `.esVdy`, `.y8jJs`, `.A7vDd/.Os2ep/.PiYD4` match nothing right now. Some only appear with menus or open trades, so they still need re-checking with a trade open. | Auto-close, `R`/`Q` rebuild, SL native-limit lock, timers and live-payout may be partly broken |

### From code review
| # | Bug | Impact |
|---|---|---|
| B4 | `Cmd+↑/↓` uses `metaKey`, which is Mac-only | Doesn't work on Windows |
| B5 | `content.js` `gi()` walks `__reactFiber$` from the **isolated** world, where those expandos aren't visible. It always returns null, wasting work every 300 ms before the bridge is used | Performance |
| B6 | Heavy polling: a 200 ms interval, a rAF loop while trades are open, a 500 ms settle monitor, a 5 s auto-close, and 3 `MutationObserver`s on `document.body` subtree, plus one on the whole document just to watch the URL. `Ir()` runs `querySelectorAll('button')` 5×/s | CPU and battery on a page that already redraws constantly |
| B7 | Loss-streak detection relies on `.A7vDd`/`.Os2ep` open-trade rows disappearing (currently 0 matches) | 3-loss streak lock may never trigger |
| B8 | The journal renderer hard-codes `₹` and `en-IN`. The day boundary is hard-coded IST (UTC+5:30) | Wrong for non-INR accounts |
| B9 | The deposit scanner only accepts `qxbroker.com/en/balance` | Fails for other site languages |
| B10 | The SL toggle in the popup writes storage but doesn't broadcast | Needs a page reload to apply |
| B11 | Randomized style IDs (`x<rand>1…`) are added to `document.head`, visible to the page | Contradicts the "stealth" goal of `chart_reader.js` |
| B12 | `content_scripts.matches` covers only `qxbroker.com`, not `*.qxbroker.com` (host permissions include it) | Panel missing on subdomains |
| B13 | `README.md` inside the extension describes an old bookmark updater. `bookmarklet.js` (163 KB) is unused | Confusing |
| B14 | The daily SL setup trusts `chrome.storage.sync` over the local backup. On 2026-09-15 (v1.19.0 running), today's SL (14,466) and a recorded breach were in localStorage, but the setup modal reappeared offering a new SL at 85% of the *lower* balance. A possible cause is missing or rate-limited sync writes (`storage.sync` has per-minute and per-hour write quotas, and the trade log also writes to it) | After an SL breach, trading can resume by accepting a lower SL, which defeats the stop loss |

Status: B1, B2 and B4 were fixed in v1.20.1.

### Maintainability
- **There's no real source.** `content.js` and `bookmarklet.js` are minified build output (a single 164 KB line). Comments refer to a `calculator.js`, "part 01/06" and `build-bookmarklet.sh` that aren't in the folder. Git diffs on a one-line file are useless, and every fix means editing minified code.
- About 65 distinct hashed CSS-module classes (`.Zt1hG`, `.ib6yR`, …) are hard-coded in about 90 places, not just in the selector registry.

## 3. Making it dynamic (resilient to Quotex class changes)

Quotex's class names are CSS-module hashes that rotate on each build. Three layers, from most to least stable:

### Layer 1: read data from Quotex's Redux store (no CSS at all)
`chart_reader.js` already reaches `plot.store` through the chart canvas's React fiber. It was verified live that `store.getState()` exposes:

| Needed value | Store path |
|---|---|
| Current pair, payout % | `chartSettings.chartById[id].currentAsset.symbol` → `assets.assetBySymbol[sym].payout` |
| Payout for every pair (for auto-close / OTC rebuild) | `assets.assetBySymbol[*].payout`, `.is_otc`, `.label` |
| Investment (stake) | `chartSettings.chartById[id].dealValue` / `dealPercentValue` |
| Open trades (count, amount, expiry, pair) | `deals.openedById` / `openedIds` |
| Settled trades (win/loss, profit) for loss streak and journal | `deals.closedById` (`profit`, `amount`, `percentProfit`, `closeTimestamp`, `isDemo`) |
| Currency symbol/code, timezone | `global.currency`, `global.currencyCode`, `global.timeZone` |
| Pair tabs | `navigationSymbols.list` |
| Chart period | `chartSettings.chartById[id].chartPeriod` |
| Deposits (replaces the page-walking scanner) | `transactions.list` |

The MAIN-world bridge would add a **read-only** `snapshot` request returning these values as plain JSON, following the existing stealth rules (pull-only, no globals, no patching, no network).

### Layer 2: semantic DOM anchors (for clicking and reading what's not in the store)
Stable hooks seen live: `#trade-button`, `svg.icon-arrow-up-circle` / `icon-arrow-down-circle`, `.deal-amount-input`, `input.input-control__input`, `<legend>` text (`Investment`, `Time`), `#tab-active`, `[data-symbol]` on pair tabs, `#asset-select-dropdown`, `button[aria-label="Close"]`, sprite IDs (`#icon-cross`, `#icon-caret`, `#icon-favorite`), `#graph canvas.layer.plot`, and the text "Demo Account"/"Live Account" with its sibling balance.

### Layer 3: self-healing selector resolver
A single `resolve(name)` registry where each target has an ordered strategy list: store → semantic anchor → text/structure heuristic (e.g. "element whose text matches `₹15,228.00` next to the account label") → last known hashed class. When a heuristic finds the element, the resolver **learns** its current class and caches it in `chrome.storage.local` with the Quotex build hash. A popup **Health panel** shows each target as ✅ / ⚠️ fallback / ❌ missing, so a Quotex update shows up at a glance instead of as silent failures.

## 4. Recommended plan

| Phase | Work | Version |
|---|---|---|
| 0 | Git baseline, versioning, changelog | **v1.19.0** ✅ |
| 1 | Recover a readable source tree with a build step, keeping behavior identical (proved by `npm run verify`) | **v1.20.0** ✅ |
| 2a | Hotfixes B1 panel toggle, B2 investment, B4 take-profit shortcut, plus jsdom tests | **v1.20.1** ✅ |
| 2b | Remaining quick fixes: B10, B12, B13, B14 | v1.20.x |
| 3 | Store bridge (Layer 1) + selector resolver (Layers 2–3) + Health panel. Migrate every hashed class to it | v1.21.0 |
| 4 | Performance: one scheduler instead of 5 timers and 4 observers, drop dead `gi()` | v1.22.0 |
| 5 | Cleanup: currency/timezone from store, i18n-safe URLs, deposit scanner via store, decide on account-label spoof as an explicit opt-in toggle | v1.23.0 |
