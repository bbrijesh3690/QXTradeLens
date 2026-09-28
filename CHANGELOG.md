# Changelog

All notable changes to QXTradeLens Controller are recorded here.
Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
The version in `qx-calc-updater/qx-calc-updater/manifest.json` must match the latest entry,
and every release is tagged in git as `vX.Y.Z`.

## [1.80.1] - 2026-09-28

### Fixed
- **With the trade history hidden, the chip's countdown turned a second before Quotex's.** The panel learns how
  Quotex rounds its countdown from the numbers in their trade history (1.75.2). It reads those at most every
  200 ms but works out the seconds left on every frame, and it learnt a row up to 200 ms old against the seconds
  left now. That pushed what it learnt up by as much as the 0.2 s it is there to learn (+0.68 to +0.91 s measured
  where the answer was +0.6). Each row is now learnt as of the moment it was read.

### Tests
- The 1.75.2 spec failed about half the time, on this build and on 1.79.0 alike. It set Quotex's clock only after
  the panel had started, its row ran on a timer that could lag more than the panel's slack, and it read the chip
  at any moment of the second. The clock is now set from the start, the row is worked out from the page's clock
  on a 100 ms tick, and the chip is read where every shift the spec accepts gives the same second - and where a
  countdown that ignored the learning would always fail, which it used to pass most of the time.
- New: "a trade-history row is learnt as of the moment it was read". The page's clock is held at chosen moments
  so a cached row is used 190 ms after it was read. Fails on 1.80.0 every time ("the chip shows 43, their rows
  would show 42"), passes here every time.

## [1.80.0] - 2026-09-28

Self-healing, step 4 - and a live bug that step 2 caused.

### Fixed
- **R opened the deposit window (reported live on 1.79.0).** Quotex's pair list has been renamed, so the
  fallback from 1.77.0 was in use, and it guessed twice wrong. For the list it took a block that is always on the
  page (rows of pairs and percents), so the list never looked closed ("still open after 8 tries"). For "+" it took
  the first plus icon on the page - the deposit button in the header - which the close steps then pressed. Both
  guesses were remembered, and a remembered name is tried first, so they stuck. Now:
  - the list must hold its search box as well as the pair rows;
  - "+" is only the plus nearest the pair tabs (never a link, never one with a word such as "Deposit" on it) -
    1.76.0 also looked near the tabs first; 1.77.0 lost that;
  - a remembered name is checked before use and forgotten if it no longer fits, which clears the two wrong ones on
    the first run without anything to reset.
  The diagnostics line's `assetList` now also says which "+" would be pressed.
- **Pair tabs with no id, no class and no data-symbol left.** The tabs are found as the small blocks showing a pair
  name and a payout %, starting from the one showing the chart's pair (from Quotex's data); the active tab and the
  payout % beside it follow. A page that marks its active tab is still believed over the data.

### Added
- `tests/scramble.test.mjs`: the whole trade page renamed at once - every class and id replaced, every data-
  attribute dropped, the field labels in another language - and each feature checked on it: every health-check
  lookup, the payout floor, MAX, the arrows, the chips and balance, the pair tabs. On 1.79.0 the pair tabs fail.

## [1.79.0] - 2026-09-28

Self-healing, step 4.

### Fixed
- **Everything that reads Quotex's data depended on one id, `#graph`.** The bridge that reads the balance, the
  open deals, the candles and Quotex's clock found the chart only by that id; renamed, all of it would have
  stopped - balance, countdowns, MAX, charts - with no error. It now tries every canvas on the page when the id
  is gone: the chart is the one whose owner holds a plot with candles. Still read-only.
- **The chips, the candle-timer probe and the click that closes the pair list** knew the chart block by the
  same id. They now use one finder: the known name, then a remembered one, then the block around the page's
  largest canvas. The chips appear on a renamed chart; the spec shows both halves failing on 1.78.0.

## [1.78.0] - 2026-09-28

Self-healing, step 3.

### Fixed
- **← / → could type the amount into the expiry time box after a rename.** The amount box's second known name,
  `input.input-control__input`, also matches Quotex's expiry time box - which comes first on the page. With the
  box's container renamed, → would have written "4000" into the expiry. The spec shows it on 1.77.0. That name
  is gone; the amount box is now found by its "Investment" label, else - in any language - as the box in the
  trade panel holding an amount or a percent, never the one holding a time. RISK, REQ and the arrows all use
  this one finder (RISK read the same wrong box).
- **T finds the expiry box and its Time / Timer switch after a rename**: the box as the block around the box
  holding a time, the switch as the one control in it outside the time field and its steppers - pressed only
  when there is exactly one.

### Tests
- The amount box's container renamed and its label in another language: → doubles the amount and leaves the
  expiry time alone. The expiry box renamed: T presses its switch. Both fail on 1.77.0.

## [1.77.0] - 2026-09-28

Self-healing, step 2.

### Fixed
- **Auto-open, R and Q find Quotex's pair list and its "+" button after a rename.** Both were known by fixed
  names only. Each now goes through the self-repairing finder - known names, then a remembered one, then by
  what it is - and remembers what worked: the list as the block holding several asset rows (a name and a
  payout %) that is not the tabs, the chart or the trade buttons; "+" by its plus icon, or as a "+" beside the
  pair tabs.
- **Asset rows are recognised by what they are more widely**: a name marked OTC counts, not only ABC/XYZ
  pairs - so crypto and stock rows like "Toncoin (OTC)" are rows - and a payout may have a space before %.
- **The timeframe button (S/D keys, the chart fill) is found after a rename** - as the one lone timeframe
  label on the page ("1m"); the open menu shows several side by side and is not it. The chart's own
  timeframe falls back to that button's label too.
- **Middle-click closes a pair tab after a rename** - it used the tabs' fixed class names; it now uses the
  tab finder that already heals. So does the bar's keep-off-the-tabs nudge.

### Tests
- The pair list and "+" with names the panel has never seen: auto-open opens the pair and closes the list. The
  timeframe button and menu renamed: the chart fill still collects 5m's history. A renamed pair tab: middle-
  click still closes it. All fail on 1.76.0.

## [1.76.0] - 2026-09-28

Self-healing, step 1 of the audit (every feature checked for what happens when Quotex renames its markup).

### Fixed
- **The trade guard finds Quotex's Up / Down buttons even after a rename.** The guard behind the PAYOUT floor,
  MAX and FAST knew the buttons by three fixed names only (`#trade-button button`, `.hkjXJ button`,
  `.bSenO button`); a rename by Quotex would have stopped every block without a word - trades would simply go
  through. One finder now serves the guard, the ↑/↓ keys, the greying of blocked buttons and the win/loss
  preview: the known names, then the buttons by what they are - their arrow icons, then their "Up" / "Down"
  words - and the name that worked is remembered for next time. ⚙ → Check reports which way it found them.
- **The win/loss preview above the buttons** hung off the `trade-button` id alone; it now sits above the block
  holding both buttons, however that block is named. The payout-amount finder uses the same block.

### Tests
- Quotex's buttons with no id and every class name changed: MAX still stops a third trade, a trade still goes
  through when nothing blocks it, Check still finds them, and the win/loss preview still sits above them. All
  fail on 1.75.4.

## [1.75.4] - 2026-09-28

### Fixed
- **Read from the live page with the 1.75.3 log, two refills a few seconds after a pair was closed:**
  - **The close ran before the list was on screen, and left it open.** Auto-open pressed "+", found nothing
    to pick and ran its close within half a second - while the list was still arriving. The close saw
    nothing open and stopped; the list then appeared and stayed open, which also held auto-open off ("the
    asset list is open"). A list "+" was pressed for in the last 2 s is now waited for, and closed once it is
    there.
  - **The refill kept opening the list for a pair it could not click.** It wanted Toncoin (OTC) - a crypto
    pair, the best OTC payout - while Quotex's list was showing another category, so the pair was not there
    to click, and every close brought the list up again for it. A pair that is not in the list when it is open
    is now left out for 10 minutes, and the best OTC pair that is in the list is opened instead (or nothing,
    if none clears the floor).
- `assetLog` records both: `close waits for the list it opened`, and `Toncoin (OTC) is not in the list shown -
  left out for 10 min`.

### Tests
- A list whose rows are on the page at once but which becomes visible 400 ms later, without the wanted pair:
  on 1.75.3 it is left open, as seen live; on 1.75.4 it is closed and both steps are in the log.

## [1.75.3] - 2026-09-28

### Added
- **An `assetLog` field on the diagnostics line**: the last eight steps with the "select trade pair" list, each
  with how long ago - auto-open looking (and whether it is a refill after a close), the "+" press that opened
  the list, which pair it picked, the list appearing and going (whoever did it), each closing try, and how the
  close ended. Reported live: the list opened again 2-3 s after it closed when auto-open ran. Two causes fit
  and need opposite fixes - the refill opening the next qualifying pair (v1.62.0 opens them one at a time), or
  a closing step re-opening a list that was already shutting - and no auto-open had run since the last refresh,
  so there was nothing to read. Following the rule to check live data before changing logic, the refill is
  left as it is until the log shows the cause.

### Fixed
- **The closing steps never press "+" on a list that is not settled open.** "+" opens the list as well as
  closing it; it is now pressed only once the list has stayed open 1.5 s without a break and is not fading out,
  so a list already on its way out cannot be opened again by our own click. Hardening - this was not reproduced;
  the existing close specs still pass.

### Tests
- A list that closes itself when a pair is picked, as on the live page: the log records auto-open, the "+"
  press, the list appearing, the pick, the list going and "closed by itself", with times. Fails on 1.75.2.

## [1.75.2] - 2026-09-28

### Fixed
- **The countdown's fallback learns exactly how Quotex turns seconds into its number.** Checked live on 1.75.1
  with a demo trade: three reads, and each time the chip showed exactly Quotex's number, copied from the trade
  history (`00:10`, `00:07`, `00:03`). The same reads showed the fallback - used when the trade history is not
  on screen - would have been a second out at times: by Quotex's clock the trade had 8.84 s left while its row
  showed 00:10, so their number runs about 0.2 s ahead of a plain round-up, and no fixed "round up or down"
  rule matches it. Now one shift is learnt from the rows: each agreeing row narrows where it can lie, and
  rounding up (seconds left + shift) gives their number. Rounding down is the same with the shift near -1, so
  either is learnt. A row that cannot fit means their clock or rounding changed, and the learning starts again
  from it. `tradeClock` on the diagnostics line reports the shift and how many rows taught it.
- Also seen: Quotex's clock ran about 1.2 s behind this computer's - which is why the chip used to show a
  second or two less than their trade history.

### Tests
- Rows running 0.6 s ahead of a round-up: the shift is learnt, and with the rows gone the chip goes on showing
  their number. Rows rounding down: learnt as a shift near -1. Both fail on 1.75.1.

## [1.75.1] - 2026-09-28

### Changed
- **Auto-open opens OTC pairs only** (requested). Both of its paths - refilling the board after a close, and
  opening one when every pair is below the floor - now pick only from OTC pairs, even when a regular pair pays
  more; with no OTC pair clearing the floor, nothing is opened. OTC is recognised three ways, so no single one
  going missing lets a regular pair through: the platform's own flag, "(OTC)" in the name, and the `_otc`
  ending of the symbol. When it has to fall back to the asset list's rows, only rows named OTC count. The R
  hotkey already opened OTC pairs only. The diagnostics line's `autoOpen` says "OTC" in its reasons.

### Tests
- A regular pair paying 96% beside an OTC pair at 93%: the OTC one is opened. Only a regular pair clearing the
  floor: nothing is opened. Both fail on 1.75.0.

## [1.75.0] - 2026-09-28

### Fixed
- **The trade countdown matches Quotex's, and keeps matching by itself.** Reported live: the chip's countdown
  and Quotex's own for the same trade in their trade history disagreed. The chip counted against this
  computer's clock (Quotex counts against its server's), rounded to the nearest second, and showed a fixed
  ".00". Now, in order:
  1. **Quotex's own number**, from the trade's row in their trade history, when it is on screen - matched to
     the trade by pair and by time, and copied only if it agrees with the trade's close time to within 2.5 s.
     That check is why the rows can be the first source again without the phantoms that demoted them in
     v1.34.0: a finished row or some other clock on the page is never copied.
  2. Otherwise **the close time against Quotex's server clock** - the chart's own time, read with every quote
     (1.74.4) - rounded the way Quotex's rows were seen to round. Every row that agrees teaches the rounding,
     so the fallback follows Quotex if they change it.
- The chip shows whole seconds, as Quotex does (`00:46`, hours only when there are some). The tab-title
  countdown uses the same seconds.
- `tradeClock` on the diagnostics line now says which source was used for each trade and why (`Quotex shows
  00:46 (copied)`, `trade history not on screen - the clock is used`, `its row is 17 s off the close time -
  not trusted`), with the clock gap and the rounding learnt so far.

### Tests
- Four specs, all failing on 1.74.4: the row's number is shown; a disagreeing row is not copied; without rows
  the chip counts by Quotex's clock (5 s ahead in the spec); the rounding is learnt from rows that drop the
  fraction.

## [1.74.4] - 2026-09-28

### Added
- **A `tradeClock` field on the diagnostics line**, because the trade countdown chip and Quotex's own countdown
  for the same trade in their trade history do not match (reported live). Two causes are possible: the chip
  counts against this computer's clock while Quotex counts against its server's (a steady gap), and the chip
  rounds to the nearest second and shows a fixed ".00", where Quotex may drop the fraction (one second out half
  the time). The field gives how far Quotex's clock is from this computer's, both countdowns as shown, and the
  exact seconds left by each clock - one read with a trade open says which fix is right. Nothing on screen
  changes yet.
- `chart_reader.js` now returns Quotex's server time (the chart's `targetTime`) with its state answer, and this
  computer's time at the same moment. A plain value read; nothing is called.
- The chip-follows-Quotex's-timer plan was discussed and dropped at the user's request; the chips stay where
  1.73.0 put them.

## [1.74.3] - 2026-09-28

### Fixed
- **A chart that already holds a few bars now gets its full history from the fill.** Seen live: after the
  pair was filled, the 5M chart showed "3/39 bars". The walk switches the chart to each timeframe and waits
  until Quotex stops sending candles - three quiet polls, 150 ms apart. But it counted the bars the panel
  already had: 5M held 3, folded from the 1m it collects as you watch, so the three quiet polls passed in under
  half a second, before Quotex had even switched the chart, and the walk moved on with those 3. Now nothing
  counts until the chart is really on that timeframe. The spec puts a 700 ms delay on Quotex's switch, as a
  real page has: 3 bars on 1.74.2, the full 200 on 1.74.3.

## [1.74.2] - 2026-09-28

### Fixed
- **The DEMO ACCOUNT label is Roboto Black (900), not Bold (700).** A second pair of live screenshots showed
  everything else matching theirs to the pixel - box 150x38, label at 43-118 rows 6-12, balance at 43 rows
  19-28, arrow at 129-137, ClearType on both - but their label carried 15% more ink than ours at exactly the
  same width and height. Rendering "DEMO ACCOUNT" in Roboto at each weight: 700 and 900 give the same 77 px
  width, and 900 adds 10.5% ink under greyscale smoothing (more under ClearType); 800 adds only 3.5%. So theirs
  is 900. The balance matches 700 stroke for stroke and stays. The icon moved 1 px left and grew 1 px, to
  their 12-31.

## [1.74.1] - 2026-09-28

### Fixed
- **Our Demo Account block now matches theirs in weight, spacing and position.** Measured pixel by pixel from
  two screenshots on the live page - ours and theirs side by side:
  - **Weight.** Theirs is drawn with ClearType, ours was not: Chrome keeps subpixel text only on a fully
    opaque layer, and our rounded corners made the edges see-through, so the text fell back to grey smoothing
    and looked lighter (strokes 1.58 px against their 1.84). The cover is now an opaque rectangle in the
    colour that paints behind their block, read from the page, with the rounded block drawn inside it.
  - **Width.** Their block grows to fit its text and keeps its right edge: 150 px on demo, 143 on live where
    "LIVE ACCOUNT" is shorter. The arrow sits 10 px after the text and 12 px from the edge. Ours now follows the
    same rules for "DEMO ACCOUNT", so it is as wide as their demo block, right edge on theirs - it was squeezed
    into their live box, with the arrow crowding the text.
  - **Position.** Label and balance 1 px further left, the balance 1 px lower, the arrow 9 px wide, the icon
    20 px - each by the amount measured. Font and size were already right: the same 7 px and 10 px letter
    heights at the same widths.

## [1.74.0] - 2026-09-28

### Added
- **"Show Live as Demo" works again, as our own Demo Account block over Quotex's.** Their account block
  (`<qx-usermenu-trigger>`) is a closed component, so its words cannot be changed; on the live page the panel
  now draws a copy of how the block looks on demo, exactly over it, with the live balance - and clicks go
  straight through, so the account menu still opens. The v1.58 tries failed on the background; this time
  nothing is guessed. The colour behind the block (`#1c1f2d`) was read from the layer that really paints there
  (1.72.7); the block's own `#2b3040`, 4 px corners, the cap icon, the orange `#ff8a00` DEMO ACCOUNT at 10 px
  bold, the balance at 14 px bold and the arrow were measured from a screenshot of their demo block, in
  Roboto, the font their page uses. Checked side by side with that screenshot, enlarged: text widths match
  within half a pixel. The label and the balance both start 43 px in, so DEMO ACCOUNT lines up with the ₹ sign, as on
  theirs.
- It is not drawn on the demo page (their block already says Demo), when the live balance cannot be read
  (theirs would be the only place showing it), or while their block is taller than a button - a menu drawn
  inside it is never covered. The diagnostics line has a `demoCover` field: `shown at 1551,15 143x38`, or
  `hidden:` and why.

### Tests
- Four specs, all failing on 1.73.0: shown over their block on the live page with the live balance; not on the
  demo page; not while the block is open; not without a balance.

## [1.73.0] - 2026-09-28

### Changed
- **The chips stand at the chart's right side**: the amount just above the middle, the trade countdown just
  below it. Requested: around Quotex's own candle countdown. That countdown is painted on the chart canvas at a
  height set by the price (1.72.6's probe, live), so it cannot be followed; the stack stands where it usually
  is instead - 88% across the chart, at half its height, as percentages so it scales with the chart. The
  chips no longer follow the cursor. The spot is one number (`CHIP_STACK_X`) if it wants moving.

### Found
- `accountBlock` on the live page (1.72.7): the block is 143x38 at 1551,15; what paints behind it is
  `div.app`, a flat `rgb(28, 31, 45)` gradient - not a parent of the block, which is why looking up through its
  parents found only white; its font is Roboto 14px 400, white. Step 2 - our own "Demo Account" block - is next.

## [1.72.7] - 2026-09-28

### Added
- **An `accountBlock` field on the diagnostics line** - step 1 of drawing our own "Demo Account" block over
  Quotex's, whose words sit in a closed component and cannot be changed (the user chose this over hiding the
  block). It reports the block's box, what really paints behind it - found with `elementsFromPoint`, which
  returns everything stacked at a point on screen, not only the block's parents; the v1.58 tries looked only
  at parents, which are all transparent - and the block's font. Nothing is drawn yet.
- Both probes (`candleTimer`, `accountBlock`) are wrapped so a failure in one cannot stop the diagnostics line.

### Found
- `candleTimer` on the live page (1.72.6): the only element over the chart that reads like a clock is
  `div.jHgax "17:50:40"` at the chart's top-left, ticking - Quotex's clock, not the candle countdown. The
  countdown beside the running candle is painted on the chart canvas, so its position cannot be read.

## [1.72.6] - 2026-09-28

### Added
- **A `candleTimer` field on the diagnostics line**, before the chips are moved around Quotex's candle timer
  (the amount above it, the trade countdown below - requested). It lists what over the chart reads like a
  clock (`div.xyz "00:42" at 600,200 (ticking)`), or says the timer is painted on the chart canvas. If it is
  painted, its position cannot be read at all - the chart is one WebGL canvas - and that settles what can be
  built. Nothing on the screen changes.

## [1.72.5] - 2026-09-28

### Fixed
- **MAX holds on quick clicks.** Reported live: with MAX 2 and FAST on, clicking Up/Down several times quickly
  placed more than 2 trades. The open-trade count comes from Quotex's data, which lists a trade only once
  their server has taken it - a moment after the click - so every click inside that moment still saw the old
  count and went through. A trade the panel lets through now counts at once, until Quotex's data shows it;
  one that never shows (the platform refused it) stops counting after 3 s, and the block is re-checked then.
  Applies to clicks on Up/Down and to the ↑/↓ keys, and the bar's "max trades" warning uses the same count.

### Tests
- Five quick clicks with MAX 2 place two trades, and five quick ↑ presses place two; both place five on
  1.72.4. The places free up again when Quotex never shows the trades.

## [1.72.4] - 2026-09-28

### Fixed
- **Auto-open closes the pair list after it opens a pair.** Reported live: the "select trade pair" list stayed
  open once auto-open had done its job. The list was found for opening by any of its names, but "is it open?"
  - and its Close button - were looked for under its id alone. With the id missing, the list read as closed
  the moment a pair was picked, so the close never ran. Both now use the same finder. A list found by any name
  but its id counts as open only while it is showing pair rows, so a container that stays on the page is never
  taken for an open list. The same close serves the R and Q hotkeys.
- The diagnostics line has an `assetList` field: how the list is found (`by id` / `by class ...`), whether
  it is open, and how the last close went (`closed at try 1 2m ago`, or `still open after 8 tries`). The
  cause above is the one the spec reproduces; the field confirms it on the live page after the next auto-open.

### Tests
- A spec with a list that has no id, appears on +, and goes on its own Close: on 1.72.3 the pair is picked and
  the list is never closed, exactly as reported; on 1.72.4 it is closed.

## [1.72.3] - 2026-09-28

### Changed
- **The ⚙ and 📊 buttons sit in the middle of the bar's height**, halfway between the labels and the values,
  level with the version text and the grip dots. 1.71.0 had put them on the value row, which read as out of
  line with the rest of the bar's right end. Checked by eye on a local copy of the page.

## [1.72.2] - 2026-09-28

### Fixed
- **"Alerts" is the bell icon, and the bar now finds it.** The 1.72.1 read of the live header settled it: there
  is no "Alerts" anywhere on the page, and the bell's hover label is "Notifications". The user confirmed the
  bell is what they call Alerts. A hover label reading "Notifications" now counts, alongside "Alerts". The
  spec fails on 1.72.1. Not yet seen on the live page; the `bar` field will say `in the header`.

## [1.72.1] - 2026-09-28

### Fixed
- **The bar looks for "Alerts" in more ways.** On the live page 1.72.0 found "WEB TRADING PLATFORM" but not
  "Alerts" (`bar: Alerts not found`), so the bar stayed where it was. "Alerts" is not text on the page. A word
  is now looked for as text, as text starting with it ("Alerts 3"), as the hover label of an icon
  (aria-label, title, alt, data-tooltip), and as a closed Quotex component named after it (`<qx-...alert...>`,
  whose box is on the page even though its inside is not). The `bar` field says which one worked.
- **If it is still not found, the `bar` field lists what the header has**: its components and its hover
  labels. One read then says what "Alerts" is, instead of another guess. Not yet seen on the live page.

## [1.72.0] - 2026-09-28

### Changed
- **The bar's home is Quotex's header**, centred in the gap between "WEB TRADING PLATFORM" and "Alerts", 5 px
  from the top - 1 px above where it sat. Both are found by their words, not by a class, and the look is
  repeated twice a second, so the bar stays centred when the window is resized or the bar changes width.
  It is not pushed below the pair tabs there. Dragging still works: a spot you drag to is kept, as before.
- Your old saved spot is cleared once, so the bar can move there; `__tradeCalc_pos_home` records that it
  was done.
- The diagnostics line has a `bar` field: `in the header · gap 150-950 · bar 700`, `your own spot (dragged
  there)`, or which word was not found. If Quotex renames either word or hides it in a closed component,
  the bar stays where it would have been before, and this field says which one is missing.

### Tests
- Three specs, all failing on 1.71.0: the bar is centred in the gap and not pushed below the tabs; an old
  saved spot is cleared once and a spot dragged to afterwards is kept; and with a word missing the bar keeps
  its old place and the line says which. Not yet seen on the live page - the `bar` field settles it in one read.

## [1.71.0] - 2026-09-28

### Changed
- **The bar is one even row.** Every field has the same shape: its label on top, its value centred under it.
  All values are one size - TP, REQ and RISK used to be bigger than the rest - and every value sits in a
  slot of the same height, so the labels line up in one row and the values in another. The chart and ⚙
  buttons sit on the value row. The number in each box is centred (it started at the left, with the spare
  room on the right), and the FAST button is the same size as the other values - Chrome gives buttons their
  own smaller font size, which made it sit higher and smaller.
- **TP has a box**, like SL, PAYOUT and MAX. It used to be a bare number that only showed a box on hover.
- **No decimals on the bar.** TP and SL show whole rupees (₹25,400, not ₹25,400.13) and RISK a whole
  percent (13%, not 13.13%). What is saved is what you typed, and the RISK colour still uses the exact figure.
- **The ⚙ menu shows the Check list and the deposit result once.** Closing the menu clears them; the next
  time it opens they are gone until Check or Scan is pressed again. The deposit result is shown when the scan
  brings you back and is then deleted, so the menu no longer keeps the last total for later.

### Tests
- Three specs fail on 1.70.3: the bar shows no decimals; the deposit result is not kept after it is shown;
  and the check and the result are gone when the menu is opened again. Three deposit specs now reach the
  result the way it arrives - on the way back from a scan - and the TP-step spec expects `20,000`. The layout
  itself was checked by eye on a local copy of the page; jsdom has no layout to measure it with.

## [1.70.3] - 2026-09-28

### Fixed
- **Closed charts show – in the compatibility check, not 🔁.** 🔁 means Quotex changed something and the panel
  coped; closed charts are just nothing to check right now, which is what – says. The spec fails on 1.70.2.

## [1.70.2] - 2026-09-28

### Fixed
- **The charts auto-fill says "charts are hidden (press C)" while the charts are closed**, instead of
  "starting up" for good. The pair is only read, and the auto-fill only runs, while the chart box is open;
  closed since the page loaded, nothing ever replaced the first label, which read as something being stuck
  (seen live on 1.70.1). Only the wording changes - the compatibility check and the diagnostics line both
  carry it. The spec fails on 1.70.1, where the label is still "starting up".

## [1.70.1] - 2026-09-28

### Fixed
- **The bar comes back where it was when the toolbar icon shows it again.** Reported on 1.70.0: hidden and
  shown with the icon, it moved. The bar has a rule that keeps it off Quotex's pair tabs, and it applied to a
  spot you had dragged it to as well - but only if the tabs were already drawn when the bar was built. On a
  page refresh they are drawn later, so the bar stayed at your spot; brought back by the icon, they were
  already there, and the bar was pushed below them. The saved spot here was the top of the page, 6 px down,
  over the tabs. A spot you chose is now restored as it is, only kept inside the window; the rule still
  keeps a bar that has never been moved off the tabs. The spec that shows it fails on 1.70.0 (the bar lands
  38 px lower), and a second part checks a never-moved bar is still kept off the tabs.

## [1.70.0] - 2026-09-28

### Changed
- **The chart settings are in the ⚙ menu**, under "Charts": the timeframes (typed, Enter to save), fill
  charts when a pair opens, mark when a chart turns, bars to confirm a turn (− / +), and the wait before
  filling (typed, in seconds). They apply to the chart box at once, as they did from the popup, and your
  values carry over.
- **Clicking the extension's icon shows or hides the panel.** It is what the popup's Show / Hide button did.
  The bar's own × and the "QXTradeLens" button still work too.

### Removed
- **The popup.** Everything it held is on the bar or in the ⚙ menu, so `popup.html` and `popup.js` are
  deleted and the manifest names no popup. The panel no longer answers the popup's `GET_STATE` and
  `SET_MTF` messages.

### Fixed
- **`npm test` ran neither of the two spec files added in 1.69.0.** The test script lists its files by
  name, and `menu.test.mjs` and `deposits.test.mjs` were never added to it. Both were run on their own
  before release and passed; they are in the list now, along with the new `extension.test.mjs`. A stale
  entry for `cover.test.mjs`, deleted in v1.59.0, is gone from it too.

### Tests
- New `extension.test.mjs`: no popup in the manifest or the folder, the icon click sends `TOGGLE_PANEL` to
  its tab, the worker starts and stops the deposit scan, and the start-up clean-up. It also carries the
  "no network" guard that was in the popup's spec, now over every shipped file: none may name a site other
  than Quotex.
- Three new menu specs for the chart settings; the two chart specs that drove `SET_MTF` / `GET_STATE` now
  go through the menu. All five fail on 1.69.0.

## [1.69.0] - 2026-09-28

The first step of the redesign: one panel, the top bar, instead of a bar, a floating box and a popup. The
chart panel is the last step; its settings stay in the popup until then, and then the popup goes.

### Changed
- **A ⚙ button on the bar opens a small menu** holding what the popup held: Dark / Light, the panel size
  (− / +), the ↑↓ trade-key switch, Focus Mode, the Quotex compatibility check, and the deposit scan. The
  ↑↓ switch stays a switch, because a key that places trades must be something you turned on. The menu
  closes on ⚙, Escape, or a press anywhere outside it.
- **MAX on the bar, next to PAYOUT**: the most trades open at once, 1 to 4, typed and saved with Enter. It
  was a select in the popup.
- **MULT is now FAST**, and its hover text says what it does. It never scaled anything: switched on, a quick
  second click on Up/Down goes through; switched off, a second click within 1.5 s is ignored.
- **← and → are always on**, with no switch: → doubles the amount and ← halves it. The step is 2, always.
  They do nothing while you are typing in a box.
- **The compatibility check says when the tab is out of date.** After an extension reload the old script
  keeps running in the tab but loses its link to the extension; the check now spots that and says to refresh.
- **The deposit scan starts from the trade page.** It opens the Balance page in the same tab, reads every
  page, and comes back to where you were; a small pill on the Balance page shows which page it is on and
  has a Stop button. The menu opens on the result by itself, and keeps the last result for next time. The
  scan code moved from the popup to the service worker (`deposit_scan.js`) - the panel cannot drive it,
  because it does not run on the Balance page. Same reading as before: Quotex's store first, the page as
  the fallback, one total per currency.
- **The popup holds only Show / Hide Panel and the chart settings**, with a line saying where the rest went.
- The settings clean-up that ran when the popup was opened now runs in the service worker on every start.

### Removed
- **The floating Invest ×÷ box** and its button on the bar. The arrows do its job; its 1.5 and 1.3 steps are
  gone.
- **The arrows' other path**, where a stored factor of 1 made them press Quotex's own −/+ buttons (and, in
  Focus Mode, select them). Unreachable from the screen since v1.63.0.
- **Chip Position**: the chips always follow the cursor, and rest at the anchored spot when the cursor is off
  the chart. (A new chip layout around Quotex's own candle timer is planned after the redesign.)
- **The Show Live as Demo switch**: always on now. A stored "off" from an older build is cleared, not obeyed.
- Their stored settings are cleared on load: `im_shown`, `step_mult`, `hk_leftright`, `chip_pos`,
  `relabel_demo` (and the last three, plus `hk_focus_mode`, from sync).

### Tests
- New `menu.test.mjs` (FAST, MAX, every menu item, the deposit result, the Balance-page pill) and
  `deposits.test.mjs` (the scanner, moved from the popup specs, plus the full walk: pages, Stop, a failed
  page, and the return to the trade page). All 15 panel specs and six changed specs in `privacy` /
  `relabel` fail on 1.68.0; one more - arrows do nothing while typing in a box - passes on both, as a guard.
  Removed with their features: the two −/+ arrow specs, the Invest-box visibility spec, and the relabel
  switch specs.

## [1.68.0] - 2026-09-28

### Restored
- **The trade-history "Entry" tags, always on.** v1.66.0 removed them together with their popup switch. The
  request was to remove the switch and keep the tags permanent; my confirming question said "the Entry Balance
  Tags feature (keeping the trade log)", and "trade log" read, reasonably, as the trade history the tags live
  in. The tagger is restored verbatim from 1.65.2 minus its on/off check, so it runs whatever an older build
  left in storage - an "off" setting cannot turn it off. There is still no popup switch. The trade log it
  reads from was never removed, so trades placed while the tags were gone are labelled too.

## [1.67.1] - 2026-09-28

### Fixed
- **Every decision about the payout floor now reads the saved floor.** v1.61.1 fixed this for the five-second
  pass only, and I reported afterwards that the remaining reads could not disagree because leaving the box
  saves it. That was wrong for the recalculation, which runs on page changes rather than when the box is left:
  it called auto-close and auto-open with whatever was typed, so a slip like `99` could close every tab below
  99 before it was corrected. The two trade-blocking paths, the OTC rebuild, the Q hotkey, the payout cap and
  the mobile bar's ± and label read the box too. All eight now use the saved floor; the box's own save
  routine is the only thing that reads what is typed. Two specs exercise it through a trade click and Q, and
  both fail on 1.67.0; a third fails if any other read of the box is added to the source.

## [1.67.0] - 2026-09-28

### Changed
- **The SL is one number, and it stays until you change it.** Type it into the panel and press Enter; it is
  kept across refreshes and across days, and nothing moves it but you. The field is always on the panel -
  it used to stay hidden until the daily setup screen had been answered - and clearing it then pressing
  Enter removes the SL, which replaces the popup switch that turned it off. Escape cancels. A number at or
  above the balance is still refused: not as a safety stop, but because it is almost always a slipped digit.

### Removed
- **The daily SL setup screen**, which covered the page once per trading day and blocked it until a number
  was entered.
- **Trailing**: the SL rising 20% below the day's peak, and the post-TP rule that floored it 5% below the
  peak once TP was reached.
- **The per-day SL bookkeeping** - its local backup and its Chrome-sync copy across devices - and the
  popup's **Daily SL Setup** switch. The SL is now per browser profile.
- **The SL breach signal.** When the balance reached the SL the panel fired `__tcSLBreach`, and nothing
  listened: the lock it once triggered was removed in v1.21.0. So the SL has done nothing on breach for a
  long time, which is why removing the screen and the trailing costs no protection. Found by tracing every
  reader of the SL before cutting.
- About 11 KB of the page script (176.0 KB -> 165.2 KB built), and the stored per-day values, cleared on
  load. **`__tradeCalc_sl`, the SL itself, is deliberately kept** - on the reporting page it held `1`, and it
  still does.

### Tests
- Twelve specs for the removed screen, backup and switch are gone, along with one that had started passing
  for nothing (it checked a trail gap that is no longer written and fell back to a passing default). The
  timezone specs used the setup screen to observe the trading day; they now observe it through the TP date.
  Five new specs, all failing on 1.66.0: the field is there with no SL set, yesterday's SL is still today's,
  the SL does not move when the balance is above it, an empty field clears it, and the per-day backup is
  cleared while the SL is not. The shared fixture now seeds `__tradeCalc_sl`, without which several SL specs
  had been passing on an empty field.

## [1.66.0] - 2026-09-28

### Removed
- **The trade-history "Entry" tags.** They stamped "Entry ₹X" - your balance when you placed the trade - on
  each row of Quotex's trade history, and were on by default. Removing only their popup switch would have left
  them on for good, so the feature itself is gone: the tagger, its page-observer hook, the popup switch and its
  stored setting. That was one of the two things this extension wrote into Quotex's own page; "Show Live as
  Demo" is now the only one. **The trade log the tags read from stays** - `projectedPayout` also uses it to
  price an open trade when the store cannot, which is part of the win projection - and a spec checks a placed
  trade is still logged.
- **The popup's Section show/hide toggles** (Targets, Protections, Projection) and their Save button. Every
  group of the panel is always shown. Nothing else read them. Hiding a group took its controls off the panel
  entirely - PAYOUT, MULT, the ×÷ and chart buttons - which can no longer happen by accident. The stored
  setting was already being ignored on the reporting page: it held three entries and the loader wanted four.
- Both settings are cleared from the site's storage and from Chrome sync.

## [1.65.2] - 2026-09-28

### Removed
- **The popup's Google Fonts.** It loaded two typefaces from `fonts.googleapis.com` / `fonts.gstatic.com`
  every time it opened - the last network request the extension made. It now uses the system's fonts through
  two variables, `--font-sans` (system-ui: Segoe UI on Windows) and `--font-mono` (Cascadia Mono or Consolas
  on Windows). All 12 font declarations in the popup and the 5 inline ones in the deposit scanner's results
  use them. **The extension now makes no network requests at all**, and a spec fails if the popup's markup or
  stylesheet ever references another origin again. The popup looks slightly different: system fonts in place
  of DM Sans and DM Mono.

## [1.65.1] - 2026-09-28

### Removed
- **What the removed features left in the site's storage.** Measured on the live page after updating to
  1.65.0: six values were still there, read by nothing - `loss_streak`, `seen_trades`, `streak_date`,
  `last_loss_ts`, `journal_fz` and `sys_lock_disabled`. None held anything private (no sheet rows, no sheet
  URL, no marquee text). The panel now removes those and the other six keys of the removed features each time
  it loads, after the legacy-key migration so an old unhashed copy is caught too; once they are gone it
  removes nothing. `__tradeCalc_mtf_count` is deliberately kept - it is still the starting zoom for a
  timeframe that has never been scrolled.

## [1.65.0] - 2026-09-28

### Removed
- **The Google Sheet journal, entirely.** The journal window with its editable cells, the log button and
  Enter-to-log, TP pulled from the sheet, the **P/L** and **GOAL** fields, and the popup's "Activity Log"
  section — which was the Apps Script URL, not a log. No sheet was connected on the reporting page, so none of
  it was doing anything. The service worker's fetch proxy went with it.
- **The TP refresh and save buttons.** Save was a duplicate: Enter in the TP field has always called the same
  `saveTp()`. Refresh only re-pulled TP from the sheet. TP is still edited the same way: hover, type, Enter.
- **The panel's Actions section** (LOG, JOURNAL and a theme button). It was hidden whenever no sheet URL was
  set, so it was already invisible. The popup's own theme toggle is unchanged.
- **The loss-streak system lock.** After three straight losses it blocked qxbroker.com inside Chrome for 15
  minutes, asked a local daemon on 127.0.0.1:7343 to hosts-block it too, and closed every Quotex tab. Removed
  with its toggle, the streak that fired it, the settled-trade tracker that only fed the streak, and the
  health-check row that reported on it. It was switched off on the reporting page.
- **The marquee** and its speed setting. No message was set.
- **Popup controls:** Journal Scale, Post-TP Trail Gap %, Disable System Lock, Candles per chart.
- **About 34 KB of the page script** (212.7 KB → 178.1 KB built), including 65 stylesheet rules and 6
  animations that only the removed parts used, and a TP progress line whose elements had already left the
  panel in an earlier release while its code stayed behind.

### Kept, with fixed values
- **Post-TP trailing** stays and trails 5% below the day's peak — the default, and the value it was on.
- **The SL setup screen and the payout overlay** are fixed at 20px, which is what Journal Scale was set to.
- **A timeframe never scrolled** still starts at the stored candles-per-chart value; every timeframe that has
  been scrolled keeps its own zoom, as before. On the reporting page all three already had their own.

### Safety
- **A lock active at the moment of updating is lifted.** The block rule lives inside Chrome, not in the
  extension, so deleting the code alone would have left it in force with nothing to clear it. The service
  worker now clears rule 9001, its alarm and its stored expiry on every start. `declarativeNetRequest` and
  `alarms` stay in the manifest for that alone; the two `127.0.0.1` host permissions are gone.
- **Removed settings are cleared from Chrome sync** when the popup opens, so a value cannot sit there and be
  read by an older build on another device.
- **No script in the extension makes a network request any more.** The one outbound request left is the popup
  loading its fonts from Google Fonts.

## [1.64.1] - 2026-09-28

### Fixed
- **A hand-typed SL is no longer capped at 5% of the day's peak.** Reported and then measured live: typing
  `1` against a peak of 19,655.32 stored **982**. `slTrailFor` caps the trail gap at 0.95, which is correct
  for the automatic trail — it stops the floor drifting arbitrarily far below the peak — but applied to an
  explicit edit it silently overrode it, because the ratchet's next target became peak × 0.05 and that is
  above 1. An edit now uses exactly the gap its value implies, so the ratchet's target *is* that value and it
  is left alone. The 20% floor still applies, and `slTrailFor` itself is untouched, so the automatic trail
  and the daily setup screen keep the 0.95 cap.
- **The post-TP floor can no longer push a typed SL above the balance.** It is clamped to the TP lock as
  before, but if that lock sits above the current balance the edit is refused instead — storing it would lock
  the platform out on a keystroke meant to adjust a number, which is exactly what this function already
  refuses for a value typed directly. Dormant on the reporting page (the TP lock was four days stale and so
  not loaded), found by reading the code path rather than by hitting it.



### Added
- **The SL in the main panel can be typed into, in both directions.** Enter or leaving the field commits it,
  the same as TP and PAYOUT; Escape puts back what was in force. It was `readonly` and that was not
  arbitrary: the trailing ratchet reads the **current SL out of that very field** and only ever accepts a
  higher one, so a lower number typed straight in would have been lifted back on the next pass and the edit
  would have looked ignored. An edit now widens the day's trail gap to match, measured against the day's
  **peak** rather than the current balance, because the peak is what the ratchet computes from. That is the
  same mechanism the daily setup screen already used for a lower starting SL.
- **Two values are refused rather than accepted and then corrected:** anything at or above the current
  balance, which would lock you out the moment it was stored, and anything that is not a number above zero.
  The field goes back to the SL in force and the warning line says which rule was hit. After TP is reached
  the post-TP lock still floors the SL — a lower value is clamped to it on commit, so the number cannot
  change by itself a moment later.



### Changed
- **← and → halve and double the amount, with nothing to set up first.** They have multiplied the stake
  since v1.29.0, but only once a factor had been chosen, and the only way to choose one was the floating
  `× ÷` widget — so out of the box the arrows clicked Quotex's own −/+ buttons instead. The factor now
  defaults to **2**, and 2 is first on the widget's cycle. 1.5 and 1.3 are still there for a gentler step,
  and a stored `1` still means "step with the platform's own buttons", which is the other arrow path.

### Fixed
- **Hiding the `× ÷` widget sticks.** The `×` button in the main panel has always hidden it, but the choice
  was never written down: it came back on the next reload. Worse, the desktop branch of the layout handler
  re-showed it unconditionally, so **any window resize** undid the toggle too — which is most of why hiding
  it never seemed to work. Now stored under `__tradeCalc_im_shown`, honoured when the widget is built and
  when the desktop layout is restored. Hiding it does not affect the arrows; they read the factor from
  storage, not from the widget.

### Note
- The multiplier feeds the `MULT` mode as well, which scales consecutive trades by the same factor. With the
  default now 2 rather than 1.5, that mode scales faster — the same one number drives both, deliberately.



### Changed
- **A close refills the board.** Auto-close removing a pair now puts the panel into a fill: it opens every
  instrument the platform rates at or above the floor that is not already open, best-paying first, one per
  pass, and stops when there are none left. The close is the only trigger, and the asset table decides when
  there is nothing left to do.
- **All the counting is gone.** 1.61.0 kept two pairs clear of the floor — a rule nobody asked for, and one
  that took three exchanges to even describe. How many pairs are open, and how many of them clear the floor,
  are no longer consulted at all. `AUTO_OPEN_MIN_GOOD` and `AUTO_OPEN_AFTER_CLOSE_MS` are removed.
- **A pass that closes nothing opens nothing.** The close pass runs every five seconds and usually closes
  nothing; triggering a fill on the run rather than on an actual close would open pairs for ever.
- **The 30 s throttle no longer applies during a fill.** It exists for the one path with no close behind it,
  where nothing bounds how often auto-open could fire. A fill is bounded by the asset table, so holding each
  open back by half a minute would only make refilling a board take a quarter of an hour.
- **The v1.54.0 trigger is unchanged and is still the only path that runs without a close**: when every open
  pair is below the floor, one that clears it is opened. It has to exist separately, because Quotex gives the
  last remaining tab no close control — so when your final pair drops below the floor nothing is removed and
  a fill would never start.

### Note
- This opens as many tabs as the platform lists above your floor, which can be most of the asset list. That
  is the stated intent, not an oversight. A cap would be one line if it turns out to be too many.



### Fixed
- **The payout floor had two sources, and they could disagree.** The five-second pass that closes and opens
  pairs read the PAYOUT box's current contents, while the diagnostics line reported the *stored* floor. The
  box only commits on Enter or on leaving the field, so a number typed and left sitting there had the board
  closing tabs against one figure while the line stated another. Measured on the 1.60.1 build: the line
  reported `floor 89` while the decision read `every pair below 95%`. Both now read the committed value, so
  half-typed digits decide nothing either — `95` passing through `9` on its way in used to be a floor of 9.
  Found while raising the floor to test 1.61.0 live, which is also why that test could not be set up: the
  typed 93 had never committed and storage still held 90.

## [1.61.0] - 2026-09-27

### Changed
- **The payout floor keeps two pairs clear of it, not one.** Auto-open only acted once *every* open pair had
  fallen below the floor, which let the board shrink a tab at a time: two pairs open, the weaker one drops,
  the close pass takes it, and the survivor — being above the floor — was never given company. The next dip
  left a single pair with no close control and nothing to switch to. It now opens a replacement whenever
  fewer than two open pairs clear the floor **and** the board is losing something: a pair has fallen below
  it, or auto-close has just removed one.
- **The replacement starts as soon as the close finishes.** A tab auto-close actually removed is a real
  change to the board, not a payout flickering for one pass, so it does not sit out the settle window on
  top of waiting for the next five-second pass — that was about nine seconds of looking at a board which
  had just lost a pair. `autoCloseStep` hands over directly when it has closed something. Sequenced rather
  than literally simultaneous, deliberately: both of these move the tab bar, and interleaving a close click
  with opening the asset list is how the board gets corrupted.
- **Thin is not the same as losing something.** One tab that clears the floor, with nothing below it and
  nothing just closed, is left alone — the board is the trader's, and a single pair they chose to sit on is
  not a fault to correct. The v1.54.0 behaviour in that case is unchanged, and its spec still covers it.
- **The diagnostics line counts instead of generalising**: `1 of 2 at or above 90% - opening one`,
  `2 pairs at or above 90%`, or `1 of 1 at or above 90%, none below it`. The old wording said
  "every pair below 90%", which could not distinguish one pair from five.

## [1.60.1] - 2026-09-27

### Fixed
- **The sweep's note in the diagnostics line says when it was written.** `sweepNote` is only replaced by the
  next press, so with no age on it the field read as a verdict on the press just made. Seen within an hour
  of shipping 1.60.0: the line said `every open pair is already current` while four open pairs held no
  candles at all — that note was written earlier, when one already-current pair was the only tab open, and
  it was believed for a moment before the `stale` numbers contradicted it. It now reads
  `every open pair is already current · 42m ago`. One setter (`setSweepNote`) records the time, so no site
  can leave a note without one.

## [1.60.0] - 2026-09-27

### Added
- **The sweep can be watched from another tab.** Every spec for it passed and it had still never been seen
  running on a real page, for a reason that is structural rather than lazy: it refuses to start while
  `document.hidden`, which is exactly what an automated tab reports, so it cannot be driven from one. The
  diagnostics line now carries `view` (the refresh button's scope depends on which view is up),
  `sweep` (`running · 2 of 4 · at AUD/CAD`, or what the last press came to), and `stale` — seconds behind
  per open pair, by the same measure the sweep picks its targets with. `stale` is the one that settles it:
  the same numbers before and after a press say whether the walk actually collected candles, rather than
  just visiting tabs.

### Changed
- **One place answers "how far behind is this pair"** (`pairBehindSec`). The sweep's target list and the
  diagnostics line were about to hold two copies of that arithmetic, which is how "the board says stale,
  the sweep says nothing to do" starts.

## [1.59.2] - 2026-09-24

Recorded late — this shipped and was tagged without an entry.

### Fixed
- **Reverted the widened relabel finder from 1.59.1.** Matching the words `Live Account` anywhere found the
  account switcher's own row for the live account and renamed it, leaving two entries both reading
  `Demo Account` — so the two accounts could not be told apart at the moment of choosing between them.
  That is a worse failure than the relabel being quiet. The finder is the exact one from 1.19.0: a `<div>`
  whose own text node reads `Live Account`.
- **`relabel` in the diagnostics line reports what is relabelled now**, not what the last pass matched. A
  per-pass count reads "none" as soon as the rewrite succeeds, because the label no longer says
  `Live Account` — it was describing a working feature as a broken one.

## [1.59.1] - 2026-09-24

### Fixed
- **The account relabel was too literal to survive a markup change.** It looked for a `<div>` whose own
  text node read exactly `Live Account`; one wrapper span, one newline, or any other tag and it matched
  nothing — silently, with no sign of why. The words are what identify that label, so it now matches on
  those: any element with no element children whose trimmed text is the label, including inside open
  shadow roots. The strict XPath is still tried first, so a page with the old shape behaves exactly as it
  always did.
- **It reports itself in the diagnostics line** (`relabel`): how the label was found, and how many were
  rewritten. Every conclusion drawn about this otherwise came from an automated tab whose page never left
  `body.loading`, which says nothing about the tab actually in front of someone.

## [1.59.0] - 2026-09-24

### Removed
- **The account cover is gone.** v1.58.0 and v1.58.1 painted our own "Demo Account" label over Quotex's
  account component, because their 2026-09-23 build put theirs inside a closed shadow root where the
  rewrite cannot reach it. Reverted at the user's request: covering their UI to win back a cosmetic
  relabel was not worth what it cost, and both attempts at it looked wrong on the real page.

  **"Show Live as Demo" is now exactly what it was in the frozen v1.54.4** — the relabel code is
  byte-for-byte identical. The consequence is stated plainly rather than worked around: while Quotex
  keeps that label inside a closed component, the switch has nothing to rewrite and **does nothing on a
  live account**. The tab-title cover still works. If a later build puts the label back in the page, the
  rewrite starts working again by itself, with no change needed here.

  The balance fix from v1.57.0 is unaffected and stays: that one is not cosmetic.



### Fixed
- **The cover repainted the whole account block, in the wrong colour.** v1.58.0 drew the label *and* the
  balance on a background sampled from the page. Checked against the live DOM afterwards — which should
  have come first — that was wrong twice over. The job is the name: the balance is Quotex's and is now
  left untouched. And there is no background to sample: every ancestor of their account block is
  transparent up to `<body>`, which computes to **white** while the page renders dark, so the sample put
  a white slab across a dark header.

  The cover is now a strip the width of their block and the height of its first line, over the label
  only. It names no colour at all — `backdrop-filter` gives it whatever the page actually paints, in
  either theme — and it carries the word and nothing else.
- **Nothing is drawn on a demo account.** Their own label already reads "Demo Account" there, so a cover
  is pure noise. It appears only where there is something to hide: a live account whose label sits inside
  the closed component. Where Quotex still renders the label in the page, the original rewrite handles it
  and no cover is drawn at all.



### Added
- **"Show Live as Demo" works again, by covering rather than rewriting.** v1.57.0 recorded the feature as
  lost: the label it used to rewrite is inside Quotex's closed shadow root, and no extension can reach it.
  What can be done is to paint over it. The panel now draws its own opaque block — in its own closed root,
  so the page still cannot see it — positioned exactly on their account component, carrying the
  "Demo Account" label and the balance from the store.

  It is **transparent to the mouse**, so their account menu still opens on a click; it follows the
  component if the page moves or the window resizes; and it only appears while the switch is on **and**
  their own label is genuinely out of reach — if a later build puts that label back in the page, the
  original rewrite takes over and the cover disappears by itself.

  Their component is found by what it *is* — a custom element in the top strip — rather than by a class,
  so a rename does not break it, and the search skips anything belonging to this panel.



### Fixed
- **The daily stop-loss screen sat on "Reading balance…" for ever.** Quotex's 2026-09-23 build moved the
  account block into `<qx-usermenu-trigger>`, a custom element with a **closed** shadow root — the same
  trick this panel uses to hide itself. The balance is no longer anywhere in the document: no selector
  reaches it, no text scan finds it, and no semantic finder can be written that would, because
  `querySelectorAll` stops at a shadow boundary and a closed root hands out no reference. Nothing was
  wrong with the lookup; the thing it looked for had left the page.

  The balance now comes from Quotex's own state through the read-only bridge, which is where this
  project's first working rule said it should have come from all along. The route decides which figure —
  the demo one on `/demo-trade`, the live one on `/trade` — and a zero belonging to the account the page
  is *not* on is treated as "still waiting", not as "no balance to protect". The page remains the
  fallback for a build where the bridge cannot answer.

### Changed
- **The semantic finders can cross open shadow roots.** Quotex is clearly moving parts of the page into
  components, and a finder that stops at the first shadow boundary goes blind at each one. A closed root
  still cannot be read by anyone — that is what the store is for — but an open one stays findable. The
  walk never enters this panel's own root: in the page it is closed and unreachable, and the guard keeps
  that true in the test harness, which forces every root open.
- **The health check no longer calls the missing balance element a fault.** It reports the element as
  `closed component — read from the store`, and says whether the figure itself came from the store or the
  page. Reporting it as broken would send the next reader hunting for a class that no longer exists.

### Known
- **"Show Live as Demo" can no longer relabel the account block.** The label sits inside the same closed
  shadow root, and XPath cannot cross it either. The tab-title cover still works; the on-page label does
  not. Painting our own label over the component is possible but is a visible change to their page, so it
  is left as a decision rather than assumed.



### Changed
- **The sweep is the refresh button, not a second control.** The panel already had a button meaning
  “go and fetch candles”; what changes between the two views is the scope, and the view already states
  the scope. On the charts it refreshes the pair in front of you, exactly as before; on the board it
  brings every open pair that has fallen behind up to date. Pressed again while that runs, it stops. The
  footer under the board is now only a status line — progress, and the reason when it will not start.

### Fixed
- **A pair that had just been collected could be reported as minutes behind.** How far behind a series
  is was taken from the age of its newest candle’s timestamp, but the bar now forming is always up to a
  whole period old and is not stale for it — so a pair holding only 5m and 15m data read as five minutes
  behind the moment it was swept, and the sweep queued it to be walked again for nothing. Seen live on
  2026-09-22 on EUR/NZD. A series is now behind by how long ago its newest bar should have **closed**,
  and the figure comes from the finest series a pair has rather than the kindest of them.

## [1.56.0] - 2026-09-22

### Added
- **Sweep: bring every open pair up to date in one press.** The rest of the scan board is free, which is
  why it could only judge pairs you had already been on — four tabs open with two of them reading `—` was
  the normal case. Sweep visits each open pair whose candles have fallen behind, runs the same walk the
  refresh button runs, and puts you back on the pair you started from. Stalest first, and pairs already
  current are skipped, so chart time is only spent where it buys something.

  It is the one part of this feature that moves the chart, so it never starts by itself: it needs the
  button, the tab in front and no trade running. It stops on its own if a trade opens or the tab goes to
  the back, the button becomes **Stop** while it runs and says how far along it is, and stopping takes
  effect at once rather than at the end of the pair it is on.

## [1.55.1] - 2026-09-22

### Fixed
- **Coming back from the scan board left the panel hanging off the screen.** The clamp that keeps the
  panel inside the window gave up whenever it had no inline position to read - which is every panel that
  has never been dragged, since the stylesheet places it from the top and right. A view taller than the
  charts then pushed its bottom edge, and the resize handles with it, out of reach. The clamp now reads
  the box the panel actually occupies and pins that, the two views clamp on every switch, and the board
  itself is capped at 40% of the window height so it cannot outgrow the screen to begin with.

### Added
- **A scan row says how old the candles behind it are.** Only the pair in front of you is live; every
  other row is judged from what was collected the last time it was open, and a level from forty minutes
  ago is not the same claim as one from thirty seconds ago. Rows more than 90 seconds behind carry their
  age, the header counts how many are current, and the tooltip says to open the pair to bring it up to
  date.

## [1.55.0] - 2026-09-21

### Added
- **A scan view on the chart panel: which pair is worth looking at, across the whole board.** The panel
  bar gains a **Charts / Scan** switch. The board lists one row per pair - what it pays, a direction for
  each of your timeframes, and how far price is from the nearest level, in the colour of the timeframe
  that level came from - **sorted nearest to a level first**, because those are the rows about to make a
  decision. A row whose price is inside the zone is picked out. Clicking a row switches to that pair, or
  opens it from the asset list if it is not open yet.

  **Nothing here moves your chart.** Payout, whether the market is active and the label come from
  Quotex own asset table, which covers every instrument they offer; the trend and the levels come
  from candles already collected - the pair you are on plus the ones held in the cache - using the same
  detector, window and tolerance the charts draw with, so the board and a chart can never disagree. A
  pair with no candles still earns a row if it clears your payout floor, marked, because its payout is
  knowable and worth ranking even when it cannot be placed against a level.

  The view you leave it in is the view it opens in, and the charts are not drawn while the board is up.

## [1.54.4] - 2026-09-21

### Changed
- **The S/R switch wears the same pill as the timeframe beside it.** A solid block of colour was too
  heavy next to it; it is now a tint of that timeframe colour with a matching edge and the text in the
  colour. Solid now means one thing only - this is the timeframe the platform chart is on.
- **The three marks in a cell header line up.** They had three different font sizes, paddings and line
  heights on a baseline-aligned row, so their edges never met. All three are now one box height on a row
  that centres them.

## [1.54.3] - 2026-09-21

### Fixed
- **The new timeframe pill had no text in it.** v1.26.0 marks the platform own timeframe by writing
  `style.color` on the label, and clears it with an empty string on every other cell. That was harmless
  while the stylesheet supplied `color: var(--tc-text-dim)` underneath; v1.54.2 moved the colour inline
  and dropped the stylesheet one, so clearing it left the label with no colour at all, inheriting from
  the host page. The label now keeps its timeframe colour in both states, being the platform current
  timeframe inverts the pill instead - dark ink on a solid pill of that colour, which reads better than
  the old accent text anyway - and the stylesheet carries a colour again so no future clear can blank it.

## [1.54.2] - 2026-09-21

### Changed
- **The timeframe on an MTF cell reads as the cell own identity.** It was the dimmest thing in a row it
  now leads, so it is a filled pill in the colour that timeframe already uses for its levels - blue for
  1m, amber for 5m, violet for 15m. A glance at the pill says which chart you are looking at, and the
  colour is the same one its S/R lines are drawn in.

## [1.54.1] - 2026-09-21

### Added
- **The payout floor reports what it is looking at.** Whether it should have opened a pair cannot be
  judged from another tab without the numbers the decision was made on, so the diagnostics line now
  carries the floor, what each open pair is paying, and the reason the last pass gave — `a pair is at or
  above 86%`, `every pair below 86% - waiting to see if it holds`, `a trade is running`, `opening
  AUD/CAD (OTC) at 93%`.

## [1.54.0] - 2026-09-21

### Added
- **The payout floor now opens a pair as well as closing them.** Auto-close takes low-payout pairs away
  one at a time, but Quotex gives the last remaining tab no close control — so when the final pair drops
  below the floor it stayed, trading was blocked, and there was nothing left to switch to. When every open
  pair is below the floor, one that clears it is opened and the close pass takes the stale one away on its
  next turn. Which pair is the platform's decision: its own asset table gives payout, whether the market is
  active and the label for every instrument it offers, so this works on the whole board rather than a list
  written down here. The asset list's rows are only the click target, and only the fallback for choosing.
  It waits for the condition to hold across two passes, stays out of the way while the trader has the asset
  list open, and never moves the board while a trade is running.
- **The build is on the panel.** It was only in the popup's health check, which is the wrong place for the
  question it answers — reloading the extension does not update an open tab, and that mismatch looks
  exactly like "the fix did nothing". The version sits at the end of the panel's own row, outside the
  section that hides itself when no sheet URL is configured.
- **The win projection reports itself in the diagnostics line.** It has been covered by a test since
  v1.34.0 and never once seen on a live page, because it only draws while a trade is running and an
  automated tab cannot produce one. The chip's own text is now in the line any tab can read back, so a
  single live trade settles the question.

### Changed
- **The MTF cell header reads left to right: timeframe, its S/R switch, then its turn mark.** The turn mark
  used to come first, which put a symbol that is usually absent in front of the two things the row is for.

## [1.53.0] - 2026-09-21

### Fixed
- **The candle cache had no ceiling.** Deeper per-timeframe history and wider zooms had taken it to 552 KB
  for five pairs, in an origin budget of about five megabytes shared with the platform own storage. Writes
  here are wrapped, so passing quota would not have thrown — settings would simply have stopped saving.
  It is now held under 300 KB: the current pair is kept whole, then the oldest pairs go, then history is
  thinned.
- **A walk that came back empty claimed to have filled the pair.** The retry was scheduled by back-dating
  the "filled at" time, and the panel reported that same value as elapsed — so a failed walk immediately
  read `filled this pair 40s ago`. When a fill RAN and when the next one is allowed are now two separate
  clocks, and a walk that collected nothing says so.

## [1.52.0] - 2026-09-21

### Fixed
- **The fill walk left a timeframe as soon as fifty candles had arrived.** Quotex sends a timeframe
  history progressively, so whatever happened to be loaded at that instant was all the chart ever got —
  which is why a 15m chart came back with 68 bars while the 5m, which delivers its window in one go, came
  back with 201. The walk now keeps collecting until the candles stop arriving (three quiet polls) or its
  three-second limit, so each timeframe gives up everything the platform is willing to load.

## [1.51.0] - 2026-09-21

### Fixed
- **The bar countdown printed through a level label.** A level sitting within a pixel or two of the price
  shares its row with the price pill and the countdown — seen live as `03:47` drawn straight over a
  label. Level labels now treat that row as taken and step clear of it, on every chart.
- **`201/240 bars · ↻ to retry` on a chart that has everything it can get.** Once the fill has run, the
  platform has given what it holds for that timeframe; suggesting another walk sends you after history
  that does not exist. A short chart now states its count and leaves it there.

## [1.50.1] - 2026-09-21

### Added
- **Each chart now reports its own zoom and pan state** in the diagnostics line: the zoom it is on, how
  many candles it has to draw from, how many it is drawing, where it has been dragged to and whether it
  is at the live edge. "Zoom and pan are not working" cannot be told apart from "this pair holds less
  history" without it.
- Five specs covering the cases that differ between assets: a chart with less history than the zoom asks
  for, dragging back then zooming, dragging past the oldest candle, switching pair while panned, and the
  level set following the zoom.

## [1.50.0] - 2026-09-21

### Fixed
- **The tab title counted down with no trade open**, and counted UP: `⏱0:17`, `⏱3:51`, `⏱6:17`. The
  title read the deal rows first and Quotex own data only as a fallback — the inversion fixed for the
  chart chips in v1.34.0, left in place here. With no readable rows the panel looks for a pair name beside
  a clock and found the platform session clock, `00:06:17`, which parses as a plausible six-minute
  countdown and so slips past the four-hour sanity bound. The title now follows the platform data and
  reads the markup only when the bridge cannot answer.

## [1.49.1] - 2026-09-21

### Added
- **The test harness records where a line is drawn, not just that it was drawn.** A spec now checks the
  actual coordinates of every level: it ends at the newest candle and starts on one of the candles on
  screen. The panel lives in a closed shadow root and a background tab does not render, so the drawing
  cannot be inspected from outside the browser — this is the closest thing to looking at it.

## [1.49.0] - 2026-09-20

### Fixed
- **Levels came from all the history behind a chart, not the part it is showing.** Picking the nearest by
  price across 800 bars kept choosing swings from hours ago, whose line then had to begin at the left edge
  — which is why the 1m and 5m looked like full-width lines while the 15m, covering far more time, did
  not. Levels are now found in the candles the chart is drawing, so each one starts at a candle you can
  see and grows with the newest, and zooming out brings older levels in by itself.
- **Three lines through one zone.** Swings within half a typical bar range of each other described the
  same level — seen live as 289.175 / 289.096 / 289.058 on a 5m chart — and drew three lines that crowded
  out anything genuinely elsewhere. They are now merged, keeping the newest touch. The tolerance comes
  from the chart own candles, so it scales with the instrument and with how much it is moving.
- **Labels printed on top of each other** when two levels were close. Each label now steps down until it
  has room.

### Removed
- The edge tags added in v1.47.0. With levels taken from the visible candles, a level cannot be off the
  chart, so the code could never run.

## [1.48.0] - 2026-09-20

### Fixed
- **A chart could show six levels on one side and none on the other.** The rule keeps the last three swing
  highs and the last three swing lows, which is right for a signal but wrong for a chart: in a market
  making new lows, the three recent lows are overhead too, so everything was above the price and nothing
  under it. Each chart now draws the **three nearest levels above the price and the three nearest below**,
  taken from every swing in its history rather than only the newest few. A side with nothing on it shows
  nothing, which is the honest answer when price is at a new extreme.
- **A level was drawn across the whole chart, including candles from before it existed.** It now runs from
  the swing that made it to the newest candle, growing as candles arrive, and its label follows the end of
  its own line. The rule this comes from is explicit that a level counts only once its swing has formed.

### Added
- Tests that hold the rule to the same behaviour on **any instrument**, whatever it is priced in — a
  5-decimal FX pair, a 3-decimal JPY cross, a four-figure rate and a near-zero minor: at most three levels
  a side, every label agreeing with where price stands, no level drawn twice, and none missed entirely.

## [1.47.0] - 2026-09-20

### Added
- **A level outside what a chart is showing is named at its edge** — `↑ R - 1.60850` at the top, `↓ S -
  1.59900` at the bottom, in that timeframe colour, up to two a side. Until now such a level was dropped,
  so the only way to find one was to zoom out until it appeared. A LINE at the edge would misstate where
  the level is; a tag names it and points the way, and the line comes back the moment the level is in
  range.

## [1.46.1] - 2026-09-20

### Fixed
- **A level above price was labelled `S`.** The side was taken from how the level formed — swing low is
  support, swing high is resistance — but that is only true until price crosses it. The rule these levels
  come from says broken levels stay and count from either side, and its own example is a broken high that
  later held as support. A level is now labelled by where price stands: above price it is `R` and drawn
  solid, below price it is `S` and drawn dashed, whichever kind of swing made it. Reported from the chart
  after a fall left every support sitting above the price.

## [1.46.0] - 2026-09-20

### Removed
- **The S/R list on the platform chart.** It was a second place to look and a second set of numbers to
  keep in step; the levels on the mini charts are the feature. The rule, the per-timeframe colours and
  the switch on each chart all stay.

### Changed
- **A level is labelled with its side and price, at the right**: `R - 0.56330`, `S - 0.56164`. The
  timeframe is not repeated — the chart it is drawn on already says that — and the label sits on the
  right where the rest of this panel puts prices.

## [1.45.1] - 2026-09-20

### Changed
- **The show/hide switch moved onto the chart it belongs to.** Each mini chart carries a small `S/R`
  button in its own header, lit in that timeframe colour when its levels are shown. The rail on the
  platform chart is a readout again rather than a second set of controls, and it hides itself when every
  timeframe is off.

## [1.45.0] - 2026-09-20

### Added
- **Support and resistance levels**, using the rule frozen in the Qx_Claude_Strategy research (h013):
  swing highs and lows of strength 3 on COMPLETED candles, the last three of each side, a level counting
  only once its third confirming candle has closed, broken levels kept, and a level counting from either
  side. The rule is copied rather than imported — that project has its own release cycle and this panel
  must not depend on a file outside its own repository.
- **Each mini chart draws its own levels**: resistance solid, support dashed, one colour per timeframe
  (1m blue, 5m amber, 15m violet), tagged `1m R`, `15m S` and so on. A level outside that chart's price
  range is left out rather than pinned to the edge.
- **A level rail on the platform chart** listing the six levels nearest the price, each with its
  timeframe, price and distance as a percentage, and **a chip per timeframe to show or hide it** with one
  click on the chart. The choice is remembered.

### Changed
- **The panel's own page elements are invisible to its semantic finders.** The rail carries timeframe
  labels, and the timeframe-menu finder promptly read its own chips as Quotex's menu. Anything built by
  the panel is recognised by the random id prefix it already uses, so nothing new was added to the page.

### Known limit
- **The levels are listed on the platform chart, not drawn across it.** Its chart is a single WebGL
  canvas whose vertical scale is view state the page keeps to itself: measured against its own axis, the
  visible span is NOT `maxValue - minValue`, and the price axis zooms and pans independently. A line
  placed from the readable numbers lands in the wrong place — measured about 1.35x too far apart — and
  reading the real transform would mean calling obfuscated internals that break on their next release.
  The distance readout needs no mapping and cannot silently drift. The mini charts draw the lines because
  there the scale is ours.

## [1.44.1] - 2026-09-20

### Fixed
- **One scroll ran a chart straight to the zoom cap.** A turn of a wheel arrives as a burst of events and
  a trackpad as a stream of small ones; a step was being applied to each, so a single gesture took a chart
  from 40 candles to the 240 limit. Seen in a live session: two charts sitting at exactly 240. The delta is
  now accumulated and one step taken per notch worth of it, with a gentler factor.

## [1.44.0] - 2026-09-20

### Added
- **The wheel zooms a chart**, the way the platform own chart does: scroll over a cell to show more or
  fewer candles. It applies to that chart only — the 1m can sit at twenty bars while the 15m shows eighty
  — and each timeframe keeps its level between sessions. The panel "candles per chart" setting is the
  starting point rather than a limit; the wheel ranges from 8 to 240.
- The cache keeps enough bars to fill **the widest zoom you have set**, so scrolling out does not reveal a
  chart that was trimmed to the old default.

### Fixed
- **The crosshair no longer fights a drag for the same pointer.** Dragging a chart back through older
  candles already worked; with the crosshair added in v1.40.0 both were reacting to the same pointer move.

## [1.43.1] - 2026-09-20

### Fixed
- **The crosshair and the bar-end line looked the same.** Both were drawn in the same colour, weight and
  dash, so hovering near the newest candle put two indistinguishable uprights on the chart. The crosshair
  is now the bright, finely dotted one, with a marker where its lines cross; the bar-end upright is dimmer
  and stays dashed. A spec records the colour each line is stroked in, so they cannot drift back together.

## [1.43.0] - 2026-09-20

### Added
- **The crosshair follows the same moment across every chart.** Hover a 1m bar and the 5m and 15m charts
  mark the bar holding it, each with its own readout — so one hover gives you the minute, the five minutes
  and the quarter hour around it. Candles are bucketed by time, so the rule is simply: mark the bar whose
  own period contains the hovered bar start. It reads both ways, and a 15m bar marks the first minute
  inside it.
- A chart **not showing that moment gets no crosshair** rather than the nearest bar to it: the 1m chart
  covers about forty minutes, so a 15m bar from hours ago is genuinely off its screen, and a hole in a
  chart history is not quietly filled by the bar before it.

## [1.42.1] - 2026-09-20

### Fixed
- **The price label is back on the right**, against the edge where a price axis belongs, with the
  countdown between it and the candles.
- **The countdown no longer touches the last candle.** There is a clear gap either side of it, and the
  room for both labels is now worked out BEFORE the candles are placed: on a 260 px cell the space the
  chart leaves for the future was not wide enough for a price and a countdown, so the pill was being
  shoved back over the bars it was meant to follow. The candles give up a few percent of width instead.

## [1.42.0] - 2026-09-20

### Changed
- **The countdown moved onto the chart, the way the platform draws it**: a dashed upright where the
  forming bar ends, and the time left in a dark pill riding the last-price line beside it, as `00:12`. The
  price label moved to the left end of that line to make room, which is also where Quotex puts it. The
  header copy is kept only for a cell with nothing drawn in it, where there is no line to ride.

## [1.41.0] - 2026-09-20

### Added
- **Each chart counts down to the close of the bar it is drawing.** The time left sits in the cell header
  and turns the accent colour for the last tenth of the bar (or the last three seconds, whichever is
  longer), so you can see a 1m or 5m bar about to close while you are deciding on a 15s entry.
- The countdown is **arithmetic on the clock**, not a reading of the data: Quotex buckets a candle by
  `floor(epoch / period)`, so the time left stays correct on a chart whose candles are behind, stale or
  missing altogether. Panned back into history it shows nothing — there is no bar forming in the past.

## [1.40.0] - 2026-09-20

### Added
- **Hovering a bar reads it out.** A dashed crosshair follows the pointer through the bar it is over, and
  the caption becomes that bar: time, close, high, low and the move across the bar. Leaving the chart puts
  the status line back. The hovered cell redraws at once rather than waiting for the next 200 ms tick, so
  it tracks the pointer instead of lagging behind it.

### Fixed
- **Float noise stretched the decimals again**, from a different direction than v1.38.1: 100.57 + 0.01 is
  100.57000000000001 in binary floating point, so EVERY close carried extra digits and the "appears often
  enough" rule could not filter them — a two-decimal instrument read 100.570000. Values are cleaned to
  twelve significant digits before their decimals are counted, which drops the artefact and leaves a
  genuinely long quote alone.

## [1.39.0] - 2026-09-20

### Added
- **A chart is marked when it turns.** When the direction of a chart last closed bars reverses, an arrow
  appears in that cell header for two minutes, coloured up or down, with the reason on hover. Direction is
  read from CLOSED bars only — the newest bar is still moving and would flip back and forth on its own —
  and a turn is remembered per pair and timeframe, so coming back to a pair does not announce one that
  happened while you were away.
- Nothing is marked on a chart that is **panned back**, has **gaps**, or is **too short to have a**
  **direction**: no signal is taken from data the panel has already admitted is incomplete.
- Two settings in the popup: **Trend Flip Marks** (on by default) and **Bars Per Trend** (2–10, default 3).
  Fewer bars reacts sooner and calls more turns; more is steadier.

## [1.38.1] - 2026-09-20

### Fixed
- **One noisy close stretched the price label.** The number of decimals came from the MOST any recent
  close carried, and Quotex own feed occasionally sends a value like 1.6146266 for a pair it quotes to
  five places — seen live on EUR/AUD within minutes of shipping the label. A decimal length now has to
  turn up in a fifth of the recent closes before it is believed.

## [1.38.0] - 2026-09-20

### Added
- **Each mini chart shows its last price**: a dashed line across the chart at the last close, and a label
  at the right edge in the colour of that bar. The charts showed shape with no price reference at all, so
  there was no way to tell where a level sat without going back to the platform chart. The number of
  decimals is read from the data, so a 5-decimal FX pair, a JPY cross and a whole-number index each print
  the digits they actually move in.

## [1.37.0] - 2026-09-20

### Fixed
- **A bar built from part of its period looked like any other bar.** Time you are not watching a pair is
  missing from its 1m history, so a 15m bar covering that stretch is drawn from the few minutes that were
  seen - same shape, wrong high and low. Three things stopped you noticing: the fold reset the count, so a
  hole vanished as soon as it was folded up a level; the rolling 1m history dropped the flag when it saved;
  and the newest bar, which is always part-formed because it is still running, was faded every time, which
  taught you to ignore the fading. Incomplete bars are now faded and carried up through every fold, the
  forming bar is left alone, and the caption says `gaps` with an explanation on hover.

## [1.36.0] - 2026-09-20

### Changed
- **The charts fill the moment you open a pair.** The wait before filling now defaults to 0 instead of 15
  seconds. Flicking through pairs is still safe: the pair waiting to be filled is simply overwritten as
  you go, so only the one you land on is walked. Raise **Wait Before Filling** in the popup if you would
  rather it held off.
- **An open trade no longer blocks anything.** The ↻ button refused to run while a trade was open, and the
  fill waited for the trade to close. Neither needed to: the walk changes which timeframe the chart shows,
  which is a view, not the trade. The cost is that the chart looks away from a running trade for the few
  seconds the walk takes.

## [1.35.0] - 2026-09-20

### Changed
- **Opening a pair now runs the refresh walk, full stop.** The panel used to measure how full each chart
  was and fill only what looked thin — which behaved differently depending on what the 1m fold happened
  to have collected, so it ran sometimes and not others with no way to tell which from the outside. There
  is no measuring now: a pair you open gets a walk. The conditions that remain are the ones you can
  predict — tab in front, no trade open, and the pair has stayed on screen for the wait (default 15 s).
- The repeat guard is **one minute** instead of ten: it exists only to stop a second walk while you flick
  between two pairs, not to ration fills.
- The popup switch is now **Fill Charts On Opening A Pair** (same setting, clearer name), and the health
  check reports `ready — fills when you open a pair` when it is simply waiting for you to open one.

## [1.34.0] - 2026-09-20

### Fixed
- **A countdown chip appeared with no trade running**, reading 696:10 — about eleven and a half hours.
  With no readable deal rows the panel looks for a block holding a pair name next to a clock, and matched
  a block holding the session clock instead. A trade row must now carry a plausible countdown: the longest
  expiry the platform offers is four hours.
- **The page could outvote Quotex about what was open.** The open-trade count took the HIGHEST of the page
  and the platform data, and chips read the deal rows first. A settled deal keeps its row, and when no
  deal cells exist the pair tabs own P/L cells stood in for them — so a page with nothing running reported
  two open trades. That quietly ate into the trade cap and held the chart auto-fill off with "a trade is
  open". Quotex own data now decides, and the markup is read only when the bridge cannot answer.
- **The win projection was blank with trades open.** It was only ever computed from the deal rows, so on
  the data path it showed "win —", and a single unreadable trade blanked the total for all of them. It now
  comes from the platform numbers, and a total missing one trade shows what could be added up, marked "≈".

## [1.33.0] - 2026-09-20

### Changed
- **A pair must stay on screen for 15 seconds before its charts are filled** (was 3). Flicking through
  pair tabs no longer sends the chart off on a walk for every pair you pass through — only one you settle
  on. The wait is now a setting, **Wait Before Filling** in the popup (3–120 s), and the health check
  counts it down: `settling (9s)`.

## [1.32.0] - 2026-09-20

### Fixed
- **The auto-fill called a six-bar chart "ready".** It asked whether a chart had ANY bars, not whether it
  had enough, so exactly the charts that looked emptiest were the ones it skipped. Measured live on a 15s
  chart: 97 folded 1m bars is 6 bars of 15m out of the 40 asked for, reported as nothing to do. A chart
  now counts as needing bars below 60% of your "candles per chart" setting, and folding cannot fix a short
  history - only the platform own bars for that timeframe can, which is what the walk fetches.
- **A short chart asked for a ↻ that was about to happen anyway.** It now says what the auto-fill is doing:
  `6/40 bars · filling…`, `· trade open`, `· retrying`.

### Changed
- **The timeframe menu is driven with the same realistic click the trade buttons get** (focus, then the
  full pointer sequence at the control own coordinates). A bare .click() is a lone MouseEvent with no
  coordinates - the easiest kind of scripted click for a page to pick out - and the auto-fill makes this
  walk happen without anyone pressing anything.

## [1.31.2] - 2026-09-20

### Added
- **A diagnostics line in the site own storage**, written every two seconds by whichever tab is in front:
  the build that tab is running, the pair, the chart timeframe, how many open trades it can see, and what
  the auto-fill is waiting for. The popup health check can only be read by whoever is at the browser; this
  can be read back from any tab on the site, which is what makes remote debugging of the panel possible.

## [1.31.1] - 2026-09-20

### Changed
- **A blank chart now says why it is blank.** `visit once` on its own is a dead end: it never said whether
  anything was coming. The caption carries the short reason the auto-fill is holding off — `visit once ·
  trade open`, `· filling…`, `· retrying`, `· ↻ to retry` — so the answer is on the chart you are already
  looking at rather than behind the popup. The health check still has the full wording.

## [1.31.0] - 2026-09-20

### Added
- **The health check now says what the auto-fill is doing**, in words: `ready — nothing blank`,
  `waiting: a trade is open`, `filled this pair 4m ago`, `tab is in the background`, `switched off in the
  popup`, or which charts it is filling right now. It refused to run silently before, which was
  indistinguishable from it being broken.
- **The health check reports which build the tab is running**, next to the version that is installed. If
  the extension was reloaded but the Quotex tab never refreshed, the tab keeps running the old code — the
  popup now says so in orange instead of leaving you to wonder why a fix changed nothing.

### Fixed
- **A fill that collected nothing used up the pair's ten-minute cooldown.** The walk is now judged by the
  charts it was sent to fill: if they are still blank afterwards it tries again in thirty seconds.

## [1.30.1] - 2026-09-20

### Fixed
- **A cell could sit on a stale snapshot while live data was right beside it.** Bars pulled for a
  timeframe are a snapshot: they stop the moment you leave it. A 15m cell filled by a refresh walk then
  read "4m ago" even though the rolling 1m history was updating three times a second. The platform's own
  bars are now kept for the history and the tail is re-folded from the freshest source, so the newest bars
  always move. Seen live on a 15s chart.
- **The coarsest source was preferred over the freshest.** Picking what to fold from went by timeframe
  size alone, so a ten-minute-old 5m entry beat a current 1m history. Freshness decides now; between
  sources of the same age the coarser one still wins, as it needs less folding.
- **Auto-fill never ran in practice.** It required EVERY chart to be blank. On a 15s chart a new pair has
  15s bars immediately and the 1m cell fills from the fold, so that was never true and the 5m/15m cells
  were left empty. One blank chart is now reason enough.

## [1.30.0] - 2026-09-20

### Added
- **Click a chart's timeframe to switch the platform chart to it.** The label in each mini chart's header
  is now a control: click **5m** and Quotex's chart goes to 5m, so you can act on the cell you were just
  reading without going through their menu. The cell matching the chart's own timeframe stays highlighted.
- **New pairs fill themselves in, once.** A pair you have never watched had nothing to draw and every cell
  said "visit once" until you pressed ↻. The panel now does that walk for you — once per pair, only with
  the tab in front, no trade open and nothing else using the menus — and then leaves it to the rolling 1m
  history below. It says "filling …" while it happens. Switch it off with **Auto-fill New Pairs** in the popup.

### Changed
- **A rolling 1-minute history is kept per pair.** Quotex only sends candles for the timeframe its chart is
  actually on, so the higher cells emptied out as soon as you left them. Any chart period that divides a
  minute (5s, 10s, 15s, 30s) is now folded into a 1m history for that pair, and every higher timeframe
  derives from that one history instead of from whichever fine timeframe you happened to visit. The panel
  fills itself as you trade, and the cells reach much further back.
- **The cache keeps enough bars to be useful.** It stored a flat 200 candles per timeframe, which is 13 bars
  of 15m — so a restored cache drew a stub and then said "visit once". The 1m history and anything above it
  now keep what the widest chart on screen needs (up to 1000 bars); finer timeframes keep only what their
  own cell shows, since the 1m history carries the rest. Measured live: 436 one-minute bars for a pair
  (7 hours) built from 15s data alone, where the old cache held 50 minutes.
- **A message in the panel's header no longer vanishes instantly.** "not while a trade is open" and the new
  ones were overwritten by the next 200 ms redraw, often before you could read them.

### Fixed
- **A folded timeframe is marked as approximate.** A 1m cell built from 15s bars said "live" like a real 1m
  pull; it now shows "≈" the way every other derived cell does.

## [1.29.0] - 2026-09-20

### Changed
- **The investment amount is now typed, not written by script.** Changing the amount with ←/→ (or the
  ×1.5 / ÷1.5 box) used to set the field's value through the native setter and fire a constructed
  `input` event, which reads `isTrusted: false` and marks the change as coming from a script. The value now
  goes in through the browser's own editing pipeline, so the platform sees the same trusted `input` event it
  gets when you type. Verified live on qxbroker.com: the deal amount takes the value and reformats it as
  usual. If the browser ever refuses the command, the old path still runs, so the feature cannot break.
- **Focus Mode now covers ←/→ as well**, and is renamed **Hotkey Focus Mode** in the popup (same switch,
  same setting). With it on, ←/→ select the platform's own −/+ button and your Enter (or Space) presses it;
  focus stays on the button, so a run of steps is one key each after the first.

## [1.28.0] - 2026-09-19

### Added
- **↑↓ Focus Mode** (popup → Hotkeys, off by default). ↑/↓ select the Up/Down button instead of pressing it,
  and your own **Enter** (or Space) places the trade — so the click is generated by the browser and carries
  nothing that marks it as scripted. Focus stays on the button, so repeats in the same direction are one key;
  switching direction costs one extra key. All guards still apply: a blocked trade is stopped even when the
  click is a genuine one.

### Changed
- **The hotkey click now matches a real one in every field**: the button is focused first and the full
  pointer sequence (pointerdown → mousedown → pointerup → mouseup → click) is sent at the button's own
  screen coordinates, with a single-click count. The one thing no extension can set is `isTrusted`, which is
  exactly what Focus Mode sidesteps.

## [1.27.1] - 2026-09-19

### Fixed
- **Multi-timeframe cells said "visit once" on load even with candles cached.** The cache was restored into a
  holding area and only came into use when the next chart pull happened; the pair is now read from Quotex's
  state at render time, so cached candles are shown immediately.

## [1.27.0] - 2026-09-19

### Changed — much less visible to the platform (no feature removed)
- **Settings no longer announce the extension.** Thirty keys named `__tradeCalc_*` sat in localStorage,
  readable by any script on the page and left behind after uninstalling. Each name is now an opaque hash;
  values are unchanged and the old keys are imported once, then deleted.
- **No webfont request from their page.** The `@import` of Google Fonts is gone; the panel uses the system UI font.
- **No stylesheet naming their classes.** The `<style>` listing `.UI2Kh, .bvdd_ { … }` is replaced by per-element
  styling applied where those elements are already handled, so no rule mentions their internals.
- **Their buttons are left alone.** A blocked trade is stopped in the capture phase (every reason, not just
  some) and the buttons are only greyed; `disabled` and `aria-disabled` are never written to their DOM.
- **Two page marks are now switches** in the popup, both default ON: "Show Live as Demo" and
  "Entry Balance Tags". Switching the relabel off restores the platform's own label.

Unchanged and unavoidable: automation is automation. Trades placed with ↑/↓ (and the R/Q/S/D/T helpers)
dispatch untrusted events, which a platform can distinguish from a human click. Use the buttons yourself if
that matters; the panel's guards and readouts do not need automation.
## [1.26.0] - 2026-09-19

### Fixed — multi-timeframe charts
- **Switching pairs no longer throws the collected candles away.** Every timeframe was wiped on a pair
  change, so each pair needed a fresh ↻ sync (with 12 tabs open, that was constant "visit once").
  Candles are now kept per pair for the last 6 pairs, restored when you come back, and saved immediately
  on a pair switch.
- **The cache stores several pairs** (new v2 format, old single-pair caches are still read), trimmed to what
  the charts can show, and written every 30 s instead of every 10 s.
- **↻ sync waits for data.** It moved to the next timeframe after a fixed 260 ms, which often captured
  almost nothing; it now waits up to 2.5 s per timeframe for candles to arrive.

### Added
- The header shows the **pair label** ("USD/DZD (OTC)") instead of the raw symbol.
- The cell matching the **platform chart's own timeframe** is highlighted.
- A derived timeframe shows **how many bars it has** ("12/40 bars · ↻") instead of only "≈ live".

## [1.25.1] - 2026-09-19

### Fixed (both found by running the health check on a live page)
- **"Timeframe menu" no longer reports a fallback while the menu is closed.** The finder matched the chart
  toolbar's own timeframe label ("1m") and called it an open menu. A menu now needs at least three
  timeframe choices; a single label reads as "not open".
- **Health values are rounded.** A percent stake showed raw floating point (5% of ₹28,004.59 as
  `1400.2295000000001`); it now reads `1400.23`.

## [1.25.0] - 2026-09-19

### Added — self-repair for the rest of the panel
- **Open trades, chart countdown chips, tab-title countdown and live totals now work from Quotex's own data**
  when the deal rows can't be read. The bridge also carries live prices and each deal's entry price and
  payout %, so winning/losing is known without reading the page (command 0 = Up, 1 = Down, checked against
  10 settled trades live).
- **Lists repair themselves like single elements did.** Deal rows, asset rows, timeframe items and expiry
  times are found by shape and text when their classes change, and the new class is remembered:
  a deal row = a small block holding one pair name and one mm:ss countdown; timeframe items = "1m"-style
  labels; expiry times = "HH:MM" labels inside the expiry box.
- **Max open trades** counts the highest of profit/loss cells, deal rows and Quotex's data.
- **Health check** now also reports Open trades list, Trade timers, Asset list rows, Timeframe menu and
  Expiry times, with a new "–" state for a list that simply isn't open at the moment (not a fault).

### Tests
- 58 tests. The five new ones fail on v1.24.5 and pass here.

## [1.24.5] - 2026-09-18

### Fixed
- **"Balance not found" on an account with no funds.** The daily SL setup treated a balance of 0 as
  unreadable (`balance > 0`), so a live account at ₹0 showed "Reading balance…" and then
  "Balance not found. Reload and try again." — with the page still click-blocked by the setup screen.
  - A zero balance now says the account has no funds and offers **Close**.
  - It keeps watching, so funding the account or switching to the demo account fills the amount in.
- **No more dead end while waiting for a balance.** It used to give up after ~21 s and stop retrying. It now
  keeps checking (1 s, then every 3 s), re-checks when a background tab becomes visible again, and after
  ~10 s releases the page blocker and offers **Skip for now** so Quotex stays usable.

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
