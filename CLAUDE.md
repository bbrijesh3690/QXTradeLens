# QXTradeLens — working notes

Read this first. It is written so a session starting cold can be useful within a minute, without
replaying the conversation that produced the code.

## What this is

A Chrome MV3 extension that adds a trading-discipline panel to `qxbroker.com`. It shows targets,
risk and multi-timeframe charts while you trade, and repairs itself when Quotex renames their CSS.

`src/content.js` is the source of the panel (~8,000 lines, one IIFE). Everything else is small:
`chart_reader.js` (MAIN-world read-only bridge), `service_worker.js` + `deposit_scan.js` (the deposit scan),
`popup.*` (only Show / Hide and the chart settings since v1.69.0 - see the redesign item below).

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
  v1.65.2 removed the popup's Google Fonts. No shipped file makes a request or names an external URL, and
  `tests/popup.test.mjs` fails if the popup's markup or stylesheet ever does again. Fonts are the system's,
  through `--font-sans` / `--font-mono` in popup.html - use those rather than naming a typeface.
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

Three things exist because of this:

- **The diagnostics line** — the foreground tab writes build, pair, chart timeframe, open-trade
  count, what the auto-fill is doing, the payout floor and what each open pair pays, what that
  floor last decided, what the win-projection chip is showing, and per-chart
  `zoom / have / drawn / pannedTo / atLive` into the site's own storage every 2 s, under the hashed key
  for `__tradeCalc_diag`. Any tab on the
  origin can read it back. This is how a live problem gets diagnosed in one round trip.
- **The health check** (panel ⚙ menu → Quotex compatibility → Check; the popup until v1.69.0) reports every
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
- **Say what was not verified.** "Covered by tests, not seen live" is a useful sentence.

## Commands

```bash
npm run build          # src/content.js -> the extension's content.js (minified)
npm run build:dev      # unminified, for DevTools
npm test               # all specs, ~3.5 min (files run in parallel; tests/mtf.test.mjs is the long pole)
node --test tests/mtf.test.mjs                      # one area, ~20 s
node --test --test-name-pattern="v1.49" tests/...   # one change
CONTENT_JS=path npm test                            # against another build
```

`tests/helpers.mjs` holds the jsdom harness: a fake Quotex store shaped like theirs, a canvas stub
that records what was drawn, forced-open shadow roots, and an opaque-key mirror so specs can read
the panel's settings.

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
- **"Show Live as Demo" rewrites Quotex's own label and nothing else** — byte-for-byte as frozen in
  v1.54.4. Their 2026-09-23 build moved that label into the closed `<qx-usermenu-trigger>`, so on those
  pages the switch does nothing at all; the tab-title cover still works. **Do not paint over their
  component to get it back.** That was tried twice (v1.58.0, v1.58.1) and reverted in v1.59.0: it covered
  more than the job needed, there is no background to sample — every ancestor of their block is
  transparent up to `<body>`, which computes to white on a page that renders dark — and the result looked
  wrong on the real page both times. If their label returns to the light DOM, the relabel resumes on its
  own.
- **The payout floor was watched both ways on the live page on 2026-09-27** (v1.61.0, v1.61.1). Floor raised
  from 90 to 93 with twelve pairs open: ten went, a replacement was opened as the board thinned, and it
  settled at exactly two pairs with `2 pairs at or above 93%` once the 30 s throttle expired - so the
  "top up, do not grow" guard holds. Not observed: the timing. The read caught `opened one 1s ago`, which
  proves the open happened but not that it followed the close immediately rather than a tick and a settle
  window later; that path is covered by specs only.
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
- **The redesign (started 2026-09-28): one panel - the top bar - and no popup.** Step 1 is v1.69.0: the ⚙
  menu (theme, size, ↑↓ switch, Focus Mode, compatibility check, deposit scan), MAX on the bar, MULT renamed
  FAST (it only lets a quick second trade click through), the Invest ×÷ box removed (→ doubles, ← halves,
  always on, step fixed at 2), Chip Position fixed to follow-cursor, Show Live as Demo always on. **Next and
  last: the chart panel**, which takes the popup's chart settings; then popup.html/js go, and the toolbar
  icon should toggle the bar (`chrome.action.onClicked` - it only fires once `default_popup` is removed).
  Not verified live yet: the deposit scan walking the Balance pages from the trade page and coming back, the
  pill on the Balance page, and the service worker staying alive through a long scan (every page load is an
  extension event, which should keep it up). Covered by specs only.
- **Requested for after the redesign - the chips around Quotex's own timer.** Quotex shows a timer beside the
  running candle. The user wants the running amount (dynamic) just *above* that timer and the trade countdown
  just *below* it, replacing follow-cursor. Their timer is part of the WebGL chart or its overlay - check which
  before promising a position (see "What cannot be verified": a price cannot be mapped to a pixel).
- Offered and not started: a sound for the trend-flip mark (left visual on purpose — a tone mid-trade
  is intrusive and gives no clue which chart it came from), and per-asset rather than per-timeframe
  zoom memory.
