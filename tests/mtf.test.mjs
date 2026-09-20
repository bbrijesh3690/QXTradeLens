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
