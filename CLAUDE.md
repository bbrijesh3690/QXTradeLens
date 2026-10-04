# QXTradeLens — working notes

Read this first. It is written so a session starting cold can be useful within a minute, without
replaying the conversation that produced the code.

## What this is

A Chrome MV3 extension that adds a trading-discipline panel to `qxbroker.com`. It shows targets,
risk and multi-timeframe charts while you trade, and repairs itself when Quotex renames their CSS.

`src/content.js` is the source of the panel (~8,000 lines, one IIFE). Everything else is small:
`chart_reader.js` (MAIN-world read-only bridge), `service_worker.js` (toolbar-icon show / hide, start-up
clean-up) + `deposit_scan.js` (the deposit scan). **There is no popup** since v1.70.0: every setting is on
the bar or in its ⚙ menu.

## The thumb rule

Every change is judged against three words, in this order:

1. **Dynamic** — no value that only works for one asset, one timeframe or one Quotex build. Read it
   from the data. Decimals come from the prices seen; the level-merge tolerance comes from the
   candles' own ranges; the trade-cap comes from the platform's state, not from a class name.
2. **Privacy** — the page should not be able to tell the panel is there. No stylesheet naming their
   classes, no webfont request, no `__tradeCalc_*` keys in page storage (they are hashed), no
   scripted click where a real one will do. `Hotkey Focus Mode` exists so the browser produces the
   click; the amount is typed through the browser's editing pipeline so the `input` event is trusted.
3. **Self-repair** — a lookup tries the known class, then finds the element by what it *is* (the
   label beside it, a pair name next to a countdown), then remembers the new class.

## Hard rules

- **Read-only towards Quotex.** Never call their internals, never patch a prototype, never write to
  their store. `chart_reader.js` carries the full contract at the top of the file — read it before
  touching anything in the page's own world.
- **No network at all.** v1.65.0 removed the Google Sheet journal and the local lock daemon on 127.0.0.1;
  v1.65.2 removed the popup's Google Fonts, and v1.70.0 the popup itself. No shipped file makes a request
  or names a site other than Quotex, and `tests/extension.test.mjs` fails if one ever does.
- **Nothing trades by itself.** A trade happens because the user clicked, or pressed a hotkey they
  enabled.
- **The panel's own elements are invisible to its finders** (`isOurElement`), or a semantic lookup
  reads our UI as the platform's.

## What cannot be verified from outside the browser

This matters more than it sounds, and has caused wrong conclusions before:

- The panel lives in a **closed shadow root**, so page-world script cannot see it.
- An **automated tab reports `document.hidden: true`**, so the render loop is paused there and the
  charts never draw. A screenshot of an automated tab shows empty cells; that is not a bug.
- **Quotex ships closed web components now.** Their account block is `<qx-usermenu-trigger>`, whose
  shadow root is **closed** — `el.shadowRoot` is null, `querySelectorAll` and XPath both stop at the
  boundary, and the balance is not in the document at all. No selector, no text scan and no semantic
  finder can ever reach it; only the store can (v1.57.0). Expect more of the page to go this way. When a
  lookup suddenly finds nothing, check for a custom element before hunting for a renamed class:
  `document.querySelectorAll("*")` filtered on `tagName.includes("-")` names them in one line.
  `deepQueryAll` crosses **open** roots, which is all that can be done from outside.
- Quotex's chart is **one WebGL canvas**. Its vertical scale is view state it keeps to itself —
  measured against its own axis, the visible span is *not* `maxValue - minValue`. A price cannot be
  mapped to a pixel on their chart without calling obfuscated internals. Do not try again.
- **A background tab is not the page the panel was written for.** Chrome wakes its timers once a second,
  and after five minutes once a minute, and draws no frames - so Quotex's pair list never finishes appearing
  there: its rows are in the page, but it reads as closed. Nothing that drives Quotex's page runs while
  `document.hidden`: the chart auto-fill, the sweep, and since v1.85.0 auto-close and auto-open (a refill in
  progress ends; a list the panel left open is closed on the way back). The diagnostics line is written only
  in front, so an `at` more than a few seconds old means the tab is in the background, and `assetLog` steps
  exactly 60 s apart happened there. Opening a tab for a live check can itself put the Quotex tab behind.

Three things exist because of this:

- **The diagnostics line** — the foreground tab writes build, pair, chart timeframe, open-trade
  count, what the auto-fill is doing, the payout floor and what each open pair pays, what that
  floor last decided, what the win-projection chip is showing, where the bar is placed (`bar`: in the
  header between "WEB TRADING PLATFORM" and "Alerts" - the bell, labelled "Notifications" - since v1.72.0, or dragged,
  or which word is missing plus what the header does have), and per-chart
  `zoom / have / drawn / pannedTo / atLive` into the site's own storage every 2 s, under the hashed key
  for `__tradeCalc_diag`. Any tab on the
  origin can read it back. This is how a live problem gets diagnosed in one round trip. `assetLog` on it is
  the last twelve steps with the pair list, each with how long ago: every auto-close, and for a refill the
  close that started it (v1.85.0).
- **The health check** (panel ⚙ menu → Quotex compatibility → Check; it was in the popup until v1.69.0) reports every
  lookup as ok / fallback / missing, and says when the tab is running an old copy — an extension reload does
  not update an open tab, and that mismatch looks exactly like "the fix did nothing". It spots it by
  `chrome.runtime.id` going away, which is what a reload does to the old script's context.
- **Geometry tests** — the jsdom canvas stub records `moveTo/lineTo/fillText/fillRect` coordinates,
  so a spec can assert *where* something was drawn, not just that it was.

## Working rules that have paid off

- **Trust the platform's data over its markup.** Every phantom this project has had came from
  reading the DOM first: settled deal rows counted as open, a block holding the session clock read
  as a trade countdown (twice — the chips in v1.34.0 and the tab title in v1.50.0). If the store can
  answer, it decides; markup is the fallback.
- **A fix needs a test that fails on the previous build.** `CONTENT_JS=path npm test` runs the specs
  against another build; `git show HEAD:qx-calc-updater/qx-calc-updater/content.js > /tmp/prev.js` is
  the usual way to get one. If the new test passes on the old build, it is not testing the fix.
- **Check the live data before changing logic.** The S/R work churned through several releases
  because presentation was built on assumptions; the pass that fixed it started by running the
  detector over every cached asset and finding it was already correct.
- **A fallback finder runs when the element is simply absent too** (a closed list), and whatever it finds is
  remembered and tried first. v1.77.0 learnt the deposit "+" and an always-visible block that way (v1.80.0). A
  finder must demand what only the real thing has (the list's search box, the "+" nearest the tabs), and a
  remembered name that can be wrong gets an entry in `LEARNED_CHECKS`, or is dropped with `forgetLearned` when
  Quotex's data contradicts it (open-trade rows, v1.84.0). Check uses the same finders, so it heals with them. `tests/scramble.test.mjs` renames the
  whole page at once; a new finder gets a case there - **and so does a feature that only uses finders**: the
  payout floor's close and refill had none until v1.87.0, and stopped dead on that page (a tab's payout was read
  by known names or by `data-symbol` only). Ask "does it repair itself?" of the whole feature, not of each lookup.
- **"None" from Quotex's data is an answer only when the data is there.** With the bridge out of reach or the
  payout field renamed, "nothing above the floor is left" and "I cannot tell" looked the same, and the refill
  ended in silence (v1.87.0). Where the data gives no figure, fall back to what the page prints.
- **Quotex's data is read by name, and by shape only where the data proves itself** (v1.81.0,
  `chart_reader.js`): deal times, deal pair, deal lists. Balance, payouts and amounts are never guessed; a missing
  one shows in ⚙ → Check as "Quotex data fields · missing: …". Read that row before hunting for a renamed field.
- **Say what was not verified.** "Covered by tests, not seen live" is a useful sentence.

## Commands

```bash
npm run build          # src/content.js -> the extension's content.js (minified)
npm run build:dev      # unminified, for DevTools
npm test               # all specs, ~3.5 min (files run in parallel; tests/mtf.test.mjs is the long pole)
node --test tests/mtf.test.mjs                      # one area, ~20 s
node --test --test-name-pattern="v1.49" tests/...   # one change
CONTENT_JS=path npm test                            # against another build
# A new spec file must be added to the "test" script in package.json - it lists the files by name.
```

`tests/helpers.mjs` holds the jsdom harness: a fake Quotex store shaped like theirs, a canvas stub
that records what was drawn, forced-open shadow roots, an opaque-key mirror so specs can read
the panel's settings, a background tab (`backgroundTab`: timers held to a wake-up grid, no frames), and the
pair list as the live page shows it (`floorPage`: rows there at once, the list fading in on a frame, a pick
leaving it open).

## Release

1. Change `src/`, run `npm run build`, add a `CHANGELOG.md` entry that says *why*.
2. Bump `version` in `qx-calc-updater/qx-calc-updater/manifest.json` (the build copies it to
   `package.json` and stamps it into the script).
3. Commit, tag `vX.Y.Z`, push with `--tags`.

The user reloads the extension **and refreshes the Quotex tab** — both are needed, and the health
check will say so if only one happened.

## Open items

- **The win projection on the chart chip** is covered by a test (two open trades, balance plus both
  payouts) but has still never been *seen* on a live page — that needs a trade actually running. Since
  v1.54.0 the chip's own text is in the diagnostics line (`projChip`), so one live trade settles it
  without a screenshot. The formula itself was checked against 7 settled deals on 2026-09-20 and matched
  every one exactly.
- **The scan view is complete across its three tiers** (v1.55.0 board, v1.56.0 sweep). The sweep covers
  pairs that are already **open as tabs** — it does not open new ones, because that is a bigger change to
  the board than collecting candles is, and `R` already stocks the tabs. Extending it to open the top
  payouts itself is the obvious next step if the tab-stocking step becomes the annoying part. Still not
  built: the one-line "best right now" chip on the Charts view.
- **The sweep was watched on the live page on 2026-09-27** (v1.60.0 put `view`, `sweep` and `stale` in the
  diagnostics line so it could be). Two runs, seven open pairs: it selected exactly the pairs that were
  behind, took all of them from `null` or four figures of seconds down to `0`, and returned to the pair it
  started from. A pair that was current on the first run and had gone stale by the second was picked up
  then, which is the behaviour to check if the target list is ever changed. `stale` is the field that
  settles it — `null` means no candles are held, a number means there are and this is the gap, so
  `null → 0` is collection rather than just navigation. Not caught live: the `running · 2 of 4` state. The
  whole walk is about 60 s at ~15 s a pair, which is finer than a read from another tab can reliably land
  inside; it is covered by a spec only.
- **"Show Live as Demo" is now our own Demo Account block drawn over theirs (v1.74.0, the user's choice
  after being shown the options).** Their 2026-09-23 build moved the label into the closed
  `<qx-usermenu-trigger>`, so the text relabel (still there, byte-for-byte as frozen in v1.54.4) finds nothing
  on those pages. v1.58.0/v1.58.1 painted over the block and were reverted in v1.59.0 because the background
  was guessed from the block's parents, all transparent up to a white `<body>`. v1.74.0 guesses nothing: the
  colour behind the block was read with `elementsFromPoint` (the layer that really paints there - `div.app`,
  `#1c1f2d`), and the block's own look was measured from the user's screenshot of their demo block: `#2b3040`,
  4 px corners, cap icon at 12,10, orange `#ff8a00` DEMO ACCOUNT at 10 px bold and the balance at 14 px bold,
  both starting at 43 px so the label lines up with the ₹ sign, arrow 6 px from the right, Roboto. Clicks pass
  through. It is not drawn on the demo page, without a readable live balance, or while their block is taller
  than 60 px (a menu inside it). `demoCover` on the diagnostics line says which. If it ever looks off, compare
  against a fresh screenshot of their block rather than guessing - the side-by-side check (their screenshot
  and ours, enlarged) is how 1.74.0 was matched.
- **The payout floor was watched both ways on the live page on 2026-09-27** (v1.61.0, v1.61.1). Floor raised
  from 90 to 93 with twelve pairs open: ten went, a replacement was opened as the board thinned, and it
  settled at exactly two pairs with `2 pairs at or above 93%` once the 30 s throttle expired - so the
  "top up, do not grow" guard holds. Not observed: the timing. The read caught `opened one 1s ago`, which
  proves the open happened but not that it followed the close immediately rather than a tick and a settle
  window later; that path is covered by specs only.
- **A close refills the board in one visit to the pair list, and nothing happens in the background.** The
  user's rule is "auto-open triggers when auto-close has completed"; they turned down one-for-one (2026-10-01)
  and asked for the refill to pick "the way R does" (2026-10-03). So (v1.62.0 the rule, v1.86.0 the one visit,
  which replaced the two-pair rule above): after a close the list is opened once, every pair in it that the
  platform rates at or above the floor is picked best first, the list is closed, and the refill is over - a
  pair reaching the floor later waits for the next close. Pairs the list is not showing (Litecoin, Silver -
  another category) are all left out for 10 min in that visit, so a close with nothing to open does not bring
  the list up. On the live page a pick no longer closes the list by itself; the panel closes it (`closed at
  try 1`). **Proved live on 1.85.0 with a recorder** (a `storage` listener on the diagnostics key, set in the
  robots.txt tab - a refill scrolls the twelve log steps in seconds, so one read after the return is too
  late): 10 min 46 s in the background with no step logged while two pairs sat at 77% and 88%; both were
  closed in the first second in front. **The one-visit refill was read live on 1.86.0 the same day**, with the
  same recorder: two closes, then "+" once, seven pairs picked in 2.9 s, the list closed 3.9 s after "+";
  nothing for two and a half minutes; then three closes, "+" once, two pairs picked, closed after 1.4 s. On
  1.87.0: five closes on the way back from half an hour away, "+" once, eight pairs in 0.8 s, closed 2 s after
  "+"; fifteen seconds later one more close with nothing left to open, and the list stayed shut. Still
  covered by specs only: a left-over list being closed on the way back. Known limit: a pair the list cannot
  show brings the list up once when it first reaches the floor, and once more every 10 minutes after - with
  nothing in the list to open, that visit picks nothing. Remembering what the list shows, rather than what it
  does not, would end that; offered on 2026-10-03, not built. **Self-repair (v1.87.0):** the close and the
  refill work with every class and id renamed, with the tabs' `data-symbol` gone (payout and name from what the
  tab prints), with the payout field renamed in Quotex's data and with that data out of reach (the refill picks
  by what the list prints) - four cases in `tests/scramble.test.mjs`. Not covered: a tab close button whose
  label and icon name both change. **The chart goes back to the pair it was on (v1.88.0)** - the user: "the
  auto open switched the asset I am on - not good". Quotex puts the chart on a pair the moment it is picked, so
  the refill notes the pair first and presses its tab again after the picks; the chart still passes over the
  picked pairs for that second. Not for the last-tab path (v1.54.0), where the opened pair is where the chart
  is meant to go. Offered, not built: holding Up / Down while the chart is away. **Read live on 1.88.0
  (2026-10-04):** two closes, "+" once, four pairs picked, `auto-open: back on USD/COP (OTC)` 0.2 s after the
  picks, and the list gone 1.8 s after "+" - pressing the tab closes Quotex's list by itself (`closed by
  itself`). The chart was away from its pair for about 1.2 s.
- **The floor is committed on Enter or blur, and nothing acts on the box's contents** (v1.61.1, completed
  in v1.67.1). v1.61.1 fixed only the five-second pass; the recalculation - which runs on page changes, not
  when the box is left - plus both trade-blocking paths, the OTC rebuild, the Q hotkey, the payout cap and the
  mobile bar still read the box until v1.67.1. The only read of the box left is its own save routine, and a
  spec in platform.test.mjs fails if another appears. Read the floor with `getMinPayoutStored()`.
- **Two permissions are kept for one purpose, and can go in a later release** (v1.65.0). The loss-streak
  lock blocked qxbroker.com with a `declarativeNetRequest` dynamic rule and lifted it with an alarm. The rule
  lives inside Chrome, not in the extension, so deleting the code would have left any lock active at the
  moment of updating in place for ever. `service_worker.js` clears rule 9001, the alarm and the stored expiry
  on every start. `declarativeNetRequest` and `alarms` stay in the manifest only so that clean-up can run;
  once it has run everywhere, both - and the clean-up - can be removed.
- **What v1.65.0 removed, so it is not rebuilt by accident:** the Google Sheet journal (journal window, log
  button and Enter-to-log, TP fetch from the sheet, P/L and GOAL fields, the popup's Apps Script URL), the
  TP save button (Enter in the field does the same), the panel's Actions section and its theme button (the
  theme is in the ⚙ menu since v1.69.0), the marquee, the loss-streak lock and the settled-trade tracker that only fed
  it, and the popup's Journal Scale, Post-TP Trail Gap %, Disable System Lock and Candles-per-chart controls.
  Post-TP trailing is fixed at 5%; the SL setup screen and payout overlay are fixed at 20px; a timeframe never
  scrolled still starts at the stored `__tradeCalc_mtf_count`.
  **v1.66.0** took the popup's Section show/hide toggles - every group of the panel is always shown. It also
  took the trade-history "Entry" tags, which was a misread request: the user meant the switch, not the tags.
  **v1.68.0 restored the tags, always on, with no switch.** `__tradeCalc_entry_tags` stays in the clean-up list
  and nothing reads it. The trade log they read from was never removed; `projectedPayout` also uses it.
  **v1.67.0** reduced the SL to one stored number, `__tradeCalc_sl`, kept until the user changes it: no daily
  setup screen, no trailing (pre- or post-TP), no per-day local/sync backup, no popup switch, and no
  `__tcSLBreach` event - it had no listener, so the SL has done nothing on breach since v1.21.0. The field is
  always on the panel; empty + Enter clears it. Do not delete `__tradeCalc_sl` in any clean-up: it is the
  SL. `getDayKey` stays - TP saving dates itself by the trading day, and the account timezone is now
  cached the first time that happens rather than at load.
- **The redesign (2026-09-28): one panel - the top bar - and no popup.** v1.69.0: the ⚙ menu (theme, size,
  ↑↓ switch, Focus Mode, compatibility check, deposit scan), MAX on the bar, MULT renamed FAST (it only lets
  a quick second trade click through - it is not Martingale; nothing ever changes the amount by itself), the
  Invest ×÷ box removed (→ doubles, ← halves, always on, step fixed at 2), Chip Position fixed to
  follow-cursor, Show Live as Demo always on. v1.70.0: the chart settings moved into the ⚙ menu (the user
  chose the menu over the chart box), the popup was deleted, and clicking the toolbar icon shows / hides the
  bar (`chrome.action.onClicked`, which only fires because the manifest names no `default_popup`). The
  user confirmed v1.69.0 live ("all good"), deposit scan included. **Still to look at: the chart panel
  itself** - the user said it comes last.
- **The chips stand at the chart's right side (v1.73.0).** Quotex's candle countdown is painted on the canvas
  (probe, v1.72.6). Making the chips ride beside it with the chart engine's `getXFromTime` / `getYFromValue`
  (the way the user's QX CRT Alert extension does) was planned and then **dropped by the user** - do not
  rebuild it unless asked.
- **Trade countdowns (chip and tab title) match Quotex by construction (v1.75.0).** Order: Quotex's own number
  from the trade's row in their trade history (matched by pair and time, copied only within 2.5 s of the close
  time, so no stale row or stray clock is copied); otherwise the close time against Quotex's server clock
  (`targetTime` via chart_reader - highest offset of the last 10 s, sampled only when it moves), plus a shift
  learnt from their rows so that rounding up gives their number (v1.75.2 - live, their number ran ~0.2 s ahead
  of a plain round-up; rounding down would be learnt as a shift near -1). Verified live on 1.75.1: three reads,
  chip = trade history each time. `tradeClock` on the diagnostics line
  says which source was used and why. If they disagree again, read that field before changing anything.
- **Parked by the user:** retrying a timeframe that still comes back short after a fill (v1.74.3 fixed the
  cause that was seen).
- Offered and not started: a sound for the trend-flip mark (left visual on purpose — a tone mid-trade
  is intrusive and gives no clue which chart it came from), and per-asset rather than per-timeframe
  zoom memory.
