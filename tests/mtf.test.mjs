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
    await sleep(2600); // the canvas redraws every second; allow for a loaded machine running specs in parallel
    const shown = clocksPrinted(qx);
    assert.ok(shown.length, "a countdown was drawn: " + printed(qx).slice(0, 5).join(" "));
    const now = Math.floor(Date.now() / 1000);
    const left = 60 - (now % 60);
    const want = [left, left + 1, left + 2, left + 3, left + 4].map((v) => "00:" + String(((v % 60) + 60) % 60).padStart(2, "0"));
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
    const allLabels = boxes.filter((b) => b[2] > 20);
    // The canvas redraws once a second for the countdown, so read the newest pair of labels.
    const labels = allLabels.slice(-2);
    assert.equal(labels.length, 2, "a price label and a countdown: " + JSON.stringify(allLabels));
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

// ── v1.44.0: zoom and pan, per chart ────────────────────────────────────

function wheelOver(qx, tf, deltaY) {
  const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="' + tf + '"]');
  const canvas = cell.querySelector(".tcMtfCv");
  const ev = new qx.window.Event("wheel", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "deltaY", { value: deltaY });
  Object.defineProperty(ev, "target", { value: canvas });
  canvas.dispatchEvent(ev);
  return cell;
}

test("MTF: the wheel shows more or fewer candles on that chart alone (v1.44.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(900, 15);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1400);
    const oneCellEl = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"]');
    const other = qx.panelRoot().querySelector('.tcMtfCell[data-tf="5m"]');
    const started = oneCellEl._tcCount;
    assert.equal(started, 40, "the panel setting is where it starts");
    wheelOver(qx, "1m", 120); // wheel down: zoom out
    await sleep(300);
    assert.ok(oneCellEl._tcCount > started, "more candles: " + oneCellEl._tcCount);
    assert.equal(other._tcCount, started, "and the other charts are untouched");
    const out = oneCellEl._tcCount;
    wheelOver(qx, "1m", -120); // wheel up: zoom in
    await sleep(300);
    assert.ok(oneCellEl._tcCount < out, "fewer again: " + oneCellEl._tcCount);
  } finally {
    qx.close();
  }
});

test("MTF: the zoom is remembered per timeframe (v1.44.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(900, 15);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1400);
    wheelOver(qx, "15m", 120);
    await sleep(300);
    const saved = JSON.parse(pref(qx, "__tradeCalc_mtf_zoom"));
    assert.ok(saved["15m"] > 40, "the 15m chart kept its own level: " + JSON.stringify(saved));
    assert.equal(saved["1m"], undefined, "and nothing was written for the others");
  } finally {
    qx.close();
  }
});

test("MTF: dragging moves back through older candles (v1.44.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(900, 15);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1400);
    const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"]');
    const canvas = cell.querySelector(".tcMtfCv");
    canvas.setPointerCapture = () => {};
    const send = (type, x) => { const ev = new qx.window.Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(ev, "clientX", { value: x }); Object.defineProperty(ev, "target", { value: canvas }); Object.defineProperty(ev, "pointerId", { value: 1 }); canvas.dispatchEvent(ev); };
    assert.equal(cell._tcPanEndT, null, "starts at the live edge");
    send("pointerdown", 200);
    send("pointermove", 260); // dragged right: back in time
    await sleep(300);
    assert.ok(cell._tcPanEndT, "the chart moved back to older candles");
    send("pointerup", 260);
    // Double-click returns to the live edge.
    canvas.dispatchEvent(new qx.window.Event("dblclick", { bubbles: true }));
    await sleep(300);
    assert.equal(cell._tcPanEndT, null, "and double-click brings it back");
  } finally {
    qx.close();
  }
});

test("MTF: a wheel gesture moves one step, not to the cap (v1.44.1)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(900, 15);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1400);
    const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"]');
    const started = cell._tcCount;
    // A trackpad flick: a stream of small deltas, together about one notch.
    for (let i = 0; i < 8; i++) wheelOver(qx, "1m", 6);
    await sleep(300);
    assert.ok(cell._tcCount > started, "it did zoom: " + cell._tcCount);
    assert.ok(cell._tcCount < started * 1.5, "but one gesture is one step, not a leap: " + cell._tcCount);
    // Ten full notches still cannot run past the cap.
    for (let i = 0; i < 40; i++) wheelOver(qx, "1m", 100);
    await sleep(300);
    assert.equal(cell._tcCount, 240, "and the cap holds: " + cell._tcCount);
  } finally {
    qx.close();
  }
});

// ── v1.45.0: support and resistance ──────────────────────────────────────

// A 1m series with two clean swing highs and two swing lows, strength 3.
function swingSeries(now) {
  const shape = [10,11,12,13,12,11,10, 9, 8, 7, 8, 9,10,11,12,13,14,13,12,11,10, 9, 8, 9,10,11,12];
  const t0 = Math.floor(now / 60) * 60 - shape.length * 60;
  return shape.map((v, i) => ({ t: t0 + i * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + 0.0005, l: 100 + v * 0.001 - 0.0005, c: 100 + v * 0.001 }));
}

const srCellStrokes = (qx, tf) => qx.ctxCalls.filter((c) => c === "stroke:" + ({ "1m": "#5aa9ff", "5m": "#ffb454", "15m": "#c792ea" })[tf]).length;

test("S/R: the levels are drawn on each chart, in that timeframe colour (v1.45.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const bars = swingSeries(now);
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    await sleep(1400); // one redraw
    assert.ok(srCellStrokes(qx, "1m") > 0, "the 1m chart drew its levels");
  } finally {
    qx.close();
  }
});

test("S/R: a timeframe is switched off from its own chart (v1.45.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const bars = swingSeries(now);
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    const chip = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"] [data-mtf="sr"]');
    assert.ok(chip, "a switch on the 1m chart");
    qx.ctxCalls.length = 0;
    await sleep(1400);
    assert.ok(srCellStrokes(qx, "1m") > 0, "levels drawn first");
    chip.click();
    await sleep(400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    assert.equal(srCellStrokes(qx, "1m"), 0, "and gone after one click");
    assert.equal(JSON.parse(pref(qx, "__tradeCalc_sr_tfs"))["1m"], false, "the choice is remembered");
  } finally {
    qx.close();
  }
});

test("S/R: a level is labelled with its side and price, not its timeframe (v1.46.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const bars = swingSeries(now);
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    const labels = printed(qx).filter((t) => /^[RS] - /.test(t));
    assert.ok(labels.length, "levels are labelled: " + printed(qx).slice(0, 6).join(" | "));
    assert.ok(labels.every((l) => /^[RS] - [0-9]+.[0-9]+$/.test(l)), "side and price only: " + labels.join(" "));
    assert.ok(!labels.some((l) => /1m|5m|15m/.test(l)), "no timeframe repeated on the line: " + labels.join(" "));
  } finally {
    qx.close();
  }
});

test("S/R: a level price has fallen through is resistance, not support (v1.46.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // A swing low, then a decline that leaves price well below it.
  const shape = [20,19,18,17,16,15,14,15,16,17,18,19,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3];
  const t0 = Math.floor(now / 60) * 60 - shape.length * 60;
  const bars = shape.map((v, i) => ({ t: t0 + i * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + 0.0004, l: 100 + v * 0.001 - 0.0004, c: 100 + v * 0.001 }));
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    const labels = printed(qx).filter((x) => /^[RS] - /.test(x));
    assert.ok(labels.length, "levels drawn: " + printed(qx).slice(0,6).join(" | "));
    const last = bars[bars.length - 1].c;
    for (const l of labels) {
      const [side, price] = [l.slice(0, 1), parseFloat(l.slice(4))];
      if (price >= last) assert.equal(side, "R", l + " sits above " + last.toFixed(5));
      else assert.equal(side, "S", l + " sits below " + last.toFixed(5));
    }
  } finally {
    qx.close();
  }
});



test("S/R: levels are taken from both sides of the price, nearest first (v1.47.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // Swings up and down, ending between them: there are levels above AND below the last price.
  const shape = [20,24,28,24,20,26,32,28,24,30,36,32,28,34,40,36,32,28,24,20,16,20,24,20,16,12,16,20,16,12,8,12,16,20,24,22];
  const t0 = Math.floor(now / 60) * 60 - shape.length * 60;
  const bars = shape.map((v, i) => ({ t: t0 + i * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + 0.0004, l: 100 + v * 0.001 - 0.0004, c: 100 + v * 0.001 }));
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_count: "120", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    const labels = [...new Set(printed(qx).filter((x) => /^[RS] - /.test(x)))];
    assert.ok(labels.some((x) => x.startsWith("S - ")), "something under the price: " + labels.join(" "));
    assert.ok(labels.some((x) => x.startsWith("R - ")), "and something over it: " + labels.join(" "));
  } finally {
    qx.close();
  }
});

test("S/R: at a new low, the overhead levels are not multiplied to fill the gap (v1.47.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // A fall to a fresh low: every swing is overhead, so only the nearest few are worth drawing.
  const shape = [20,24,28,24,20,26,32,28,24,30,36,32,28,34,40,36,32,28,24,20,16,20,24,20,16,12,16,20,16,12,8,12,16,12,8,4];
  const t0 = Math.floor(now / 60) * 60 - shape.length * 60;
  const bars = shape.map((v, i) => ({ t: t0 + i * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + 0.0004, l: 100 + v * 0.001 - 0.0004, c: 100 + v * 0.001 }));
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_count: "120", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    const labels = [...new Set(printed(qx).filter((x) => /^[RS] - /.test(x)))];
    assert.ok(labels.length && labels.every((x) => x.startsWith("R - ")), "nothing below exists to draw: " + labels.join(" "));
    assert.ok(labels.length <= 3, "and only the nearest three overhead, not all six: " + labels.join(" "));
  } finally {
    qx.close();
  }
});

// Invariants that must hold for ANY instrument, whatever it is priced in: a 5-decimal FX pair, a
// 3-decimal JPY cross, a four-figure exchange rate, a near-zero minor. Same rule, no tuning per asset.
const SCALES = [
  { name: "FX 5dp", base: 0.5613, tick: 0.00002 },
  { name: "JPY 3dp", base: 158.147, tick: 0.004 },
  { name: "four figures", base: 1327.05, tick: 0.35 },
  { name: "near zero", base: 0.00734, tick: 0.0000008 },
];

for (const scale of SCALES) {
  test("S/R: the rule holds on " + scale.name + " (v1.48.0)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const shape = [20,24,28,24,20,26,32,28,24,30,36,32,28,34,40,36,32,28,24,20,16,20,24,20,16,12,16,20,16,12,8,12,16,20,24,22];
    const t0 = Math.floor(now / 60) * 60 - shape.length * 60;
    const bars = shape.map((v, i) => ({ t: t0 + i * 60, o: scale.base + v * scale.tick, h: scale.base + v * scale.tick + scale.tick, l: scale.base + v * scale.tick - scale.tick, c: scale.base + v * scale.tick }));
    const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
    const store = quotexStore();
    store.__candles = [];
    const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_count: "120", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
    try {
      await sleep(1400);
      qx.ctxCalls.length = 0;
      await sleep(1400);
      const labels = [...new Set(printed(qx).filter((x) => /^[RS] - /.test(x)))];
      assert.ok(labels.length, scale.name + ": levels were found at all");
      const last = bars[bars.length - 1].c;
      const R = labels.filter((x) => x.startsWith("R")), S = labels.filter((x) => x.startsWith("S"));
      assert.ok(R.length <= 3, scale.name + ": at most three above - " + R.join(" "));
      assert.ok(S.length <= 3, scale.name + ": at most three below - " + S.join(" "));
      for (const l of labels) {
        const price = parseFloat(l.slice(4));
        assert.ok(isFinite(price), scale.name + ": a readable price in " + l);
        assert.equal(price >= last, l.startsWith("R"), scale.name + ": " + l + " against last " + last);
      }
      assert.equal(new Set(labels.map((l) => l.slice(4))).size, labels.length, scale.name + ": no level drawn twice");
    } finally {
      qx.close();
    }
  });
}

// Where a level begins, and that two of them never print on top of each other.
// Each fillText records its text then its y, so a level label can be paired with where it landed.
const srLabelRows = (qx) => {
  const out = [];
  for (let i = 0; i < qx.ctxCalls.length - 1; i++) {
    const t = qx.ctxCalls[i];
    if (t.startsWith("fillText:") && /^[RS] - /.test(t.slice(9)) && qx.ctxCalls[i + 1].startsWith("textY:")) {
      out.push(parseInt(qx.ctxCalls[i + 1].slice(6), 10));
    }
  }
  return out;
};

test("S/R: every level starts at a candle on the chart (v1.49.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // Far more history than the window shows: the old code picked levels from all of it.
  const bars = [];
  for (let i = 0; i < 400; i++) { const v = 20 + 8 * Math.sin(i / 3) + 4 * Math.sin(i / 11); bars.push({ t: Math.floor(now/60)*60 - (400 - i) * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + 0.0006, l: 100 + v * 0.001 - 0.0006, c: 100 + v * 0.001 }); }
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...oneCell, __tradeCalc_mtf_count: "40", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"]');
    const shown = cell._tcDrawn;
    assert.ok(shown && shown.length, "the chart is drawing candles");
    const firstVisible = shown[0].t, lastVisible = shown[shown.length - 1].t;
    // Every level the chart draws must come from a swing inside that window.
    const labels = [...new Set(printed(qx).filter((x) => /^[RS] - /.test(x)))].map((x) => parseFloat(x.slice(4)));
    assert.ok(labels.length, "levels drawn");
    for (const price of labels) {
      const born = shown.some((b) => Math.abs(b.h - price) < 1e-5 || Math.abs(b.l - price) < 1e-5);
      assert.ok(born, price + " comes from a candle between " + firstVisible + " and " + lastVisible);
    }
  } finally {
    qx.close();
  }
});

test("S/R: levels in the same zone are drawn once, and labels never overlap (v1.49.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // Three swing highs a hair apart - one zone, not three levels.
  const shape = [10,14,18,14,10,14,18.02,14,10,14,18.04,14,10,12,14,12,10,8,6,8,10,12,14,12,10,8,6,4,6,8,10,12,10,8,6,7];
  const t0 = Math.floor(now / 60) * 60 - shape.length * 60;
  const bars = shape.map((v, i) => ({ t: t0 + i * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + 0.0006, l: 100 + v * 0.001 - 0.0006, c: 100 + v * 0.001 }));
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...oneCell, __tradeCalc_mtf_count: "120", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    const labels = [...new Set(printed(qx).filter((x) => /^[RS] - /.test(x)))].map((x) => parseFloat(x.slice(4)));
    const zone = labels.filter((v) => v > 100.017 && v < 100.021);
    assert.ok(zone.length <= 1, "three swings a hair apart are one level: " + zone.join(" "));
    const rows = srLabelRows(qx).sort((a, b) => a - b);
    const distinct = [...new Set(rows)].sort((x, y) => x - y);
    for (let i = 1; i < distinct.length; i++) assert.ok(distinct[i] - distinct[i - 1] >= 8, "labels are not printed on each other: " + distinct.join(" "));
  } finally {
    qx.close();
  }
});

test("S/R: a line runs from its own swing to the newest candle (v1.49.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const bars = [];
  for (let i = 0; i < 200; i++) { const v = 20 + 8 * Math.sin(i / 3.3) + 4 * Math.sin(i / 9); bars.push({ t: Math.floor(now/60)*60 - (200 - i) * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + 0.0006, l: 100 + v * 0.001 - 0.0006, c: 100 + v * 0.001 }); }
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...oneCell, __tradeCalc_mtf_count: "40", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    const cell = qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"]');
    const shown = cell._tcDrawn, slot = cell._tcSlotDrawn;
    assert.ok(shown && shown.length && slot > 0, "the chart drew candles");
    qx.ctxCalls.length = 0;
    await sleep(1400);
    // Segments stroked in the 1m colour, paired with the coordinates just before them.
    const segs = [];
    for (let i = 2; i < qx.ctxCalls.length; i++) {
      if (qx.ctxCalls[i] !== "stroke:#5aa9ff") continue;
      const a2 = qx.ctxCalls[i - 2], b2 = qx.ctxCalls[i - 1];
      if (!a2.startsWith("moveTo:") || !b2.startsWith("lineTo:")) continue;
      segs.push({ x0: +a2.slice(7).split(",")[0], y0: +a2.slice(7).split(",")[1], x1: +b2.slice(7).split(",")[0], y1: +b2.slice(7).split(",")[1] });
    }
    const level = segs.filter((sg) => sg.y0 === sg.y1); // horizontal: a level, not the bar-end upright
    assert.ok(level.length, "level lines were stroked: " + segs.length + " segments");
    const lastCandleRight = Math.round(6 + (shown.length - 0.5) * slot + slot / 2);
    for (const sg of level) {
      assert.ok(Math.abs(sg.x1 - lastCandleRight) <= 2, "ends at the newest candle (" + sg.x1 + " vs " + lastCandleRight + ")");
      assert.ok(sg.x0 >= 5 && sg.x0 < sg.x1, "starts on the chart and before the end: " + sg.x0);
      // its start must line up with one of the candles on screen
      const onACandle = shown.some((b, idx) => Math.abs(sg.x0 - (6 + (idx + 0.5) * slot)) <= 2) || sg.x0 === 6;
      assert.ok(onACandle, "starts at a candle, not an arbitrary x: " + sg.x0);
    }
  } finally {
    qx.close();
  }
});

// ── v1.50.1: zoom and pan across different assets ─────────────────────────────────

// A pair's worth of 1m candles, with its own shape so two pairs are distinguishable.
function pairBars(count, now, seed) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const v = 20 + 8 * Math.sin((i + seed) / 3.3) + 4 * Math.sin((i + seed) / 9);
    out.push({ t: Math.floor(now / 60) * 60 - (count - i) * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + 0.0006, l: 100 + v * 0.001 - 0.0006, c: 100 + v * 0.001 });
  }
  return out;
}
const cellOf = (qx, tf) => qx.panelRoot().querySelector('.tcMtfCell[data-tf="' + tf + '"]');
const dragBack = (qx, cell, px) => {
  const canvas = cell.querySelector(".tcMtfCv");
  canvas.setPointerCapture = () => {};
  const send = (type, x) => {
    const ev = new qx.window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clientX", { value: x });
    Object.defineProperty(ev, "target", { value: canvas });
    Object.defineProperty(ev, "pointerId", { value: 1 });
    canvas.dispatchEvent(ev);
  };
  send("pointerdown", 200);
  send("pointermove", 200 + px);
  send("pointerup", 200 + px);
};

test("zoom: a chart with less history than the zoom asks for still draws (v1.50.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // 70 candles on a 15m chart is what a real pair holds; the zoom asks for far more.
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@900": { candles: pairBars(70, now, 0), capturedAt: now, periodSeconds: 900 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({
    storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_zoom: JSON.stringify({ "15m": 240 }), __tradeCalc_mtf_cache: JSON.stringify(cache) },
    store,
  });
  try {
    await sleep(1400);
    const cell = cellOf(qx, "15m");
    assert.ok(cell._tcDrawn && cell._tcDrawn.length, "the chart drew candles rather than going blank");
    assert.ok(cell._tcDrawn.length <= 70, "it cannot draw more than it has: " + cell._tcDrawn.length);
    assert.ok(!/visit once/.test(mtfCap(qx, "15m")), "and does not claim to be empty: " + mtfCap(qx, "15m"));
  } finally {
    qx.close();
  }
});

test("pan: dragging back then zooming keeps the chart where it was put (v1.50.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: pairBars(400, now, 0), capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...oneCell, __tradeCalc_mtf_count: "40", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    const cell = cellOf(qx, "1m");
    dragBack(qx, cell, 120);
    await sleep(300);
    const anchored = cell._tcPanEndT;
    assert.ok(anchored, "the drag moved it back");
    const shownBefore = cell._tcDrawn.length;
    wheelOver(qx, "1m", 120); // zoom out while panned
    await sleep(400);
    assert.equal(cell._tcPanEndT, anchored, "still anchored at the same moment");
    assert.ok(cell._tcDrawn.length >= shownBefore, "and showing at least as many candles: " + cell._tcDrawn.length);
    assert.ok(cell._tcDrawn.length, "not blank");
  } finally {
    qx.close();
  }
});

test("pan: dragging past the oldest candle stops there (v1.50.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const bars = pairBars(60, now, 0);
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...oneCell, __tradeCalc_mtf_count: "40", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    const cell = cellOf(qx, "1m");
    dragBack(qx, cell, 4000); // far further back than the history goes
    await sleep(400);
    assert.ok(cell._tcDrawn && cell._tcDrawn.length, "the chart is still drawing: " + (cell._tcDrawn || []).length);
    assert.ok(cell._tcPanEndT >= bars[0].t, "it stops at the oldest candle rather than running off the end");
  } finally {
    qx.close();
  }
});

test("pan: switching pair returns the chart to live (v1.50.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const store = quotexStore();
  store.__candles = makeCandles(300, 60);
  const qx = await boot({ storage: { ...oneCell, __tradeCalc_mtf_count: "40" }, store });
  try {
    await sleep(1400);
    const cell = cellOf(qx, "1m");
    dragBack(qx, cell, 120);
    await sleep(300);
    assert.ok(cell._tcPanEndT, "panned back on the first pair");
    setChart(store, "EURUSD_otc", 60, 300); // the trader switches pair
    await sleep(1200);
    assert.equal(cell._tcPanEndT, null, "the new pair opens at the live edge");
    assert.ok(cell._tcDrawn && cell._tcDrawn.length, "and is drawing the new pair");
  } finally {
    qx.close();
  }
});

test("zoom: the level set follows the zoom, on every asset (v1.50.1)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: pairBars(400, now, 0), capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...oneCell, __tradeCalc_mtf_count: "40", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    const tight = [...new Set(printed(qx).filter((x) => /^[RS] - /.test(x)))];
    wheelOver(qx, "1m", 120);
    wheelOver(qx, "1m", 120);
    await sleep(1500);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    const wide = [...new Set(printed(qx).filter((x) => /^[RS] - /.test(x)))];
    assert.ok(tight.length && wide.length, "levels at both zooms: " + tight.length + " then " + wide.length);
    assert.notDeepEqual(wide, tight, "a wider window sees different levels");
  } finally {
    qx.close();
  }
});

test("S/R: a level label never lands on the price or countdown row (v1.51.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // A swing high a hair above the final close: on an 88px cell that level sits within two pixels of
  // the price line, exactly where the price pill and the bar countdown are drawn.
  const shape = [10,14,18,14,10,14,30,14,10,14,18,14,10,14,18,14,12,16,20,16,12,16,20,16,12,16,20,16,14,18,20,18,16,18,20,20];
  const t0 = Math.floor(now / 60) * 60 - shape.length * 60;
  const bars = shape.map((v, i) => ({ t: t0 + i * 60, o: 100 + v * 0.001, h: 100 + v * 0.001 + (i === 30 ? 0.00006 : 0.0004), l: 100 + v * 0.001 - 0.0004, c: 100 + v * 0.001 }));
  bars[bars.length - 1].c = bars[30].h - 0.00002; // price finishing right on that level
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": { candles: bars, capturedAt: now, periodSeconds: 60 } } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...oneCell, __tradeCalc_mtf_count: "120", __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1400);
    qx.ctxCalls.length = 0;
    await sleep(1400);
    // Pair every printed text with the y recorded right after it.
    const printedAt = [];
    for (let i = 0; i < qx.ctxCalls.length - 1; i++) {
      if (qx.ctxCalls[i].startsWith("fillText:") && qx.ctxCalls[i + 1].startsWith("textY:")) {
        printedAt.push({ text: qx.ctxCalls[i].slice(9), y: parseInt(qx.ctxCalls[i + 1].slice(6), 10) });
      }
    }
    const levels = printedAt.filter((x) => /^[RS] - /.test(x.text));
    const priceRow = printedAt.filter((x) => /^[0-9]+[.][0-9]+$/.test(x.text));
    const clocks = printedAt.filter((x) => /^[0-9][0-9]:[0-9][0-9]$/.test(x.text));
    assert.ok(levels.length, "levels were labelled");
    assert.ok(priceRow.length, "the price was labelled");
    for (const l of levels) {
      for (const other of priceRow.concat(clocks)) {
        assert.ok(Math.abs(l.y - other.y) >= 7, l.text + " at " + l.y + " clashes with " + other.text + " at " + other.y);
      }
    }
  } finally {
    qx.close();
  }
});
