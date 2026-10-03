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
  // v1.67.0: the SL is this one value, kept until it is changed. The _ls_ keys below are the per-day backup
  // the panel used to keep; it now deletes them on load, and they stay here only as what an existing
  // install has in storage.
  __tradeCalc_sl: String(sl),
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
function quotexStore({ payout = 91, opened = [], closed = [], timeZone = 19800, quotes = {}, balance, liveBalance, demoBalance, activeAccount } = {}) {
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
    // v1.57.0: the account figures live here, as they do on the live page. Left undefined by default so
    // the specs written before the balance came from the store still exercise the markup path.
    global: { currency: "₹", currencyCode: "INR", timeZone, balance, liveBalance, demoBalance, activeAccount },
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

async function boot({ path = "/en/demo-trade", storage = slStorage(10000), html = FIXTURE, sync = null, local = null, store = null, setup = null } = {}) {
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
    // Coordinates recorded so a spec can check WHERE a line was drawn, not just that it was (v1.49.1).
    moveTo: (x, y) => ctxCalls.push("moveTo:" + Math.round(x) + "," + Math.round(y)),
    lineTo: (x, y) => ctxCalls.push("lineTo:" + Math.round(x) + "," + Math.round(y)),
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
      // A live extension context has an id; after an extension reload the old script loses it (v1.69.0).
      id: "test-extension",
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
  // Optional chrome.storage.local mock (v1.69.0: the deposit scan result waits here for the ⚙ menu).
  if (local) {
    window.chrome.storage = window.chrome.storage || {};
    window.chrome.storage.local = {
      data: { ...local },
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
      remove(keys) {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete this.data[k];
      },
    };
  }
  for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);

  // Optional Quotex store: attach a React fiber to the chart canvas and load the real chart_reader.js.
  if (store) {
    const canvas = window.document.querySelector("#graph canvas.layer.plot") || window.document.querySelector("canvas");
    const plot = {
      chartId: "c1",
      pointsManager: { candles: store.__candles || [] },
      store: { getState: () => store },
    };
    store.__plot = plot; // tests can swap candles/pair through this
    // Quotex's server clock, as the live chart has it: level with this computer's unless a spec moves it.
    Object.defineProperty(plot.pointsManager, "targetTime", { get: () => window.Date.now() / 1000, configurable: true });
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
    shadowRoots,
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

// A background tab (v1.85.0). Chrome wakes a hidden tab's timers on a grid - once a second, and after five
// minutes once a minute - and draws no frames, which is what the live log showed on 2026-10-03 (steps exactly
// 60 s apart, and a pair list that never finished appearing). Call it from `setup`, before the panel starts:
// while hidden, a timeout that comes due waits for the next wake-up, an interval runs once per wake-up, and
// animation frames are held until the tab is shown. hide() / show() are the user switching away and back.
function backgroundTab(w, wakeMs = 1200) {
  const st = w.setTimeout.bind(w),
    si = w.setInterval.bind(w),
    ct = w.clearTimeout.bind(w),
    raf = w.requestAnimationFrame.bind(w);
  const tab = { hidden: false, wakeUps: 0 };
  let due = [];
  const heldFrames = [];
  const pendingIntervals = new Set();
  Object.defineProperty(w.document, "hidden", { get: () => tab.hidden, configurable: true });
  Object.defineProperty(w.document, "visibilityState", { get: () => (tab.hidden ? "hidden" : "visible"), configurable: true });
  w.setTimeout = (fn, ms, ...a) => {
    const id = st(() => {
      if (!tab.hidden) return fn(...a);
      due.push({ id, run: () => fn(...a) });
    }, ms);
    return id;
  };
  w.clearTimeout = (id) => {
    due = due.filter((d) => d.id !== id);
    return ct(id);
  };
  w.setInterval = (fn, ms, ...a) => {
    const tick = () => fn(...a);
    return si(() => {
      if (!tab.hidden) return tick();
      pendingIntervals.add(tick);
    }, ms);
  };
  w.requestAnimationFrame = (fn) => {
    if (!tab.hidden) return raf(fn);
    heldFrames.push(fn);
    return 0;
  };
  const wake = () => {
    tab.wakeUps++;
    const q = due;
    due = [];
    q.forEach((d) => d.run());
    const p = [...pendingIntervals];
    pendingIntervals.clear();
    p.forEach((t) => t());
  };
  si(() => {
    if (tab.hidden) wake();
  }, wakeMs);
  tab.hide = () => {
    tab.hidden = true;
    w.document.dispatchEvent(new w.Event("visibilitychange"));
  };
  tab.show = () => {
    tab.hidden = false;
    heldFrames.splice(0).forEach((f) => f(Date.now())); // the first frame drawn after coming back
    wake();
    w.document.dispatchEvent(new w.Event("visibilitychange"));
  };
  return tab;
}

// The trade page with its pair list behaving the way the live log read on 2026-10-03 (v1.85.0): "+" beside the
// tabs opens the list, whose rows are in the page at once while the list itself fades in on the next frame; a
// pick opens the pair's tab and leaves the list open (the panel closes it); its Close button takes it away.
// Beside the fixture's own tab there is EUR/JPY (OTC) at 91% with a close control - the pair a spec lets fall.
//   lastTabLow:  one tab only, below the floor, with no close control (Quotex gives the last tab none).
//   awayOnPlus:  the user switches to another browser tab at the moment "+" is pressed.
//   unlisted:    pairs the platform rates that the list is not showing (another category).
//   renamed:     "names" - every class and id on the page has a fresh name, as after one of Quotex's renames;
//                "all"   - and the tabs have lost their pair code (`data-symbol`) as well. Either way the "+"
//                sits beside the tabs and the list has its search box, as on the live page, and a row is just
//                a name and a percent.
//   payoutField: the name Quotex's data carries the payout under ("payout", unless a spec renames it).
// `page.tab` is the backgroundTab; `page.said()` is what the page saw, in order.
const FLOOR_LIST = [
  ["EUR/USD (OTC)", 70, "EURUSD_otc"],
  ["AUD/CAD (OTC)", 93, "AUDCAD_otc"],
  ["GBP/JPY (OTC)", 95, "GBPJPY_otc"],
];
function floorPage({ lastTabLow = false, awayOnPlus = false, list = FLOOR_LIST, unlisted = [], renamed = false, payoutField = "payout" } = {}) {
  const store = quotexStore({ payout: lastTabLow ? 70 : 91 });
  const A = store.assets.assetBySymbol;
  for (const [label, payout, symbol] of [...list, ...unlisted]) A[symbol] = { symbol, label, payout, is_otc: 1, active: true };
  if (!lastTabLow) A.EURJPY_otc = { symbol: "EURJPY_otc", label: "EUR/JPY (OTC)", payout: 91, is_otc: 1, active: true };
  if (payoutField !== "payout") {
    for (const a of Object.values(A)) {
      a[payoutField] = a.payout;
      delete a.payout;
    }
  }
  const names = new Map();
  const fresh = (old) => {
    if (!renamed) return old;
    if (!names.has(old)) names.set(old, "z" + (names.size + 1).toString(36) + "Qx");
    return names.get(old);
  };
  const cls = (s) => s.split(/\s+/).map(fresh).join(" ");
  let html = FIXTURE;
  if (lastTabLow) {
    html = html.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>').replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>');
  }
  if (renamed) {
    html = html
      .replace('<div class="Q02Z1">', '<div class="Q02Z1"></div><button class="xP4qa" id="plus">+</button><div class="Hm2vT">')
      .replace(/<!--[^]*?-->/g, "")
      .replace(/ (class|id)="([^"]*)"/g, (m, attr, v) => ` ${attr}="${cls(v)}"`);
    if (renamed === "all") html = html.replace(/ data-[a-z-]+="[^"]*"/g, "");
  } else {
    html = html.replace('<div id="graph">', '<div id="asset-select--button"><button id="plus">+</button></div><div id="graph">');
  }
  const events = []; // what the page saw: { what, hidden, at }
  const page = { store, html, events, tab: null };
  page.setup = (w) => {
    const doc = w.document;
    page.tab = backgroundTab(w);
    const note = (what) => events.push({ what, hidden: page.tab.hidden, at: Date.now() });
    const LIST_CLASS = fresh("a_IoG"),
      ROW_CLASS = fresh("R2Rgm");
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      // jsdom has no layout: the list and its rows get a box while they are on the page.
      if (this.classList && (this.classList.contains(LIST_CLASS) || this.classList.contains(ROW_CLASS))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    const tabBar = doc.querySelector("." + fresh(renamed ? "Hm2vT" : "Q02Z1"));
    const added = new Map(); // symbol -> { el, label, pct }
    const addTab = (symbol, label, pct) => {
      const tab = doc.createElement("div");
      tab.className = cls("dJ15T vXMlv");
      if (renamed !== "all") tab.setAttribute("data-symbol", symbol);
      tab.innerHTML =
        '<div class="' + fresh("WRocw") + '">' + label + '</div><div class="' + fresh("ElyTP") + '">' + pct + ' %</div>' +
        '<button aria-label="Close"><svg class="' + fresh("icon-close-tiny") + '"><use href="#icon-close-tiny"></use></svg></button>';
      tab.querySelector("button").addEventListener("click", () => {
        note("closed " + label);
        tab.remove();
        added.delete(symbol);
      });
      tabBar.appendChild(tab);
      added.set(symbol, { el: tab, label });
    };
    if (!lastTabLow) addTab("EURJPY_otc", "EUR/JPY (OTC)", 91);
    let away = awayOnPlus,
      listEl = null;
    doc.getElementById(fresh("plus")).addEventListener("click", () => {
      if (listEl && listEl.isConnected) {
        note("+ closed the list");
        listEl.remove();
        return;
      }
      note("+ opened the list");
      if (away) {
        away = false;
        page.tab.hide();
      }
      const el = (listEl = doc.createElement("div"));
      el.className = LIST_CLASS;
      el.style.opacity = "0"; // fades in on the next frame - which a background tab never draws
      if (renamed) el.innerHTML = '<input type="text" placeholder="Search">';
      for (const [label, pct, symbol] of list) {
        const row = doc.createElement("div");
        row.className = ROW_CLASS;
        row.innerHTML = renamed
          ? "<span>" + label + "</span><b>" + pct + " %</b>"
          : '<div class="teoXG">' + label + '</div><div class="mQX6T">' + pct + ' %</div>';
        row.addEventListener("click", () => {
          if (added.has(symbol)) return;
          note("opened " + label);
          addTab(symbol, label, pct);
        });
        el.appendChild(row);
      }
      const close = doc.createElement("button");
      close.setAttribute("aria-label", "Close");
      close.textContent = "x";
      close.addEventListener("click", () => {
        note("list closed");
        el.remove();
      });
      el.appendChild(close);
      doc.getElementById(fresh("graph")).before(el);
      w.requestAnimationFrame(() => (el.style.opacity = "1"));
    });
    // A pair's payout falls: the platform's own figure and what its tab prints.
    page.fall = (symbol, pct) => {
      store.assets.assetBySymbol[symbol][payoutField] = pct;
      added.get(symbol).el.children[1].textContent = pct + " %";
    };
    page.tabs = () => ["USD/DZD (OTC)", ...[...added.values()].map((t) => t.label)];
    page.list = () => (!listEl || !listEl.isConnected ? "not on the page" : listEl.style.opacity === "1" ? "open, on screen" : "in the page, not on screen");
  };
  page.said = (hidden) => events.filter((e) => hidden === undefined || e.hidden === hidden).map((e) => e.what);
  return page;
}
// Waits until `ok()` holds, for at most `ms`; says whether it did.
const until = async (ok, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (ok()) return true;
    await sleep(100);
  }
  return ok();
};

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
  backgroundTab,
  FLOOR_LIST,
  floorPage,
  until,
};
