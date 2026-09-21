// Filling a pair's charts: when the walk runs, what holds it back, and what the panel says it is doing.


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

// ── v1.31.0: saying why, instead of quietly doing nothing ────────────────────────────

test("health: the auto-fill says what it is waiting for (v1.31.0)", async () => {
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_settle: "30" }, store });
  try {
    await sleep(3600);
    const row = healthRow(qx, "Charts auto-fill");
    assert.ok(row, "the check reports on it at all");
    assert.match(row.value, /settling \(\d+s\)/, "and counts the wait down: " + row.value);
  } finally {
    qx.close();
  }
});

test("health: after the fill, the status says when it ran (v1.31.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const full = (sec) => ({
    candles: rows(60, sec, Math.floor(now / sec) * sec),
    capturedAt: now,
    periodSeconds: sec,
  });
  const cache = {
    v: 2,
    symbols: { USDDZD_otc: { "USDDZD_otc@60": full(60), "USDDZD_otc@300": full(300), "USDDZD_otc@900": full(900) } },
  };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(5200); // settle, walk, and land on the resting state
    const row = healthRow(qx, "Charts auto-fill");
    assert.equal(row.status, "ok");
    // v1.35.0: opening a pair always fills, so the resting state is "filled this pair N ago".
    assert.match(row.value, /filled this pair|filling/, row.value);
  } finally {
    qx.close();
  }
});

test("health: a walk that fills nothing does not cost the pair its cooldown (v1.31.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // 5m bars only, and no live chart: the 1m chart is blank and the walk has nothing to collect.
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
    await sleep(4600); // settle, walk, and come back empty
    const row = healthRow(qx, "Charts auto-fill");
    assert.ok(!/filled this pair/.test(row.value), "not marked done for ten minutes: " + row.value);
  } finally {
    qx.close();
  }
});

test("health: the report says which build the tab is running (v1.31.0)", async () => {
  const qx = await boot();
  try {
    const report = qx.askPanel({ type: "GET_HEALTH" });
    assert.match(String(report.build), /^\d+\.\d+\.\d+$/, "a real version, not the placeholder: " + report.build);
  } finally {
    qx.close();
  }
});

test("MTF: a blank chart says what is happening to it (v1.31.1)", async () => {
  const store = quotexStore();
  store.__candles = [];
  // A long wait, so the chart is blank and the fill has not started.
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_settle: "60" }, store });
  try {
    await sleep(2000);
    assert.match(mtfCap(qx, "5m"), /visit once/, mtfCap(qx, "5m"));
  } finally {
    qx.close();
  }
});

test("diagnostics: the panel leaves a readable record of what it is doing (v1.31.2)", async () => {
  const store = quotexStore({ opened: [deal("a")] });
  store.__candles = [];
  const qx = await boot({ storage: bigTfStorage, store });
  try {
    // The pair has to arrive from the store, then settle for three seconds, before the auto-fill judges it.
    await sleep(5600);
    const diag = JSON.parse(pref(qx, "__tradeCalc_diag"));
    assert.match(String(diag.build), /^[0-9]+[.][0-9]+[.][0-9]+$/, "the build the tab is running: " + diag.build);
    assert.equal(diag.pair, "USDDZD_otc");
    assert.match(diag.autofill, /filling|filled|settling|ready/, diag.autofill);
    assert.ok(diag.openTrades >= 1, "and how many trades it can see");
    assert.ok(Date.now() - diag.at < 5000, "written just now");
  } finally {
    qx.close();
  }
});

// ── v1.32.0: "enough bars", not "any bars" ─────────────────────────────────────────

test("MTF: a chart with a handful of bars is filled, not called ready (v1.32.0)", async () => {
  // Exactly what was measured live: a short 1m history, which folds to six bars of 15m out of forty.
  const now = Math.floor(Date.now() / 1000);
  const cache = {
    v: 2,
    symbols: {
      USDDZD_otc: {
        "USDDZD_otc@60": { candles: rows(97, 60, Math.floor(now / 60) * 60), capturedAt: now, periodSeconds: 60, derived: true },
      },
    },
  };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(1200);
    assert.ok(!/visit once/.test(mtfCap(qx, "15m")), "it does have bars, just not many: " + mtfCap(qx, "15m"));
    assert.match(mtfCap(qx, "15m"), /\/40 bars/, mtfCap(qx, "15m"));
    await sleep(3000);
    const row = healthRow(qx, "Charts auto-fill");
    assert.ok(!/ready/.test(row.value), "a six-bar chart is not 'ready': " + row.value);
    assert.match(row.value, /filling/, "it goes and fills it: " + row.value);
  } finally {
    qx.close();
  }
});

test("MTF: a short chart says the fill is coming instead of asking for ↻ (v1.32.0)", async () => {
  // v1.36.0: with the trade gate gone, what it says is that the fill is under way.
  const now = Math.floor(Date.now() / 1000);
  const cache = {
    v: 2,
    symbols: {
      USDDZD_otc: {
        "USDDZD_otc@60": { candles: rows(97, 60, Math.floor(now / 60) * 60), capturedAt: now, periodSeconds: 60, derived: true },
      },
    },
  };
  const store = quotexStore({ opened: [deal("a")] });
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(2000);
    assert.match(mtfCap(qx, "15m"), /bars/, mtfCap(qx, "15m"));
  } finally {
    qx.close();
  }
});

// ── v1.33.0: how long a pair must stay put before it is filled ──────────────────────────────

test("MTF: a pair passed through is not filled; one you stay on is (v1.33.0)", async () => {
  const store = quotexStore();
  store.__candles = [];
  // Ten seconds of settling: long enough that a glance does not trigger a walk.
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_settle: "10" }, store });
  try {
    await sleep(4200);
    let row = healthRow(qx, "Charts auto-fill");
    assert.match(row.value, /settling/, "still counting down: " + row.value);
    assert.ok(!/filling/.test(row.value), "and nothing has been fetched yet");
    await sleep(7000);
    row = healthRow(qx, "Charts auto-fill");
    assert.match(row.value, /filling/, "once the pair has stayed put, it fills: " + row.value);
  } finally {
    qx.close();
  }
});

test("MTF: the wait defaults to none and is clamped to sane values (v1.36.0)", async () => {
  const plain = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_settle: undefined } });
  try {
    assert.equal(plain.askPanel({ type: "GET_STATE" }).mtfSettle, 0, "fills the moment you open a pair");
    await plain.sendToPanel({ type: "SET_MTF", settle: 999 });
    assert.equal(plain.askPanel({ type: "GET_STATE" }).mtfSettle, 120, "clamped at the top");
    await plain.sendToPanel({ type: "SET_MTF", settle: -5 });
    assert.equal(plain.askPanel({ type: "GET_STATE" }).mtfSettle, 0, "and at the bottom");
  } finally {
    plain.close();
  }
});

// ── v1.35.0: opening a pair is the trigger ──────────────────────────────────

test("MTF: opening a pair fills it even when its charts already have bars (v1.35.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // Charts that the old "is it thin?" test would have called full, so no walk would have run.
  const full = (sec) => ({ candles: rows(60, sec, Math.floor(now / sec) * sec), capturedAt: now, periodSeconds: sec });
  const cache = { v: 2, symbols: { USDDZD_otc: { "USDDZD_otc@60": full(60), "USDDZD_otc@300": full(300), "USDDZD_otc@900": full(900) } } };
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(4200);
    const row = healthRow(qx, "Charts auto-fill");
    assert.match(row.value, /filling|filled this pair/, "the pair was opened, so it gets a walk: " + row.value);
  } finally {
    qx.close();
  }
});

test("MTF: a pair already filled is not walked again straight away (v1.35.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: bigTfStorage, store });
  try {
    await sleep(4200);
    assert.match(healthRow(qx, "Charts auto-fill").value, /filling|filled/, "filled on open");
    await sleep(9000); // the walk gives each timeframe up to 2.5 s to deliver
    const row = healthRow(qx, "Charts auto-fill");
    assert.match(row.value, /filled this pair/, "and then it leaves the pair alone: " + row.value);
  } finally {
    qx.close();
  }
});

// ── v1.36.0: at once, and never held back by a trade ────────────────────────

test("MTF: with no wait set, opening a pair fills it straight away (v1.36.0)", async () => {
  const store = quotexStore();
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_settle: "0" }, store });
  try {
    await sleep(1400); // the panel itself starts at 800 ms
    assert.match(healthRow(qx, "Charts auto-fill").value, /filling|filled/, "no countdown first");
  } finally {
    qx.close();
  }
});

test("MTF: the refresh button works while a trade is open (v1.36.0)", async () => {
  const store = quotexStore({ opened: [deal("a")] });
  store.__candles = makeCandles(200, 15);
  // Auto-fill off, so the only thing that can start a walk is the button itself.
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0" }, store });
  try {
    await sleep(1200);
    const before = mtfPairLabel(qx);
    qx.panelRoot().querySelector('[data-mtf="sync"]').click();
    await sleep(300);
    assert.ok(!/not while a trade/.test(mtfPairLabel(qx)), "no refusal: " + mtfPairLabel(qx));
    assert.match(healthRow(qx, "Charts auto-fill").value, /filling now|switched off/, "the walk is running");
    assert.ok(before !== null);
  } finally {
    qx.close();
  }
});

test("MTF: the walk waits while history is still arriving (v1.52.0)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(60, 60);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_tfs: JSON.stringify(["1m"]) }, store });
  try {
    await sleep(1200);
    // The platform keeps sending: a few more candles every poll, the way a timeframe loads in.
    let n = 60;
    const feed = setInterval(() => { n += 8; store.__plot.pointsManager.candles = makeCandles(n, 60); }, 120);
    qx.panelRoot().querySelector('[data-mtf="sync"]').click();
    await sleep(1800);
    const panel = qx.panelRoot().getElementById("__tcMTF");
    const busyWhileArriving = panel.classList.contains("tcMtfBusy");
    clearInterval(feed);
    // Leaving at fifty candles would have finished this long ago.
    assert.ok(busyWhileArriving, "still collecting while candles keep arriving");
    await sleep(2500);
    assert.ok(!panel.classList.contains("tcMtfBusy"), "and stops once they stop");
  } finally {
    qx.close();
  }
});

test("MTF: the cache is held under its ceiling (v1.53.0)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // Six pairs with deep history: far more than the cache is allowed to keep.
  const bars = (n) => { const out=[]; for (let i=0;i<n;i++) out.push({ t: now - (n-i)*60, o: 1.2345+i*1e-5, h: 1.2350+i*1e-5, l: 1.2340+i*1e-5, c: 1.2346+i*1e-5 }); return out; };
  const symbols = {};
  for (const sym of ["USDDZD_otc","A_otc","B_otc","C_otc","D_otc","E_otc"]) {
    symbols[sym] = { [sym+"@60"]: { candles: bars(900), capturedAt: now, periodSeconds: 60 }, [sym+"@300"]: { candles: bars(400), capturedAt: now, periodSeconds: 300 }, [sym+"@900"]: { candles: bars(400), capturedAt: now, periodSeconds: 900 } };
  }
  const store = quotexStore();
  store.__candles = makeCandles(200, 15);
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify({ v: 2, symbols }) }, store });
  try {
    await sleep(1200);
    setChart(store, "EURUSD_otc", 60); // a pair change forces the cache to be written
    await sleep(1200);
    const written = pref(qx, "__tradeCalc_mtf_cache") || "";
    assert.ok(written.length, "the cache was written");
    assert.ok(written.length <= 300 * 1024, "and kept under the ceiling: " + Math.round(written.length/1024) + " KB");
    const back = JSON.parse(written);
    assert.ok(Object.keys(back.symbols).length >= 1, "with pairs still in it");
  } finally {
    qx.close();
  }
});

test("MTF: an empty walk does not claim the pair was filled (v1.53.0)", async () => {
  const store = quotexStore();
  store.__candles = []; // nothing for the walk to collect
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_settle: "0" }, store });
  try {
    // Sample across the whole cycle: walk, come back empty, wait, try again. At no point should the
    // panel claim the pair was filled.
    const seen = [];
    for (let i = 0; i < 14; i++) { await sleep(1000); seen.push(healthRow(qx, "Charts auto-fill").value); }
    const claims = seen.filter((v) => /filled this pair/.test(v));
    assert.deepEqual(claims, [], "a fill was never claimed: " + [...new Set(seen)].join(" | "));
  } finally {
    qx.close();
  }
});
