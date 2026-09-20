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
