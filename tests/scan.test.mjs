// The scan view: one row per pair worth a look, nearest to a level first, without moving the chart.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sleep, quotexStore, makeCandles, boot, bigTfStorage, prefKey } from "./helpers.mjs";

const scanRows = (qx) => [...qx.panelRoot().querySelectorAll(".tcMtfScanRow")];
const scanText = (row) => row.textContent.replace(/\s+/g, " ").trim();
const viewBtn = (qx, view) => qx.panelRoot().querySelector('[data-mtf="view"][data-view="' + view + '"]');
const scanOn = (qx) => qx.panelRoot().getElementById("__tcMTF").classList.contains("tcMtfScanOn");
const header = (qx) => qx.panelRoot().querySelector(".tcMtfScanHdr").textContent;

// A pair's 1m history with a shape of its own, so two pairs are not the same chart twice. `swings`
// controls how far the price wanders, which is what decides where its levels land.
function pairRows(count, endT, price, swing) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const wobble = swing * Math.sin(i / 3.1) + swing * 0.4 * Math.sin(i / 11);
    const o = price + wobble;
    out.push({ t: endT - i * 60, o, h: o + swing * 0.15, l: o - swing * 0.15, c: o + swing * 0.05 });
  }
  return out;
}
const cacheOf = (pairs) => {
  const now = Math.floor(Date.now() / 1000);
  const symbols = {};
  for (const [sym, spec] of Object.entries(pairs)) {
    symbols[sym] = {
      [sym + "@60"]: { candles: pairRows(200, now, spec.price, spec.swing), capturedAt: now, periodSeconds: 60 },
    };
  }
  return JSON.stringify({ v: 2, symbols });
};

// Three pairs in the cache, plus the pair the panel is on, and an asset table that rates them.
async function bootScan({ floor = "80", view = "scan" } = {}) {
  const store = quotexStore();
  store.__candles = makeCandles(300, 60);
  const A = store.assets.assetBySymbol;
  A.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  A.CHFJPY_otc = { symbol: "CHFJPY_otc", label: "CHF/JPY (OTC)", payout: 91, is_otc: 1, active: true };
  A.GBPCAD_otc = { symbol: "GBPCAD_otc", label: "GBP/CAD (OTC)", payout: 92, is_otc: 1, active: true };
  A.NZDCHF_otc = { symbol: "NZDCHF_otc", label: "NZD/CHF (OTC)", payout: 70, is_otc: 1, active: true };
  A.EURJPY_otc = { symbol: "EURJPY_otc", label: "EUR/JPY (OTC)", payout: 94, is_otc: 1, active: false };
  // Clears the floor, but no candles have ever been collected for it.
  A.USDBRL_otc = { symbol: "USDBRL_otc", label: "USD/BRL (OTC)", payout: 92, is_otc: 1, active: true };
  return await boot({
    storage: {
      ...bigTfStorage,
      __tradeCalc_minrp: floor,
      __tradeCalc_mtf_view: view,
      __tradeCalc_mtf_autofill: "0",
      __tradeCalc_mtf_cache: cacheOf({
        AUDCAD_otc: { price: 1.4, swing: 0.004 },
        CHFJPY_otc: { price: 160, swing: 0.5 },
        GBPCAD_otc: { price: 1.7, swing: 0.002 },
      }),
    },
    store,
  });
}

test("scan: the switch shows the board instead of the charts, and back (v1.55.0)", async () => {
  const qx = await bootScan({ view: "charts" });
  try {
    await sleep(1600);
    assert.equal(scanOn(qx), false, "opens on the charts");
    assert.ok(qx.panelRoot().querySelector('.tcMtfCell[data-tf="1m"] canvas'), "the cells are there");

    viewBtn(qx, "scan").dispatchEvent(new qx.window.Event("click", { bubbles: true }));
    await sleep(400);
    assert.equal(scanOn(qx), true, "the switch puts the board up");
    assert.ok(scanRows(qx).length, "with rows on it");
    assert.ok(viewBtn(qx, "scan").classList.contains("tcOn"), "and the switch says which view you are in");
    assert.ok(!viewBtn(qx, "charts").classList.contains("tcOn"));

    viewBtn(qx, "charts").dispatchEvent(new qx.window.Event("click", { bubbles: true }));
    await sleep(400);
    assert.equal(scanOn(qx), false, "and back to the charts");
  } finally {
    qx.close();
  }
});

test("scan: the view it was left in is the view it opens in (v1.55.0)", async () => {
  const qx = await bootScan({ view: "charts" });
  try {
    await sleep(1600);
    viewBtn(qx, "scan").dispatchEvent(new qx.window.Event("click", { bubbles: true }));
    await sleep(300);
    assert.equal(qx.window.localStorage.getItem(prefKey("__tradeCalc_mtf_view")), "scan", "the choice is remembered");
  } finally {
    qx.close();
  }
});

test("scan: a row carries the payout, a direction per timeframe and the nearest level (v1.55.0)", async () => {
  const qx = await bootScan();
  try {
    await sleep(2400);
    const rows = scanRows(qx);
    assert.ok(rows.length >= 4, "every cached pair and the one in front: " + rows.length);
    const aud = rows.find((r) => r.getAttribute("data-sym") === "AUDCAD_otc");
    assert.ok(aud, "AUD/CAD has a row");
    assert.match(scanText(aud), /AUD\/CAD/, scanText(aud));
    assert.match(scanText(aud), /93%/, "with what it pays: " + scanText(aud));
    assert.equal(aud.querySelectorAll(".tcScanTf").length, 3, "one direction per timeframe");
    assert.match(aud.querySelector(".tcScanNear").textContent, /^[RS] [0-9]+[.][0-9]{2}%$/, "and the nearest level, with the side it is on: " + aud.querySelector(".tcScanNear").textContent);
  } finally {
    qx.close();
  }
});

test("scan: nearest to a level comes first (v1.55.0)", async () => {
  const qx = await bootScan();
  try {
    await sleep(2400);
    const judged = scanRows(qx)
      .map((r) => r.querySelector(".tcScanNear").textContent)
      .filter((t) => /%/.test(t) && !/—/.test(t))
      .map((t) => parseFloat(t.replace(/[^0-9.]/g, "")));
    assert.ok(judged.length >= 3, "several pairs could be placed against a level: " + judged.length);
    for (let i = 1; i < judged.length; i++) {
      assert.ok(judged[i] >= judged[i - 1], "ordered by distance: " + judged.join(" "));
    }
  } finally {
    qx.close();
  }
});

test("scan: a pair with no candles still gets a row, behind the ones that have them (v1.55.0)", async () => {
  const qx = await bootScan();
  try {
    await sleep(2400);
    const rows = scanRows(qx);
    const nzd = rows.find((r) => r.getAttribute("data-sym") === "NZDCHF_otc");
    assert.equal(nzd, undefined, "a pair under the payout floor is left off");

    const brl = rows.find((r) => r.getAttribute("data-sym") === "USDBRL_otc");
    assert.ok(brl, "a pair we have never collected still appears, on its payout alone");
    assert.match(brl.querySelector(".tcScanNear").textContent, /—/, "with no level to report");
    assert.match(brl.getAttribute("title"), /no candles yet/, "saying why: " + brl.getAttribute("title"));
    assert.equal(brl.querySelectorAll(".tcScanTf").length, 3, "and a blank direction per timeframe");

    const placed = rows.filter((r) => /%/.test(r.querySelector(".tcScanNear").textContent));
    assert.ok(placed.length, "alongside the ones that could be placed against a level");
    assert.ok(rows.indexOf(brl) > rows.indexOf(placed[placed.length - 1]), "and it sits behind them, not among them");
  } finally {
    qx.close();
  }
});

test("scan: a market that is closed is not offered (v1.55.0)", async () => {
  const qx = await bootScan();
  try {
    await sleep(2400);
    const syms = scanRows(qx).map((r) => r.getAttribute("data-sym"));
    assert.ok(!syms.includes("EURJPY_otc"), "the inactive 94% pair is left off: " + syms.join(","));
  } finally {
    qx.close();
  }
});

test("scan: the header counts what is on the board and the floor it used (v1.55.0)", async () => {
  const qx = await bootScan({ floor: "90" });
  try {
    await sleep(2400);
    assert.match(header(qx), /^[0-9]+ pairs/, header(qx));
    assert.match(header(qx), /90%/, "and the payout floor it filtered on: " + header(qx));
  } finally {
    qx.close();
  }
});

test("scan: clicking a row switches to that pair's tab (v1.55.0)", async () => {
  const tab =
    '<div class="dJ15T vXMlv" data-symbol="AUDCAD_otc"><div class="WRocw">AUD/CAD (OTC)</div><div class="ElyTP">93 %</div></div>';
  const store = quotexStore();
  store.__candles = makeCandles(300, 60);
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const { FIXTURE } = await import("./helpers.mjs");
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>\n          </div>', '<div class="ElyTP">91 %</div>\n          </div>' + tab);
  let activated = 0;
  const setup = (w) =>
    w.document.querySelector('[data-symbol="AUDCAD_otc"] .WRocw').addEventListener("click", () => activated++);
  const qx = await boot({
    html,
    store,
    setup,
    storage: { ...bigTfStorage, __tradeCalc_minrp: "80", __tradeCalc_mtf_view: "scan", __tradeCalc_mtf_autofill: "0" },
  });
  try {
    await sleep(2400);
    const row = scanRows(qx).find((r) => r.getAttribute("data-sym") === "AUDCAD_otc");
    assert.ok(row, "the open pair is on the board");
    row.dispatchEvent(new qx.window.Event("click", { bubbles: true }));
    await sleep(300);
    assert.equal(activated, 1, "clicking it switched to its tab");
  } finally {
    qx.close();
  }
});

test("scan: the charts are not drawn while the board is up (v1.55.0)", async () => {
  const qx = await bootScan();
  try {
    await sleep(1600);
    qx.ctxCalls.length = 0;
    await sleep(1200);
    assert.equal(qx.ctxCalls.length, 0, "nothing was drawn behind the board: " + qx.ctxCalls.slice(0, 6).join(","));
    viewBtn(qx, "charts").dispatchEvent(new qx.window.Event("click", { bubbles: true }));
    await sleep(1200);
    assert.ok(qx.ctxCalls.length, "and drawing resumes when the charts come back");
  } finally {
    qx.close();
  }
});

// ── v1.55.1: the board is a different height from the charts ───────────────────────────────────

// jsdom has no layout, so the panel is given a box to be measured against: 600px tall with its top at
// 500, in a 768px window - a panel whose bottom hangs 332px below the screen.
function giveItABox(panel, { left = 40, top = 500, width = 268, height = 600 } = {}) {
  panel.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
  Object.defineProperty(panel, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(panel, "offsetHeight", { value: height, configurable: true });
}

test("scan: a panel that has never been dragged is still pulled back on screen (v1.55.1)", async () => {
  const qx = await bootScan({ view: "charts" });
  try {
    await sleep(1600);
    const panel = qx.panelRoot().getElementById("__tcMTF");
    // It starts on the corner the stylesheet put it on, with no inline left/top of its own - which is
    // exactly the case the clamp used to give up on, so a taller view could push its bottom, and its
    // resize handles, off the screen with nothing left to grab.
    assert.equal(panel.style.left, "", "it starts on its stylesheet corner");
    giveItABox(panel);

    viewBtn(qx, "scan").dispatchEvent(new qx.window.Event("click", { bubbles: true }));
    await sleep(400);
    assert.match(panel.style.top, /px$/, "the switch pins it so it can be clamped: " + panel.style.top);
    assert.equal(panel.style.right, "auto", "and it is positioned from the left/top from then on");
    const top = parseInt(panel.style.top, 10);
    assert.ok(top >= 2, "inside the window: " + top);
    assert.ok(top + 600 <= qx.window.innerHeight, "with its bottom edge - and its handles - on screen: " + (top + 600) + " of " + qx.window.innerHeight);
  } finally {
    qx.close();
  }
});

test("scan: coming back to the charts clamps the panel too (v1.55.1)", async () => {
  const qx = await bootScan({ view: "scan" });
  try {
    await sleep(1600);
    const panel = qx.panelRoot().getElementById("__tcMTF");
    giveItABox(panel, { top: 700, height: 400 });
    viewBtn(qx, "charts").dispatchEvent(new qx.window.Event("click", { bubbles: true }));
    await sleep(400);
    const top = parseInt(panel.style.top, 10);
    assert.ok(top + 400 <= qx.window.innerHeight, "the charts view is clamped as well: " + top);
  } finally {
    qx.close();
  }
});

// ── v1.55.1: a row is never read as fresher than it is ─────────────────────────────────────────

test("scan: the header counts how many rows are current (v1.55.1)", async () => {
  const qx = await bootScan();
  try {
    await sleep(2400);
    assert.match(header(qx), /[0-9]+ live/, "the header says how many rows are current: " + header(qx));
    // The cache here was written with candles ending now, so those pairs read live.
    const aud = scanRows(qx).find((r) => r.getAttribute("data-sym") === "AUDCAD_otc");
    assert.equal(aud.querySelector(".tcScanAge"), null, "a current row carries no age label");
    assert.match(aud.getAttribute("title"), /live/, "and says so: " + aud.getAttribute("title"));
    const blank = scanRows(qx).find((r) => r.getAttribute("data-sym") === "USDBRL_otc");
    assert.equal(blank.querySelector(".tcScanAge"), null, "and a pair with no candles has no age to show");
  } finally {
    qx.close();
  }
});

test("scan: candles from twenty-five minutes ago are labelled, not passed off as current (v1.55.1)", async () => {
  const store = quotexStore();
  store.__candles = makeCandles(300, 60);
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const now = Math.floor(Date.now() / 1000);
  // 25 minutes: old enough to matter, inside the half-hour after which the cache drops an entry entirely.
  const stale = {
    v: 2,
    symbols: {
      AUDCAD_otc: { "AUDCAD_otc@60": { candles: pairRows(200, now - 1500, 1.4, 0.004), capturedAt: now - 1500, periodSeconds: 60 } },
    },
  };
  const qx = await boot({
    storage: { ...bigTfStorage, __tradeCalc_minrp: "80", __tradeCalc_mtf_view: "scan", __tradeCalc_mtf_autofill: "0", __tradeCalc_mtf_cache: JSON.stringify(stale) },
    store,
  });
  try {
    await sleep(2400);
    const aud = scanRows(qx).find((r) => r.getAttribute("data-sym") === "AUDCAD_otc");
    assert.ok(aud, "the pair still gets a row");
    const age = aud.querySelector(".tcScanAge");
    assert.ok(age, "with its age on it: " + aud.textContent);
    assert.match(age.textContent, /^[0-9]+[hm]$/, "in plain words: " + age.textContent);
    assert.match(aud.getAttribute("title"), /open it to bring them up to date/, aud.getAttribute("title"));
  } finally {
    qx.close();
  }
});
