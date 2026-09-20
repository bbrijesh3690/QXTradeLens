// The multi-timeframe charts: collecting candles, keeping them per pair, folding a finer timeframe
// up into a coarser one, and never leaving a chart on a stale snapshot.


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

// ── v1.26.0: multi-timeframe panel ─────────────────────────────────────────────────────────────────

test("MTF: candles collected for one pair survive switching pairs (v1.26.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15); // chart starts on 15s
  const qx = await boot({ storage: mtfStorage, store });
  try {
    await sleep(900);
    assert.ok(!/visit once/.test(mtfCap(qx, "15s")), "15s collected while the chart is on 15s");
    // Move the chart to 1m: 15s can no longer be derived, only recalled.
    setChart(store, "USDDZD_otc", 60);
    await sleep(900);
    // Switch to another pair, then back.
    setChart(store, "EURUSD_otc", 60);
    await sleep(900);
    setChart(store, "USDDZD_otc", 60);
    await sleep(900);
    assert.ok(!/visit once/.test(mtfCap(qx, "15s")), "15s data is still there after coming back: " + mtfCap(qx, "15s"));
  } finally {
    qx.close();
  }
});

test("MTF: cached candles show immediately on load, before any chart pull (v1.27.1)", async () => {
  // A cache from an earlier session, and a chart that has no candles yet.
  const now = Math.floor(Date.now() / 1000);
  const candles = [];
  for (let i = 0; i < 200; i++) {
    const o = 100 + i * 0.01;
    candles.push({ t: now - (200 - i) * 15, o, h: o + 0.05, l: o - 0.05, c: o + 0.02 });
  }
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@15": { candles, capturedAt: now, periodSeconds: 15 } } } };
  const storage = { ...mtfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) };
  const store = quotexStore();
  store.__candles = []; // the chart itself has nothing to give
  const qx = await boot({ storage, store });
  try {
    await sleep(700);
    assert.ok(!/visit once/.test(mtfCap(qx, "1m")), "1m derived from the cached 15s candles: " + mtfCap(qx, "1m"));
  } finally {
    qx.close();
  }
});
test("MTF: the cache keeps several pairs (v2 format)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 60);
  const qx = await boot({ storage: mtfStorage, store });
  try {
    await sleep(900);
    setChart(store, "EURUSD_otc", 60);
    await sleep(1200);
    const cache = JSON.parse(pref(qx, "__tradeCalc_mtf_cache"));
    assert.equal(cache.v, 2);
    assert.deepEqual(Object.keys(cache.symbols).sort().join(","), "EURUSD_otc,USDDZD_otc");
    // Only what the charts can show is stored.
    const kept = cache.symbols.USDDZD_otc["USDDZD_otc@60"].candles.length;
    assert.ok(kept <= 200, "stored candles are trimmed, got " + kept);
  } finally {
    qx.close();
  }
});

test("MTF: a timeframe derived from finer candles says how many bars it has", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(60, 60); // 1 hour of 1m candles
  const qx = await boot({ storage: mtfStorage, store });
  try {
    await sleep(900);
    // 60 x 1m -> 12 bars of 5m, against a requested 40.
    assert.match(mtfCap(qx, "5m"), /\d+\/40 bars · ↻/);
    assert.match(mtfCap(qx, "5m"), /^≈/, "marked as derived");
  } finally {
    qx.close();
  }
});

test("MTF: header shows the pair label and marks the chart's own timeframe", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 60);
  const qx = await boot({ storage: mtfStorage, store });
  try {
    await sleep(900);
    const root = qx.panelRoot();
    assert.equal(root.querySelector('[data-mtf="pair"]').textContent, "USD/DZD (OTC)");
    const label = (tf) => root.querySelector('.tcMtfCell[data-tf="' + tf + '"] .tcMtfTf').style.color;
    assert.match(label("1m"), /accent/, "1m is the chart timeframe");
    assert.equal(label("5m"), "");
  } finally {
    qx.close();
  }
});
// ── v1.30.0: multi-timeframe panel, second pass ───────────────────────────────────

test("MTF: clicking a cell's timeframe puts the platform chart on it (v1.30.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: mtfStorage, store });
  try {
    await sleep(900);
    // The platform's timeframe button, as the site renders it.
    const tfBtn = qx.window.document.createElement("div");
    tfBtn.className = "HgaSf";
    tfBtn.textContent = "15s";
    qx.window.document.body.appendChild(tfBtn);
    let opened = 0;
    tfBtn.addEventListener("click", () => opened++);
    qx.panelRoot().querySelector('.tcMtfCell[data-tf="5m"] .tcMtfTf').click();
    assert.match(mtfPairLabel(qx), /5m/, "the panel says where the chart is going");
    await sleep(400);
    assert.equal(opened, 1, "the platform's own timeframe menu was opened");
  } finally {
    qx.close();
  }
});

test("MTF: the pair name comes back after a message (v1.30.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  // Auto-fill off: its own "filling …" message would be the one on screen, not the one under test.
  const qx = await boot({ storage: { ...mtfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(900);
    qx.panelRoot().querySelector('.tcMtfCell[data-tf="15s"] .tcMtfTf').click(); // already on 15s
    assert.match(mtfPairLabel(qx), /chart is on/);
    await sleep(400);
    assert.match(mtfPairLabel(qx), /chart is on/, "the 200 ms render does not wipe it straight away");
    await sleep(1800);
    assert.equal(mtfPairLabel(qx), "USD/DZD (OTC)", "and the pair name returns on its own");
  } finally {
    qx.close();
  }
});

test("MTF: 15s candles are folded into a rolling 1m history (v1.30.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15); // 50 minutes of 15s bars
  const qx = await boot({ storage: mtfStorage, store });
  try {
    await sleep(900);
    setChart(store, "EURUSD_otc", 60); // switching pairs writes the cache immediately
    await sleep(900);
    const cache = JSON.parse(pref(qx, "__tradeCalc_mtf_cache"));
    const entries = cache.symbols.USDDZD_otc;
    const base = entries["USDDZD_otc@60"];
    assert.ok(base, "a 1m entry exists although the chart was never on 1m: " + Object.keys(entries).join(","));
    assert.ok(base.candles.length >= 45, "about one bar per minute of 15s data, got " + base.candles.length);
    assert.equal(base.derived, true, "and it is marked as folded, not a real 1m pull");
  } finally {
    qx.close();
  }
});

test("MTF: a folded 1m entry still reads as derived in the cell (v1.30.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: mtfStorage, store });
  try {
    await sleep(900);
    assert.match(mtfCap(qx, "1m"), /^≈/, "1m is folded from 15s, so it stays marked approximate");
  } finally {
    qx.close();
  }
});

test("MTF: an empty pair is filled once, by itself (v1.30.0)", async () => {
  const store = quotexStore();
  store.__candles = []; // a pair with nothing to draw
  const qx = await boot({ storage: mtfStorage, store });
  try {
    assert.match(mtfCap(qx, "5m"), /visit once/, "nothing to show at the start");
    await sleep(4200); // the auto-fill waits for the pair to settle
    assert.match(mtfPairLabel(qx), /filling/, "it went and got the candles");
  } finally {
    qx.close();
  }
});

test("MTF: auto-fill stays out of the way when it is switched off, and fills with a trade open (v1.36.0)", async () => {
  const off = await boot({ storage: { ...mtfStorage, __tradeCalc_mtf_autofill: "0" }, store: (() => { const s = quotexStore(); s.__candles = []; return s; })() });
  try {
    await sleep(4200);
    assert.equal(mtfPairLabel(off), "USD/DZD (OTC)", "switched off: the panel is left alone");
  } finally {
    off.close();
  }
  // v1.36.0: an open trade is not a reason to hold off — the walk changes the view, not the trade.
  const busy = (() => { const s = quotexStore({ opened: [deal("a")] }); s.__candles = []; return s; })();
  const qx = await boot({ storage: mtfStorage, store: busy });
  try {
    await sleep(4200);
    assert.match(healthRow(qx, "Charts auto-fill").value, /filling|filled/, "it fills anyway");
  } finally {
    qx.close();
  }
});

// ── v1.30.1: a cell is never left on a snapshot ─────────────────────────────────────

test("MTF: a stale 15m snapshot is brought up to date from the 1m history (v1.30.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / 900) * 900;
  const cache = {
    v: 2,
    symbols: {
      USDDZD_otc: {
        // Quotex's own 15m bars, captured five minutes ago and frozen there.
        "USDDZD_otc@900": { candles: rows(60, 900, bucket), capturedAt: now - 300, periodSeconds: 900 },
        // The rolling 1m history, still being folded from the live chart.
        "USDDZD_otc@60": { candles: rows(600, 60, Math.floor(now / 60) * 60), capturedAt: now, periodSeconds: 60, derived: true },
      },
    },
  };
  const store = quotexStore();
  store.__candles = []; // nothing live, so only the cache decides what the cell shows
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    const cap = mtfCap(qx, "15m");
    assert.ok(!/ago/.test(cap), "not frozen on the five-minute-old snapshot: " + cap);
    assert.match(cap, /live/, "the tail is redrawn from the 1m history: " + cap);
    // The point of the merge: the platform own 15m history is KEPT and only the tail is re-folded.
    // Falling back to the 1m history wholesale would draw a shorter, entirely derived chart.
    assert.ok(!/≈/.test(cap), "still backed by native bars, not purely folded: " + cap);
    assert.ok(!/bars/.test(cap), "and long enough to fill the cell: " + cap);
  } finally {
    qx.close();
  }
});

test("MTF: the freshest source wins, not the coarsest (v1.30.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cache = {
    v: 2,
    symbols: {
      USDDZD_otc: {
        // A 5m entry left behind by an old walk, and a 1m history from a moment ago.
        "USDDZD_otc@300": { candles: rows(100, 300, Math.floor(now / 300) * 300), capturedAt: now - 600, periodSeconds: 300 },
        "USDDZD_otc@60": { candles: rows(600, 60, Math.floor(now / 60) * 60), capturedAt: now, periodSeconds: 60, derived: true },
      },
    },
  };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    // 15m can be folded from either the 10-minute-old 5m entry or the current 1m one.
    const cap = mtfCap(qx, "15m");
    assert.ok(!/ago/.test(cap), "the stale 5m entry is not what the 15m cell folds: " + cap);
  } finally {
    qx.close();
  }
});

test("MTF: auto-fill runs when only some cells are blank (v1.30.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // 5m bars only: 5m and 15m can be drawn, 1m cannot be built from them at all.
  const cache = {
    v: 2,
    symbols: {
      USDDZD_otc: {
        "USDDZD_otc@300": { candles: rows(100, 300, Math.floor(now / 300) * 300), capturedAt: now, periodSeconds: 300 },
      },
    },
  };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    assert.match(mtfCap(qx, "1m"), /visit once/, "the 1m cell has nothing it can fold from");
    assert.ok(!/visit once/.test(mtfCap(qx, "5m")), "while 5m is fine");
    await sleep(3200);
    assert.match(mtfPairLabel(qx), /filling/, "one blank cell is enough to go and get it");
  } finally {
    qx.close();
  }
});

// ── v1.37.0: bars built from part of a period ──────────────────────────────

// A 1m history with a hole in the middle: the panel was not watching for twenty of these minutes.
function baseWithHole(now) {
  const bars = rows(120, 60, Math.floor(now / 60) * 60);
  for (let i = 40; i < 60; i++) bars[i].part = true; // folded from part of the minute
  return { candles: bars, capturedAt: now, periodSeconds: 60, derived: true };
}

test("MTF: a chart built over a gap says so (v1.37.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": baseWithHole(now) } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    assert.match(mtfCap(qx, "15m"), /gaps/, mtfCap(qx, "15m"));
    const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="15m"]');
    assert.match(cell.title, /part of the period/, "and explains it on hover");
  } finally {
    qx.close();
  }
});

test("MTF: a complete history is not marked, and the forming bar alone is not a gap (v1.37.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: rows(120, 60, Math.floor(now / 60) * 60), capturedAt: now, periodSeconds: 60, derived: true } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    const cap = mtfCap(qx, "15m");
    assert.ok(!/gaps/.test(cap), "the newest bar is always part-formed; that is not a hole: " + cap);
  } finally {
    qx.close();
  }
});

// ── v1.38.0: a price to read the shape against ────────────────────────────

const printed = (qx) => qx.ctxCalls.filter((c) => c.startsWith("fillText:")).map((c) => c.slice(9));

test("MTF: each chart prints its last price (v1.38.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15); // closes run 100.02, 100.03, ...
  const qx = await boot({ storage: { ...mtfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1200);
    const labels = printed(qx);
    assert.ok(labels.length, "something was printed on the charts");
    // The fake feed ends at 100 + 199 x 0.01 + 0.02 = 102.01, to the decimals the data carries.
    assert.ok(labels.some((l) => l.startsWith("102.0")), "the last close: " + labels.slice(0, 4).join(" "));
  } finally {
    qx.close();
  }
});

test("MTF: the price label keeps the decimals the instrument moves in (v1.38.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // A five-decimal pair, the way Quotex quotes FX.
  const bars = rows(60, 60, Math.floor(now / 60) * 60).map((b, i) => ({ ...b, o: 0.57192, h: 0.57221, l: 0.5718, c: 0.57204 + i * 0.00001 }));
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    const labels = printed(qx);
    assert.ok(labels.some((l) => l.split(".")[1] && l.split(".")[1].length === 5), "five decimals, not rounded: " + labels.slice(0, 4).join(" "));
  } finally {
    qx.close();
  }
});

test("MTF: one noisy close does not stretch the price label (v1.38.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // Live data from the platform: a five-decimal pair whose feed slips in 1.6146266 now and then.
  const bars = rows(60, 60, Math.floor(now / 60) * 60).map((b, i) => ({
    ...b,
    o: 1.61441, h: 1.61472, l: 1.61402,
    c: i === 57 ? 1.6146266 : Number((1.61441 + i * 0.00001).toFixed(5)),
  }));
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    const labels = printed(qx);
    assert.ok(labels.length, "a label was printed");
    const tooLong = labels.filter((l) => (l.split(".")[1] || "").length > 5);
    assert.equal(tooLong.length, 0, "five decimals, not six: " + labels.slice(0, 4).join(" "));
  } finally {
    qx.close();
  }
});

// ── v1.39.0: marking a chart when it turns ────────────────────────────────────────

const flipMark = (qx, tf) => qx.panelRoot().querySelector('.tcMtfCell[data-tf="' + tf + '"] .tcMtfFlip').textContent;
// A 1m feed in the platform's shape, rising then falling.
const feed = (count, from, step, startT = 1789830000) => {
  const out = [];
  for (let i = 0; i < count; i++) {
    const o = from + i * step;
    out.push({ time: startT + i * 60, enterValue: o, maxValue: o + 0.05, minValue: o - 0.05, exitValue: o + step });
  }
  return out;
};

test("MTF: a chart that turns is marked, and a steady one is not (v1.39.0)", async () => {
  const store = quotexStore();
  store.__candles = feed(40, 100, 0.05); // rising
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1200);
    assert.equal(flipMark(qx, "1m"), "", "the first look records the direction, it does not announce one");
    // The same feed, carrying on downwards.
    const falling = feed(40, 100, 0.05).concat(
      feed(6, 101.95, -0.08, 1789830000 + 40 * 60).map((c) => c),
    );
    store.__plot.pointsManager.candles = falling;
    await sleep(900);
    assert.equal(flipMark(qx, "1m"), "▼", "it turned down");
    const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"] .tcMtfFlip');
    assert.match(cell.title, /turned down over its last 3 closed bars/, cell.title);
  } finally {
    qx.close();
  }
});

test("MTF: the mark can be switched off (v1.39.0)", async () => {
  const store = quotexStore();
  store.__candles = feed(40, 100, 0.05);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_flip: "0" }, store });
  try {
    await sleep(1200);
    store.__plot.pointsManager.candles = feed(40, 100, 0.05).concat(feed(6, 101.95, -0.08, 1789830000 + 40 * 60));
    await sleep(900);
    assert.equal(flipMark(qx, "1m"), "", "switched off: nothing is marked");
  } finally {
    qx.close();
  }
});

test("MTF: a chart with gaps in it is never marked (v1.39.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // A 1m history that turns, but with a stretch nobody was watching.
  const bars = rows(60, 60, Math.floor(now / 60) * 60).map((b, i) => ({
    ...b,
    c: i < 50 ? 100 + i * 0.05 : 102.5 - (i - 50) * 0.08,
  }));
  for (let i = 20; i < 30; i++) bars[i].part = true;
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60, derived: true } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    assert.match(mtfCap(qx, "15m"), /gaps/, "the 15m chart has holes: " + mtfCap(qx, "15m"));
    assert.equal(flipMark(qx, "15m"), "", "so no signal is taken from it");
  } finally {
    qx.close();
  }
});

test("MTF: the bars per trend is a setting, clamped (v1.39.0)", async () => {
  const qx = await boot({ storage: bigTfStorage });
  try {
    assert.equal(qx.askPanel({ type: "GET_STATE" }).mtfFlipBars, 3, "default");
    await qx.sendToPanel({ type: "SET_MTF", flipBars: 99 });
    assert.equal(qx.askPanel({ type: "GET_STATE" }).mtfFlipBars, 10, "clamped at the top");
    await qx.sendToPanel({ type: "SET_MTF", flipBars: 1 });
    assert.equal(qx.askPanel({ type: "GET_STATE" }).mtfFlipBars, 2, "and at the bottom");
    await qx.sendToPanel({ type: "SET_MTF", flip: false });
    assert.equal(qx.askPanel({ type: "GET_STATE" }).mtfFlip, false, "and the switch carries");
  } finally {
    qx.close();
  }
});

// ── v1.40.0: reading a single bar ────────────────────────────────────────

// jsdom has no layout, so give the canvas a box the hover maths can use.
function hoverBar(qx, tf, barsFromLeft) {
  const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="' + tf + '"]');
  const canvas = cell.querySelector(".tcMtfCv");
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 260, height: 88, right: 260, bottom: 88 });
  const slot = cell._tcSlotDrawn || 6;
  const ev = new qx.window.Event("pointermove", { bubbles: true });
  Object.defineProperty(ev, "clientX", { value: 6 + slot * (barsFromLeft + 0.5) });
  Object.defineProperty(ev, "clientY", { value: 40 });
  Object.defineProperty(ev, "target", { value: canvas });
  canvas.dispatchEvent(ev);
  return cell;
}

test("MTF: hovering a bar reads it out in the caption (v1.40.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: { ...mtfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1200);
    const before = mtfCap(qx, "1m");
    hoverBar(qx, "1m", 3);
    const during = mtfCap(qx, "1m");
    assert.notEqual(during, before, "the caption changed to the bar under the pointer");
    assert.ok(/^[0-9][0-9]:[0-9][0-9] /.test(during), "it starts with the bar time: " + during);
    assert.ok(during.includes(" H ") && during.includes(" L "), "and carries the high and low: " + during);
    assert.ok(!/[0-9]{7}/.test(during.split(" ")[2] || ""), "without float noise: " + during);
  } finally {
    qx.close();
  }
});

test("MTF: the pointer leaving puts the chart status back (v1.40.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: { ...mtfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1200);
    const before = mtfCap(qx, "1m");
    hoverBar(qx, "1m", 5);
    assert.notEqual(mtfCap(qx, "1m"), before);
    const panel = qx.panelRoot().getElementById("__tcMTF");
    panel.dispatchEvent(new qx.window.Event("pointerleave", { bubbles: false }));
    await sleep(400);
    assert.equal(mtfCap(qx, "1m"), before, "back to the chart status");
  } finally {
    qx.close();
  }
});

// ── v1.41.0: time left on the bar now forming ────────────────────────────

const barClock = (qx, tf) => qx.panelRoot().querySelector('.tcMtfCell[data-tf="' + tf + '"] .tcMtfCd').textContent;

const oneCell = { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_tfs: JSON.stringify(["1m"]) };
const clocksPrinted = (qx) => printed(qx).filter((t) => /^\d{2}:\d{2}$/.test(t));

test("MTF: the chart prints the time left on its forming bar (v1.42.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: oneCell, store });
  try {
    await sleep(1200);
    qx.ctxCalls.length = 0; // watch one redraw
    await sleep(1400); // the canvas redraws every second so the countdown ticks
    const shown = clocksPrinted(qx);
    assert.ok(shown.length, "a countdown was drawn: " + printed(qx).slice(0, 5).join(" "));
    const now = Math.floor(Date.now() / 1000);
    const left = 60 - (now % 60);
    const want = [left, left + 1, left + 2].map((v) => "00:" + String(v % 60).padStart(2, "0"));
    assert.ok(
      shown.some((t) => want.includes(t)),
      "matching the wall clock: drew " + shown.join(" ") + ", expected one of " + want.join(" "),
    );
  } finally {
    qx.close();
  }
});

test("MTF: the countdown is clock-based, so an empty chart still has one (v1.41.0)", async () => {
  const store = quotexStore();
  store.__candles = []; // nothing to draw at all
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1200);
    assert.match(mtfCap(qx, "15m"), /visit once/, "the chart has no candles");
    assert.match(barClock(qx, "15m"), /^[0-9]+:[0-9][0-9]$/, "but it still knows when the bar ends: " + barClock(qx, "15m"));
  } finally {
    qx.close();
  }
});

test("MTF: panned back into history, there is no bar to count down (v1.41.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: oneCell, store });
  try {
    await sleep(1400);
    assert.ok(clocksPrinted(qx).length, "counting at first");
    const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"]');
    cell._tcPanEndT = cell._tcRows[Math.max(0, cell._tcRows.length - 10)].t; // dragged back ten bars
    await sleep(400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    assert.deepEqual(clocksPrinted(qx), [], "nothing is forming in the past");
    assert.equal(barClock(qx, "1m"), "", "and no copy in the header either");
  } finally {
    qx.close();
  }
});

test("MTF: price on the right, countdown clear of the candles (v1.42.1)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: oneCell, store });
  try {
    await sleep(1200);
    qx.ctxCalls.length = 0;
    await sleep(1400); // one redraw, carrying both labels
    const boxes = qx.ctxCalls.filter((c) => c.startsWith("fillRect:")).map((c) => c.slice(9).split(",").map(Number));
    assert.ok(boxes.length > 2, "candles and labels were drawn");
    // The two label boxes are the ones on the price line; the candles are thin and tall.
    const labels = boxes.filter((b) => b[2] > 20);
    assert.equal(labels.length, 2, "a price label and a countdown: " + JSON.stringify(labels));
    const [clock, price] = labels[0][0] < labels[1][0] ? labels : [labels[1], labels[0]];
    assert.ok(price[0] + price[2] >= 255, "the price sits against the right edge: " + price.join(","));
    assert.ok(clock[0] + clock[2] + 4 <= price[0], "with the countdown clear to its left: " + clock.join(","));
    const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"]');
    const lastCandleRight = 6 + (cell._tcDrawn.length - 0.5) * (cell._tcSlotDrawn || 6);
    assert.ok(clock[0] >= lastCandleRight, "and a gap after the last candle: " + clock[0] + " vs " + Math.round(lastCandleRight));
  } finally {
    qx.close();
  }
});

// ── v1.43.0: the same moment on every chart ──────────────────────────────

const hoveredBar = (qx, tf) => {
  const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="' + tf + '"]');
  return cell._tcHoverIdx == null ? null : cell._tcDrawn[cell._tcHoverIdx];
};

test("MTF: hovering one chart marks the same moment on the others (v1.43.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(900, 15); // enough history for all three charts
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1400);
    hoverBar(qx, "1m", 12);
    const one = hoveredBar(qx, "1m");
    assert.ok(one, "a 1m bar is under the pointer");
    for (const [tf, sec] of [["5m", 300], ["15m", 900]]) {
      const bar = hoveredBar(qx, tf);
      assert.ok(bar, tf + " picked a bar too");
      assert.ok(bar.t <= one.t && one.t < bar.t + sec, tf + " bar " + bar.t + " holds the 1m bar at " + one.t);
    }
  } finally {
    qx.close();
  }
});

test("MTF: it reads the other way too - a 15m bar marks the first minute inside it (v1.43.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(900, 15);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1400);
    // The newest 15m bar: the 1m chart only shows about forty minutes, so an older one is genuinely
    // off its screen and correctly gets no crosshair.
    const wideCell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="15m"]');
    hoverBar(qx, "15m", wideCell._tcDrawn.length - 1);
    const wide = hoveredBar(qx, "15m");
    assert.ok(wide, "a 15m bar is under the pointer");
    const minute = hoveredBar(qx, "1m");
    assert.ok(minute, "the 1m chart followed");
    assert.equal(minute.t, wide.t, "and landed on the first minute of that fifteen");
  } finally {
    qx.close();
  }
});

test("MTF: leaving clears every chart, not just the one hovered (v1.43.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(900, 15);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1400);
    hoverBar(qx, "1m", 8);
    assert.ok(hoveredBar(qx, "15m"), "marked while hovering");
    const panel = qx.panelRoot().getElementById("__tcMTF");
    panel.dispatchEvent(new qx.window.Event("pointerleave", { bubbles: false }));
    await sleep(300);
    for (const tf of ["1m", "5m", "15m"]) assert.equal(hoveredBar(qx, tf), null, tf + " cleared");
  } finally {
    qx.close();
  }
});

test("MTF: the crosshair does not look like the bar-end line (v1.43.1)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: oneCell, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    hoverBar(qx, "1m", 20);
    const strokes = qx.ctxCalls.filter((c) => c.startsWith("stroke:")).map((c) => c.slice(7));
    const colours = [...new Set(strokes)];
    assert.ok(colours.includes("#e8eefc"), "the crosshair is drawn in its own colour: " + colours.join(" "));
    assert.ok(colours.includes("#9fb3d9"), "the bar-end line keeps its own: " + colours.join(" "));
  } finally {
    qx.close();
  }
});
