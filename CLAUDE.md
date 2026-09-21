# QXTradeLens — working notes

Read this first. It is written so a session starting cold can be useful within a minute, without
replaying the conversation that produced the code.

## What this is

A Chrome MV3 extension that adds a trading-discipline panel to `qxbroker.com`. It shows targets,
risk and multi-timeframe charts while you trade, and repairs itself when Quotex renames their CSS.

`src/content.js` is the source of the panel (~8,000 lines, one IIFE). Everything else is small:
`chart_reader.js` (MAIN-world read-only bridge), `popup.*`, `service_worker.js`.

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
- **No network** except the user's own Google Apps Script, if they configure one.
- **Nothing trades by itself.** A trade happens because the user clicked, or pressed a hotkey they
  enabled.
- **The panel's own elements are invisible to its finders** (`isOurElement`), or a semantic lookup
  reads our UI as the platform's.

## What cannot be verified from outside the browser

This matters more than it sounds, and has caused wrong conclusions before:

- The panel lives in a **closed shadow root**, so page-world script cannot see it.
- An **automated tab reports `document.hidden: true`**, so the render loop is paused there and the
  charts never draw. A screenshot of an automated tab shows empty cells; that is not a bug.
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
- **The health check** (popup → Check Quotex compatibility) reports every lookup as ok / fallback /
  missing, plus the build the *tab* is running against the one installed — an extension reload does
  not update an open tab, and that mismatch looks exactly like "the fix did nothing".
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
- Offered and not started: a sound for the trend-flip mark (left visual on purpose — a tone mid-trade
  is intrusive and gives no clue which chart it came from), and per-asset rather than per-timeframe
  zoom memory.
