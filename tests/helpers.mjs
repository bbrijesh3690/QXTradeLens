// Shared harness for the behaviour tests: the jsdom boot, a fake Quotex store, and the small
// readers each spec leans on. Split out of tests/content.test.mjs so the specs can run as separate
// files - node runs FILES in parallel but not tests within one, and the suite is almost entirely
// waiting on the panel's timers.
//
//   CONTENT_JS=path/to/content.js npm test   -> run the specs against another build
// Behavior tests for the content script, run in jsdom against a copy of the live Quotex DOM.
//
//   npm test                                   -> tests the built extension content.js
//   CONTENT_JS=path/to/content.js npm test     -> tests another build (e.g. the v1.19.0 release)
//
// The panel lives in a closed shadow root; the harness forces shadow roots open so tests can look
// inside. Nothing here touches the network or a real Quotex page.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

const CONTENT_JS = process.env.CONTENT_JS || "qx-calc-updater/qx-calc-updater/content.js";
const FIXTURE = fs.readFileSync(new URL("./fixtures/trade-page.html", import.meta.url), "utf8");
const SOURCE = fs.readFileSync(CONTENT_JS, "utf8");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const istToday = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);

// Today's stop loss in the local backup, so boot skips the daily SL setup modal. Peak balance and a
// take profit above the balance keep the trailing SL from moving during the test.
const slStorage = (sl) => ({
  __tradeCalc_sl_ls_date: istToday(),
  __tradeCalc_sl_ls_value: String(sl),
  __tradeCalc_sl_ls_init_bal: "15228",
  __tradeCalc_tb: "20000",
  __tradeCalc_tp_manual_date: istToday(),
});

// Settings are stored under opaque key names (v1.27.0); this mirrors the extension's prefKey().
function prefKey(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "q" + (h >>> 0).toString(36) + name.length.toString(36);
}
const pref = (qx, name) => qx.window.localStorage.getItem(prefKey(name));

const CHART_READER = fs.readFileSync(new URL("../qx-calc-updater/qx-calc-updater/chart_reader.js", import.meta.url), "utf8");

// A Redux state shaped like Quotex's (paths seen live on 2026-09-15). Tests mutate it to simulate the app.
function quotexStore({ payout = 91, opened = [], closed = [], timeZone = 19800, quotes = {} } = {}) {
  const byId = (list) => Object.fromEntries(list.map((d) => [d.id, d]));
  return {
    chartSettings: { chartById: { c1: { currentAsset: { symbol: "USDDZD_otc" }, dealValue: 2000 } } },
    assets: {
      assetBySymbol: {
        USDDZD_otc: { symbol: "USDDZD_otc", label: "USD/DZD (OTC)", payout, is_otc: 1, active: true },
        EURUSD_otc: { symbol: "EURUSD_otc", label: "EUR/USD (OTC)", payout: 70, is_otc: 1, active: true },
      },
    },
    deals: { openedById: byId(opened), openedIds: opened.map((d) => d.id), closedById: byId(closed), closedIds: closed.map((d) => d.id) },
    global: { currency: "₹", currencyCode: "INR", timeZone },
    quotes: { quoteBySymbol: Object.fromEntries(Object.entries(quotes).map(([k, price]) => [k, { price, time: 1789464900 }])), symbols: Object.keys(quotes) },
    navigationSymbols: { list: ["USDDZD_otc"] },
  };
}
// Candles as the platform stores them: { time, enterValue, maxValue, minValue, exitValue }.
function makeCandles(count, periodSec, startT = 1789830000, price = 100) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const o = price + i * 0.01;
    out.push({ time: startT + i * periodSec, enterValue: o, maxValue: o + 0.05, minValue: o - 0.05, exitValue: o + 0.02 });
  }
  return out;
}

const deal = (id, { profit = 0, isDemo = 1, close = 1789464960, command = 1, openPrice = 256.5, percentProfit = 85 } = {}) => ({
  id, asset: "USDDZD_otc", amount: 2000, profit, isDemo, command, openPrice, percentProfit,
  openTimestamp: close - 60, closeTimestamp: close,
});

async function boot({ path = "/en/demo-trade", storage = slStorage(10000), html = FIXTURE, sync = null, store = null, setup = null } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => {
    if (!/Could not parse CSS stylesheet/.test(e.message)) errors.push(e);
  });
  const dom = new JSDOM(html, {
    url: "https://qxbroker.com" + path,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;

  const shadowRoots = [];
  const attachShadow = window.Element.prototype.attachShadow;
  window.Element.prototype.attachShadow = function (init) {
    const root = attachShadow.call(this, { ...init, mode: "open" });
    shadowRoots.push(root);
    return root;
  };
  // Track observers (for the resource tests, and so teardown can disconnect them before the window closes).
  const observers = [];
  const NativeObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    constructor(cb) {
      super(cb);
      observers.push(this);
    }
  };
  // Track intervals (for the resource tests).
  const intervals = new Set();
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...rest) => {
    const id = nativeSetInterval(fn, ms, ...rest);
    intervals.add(id);
    return id;
  };
  window.clearInterval = (id) => {
    intervals.delete(id);
    return nativeClearInterval(id);
  };
  window.PointerEvent = window.MouseEvent; // not implemented by jsdom
  const ctxCalls = [];
  window.HTMLCanvasElement.prototype.getContext = () => ({
    setTransform: () => ctxCalls.push("setTransform"),
    clearRect: () => ctxCalls.push("clearRect"),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    // The colour is recorded with the stroke so a spec can tell two lines apart (v1.43.1).
    stroke: function () { ctxCalls.push("stroke:" + this.strokeStyle); },
    // Coordinates recorded too, so a spec can check the chart’s layout (v1.42.1).
    fillRect: (x, y, w, h) => ctxCalls.push("fillRect:" + [x, y, w, h].map((v) => Math.round(v)).join(",")),
    // Enough of a text API for the last-price label (v1.38.0); the text itself is recorded so a spec
    // can read what the chart would have printed.
    setLineDash: () => ctxCalls.push("setLineDash"),
    measureText: (t) => ({ width: String(t).length * 5 }),
    // The y is recorded separately so a spec can check that two labels never land on each other,
    // while `printed()` keeps returning plain text (v1.49.0).
    fillText: (t, x, y) => { ctxCalls.push("fillText:" + t); ctxCalls.push("textY:" + Math.round(y)); },
    lineWidth: 1, strokeStyle: "", fillStyle: "", globalAlpha: 1, font: "", textBaseline: "alphabetic",
  });
  // jsdom has no layout; give canvases a size so drawing isn't skipped.
  Object.defineProperty(window.HTMLCanvasElement.prototype, "clientWidth", { get: () => 260, configurable: true });
  Object.defineProperty(window.HTMLCanvasElement.prototype, "clientHeight", { get: () => 88, configurable: true });

  const listeners = new Set();
  const sentMessages = [];
  window.chrome = {
    runtime: {
      onMessage: { addListener: (f) => listeners.add(f), removeListener: (f) => listeners.delete(f) },
      sendMessage: (msg) => sentMessages.push(msg),
    },
  };
  // Optional chrome.storage.sync mock: `sync` is the initial stored object.
  if (sync) {
    window.chrome.storage = {
      sync: {
        data: { ...sync },
        get(keys, cb) {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of list) if (k in this.data) out[k] = this.data[k];
          setTimeout(() => cb(out), 0);
        },
        set(obj, cb) {
          Object.assign(this.data, obj);
          if (cb) setTimeout(cb, 0);
        },
      },
    };
  }
  for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);

  // Optional Quotex store: attach a React fiber to the chart canvas and load the real chart_reader.js.
  if (store) {
    const canvas = window.document.querySelector("#graph canvas.layer.plot");
    const plot = {
      chartId: "c1",
      pointsManager: { candles: store.__candles || [] },
      store: { getState: () => store },
    };
    store.__plot = plot; // tests can swap candles/pair through this
    canvas["__reactFiber$test"] = { stateNode: null, return: { stateNode: { plot }, return: null } };
    window.eval(CHART_READER);
  }
  if (setup) setup(window); // page behavior that must exist before the panel starts
  window.eval(SOURCE);
  await sleep(1100); // the launcher starts the panel after 800 ms

  const api = {
    window,
    errors,
    listeners,
    sentMessages,
    observers,
    intervals,
    ctxCalls,
    isRunning: () => typeof window.__tcCleanup === "function",
    panelRoot: () => shadowRoots.filter((r) => r.host.isConnected).at(-1),
    async navigate(p) {
      window.history.pushState({}, "", p);
      await sleep(350); // the launcher polls the URL every 250 ms
    },
    async sendToPanel(msg) {
      for (const f of Array.from(listeners)) f(msg, {}, () => {});
      await sleep(80);
    },
    askPanel(msg) {
      let response;
      for (const f of Array.from(listeners)) f(msg, {}, (r) => (response = response ?? r));
      return response;
    },
    close: () => {
      observers.forEach((o) => o.disconnect());
      window.close();
    },
  };
  return api;
}

// v1.27.0: Quotex's buttons keep their own state; a blocked trade is stopped before it reaches them.
function tradeReachesPlatform(qx) {
  const btn = qx.window.document.querySelector("#trade-button button");
  let reached = false;
  const onClick = () => (reached = true);
  btn.addEventListener("click", onClick);
  btn.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  btn.removeEventListener("click", onClick);
  return reached;
}
const tradeButtonsGreyed = (qx) =>
  Array.from(qx.window.document.querySelectorAll("#trade-button button")).every((b) => b.style.opacity === "0.55");

const tradeButtonsEnabled = (qx) => !tradeButtonsGreyed(qx) && tradeReachesPlatform(qx);

const slSetupOpen = (qx) => !!qx.panelRoot().getElementById("__tcSLSetup");
const slShown = (qx) => qx.panelRoot().getElementById("__tcSLInput").value;

const healthRow = (qx, name) => qx.askPanel({ type: "GET_HEALTH" }).rows.find((r) => r.name === name);
const overlayShown = (qx) => qx.panelRoot().getElementById("__tcDangerOverlay").classList.contains("tcPercentVisible");

const noSl = { __tradeCalc_tb: "20000" };
async function openSetup(opts = {}) {
  const qx = await boot({ storage: noSl, ...opts });
  await sleep(900); // the panel starts at 800 ms, and the setup screen reads the balance 800 ms after that
  const root = qx.panelRoot();
  return { qx, root, input: root.getElementById("__tcSLSetupInput"), confirm: root.getElementById("__tcSLConfirmBtn") };
}
const typeInto = (qx, input, value) => {
  input.value = value;
  input.dispatchEvent(new qx.window.Event("input", { bubbles: true }));
};

// Offsets 24 h apart (UTC+14 vs UTC−10) always give different calendar dates.
const dayKeyAt = (offsetSec) => new Date(Date.now() + offsetSec * 1000).toISOString().slice(0, 10);
const slForDay = (day) => ({ ...slStorage(10000), __tradeCalc_sl_ls_date: day });

// An open trade closing 45 s from now, with a live price that makes it a winner (command 1 = Down).
const openDealNow = (over = {}) => deal("live-1", { close: Math.floor(Date.now() / 1000) + 45, command: 1, openPrice: 256.5, ...over });

const mtfStorage = {
  ...slStorage(10000),
  __tradeCalc_mtf_on: "1",
  __tradeCalc_mtf_settle: "3", // the shipped default is 15 s; tests use the minimum so they stay quick
  __tradeCalc_mtf_count: "40",
  __tradeCalc_mtf_tfs: JSON.stringify(["15s", "1m", "5m"]),
};
const mtfCap = (qx, tf) => qx.panelRoot().querySelector('.tcMtfCell[data-tf="' + tf + '"] .tcMtfCap').textContent;
// Point the fake chart at a pair and a timeframe, the way switching pair/timeframe does on the site.
function setChart(store, symbol, periodSec, count = 200) {
  store.chartSettings.chartById.c1.currentAsset.symbol = symbol;
  store.__plot.pointsManager.candles = makeCandles(count, periodSec, 1789830000, symbol === "USDDZD_otc" ? 100 : 200);
}

const mtfPairLabel = (qx) => qx.panelRoot().querySelector('[data-mtf="pair"]').textContent;

// Plain OHLC rows, the shape the cache stores (the chart bridge's shape is converted on the way in).
function rows(count, sec, endT, price = 100) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const o = price + i * 0.01;
    out.push({ t: endT - i * sec, o, h: o + 0.05, l: o - 0.05, c: o + 0.02 });
  }
  return out;
}
const bigTfStorage = { ...mtfStorage, __tradeCalc_mtf_tfs: JSON.stringify(["1m", "5m", "15m"]) };

const graphChips = (qx) => [...qx.window.document.querySelectorAll("#graph > div")].filter((d) => (d.style.cssText || "").includes("translate(-50%"));
const chipEl = (qx) => graphChips(qx).find((d) => /[⏱]/.test(d.textContent || "")) || null;
const projEl = (qx) => graphChips(qx).find((d) => /win/.test(d.textContent || "")) || null;
const visible = (el) => !!el && el.style.display !== "none";

// A settled deal keeps its row on the page; the platform just fills in the profit.
function settledRow(doc, pair = "USD/ARS (OTC)") {
  const row = doc.createElement("div");
  row.className = "ib6yR";
  row.innerHTML =
    '<span class="Fqtla">closed</span><span class="DBihS">' + pair + '</span>' +
    '<span class="PiYD4">00:00:15</span><span class="Os2ep">2,615.64</span>';
  doc.body.appendChild(row);
  return row;
}

const hkStorage = { ...slStorage(10000), __tradeCalc_hk_updown: "true" };
const pressArrow = (qx, code) =>
  qx.window.document.dispatchEvent(
    new qx.window.KeyboardEvent("keydown", { key: code === "ArrowUp" ? "ArrowUp" : "ArrowDown", code, bubbles: true }),
  );

const amtStorage = { ...slStorage(10000), __tradeCalc_hk_leftright: "true" };
const pressSideArrow = (qx, code) =>
  qx.window.document.dispatchEvent(
    new qx.window.KeyboardEvent("keydown", { key: code, code, bubbles: true, cancelable: true }),
  );
const stakeField = (qx) => qx.window.document.querySelector(".deal-amount-input input.input-control__input");

export {
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
};
