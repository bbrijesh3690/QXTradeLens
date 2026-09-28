// The on-chart countdown and projection chips: they stand or fall on what counts as an open trade.


import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTENT_JS,
  FIXTURE,
  SOURCE,
  CHART_READER,
  sleep,
  istToday,
  slStorage,
  prefKey,
  pref,
  quotexStore,
  makeCandles,
  deal,
  boot,
  tradeReachesPlatform,
  tradeButtonsGreyed,
  tradeButtonsEnabled,
  slSetupOpen,
  slShown,
  healthRow,
  overlayShown,
  noSl,
  openSetup,
  typeInto,
  dayKeyAt,
  slForDay,
  openDealNow,
  mtfStorage,
  mtfCap,
  setChart,
  mtfPairLabel,
  rows,
  bigTfStorage,
  graphChips,
  chipEl,
  projEl,
  visible,
  settledRow,
  hkStorage,
  pressArrow,
  amtStorage,
  pressSideArrow,
  stakeField,
} from "./helpers.mjs";

// ── v1.34.0: chips for trades that are actually running ──────────────────────────────

test("chips: a settled deal row does not get a countdown chip (v1.34.0)", async () => {
  const store = quotexStore(); // Quotex says nothing is open
  const qx = await boot({ store });
  try {
    settledRow(qx.window.document);
    settledRow(qx.window.document, "AUD/USD (OTC)");
    await sleep(900);
    assert.ok(!visible(chipEl(qx)), "no countdown chip");
    assert.ok(!visible(projEl(qx)), "and no projection chip");
  } finally {
    qx.close();
  }
});

test("chips: a block holding the session clock is not mistaken for a trade (v1.34.0)", async () => {
  const store = quotexStore();
  const qx = await boot({ store });
  try {
    // What was on the page live: a pair name beside a clock counting 11:39:34.
    const block = qx.window.document.createElement("div");
    block.innerHTML = '<span>USD/ARS (OTC)</span><span class="jHgax">11:39:34</span>';
    qx.window.document.body.appendChild(block);
    await sleep(900);
    assert.ok(!visible(chipEl(qx)), "eleven hours is not a trade countdown");
  } finally {
    qx.close();
  }
});

test("chips: the win total adds up every open trade (v1.34.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const open = (id, amount, pct) => ({
    id, asset: "USDDZD_otc", amount, profit: 0, isDemo: 1, command: 0, openPrice: 100, percentProfit: pct,
    openTimestamp: now - 10, closeTimestamp: now + 50,
  });
  const store = quotexStore({ opened: [open("a", 1000, 80), open("b", 2000, 90)] });
  const qx = await boot({ store });
  try {
    await sleep(900);
    const text = projEl(qx).textContent;
    // 1000 x 1.8 = 1800, 2000 x 1.9 = 3800, on a 10,000 balance.
    assert.match(text, /win/, text);
    assert.ok(!/win\s*—/.test(text), "not blank when several trades are open: " + text);
    // 1000 x 1.8 + 2000 x 1.9 = 5600 more than the running balance shown on the chip above it.
    const nums = (text.match(/[0-9][0-9,]*[.][0-9]{2}/g) || []).map((n) => parseFloat(n.replace(/,/g, "")));
    assert.equal(nums.length, 2, "balance and win: " + text);
    assert.equal(Math.round((nums[1] - nums[0]) * 100) / 100, 5600, "both payouts counted: " + text);
  } finally {
    qx.close();
  }
});

test("chips: the tab title does not count down with nothing open (v1.50.0)", async () => {
  const store = quotexStore(); // Quotex says no deals are open
  const qx = await boot({ store });
  try {
    // What the live page has beside the chart: a pair name next to the platform session clock.
    const block = qx.window.document.createElement("div");
    block.innerHTML = '<span>AUD/USD (OTC)</span><span class="jHgax">00:06:17</span>';
    qx.window.document.body.appendChild(block);
    await sleep(900);
    assert.ok(!/[⏱]/.test(qx.window.document.title), "no countdown in the title: " + qx.window.document.title);
  } finally {
    qx.close();
  }
});

test("chips: an open deal still counts down in the tab title (v1.50.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const open = { id: "t1", asset: "USDDZD_otc", amount: 1000, profit: 0, isDemo: 1, command: 0, openPrice: 100, percentProfit: 85, openTimestamp: now - 10, closeTimestamp: now + 40 };
  const qx = await boot({ store: quotexStore({ opened: [open] }) });
  try {
    await sleep(900);
    const title = qx.window.document.title;
    assert.equal(title.charCodeAt(0), 0x23f1, "the title starts with the timer mark: " + title);
    assert.ok(/[0-9]:[0-9][0-9]/.test(title), "and carries the countdown: " + title);
  } finally {
    qx.close();
  }
});

// ── v1.72.6: where Quotex's candle timer is, before the chips are placed around it ────────────────
const candleDiag = (qx) => JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").candleTimer;
const overChart = (w, withTimer) => {
  if (withTimer) {
    const t = w.document.createElement("div");
    t.className = "qTimer";
    t.textContent = "00:42";
    w.document.getElementById("graph").appendChild(t);
    let left = 42;
    w.setInterval(() => (t.textContent = "00:" + String(--left).padStart(2, "0")), 1000);
  }
  const rect = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.tagName === "CANVAS") return { left: 0, top: 100, width: 800, height: 400, right: 800, bottom: 500, x: 0, y: 100 };
    if (this.classList && this.classList.contains("qTimer")) return { left: 600, top: 300, width: 40, height: 16, right: 640, bottom: 316, x: 600, y: 300 };
    return rect.call(this);
  };
};

test("candle timer: an element over the chart that reads like a clock is reported, ticking (v1.72.6)", async () => {
  const qx = await boot({ setup: (w) => overChart(w, true) });
  try {
    await sleep(4300); // two diagnostics writes, so the text has changed between them
    assert.match(String(candleDiag(qx)), /div\.qTimer "00:\d\d" at 600,200 \(ticking\)/);
  } finally {
    qx.close();
  }
});

test("candle timer: with none over the chart, the line says it is painted on the chart (v1.72.6)", async () => {
  const qx = await boot({ setup: (w) => overChart(w, false) });
  try {
    await sleep(2200);
    assert.match(String(candleDiag(qx)), /painted on the chart/);
  } finally {
    qx.close();
  }
});

test("chips: the amount stands just above the middle of the chart's right side, the countdown just below (v1.73.0)", async () => {
  // Requested: the amount above Quotex's candle countdown and the trade countdown below it. Their countdown is
  // painted on the chart canvas (read live, v1.72.6), so the stack stands where it usually is instead.
  const now = Math.floor(Date.now() / 1000);
  const store = quotexStore({
    opened: [{ id: "a", asset: "USDDZD_otc", amount: 1000, profit: 0, isDemo: 1, command: 0, openPrice: 100, percentProfit: 80, openTimestamp: now - 10, closeTimestamp: now + 50 }],
  });
  const qx = await boot({ store });
  try {
    await sleep(900);
    const amount = projEl(qx),
      countdown = chipEl(qx);
    assert.ok(visible(amount) && visible(countdown), "both chips are up");
    for (const chip of [amount, countdown]) {
      assert.equal(chip.style.left, "88%", "on the chart's right side");
      assert.equal(chip.style.top, "50%", "at its middle");
    }
    assert.equal(amount.style.transform, "translate(-50%, calc(-100% - 4px))", "the amount sits above the middle");
    assert.equal(countdown.style.transform, "translate(-50%, 4px)", "the countdown below it");
  } finally {
    qx.close();
  }
});

test("trade clock: the line says how far Quotex's clock is from this one, and both countdowns (v1.74.4)", async () => {
  // Reported live: the chip's countdown and Quotex's own in the trade history do not match.
  const now = Math.floor(Date.now() / 1000);
  const store = quotexStore({
    opened: [{ id: "a", asset: "USDDZD_otc", amount: 1000, profit: 0, isDemo: 1, command: 0, openPrice: 100, percentProfit: 80, openTimestamp: now - 10, closeTimestamp: now + 50 }],
  });
  const qx = await boot({ store });
  try {
    // Quotex's server clock running 2 s ahead of this computer's.
    Object.defineProperty(store.__plot.pointsManager, "targetTime", { get: () => Date.now() / 1000 + 2, configurable: true });
    await sleep(2300);
    const line = String(JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").tradeClock);
    assert.match(line, /^Quotex clock \+2\.0\d s against this computer/, line);
    assert.match(line, /left by this computer's clock 4\d\.\d\d s, by Quotex's 4\d\.\d\d s/, line);
  } finally {
    qx.close();
  }
});

// ── v1.75.0: the countdown the way Quotex shows it, kept right by itself ───────────────────────────
// v1.80.1: everything here runs on the page's clock, which a spec can hold still at a chosen moment (`hold`).
function openTradePage({ rowText = null, ahead = 2, rowFollows = null, rowTick = 100 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const store = quotexStore({
    opened: [{ id: "a", asset: "USDDZD_otc", amount: 1000, profit: 0, isDemo: 1, command: 0, openPrice: 100, percentProfit: 80, openTimestamp: now - 10, closeTimestamp: now + 50 }],
  });
  const close = now + 50;
  const clock = { held: null };
  const setup = (w) => {
    const realNow = w.Date.now.bind(w.Date);
    w.Date.now = () => clock.held ?? realNow();
    // Quotex's server clock `ahead` of this computer's from the start, so no row is learnt against a wrong one.
    Object.defineProperty(store.__plot.pointsManager, "targetTime", { get: () => w.Date.now() / 1000 + ahead, configurable: true });
    if (rowText == null && !rowFollows) return;
    const row = w.document.createElement("div");
    row.className = "A7vDd";
    row.innerHTML = '<span class="DBihS">USD/DZD (OTC)</span><span class="PiYD4">' + (rowText || "00:50") + '</span><span class="Os2ep">1,800.00</span>';
    w.document.body.appendChild(row);
    // Quotex's own row counting down against its server clock on a `rowTick` ms tick, rounding the way
    // `rowFollows` says. Worked out when it is read, so a timer running late on a busy machine cannot make it
    // lag more than one tick - that lag, beyond the panel's 0.15 s slack, made the v1.75.2 spec flaky.
    if (rowFollows) {
      const el = row.querySelector(".PiYD4");
      const text = () => "00:" + String(rowFollows(close - (Math.floor(w.Date.now() / rowTick) * rowTick) / 1000 - ahead)).padStart(2, "0");
      Object.defineProperty(el, "textContent", { get: text, configurable: true });
      w.setInterval(() => (el.firstChild.nodeValue = text()), Math.max(rowTick, 100)); // keeps the row's own text in step too
    }
  };
  return { store, close, setup, hold: (ms) => (clock.held = ms) };
}
const chipTime = (qx) => ((chipEl(qx) && chipEl(qx).textContent) || "").match(/\d{2}:\d{2}(\.\d{2})?/)?.[0];
const clockLine = (qx) => String(JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").tradeClock);

test("countdown: with Quotex's trade history on screen, the chip shows its number (v1.75.0)", async () => {
  // Reported live: the chip and Quotex's own countdown for the trade disagreed. Quotex's row reads 00:46,
  // a little off the computed close - it is its number the chip must show.
  const page = openTradePage({ rowText: "00:46" });
  const qx = await boot({ store: page.store, setup: page.setup });
  try {
    await sleep(900);
    assert.equal(chipTime(qx), "00:46", "copied from the trade history");
    await sleep(1500);
    assert.match(clockLine(qx), /Quotex shows 00:46 \(copied\)/);
  } finally {
    qx.close();
  }
});

test("countdown: a row that disagrees with the trade's close time is not copied (v1.75.0)", async () => {
  // Nothing on the page is trusted just for looking like a clock: this row is 17 s off.
  const page = openTradePage({ rowText: "00:30" });
  const qx = await boot({ store: page.store, setup: page.setup });
  try {
    await sleep(900);
    const shown = chipTime(qx);
    assert.notEqual(shown, "00:30", "not the disagreeing row");
    assert.match(shown, /^00:4[6-8]$/, "the close time against Quotex's clock: " + shown);
    await sleep(1500);
    assert.match(clockLine(qx), /not trusted/);
  } finally {
    qx.close();
  }
});

test("countdown: without the trade history, the chip counts against Quotex's server clock (v1.75.0)", async () => {
  // Quotex's clock 5 s ahead of this computer's: 50 s to the close by this clock is 45 by theirs.
  const page = openTradePage({ ahead: 5 });
  const qx = await boot({ store: page.store, setup: page.setup });
  try {
    await sleep(900);
    const shown = chipTime(qx);
    assert.match(shown, /^00:4[2-5]$/, "by Quotex's clock, in whole seconds: " + shown);
    await sleep(1500);
    assert.match(clockLine(qx), /Quotex clock \+5\.\d\d s/);
  } finally {
    qx.close();
  }
});

test("countdown: the rounding is learnt from Quotex's rows (v1.75.0)", async () => {
  // Their rows drop the fraction; after watching them, the fallback does the same.
  const page = openTradePage({ rowFollows: Math.floor });
  const qx = await boot({ store: page.store, setup: page.setup });
  try {
    await sleep(2400);
    // v1.75.2: rounding down is learnt as a shift just above -1.
    const shift = parseFloat((clockLine(qx).match(/shift ([+-]\d+\.\d+) s/) || [])[1]);
    assert.ok(shift <= -0.5 && shift > -1.2, "learnt a shift near -1: " + clockLine(qx));
  } finally {
    qx.close();
  }
});

test("countdown: Quotex's number running ahead of a round-up is learnt, and the fallback follows it (v1.75.2)", async () => {
  // Read live on 1.75.1: 8.84 s left by Quotex's clock while its row showed 00:10. Here their rows run 0.6 s
  // ahead; once the rows are gone, the chip must go on showing what they would have shown.
  const page = openTradePage({ rowFollows: (e) => Math.ceil(e + 0.6) });
  const qx = await boot({ store: page.store, setup: page.setup });
  try {
    await sleep(2400);
    const shift = parseFloat((clockLine(qx).match(/shift ([+-]\d+\.\d+) s/) || [])[1]);
    assert.ok(shift > 0.4 && shift < 0.8, "learnt about +0.6: " + clockLine(qx));
    // The trade history goes off screen: the chip now counts by itself.
    qx.window.document.querySelectorAll(".A7vDd").forEach((row) => row.remove());
    await sleep(400);
    // v1.80.1: read when the time left sits 0.65-0.75 s into its second. There any shift the check above allows
    // gives the same whole second as +0.6, and no shift at all gives one less - so a chip read a moment late
    // cannot pass or fail by luck, and a fallback that ignored the learning would always fail.
    const left = () => page.close - (Date.now() / 1000 + 2);
    while (left() % 1 < 0.65 || left() % 1 > 0.75) await sleep(5);
    const expect = Math.ceil(left() + 0.6),
      shown = parseInt(chipTime(qx).slice(3), 10);
    assert.equal(shown, expect, "the chip shows " + shown + ", their rows would show " + expect + " · " + clockLine(qx));
  } finally {
    qx.close();
  }
});

test("countdown: a trade-history row is learnt as of the moment it was read (v1.80.1)", async () => {
  // The rows are read at most every 200 ms; the seconds left are worked out on every frame. Up to 1.80.0 a row
  // up to 200 ms old was learnt against the seconds left now, which pushed the shift up by as much as the 0.2 s
  // it is there to learn - and the fallback then turned a second before Quotex did. The page's clock is held
  // still here, so each read and each use happens at a chosen moment. Their rows run 0.6 s ahead.
  const page = openTradePage({ rowFollows: (e) => Math.ceil(e + 0.6), rowTick: 1 });
  const qx = await boot({ store: page.store, setup: page.setup });
  try {
    await sleep(600);
    // A moment whose time left is `frac` into its second, `sec` whole seconds from now (close is a whole second).
    const base = Math.ceil(Date.now() / 1000) * 1000 + 1000;
    const at = (sec, frac) => base + sec * 1000 + Math.round((1 - frac) * 1000);
    // 1. A row read 0.42 s into a second (its number turned 0.02 s ago): the shift is above 0.43.
    page.hold(at(0, 0.42));
    await sleep(250);
    // 2. The same row still cached 190 ms later. Learnt against the seconds left then, it says "above 0.62".
    page.hold(at(0, 0.42) + 190);
    await sleep(250);
    // 3. A fresh row 0.39 s into a second (its number about to turn): the shift is at most 0.76.
    page.hold(at(1, 0.39));
    await sleep(250);
    // 4. The rows go; 0.36 s into a second, +0.6 and the learnt middle (0.59-0.61) give the same whole second,
    //    and the 1.80.0 middle (0.69 or more) gives one more.
    qx.window.document.querySelectorAll(".A7vDd").forEach((row) => row.remove());
    page.hold(at(2, 0.36));
    await sleep(300);
    const expect = Math.ceil(page.close - at(2, 0.36) / 1000 - 2 + 0.6),
      shown = parseInt(chipTime(qx).slice(3), 10);
    assert.equal(shown, expect, "the chip shows " + shown + ", their rows would show " + expect);
  } finally {
    qx.close();
  }
});

// ── v1.79.0 (self-healing): Quotex renames "#graph" ────────────────────────────────────────────────
// The chart block was known by that one id, in the panel (the chips live in it) and in the bridge that
// reads the balance, the deals and the candles. A rename would have stopped both without a word.
test("self-healing: the chart block renamed - the data still arrives and the chips still stand on the chart (v1.79.0)", async () => {
  const html = FIXTURE.replace('<div id="graph"><canvas class="layer plot"></canvas></div>', '<div class="xY9zq"><canvas class="k2Pq"></canvas></div>');
  assert.ok(!/id="graph"|layer plot/.test(html), "the fixture really has no known name left");
  const now = Math.floor(Date.now() / 1000);
  const store = quotexStore({
    balance: 43662.072,
    demoBalance: 43662.072,
    activeAccount: "demo",
    opened: [{ id: "a", asset: "USDDZD_otc", amount: 1000, profit: 0, isDemo: 1, command: 0, openPrice: 100, percentProfit: 80, openTimestamp: now - 10, closeTimestamp: now + 50 }],
  });
  const qx = await boot({ html, store });
  try {
    await sleep(900);
    const row = healthRow(qx, "Balance value");
    assert.equal(row.via, "store", "the bridge found the chart and read the platform: " + row.via);
    const box = qx.window.document.querySelector(".xY9zq");
    const chips = [...box.children].filter((d) => (d.style.cssText || "").includes("translate(-50%"));
    assert.ok(chips.some((d) => /[⏱]/.test(d.textContent || "") && visible(d)), "the countdown chip is on the renamed chart");
    assert.ok(chips.some((d) => /win/.test(d.textContent || "") && visible(d)), "and the amount chip");
  } finally {
    qx.close();
  }
});
