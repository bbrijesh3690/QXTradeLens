# Changelog

All notable changes to QXTradeLens Controller are recorded here.
Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
The version in `qx-calc-updater/qx-calc-updater/manifest.json` must match the latest entry,
and every release is tagged in git as `vX.Y.Z`.

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
