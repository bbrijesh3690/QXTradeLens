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
