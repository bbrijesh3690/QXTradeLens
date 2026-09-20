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
    stroke: () => ctxCalls.push("stroke"),
    fillRect: () => ctxCalls.push("fillRect"),
    lineWidth: 1, strokeStyle: "", fillStyle: "", globalAlpha: 1,
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

// ── Bug 1: panel toggled itself off on in-app URL changes ─────────────────────────────────────────

test("panel starts on a trade page", async () => {
  const qx = await boot();
  try {
    assert.equal(qx.isRunning(), true);
    assert.ok(qx.panelRoot().getElementById("__tradeCalc"), "panel element exists");
  } finally {
    qx.close();
  }
});

test("bug 1: in-app URL changes between trade pages keep the panel running", async () => {
  const qx = await boot();
  try {
    await qx.navigate("/en/demo-trade?asset=EURUSD_otc");
    assert.equal(qx.isRunning(), true, "after query change");
    await qx.navigate("/en/trade");
    assert.equal(qx.isRunning(), true, "after demo -> live switch");
    await qx.navigate("/en/demo-trade");
    assert.equal(qx.isRunning(), true, "after live -> demo switch");
  } finally {
    qx.close();
  }
});

test("bug 1: leaving the trade pages removes the panel and coming back restores it", async () => {
  const qx = await boot();
  try {
    await qx.navigate("/en/balance");
    assert.equal(qx.isRunning(), false, "removed on /en/balance");
    await qx.navigate("/en/demo-trade");
    assert.equal(qx.isRunning(), true, "restored on /en/demo-trade");
  } finally {
    qx.close();
  }
});

test("bug 1: arriving at a trade page from another Quotex page starts the panel", async () => {
  const qx = await boot({ path: "/en/balance" });
  try {
    assert.equal(qx.isRunning(), false, "not on /en/balance");
    await qx.navigate("/en/demo-trade");
    assert.equal(qx.isRunning(), true, "started after navigating to the trade page");
  } finally {
    qx.close();
  }
});

test("bug 1: turning the panel off from the popup sticks across navigation", async () => {
  const qx = await boot();
  try {
    await qx.sendToPanel({ type: "TOGGLE_PANEL" });
    assert.equal(qx.isRunning(), false, "toggled off");
    await qx.navigate("/en/demo-trade?asset=EURUSD_otc");
    assert.equal(qx.isRunning(), false, "still off after navigation");
    await qx.sendToPanel({ type: "TOGGLE_PANEL" });
    assert.equal(qx.isRunning(), true, "toggled back on");
  } finally {
    qx.close();
  }
});

test("bug 1: a relaunched panel leaves exactly one popup message listener", async () => {
  const qx = await boot();
  try {
    const initial = qx.listeners.size; // launcher listener + panel listener
    await qx.navigate("/en/balance");
    await qx.navigate("/en/demo-trade");
    assert.equal(qx.isRunning(), true);
    assert.equal(qx.listeners.size, initial, "no stale listener from the torn-down panel");
  } finally {
    qx.close();
  }
});

// ── Bug 2: investment not read, so the SL-breach guard and projections were dead ───────────────────

// ── v1.21.0: the stop loss never blocks trading ───────────────────────────────────────────────────

const tradeButtonsEnabled = (qx) => !tradeButtonsGreyed(qx) && tradeReachesPlatform(qx);

test("SL: a stake that would take balance below the stop loss is not blocked", async () => {
  // balance 15,228 − stake 2,000 = 13,228, which is ≤ SL 14,000
  const qx = await boot({ storage: slStorage(14000) });
  try {
    assert.equal(tradeButtonsEnabled(qx), true, "Up/Down stay enabled");
    assert.doesNotMatch(qx.panelRoot().getElementById("__tcWarn").textContent, /stop loss/i);
  } finally {
    qx.close();
  }
});

test("SL: a breach (balance at or below SL) doesn't block, lock Set limit, or lock the site", async () => {
  // balance 15,228 is already below SL 16,000; system lock explicitly enabled
  const storage = { ...slStorage(16000), __tradeCalc_sl_ls_init_bal: "20000", __tradeCalc_sys_lock_disabled: "0" };
  const html = FIXTURE.replace('<div id="graph">', '<button type="button">Set limit</button><div id="graph">');
  const qx = await boot({ storage, html });
  try {
    await sleep(2200); // breach handling waits ~1.8 s after the last open trade
    assert.equal(tradeButtonsEnabled(qx), true, "Up/Down stay enabled");
    const setLimit = Array.from(qx.window.document.querySelectorAll("button")).find((b) => b.textContent === "Set limit");
    assert.equal(setLimit.disabled, false, "Quotex Set limit button not locked");
    assert.equal(pref(qx, "__tradeCalc_native_limit_lock_date"), null);
    assert.deepEqual(qx.sentMessages.filter((m) => m.type === "SYS_LOCK"), [], "no SYS_LOCK sent");
  } finally {
    qx.close();
  }
});

test("SL: a lock date stored by an older version is cleared", async () => {
  const storage = { ...slStorage(10000), __tradeCalc_native_limit_lock_date: istToday() };
  const qx = await boot({ storage });
  try {
    assert.equal(pref(qx, "__tradeCalc_native_limit_lock_date"), null);
  } finally {
    qx.close();
  }
});

test("bug 2: win/loss projection uses the stake from the Investment field", async () => {
  const qx = await boot();
  try {
    const doc = qx.window.document;
    // win: 15,228 − 2,000 + 3,580 payout = 16,808 · loss: 15,228 − 2,000 = 13,228
    assert.equal(doc.querySelector(".__tcProjBalWin").textContent, "↑ 16,808.00 ₹");
    assert.equal(doc.querySelector(".__tcProjBalLoss").textContent, "↓ 13,228.00 ₹");
    const buttons = doc.querySelectorAll("#trade-button button");
    assert.equal(tradeReachesPlatform(qx), true, "not blocked when SL is safe");
  } finally {
    qx.close();
  }
});

test("bug 2: a percent stake is converted to money using the balance", async () => {
  const html = FIXTURE.replace('value="2000"', 'value="10%"');
  const qx = await boot({ html });
  try {
    // 10% of 15,228 = 1,522.80 → loss 13,705.20
    assert.equal(qx.window.document.querySelector(".__tcProjBalLoss").textContent, "↓ 13,705.20 ₹");
  } finally {
    qx.close();
  }
});

test("bug 2: without .deal-amount-input the Investment <legend> is used, never the Time field", async () => {
  const html = FIXTURE.replace('class="deal-amount-input"', 'class="xYz12"');
  const qx = await boot({ html });
  try {
    assert.equal(qx.window.document.querySelector(".__tcProjBalLoss").textContent, "↓ 13,228.00 ₹");
  } finally {
    qx.close();
  }
});

// ── Bug 4: take-profit step shortcut ───────────────────────────────────────────────────────────────

async function pressTpStep(modifier) {
  const qx = await boot();
  try {
    const tp = qx.panelRoot().getElementById("__tcTBInput");
    assert.equal(tp.value, "20,000.00", "TP starts formatted");
    qx.window.document.dispatchEvent(
      new qx.window.KeyboardEvent("keydown", { key: "ArrowUp", code: "ArrowUp", [modifier]: true, bubbles: true }),
    );
    return tp.value;
  } finally {
    qx.close();
  }
}

test("bug 4: Ctrl+↑ steps take profit on Windows/Linux", async () => {
  assert.equal(await pressTpStep("ctrlKey"), "21000");
});

test("bug 4: Cmd+↑ steps from the full formatted value (not 20 from \"20,000.00\")", async () => {
  assert.equal(await pressTpStep("metaKey"), "21000");
});

// ── v1.21.1: B14 SL setup source, B10 live popup SL switch ─────────────────────────────────────────

const slSetupOpen = (qx) => !!qx.panelRoot().getElementById("__tcSLSetup");
const slShown = (qx) => qx.panelRoot().getElementById("__tcSLInput").value;

test("B14: today's SL in the local backup is used when sync has none, and sync is repaired", async () => {
  const qx = await boot({ storage: slStorage(14466), sync: { __tradeCalc_sl_value: 12000, __tradeCalc_sl_date: "2026-01-01" } });
  try {
    assert.equal(slSetupOpen(qx), false, "no setup screen");
    assert.equal(slShown(qx), "14,466.00");
    const data = qx.window.chrome.storage.sync.data;
    assert.equal(data.__tradeCalc_sl_value, 14466);
    assert.equal(data.__tradeCalc_sl_date, istToday());
  } finally {
    qx.close();
  }
});

test("B14: when sync and local both have today's SL, the higher (trailed) one wins", async () => {
  const qx = await boot({
    storage: slStorage(13000),
    sync: { __tradeCalc_sl_value: 13500, __tradeCalc_sl_date: istToday(), __tradeCalc_sl_init_bal: 15228 },
  });
  try {
    assert.equal(slShown(qx), "13,500.00");
  } finally {
    qx.close();
  }
});

test("B14: with no SL saved for today anywhere, the setup screen still appears", async () => {
  const storage = { __tradeCalc_tb: "20000" };
  const qx = await boot({ storage, sync: {} });
  try {
    assert.equal(slSetupOpen(qx), true);
  } finally {
    qx.close();
  }
});

test("B10: the popup SL switch applies without a reload", async () => {
  const qx = await boot();
  try {
    const field = qx.panelRoot().getElementById("__tcSLFld");
    assert.notEqual(field.style.display, "none", "SL shown at start");
    const before = slShown(qx); // 12,182.00: the trailing SL lifts 10,000 to 20% below the 15,228 peak
    assert.ok(before);
    await qx.sendToPanel({ type: "SET_SL_ENABLED", enabled: false });
    assert.equal(field.style.display, "none", "hidden after switching off");
    assert.equal(slShown(qx), "");
    await qx.sendToPanel({ type: "SET_SL_ENABLED", enabled: true });
    assert.notEqual(field.style.display, "none", "shown again after switching on");
    assert.equal(slShown(qx), before);
  } finally {
    qx.close();
  }
});

test("B10: switching SL off closes an open setup screen and its click blocker", async () => {
  const qx = await boot({ storage: { __tradeCalc_tb: "20000" } });
  try {
    assert.equal(slSetupOpen(qx), true);
    await qx.sendToPanel({ type: "SET_SL_ENABLED", enabled: false });
    assert.equal(slSetupOpen(qx), false);
    assert.equal(qx.window.__tcSLBlocker, undefined);
  } finally {
    qx.close();
  }
});

// ── v1.22.0: store bridge, self-repairing selectors, health report ─────────────────────────────────

const healthRow = (qx, name) => qx.askPanel({ type: "GET_HEALTH" }).rows.find((r) => r.name === name);
const overlayShown = (qx) => qx.panelRoot().getElementById("__tcDangerOverlay").classList.contains("tcPercentVisible");

test("store: payout % falls back to the store when Quotex's payout elements are gone", async () => {
  // Remove every payout % element the class selectors and the semantic finder could use.
  const html = FIXTURE.replace('<span class="UI2Kh">91 %</span>', "").replace('<div class="ElyTP">91 %</div>', "");
  const withStore = await boot({ html, store: quotexStore({ payout: 79 }) });
  try {
    assert.equal(overlayShown(withStore), true, "79% from the store is below the 89% minimum");
  } finally {
    withStore.close();
  }
  const withoutStore = await boot({ html });
  try {
    assert.equal(overlayShown(withoutStore), false, "no payout readable without the store");
  } finally {
    withoutStore.close();
  }
});

test("store: open trades from the store enforce the max-trades cap", async () => {
  const store = quotexStore({ opened: [deal("a"), deal("b")] });
  const qx = await boot({ store });
  try {
    const buttons = Array.from(qx.window.document.querySelectorAll("#trade-button button"));
    assert.equal(tradeReachesPlatform(qx), false, "blocked at 2 open trades");
    assert.equal(tradeButtonsGreyed(qx), true, "and shown as blocked");
    assert.match(qx.panelRoot().getElementById("__tcWarn").textContent, /Max 2 active trades/);
  } finally {
    qx.close();
  }
});

test("store: open trades on the other account don't count", async () => {
  const store = quotexStore({ opened: [deal("a", { isDemo: 0 }), deal("b", { isDemo: 0 })] });
  const qx = await boot({ store });
  try {
    const buttons = Array.from(qx.window.document.querySelectorAll("#trade-button button"));
    assert.equal(tradeReachesPlatform(qx), true, "live-account deals ignored on the demo page");
  } finally {
    qx.close();
  }
});

test("store: the loss streak counts newly closed deals, not history", async () => {
  const store = quotexStore({ closed: [deal("old1"), deal("old2"), deal("old3")] });
  const qx = await boot({ store });
  try {
    await sleep(600);
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), "0", "history isn't counted");
    const add = (d) => {
      store.deals.closedById[d.id] = d;
      store.deals.closedIds.push(d.id);
    };
    add(deal("l1", { close: 1789465000 }));
    add(deal("l2", { close: 1789465060 }));
    await sleep(900);
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), "2");
    add(deal("w1", { profit: 1700, close: 1789465120 }));
    await sleep(900);
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), "0", "a win resets the streak");
    assert.equal(healthRow(qx, "Settled trades (loss streak)").via, "store");
  } finally {
    qx.close();
  }
});

test("store: tab name comes from the store label when the name element is gone", async () => {
  const html = FIXTURE.replace('<div class="WRocw">USD/DZD (OTC)</div>', "");
  const qx = await boot({ html, store: quotexStore() });
  try {
    // X marks the active tab as monitored, saving its normalized name.
    qx.window.document.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "x", code: "KeyX", bubbles: true }));
    assert.deepEqual(JSON.parse(pref(qx, "__tradeCalc_monitor_pairs")), ["usddzdotc"]);
  } finally {
    qx.close();
  }
});

test("selectors: renamed payout-amount class is found by its text and the new class is learned", async () => {
  const html = FIXTURE.replace('<div class="omlQ2">', '<div class="Zq9Xy">');
  const qx = await boot({ html });
  try {
    assert.equal(qx.window.document.querySelector(".__tcProjBalWin").textContent, "↑ 16,808.00 ₹", "payout 3,580 still read");
    const learned = JSON.parse(pref(qx, "__tradeCalc_learned_selectors"));
    assert.equal(learned.payoutTotal.sel, ".Zq9Xy > b");
    const row = healthRow(qx, "Payout amount");
    assert.equal(row.status, "fallback");
    assert.match(row.via, /^learned /);
  } finally {
    qx.close();
  }
});

test("selectors: renamed pair-tab classes are found through data-symbol", async () => {
  const html = FIXTURE.replace('class="dJ15T vXMlv"', 'class="Qq1Aa vXMlv"');
  const qx = await boot({ html });
  try {
    const row = healthRow(qx, "Pair tabs");
    assert.match(row.via, /semantic|learned/, "found by shape (and remembered afterwards)");
    assert.equal(row.value, "1 open");
  } finally {
    qx.close();
  }
});

test("health: report shows the store bridge and page reads", async () => {
  const qx = await boot({ store: quotexStore({ payout: 91 }) });
  try {
    const report = qx.askPanel({ type: "GET_HEALTH" });
    const byName = Object.fromEntries(report.rows.map((r) => [r.name, r]));
    assert.equal(byName["Store bridge (chart_reader.js)"].status, "ok");
    assert.equal(byName["Balance value"].value, "15228");
    assert.equal(byName["Payout % value"].value, "91% page · 91% store");
    assert.equal(byName["Stake"].value, "2000");
    assert.equal(byName["Currency"].via, "store");
    assert.equal(report.url, "/en/demo-trade");
  } finally {
    qx.close();
  }
});

test("health: without the store the report says so instead of failing", async () => {
  const qx = await boot();
  try {
    const row = healthRow(qx, "Store bridge (chart_reader.js)");
    assert.equal(row.status, "missing");
  } finally {
    qx.close();
  }
});

// ── v1.23.0: resource use ──────────────────────────────────────────────────────────────────────────

test("perf: the panel runs one DOM observer and one scheduler interval", async () => {
  const qx = await boot({ store: quotexStore() });
  try {
    assert.equal(qx.observers.length, 1, "MutationObservers created (v1.22.0 had 4: launcher + 3 in the panel)");
    assert.equal(qx.intervals.size, 2, "intervals: launcher URL poll + panel scheduler");
  } finally {
    qx.close();
  }
});

test("perf: turning the panel off stops its observer and scheduler", async () => {
  const qx = await boot();
  try {
    await qx.sendToPanel({ type: "TOGGLE_PANEL" });
    assert.equal(qx.intervals.size, 1, "only the launcher URL poll remains");
  } finally {
    qx.close();
  }
});

test("perf: the scheduler still runs periodic work (loss streak tracking at 500 ms)", async () => {
  const store = quotexStore();
  const qx = await boot({ store });
  try {
    await sleep(600);
    const l = deal("late-loss", { close: 1789466000 });
    store.deals.closedById[l.id] = l;
    store.deals.closedIds.push(l.id);
    await sleep(800);
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), "1");
  } finally {
    qx.close();
  }
});

// ── v1.24.0: editable SL setup, account timezone, any-language fallbacks, clean page head ──────────

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

test("SL setup: suggests 85% of the balance in an editable field", async () => {
  const { qx, input, confirm } = await openSetup();
  try {
    assert.equal(input.disabled, false);
    assert.equal(input.value, "12943"); // floor(15,228 × 0.85)
    assert.equal(confirm.disabled, false);
    assert.match(confirm.textContent, /Set SL: ₹12,943\.00/);
  } finally {
    qx.close();
  }
});

test("SL setup: a typed amount is saved and not pulled back up by the trailing SL", async () => {
  const { qx, root, input, confirm } = await openSetup();
  try {
    typeInto(qx, input, "10,500");
    assert.equal(root.getElementById("__tcSLSetupPct").textContent, "69%");
    confirm.click();
    await sleep(900); // close animation + a few recalc ticks (trailing SL runs on recalc)
    assert.equal(root.getElementById("__tcSLSetup"), null, "setup closed");
    assert.equal(root.getElementById("__tcSLInput").value, "10,500.00", "SL kept at the typed value");
    assert.equal(pref(qx, "__tradeCalc_sl_ls_value"), "10500");
    assert.equal(pref(qx, "__tradeCalc_sl_ls_trail"), String(Math.round((1 - 10500 / 15228) * 10000) / 10000));
  } finally {
    qx.close();
  }
});

test("SL setup: % buttons fill the amount, and an amount at or above the balance can't be confirmed", async () => {
  const { qx, root, input, confirm } = await openSetup();
  try {
    root.querySelector('[data-sl-pct="75"]').click();
    assert.equal(input.value, "11421"); // floor(15,228 × 0.75)
    typeInto(qx, input, "15228");
    assert.equal(confirm.disabled, true);
    assert.match(confirm.textContent, /below your balance/);
  } finally {
    qx.close();
  }
});

test("SL setup: Enter in the field confirms", async () => {
  const { qx, root, input } = await openSetup();
  try {
    typeInto(qx, input, "12000");
    input.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(400);
    assert.equal(root.getElementById("__tcSLInput").value, "12,000.00");
  } finally {
    qx.close();
  }
});

test("SL setup: a zero balance says so instead of 'Balance not found', and unblocks the page (v1.24.5)", async () => {
  // A live account with no funds: the balance reads ₹0.00, which used to be treated as unreadable.
  const html = FIXTURE.replace("₹15,228.00", "₹0.00");
  const qx = await boot({ storage: noSl, html });
  await sleep(2000);
  try {
    const root = qx.panelRoot();
    assert.match(root.getElementById("__tcSLSetupMeta").textContent, /no funds|once the account has funds/i);
    assert.equal(root.getElementById("__tcSLConfirmBtn").disabled, true);
    assert.ok(root.getElementById("__tcSLSkipBtn"), "a way out of the screen");
    // The page must not stay click-blocked.
    let clicked = false;
    const up = qx.window.document.querySelector("#trade-button button");
    up.addEventListener("click", () => (clicked = true));
    up.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(clicked, true, "page clicks work again");
    // When the account is funded (or switched), the screen picks the balance up.
    qx.window.document.querySelector(".Zt1hG").textContent = "₹15,228.00";
    await sleep(2600);
    assert.equal(root.getElementById("__tcSLSetupInput").value, "12943");
    assert.equal(root.getElementById("__tcSLSkipBtn"), null, "skip button gone once a balance exists");
  } finally {
    qx.close();
  }
});

test("SL setup: keeps waiting when the balance is slow, and offers a way out (v1.24.5)", async () => {
  const html = FIXTURE.replace('<div class="Zt1hG">₹15,228.00</div>', "");
  const qx = await boot({ storage: noSl, html });
  try {
    const root = qx.panelRoot();
    await sleep(11000); // the skip button appears after ~10 tries
    assert.match(root.getElementById("__tcSLSetupMeta").textContent, /Waiting for your balance/i);
    assert.ok(root.getElementById("__tcSLSkipBtn"), "skip offered instead of a dead end");
    assert.equal(qx.window.__tcSLBlocker, undefined, "page no longer blocked");
    // Still watching: a balance that appears later is picked up.
    const bal = qx.window.document.createElement("div");
    bal.className = "Zt1hG";
    bal.textContent = "₹15,228.00";
    qx.window.document.querySelector(".zfJUm").appendChild(bal);
    await sleep(3200);
    assert.equal(root.getElementById("__tcSLSetupInput").value, "12943");
  } finally {
    qx.close();
  }
});

test("SL setup: page clicks stay blocked while the setup screen is open", async () => {
  const { qx } = await openSetup();
  try {
    let clicked = false;
    const up = qx.window.document.querySelector("#trade-button button");
    up.addEventListener("click", () => (clicked = true));
    up.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(clicked, false);
  } finally {
    qx.close();
  }
});

// Offsets 24 h apart (UTC+14 vs UTC−10) always give different calendar dates.
const dayKeyAt = (offsetSec) => new Date(Date.now() + offsetSec * 1000).toISOString().slice(0, 10);
const slForDay = (day) => ({ ...slStorage(10000), __tradeCalc_sl_ls_date: day });

test("timezone: the trading day follows the account timezone from the store and is cached", async () => {
  const qx = await boot({ storage: slForDay(dayKeyAt(50400)), store: quotexStore({ timeZone: 50400 }) });
  try {
    assert.equal(qx.panelRoot().getElementById("__tcSLSetup"), null, "today's SL (UTC+14 day) recognized");
    assert.equal(pref(qx, "__tradeCalc_tz_offset_sec"), "50400");
  } finally {
    qx.close();
  }
  const other = await boot({ storage: slForDay(dayKeyAt(50400)), store: quotexStore({ timeZone: -36000 }) });
  try {
    await sleep(300);
    assert.ok(other.panelRoot().getElementById("__tcSLSetup"), "a different day in UTC−10 asks for a new SL");
  } finally {
    other.close();
  }
});

test("timezone: without the store the cached timezone is used", async () => {
  const storage = { ...slForDay(dayKeyAt(50400)), __tradeCalc_tz_offset_sec: "50400" };
  const qx = await boot({ storage });
  try {
    assert.equal(qx.panelRoot().getElementById("__tcSLSetup"), null);
  } finally {
    qx.close();
  }
});

test("any language: balance and payout amount are found without English labels or known classes", async () => {
  const html = FIXTURE.replace(">Demo Account<", ">Cuenta demo<")
    .replace('class="Zt1hG"', 'class="Kk2Jj"')
    .replace('<div class="omlQ2">', '<div class="Pp0Oo">')
    .replace("<p>Payout</p>", "<p>Pago</p>");
  const qx = await boot({ html });
  try {
    const doc = qx.window.document;
    assert.equal(doc.querySelector(".__tcProjBalWin").textContent, "↑ 16,808.00 ₹");
    assert.equal(doc.querySelector(".__tcProjBalLoss").textContent, "↓ 13,228.00 ₹");
  } finally {
    qx.close();
  }
});

test("page head: no --tc-* tokens or id-tagged styles in <head>; tokens live in the shadow root", async () => {
  const qx = await boot();
  try {
    await sleep(1500); // let a trade-less panel settle
    const head = qx.window.document.head;
    const headCss = Array.from(head.querySelectorAll("style")).map((s) => s.textContent).join("\n");
    assert.doesNotMatch(headCss, /--tc-/, "no design tokens in the page head");
    assert.equal(head.querySelectorAll("style[id]").length, 0, "no id-tagged style elements");
    const shadowCss = Array.from(qx.panelRoot().querySelectorAll("style")).map((s) => s.textContent).join("\n");
    assert.match(shadowCss, /:host \{ --s-1/);
    await qx.sendToPanel({ type: "TOGGLE_PANEL" });
    assert.equal(head.querySelectorAll("style").length, 0, "cleanup removes the head styles");
  } finally {
    qx.close();
  }
});

test("Quotex's promo banners are left alone (remover removed in v1.24.1)", async () => {
  const html = FIXTURE.replace(
    '<div id="graph">',
    '<div id="promo"><svg class="icon-rocket-banner"></svg><button aria-label="Close"></button></div><div id="bonus"><img alt="welcome bonus"></div><div id="graph">',
  );
  const qx = await boot({ html });
  try {
    await sleep(500);
    assert.ok(qx.window.document.getElementById("promo"), "rocket banner still there");
    assert.ok(qx.window.document.getElementById("bonus"), "welcome bonus still there");
  } finally {
    qx.close();
  }
});

// ── v1.24.4: auto-close must never click a tab that has no close button ─────────────────────────────

test("auto-close: a low-payout tab without a close button isn't clicked (asset panel flicker)", async () => {
  // Live 2026-09-15: tabs have name, payout and a dropdown caret, no close button. Payout 77% < 89% minimum.
  const html = FIXTURE.replace('<div class="dJ15T vXMlv" id="tab-active" data-symbol="USDDZD_otc">', '<div class="dJ15T vXMlv" id="tab-active" data-symbol="USDDZD_otc"><div class="ZyIJD" id="tabBody">')
    .replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">77 %</div><div class="uLwPP"><svg xmlns="http://www.w3.org/2000/svg" class="icon-caret"><use href="#icon-caret"></use></svg></div></div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">77 %</span>');
  const qx = await boot({ html });
  try {
    let clicks = 0;
    qx.window.document.getElementById("tab-active").addEventListener("click", () => clicks++, true);
    await sleep(5600); // auto-close runs on recalc and every 5 s
    assert.equal(clicks, 0, "the tab (which opens the asset panel) was never clicked");
    assert.equal(healthRow(qx, "Tab close buttons").value, "0 of 1");
  } finally {
    qx.close();
  }
});

test("auto-close: a low-payout tab with a real close button is closed", async () => {
  const lowTab =
    '<div class="dJ15T vXMlv" data-symbol="EURUSD_otc"><div class="WRocw">EUR/USD (OTC)</div><div class="ElyTP">70 %</div>' +
    '<button id="closeLow" aria-label="Close"><svg class="icon-close-tiny"><use href="#icon-close-tiny"></use></svg></button></div>';
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>\n          </div>', '<div class="ElyTP">91 %</div>\n          </div>' + lowTab);
  // Quotex removes a tab when its close button is clicked.
  const setup = (w) => w.document.getElementById("closeLow").addEventListener("click", (e) => e.currentTarget.closest("[data-symbol]").remove());
  const qx = await boot({ html, setup });
  try {
    const doc = qx.window.document;
    assert.equal(doc.querySelector('[data-symbol="EURUSD_otc"]'), null, "low-payout tab closed");
    assert.ok(doc.getElementById("tab-active"), "the 91% tab stays");
  } finally {
    qx.close();
  }
});


// ── v1.25.0: the rest of the panel repairs itself too ──────────────────────────────────────────────

// An open trade closing 45 s from now, with a live price that makes it a winner (command 1 = Down).
const openDealNow = (over = {}) => deal("live-1", { close: Math.floor(Date.now() / 1000) + 45, command: 1, openPrice: 256.5, ...over });

test("store: chart countdown chips work with no readable deal rows", async () => {
  const store = quotexStore({ opened: [openDealNow()], quotes: { USDDZD_otc: 256.2 } }); // price below entry = winning
  const qx = await boot({ store });
  try {
    await sleep(700);
    const graphText = qx.window.document.getElementById("graph").textContent;
    assert.match(graphText, /USD\/DZD \(OTC\)/, "pair on the chip");
    assert.match(graphText, /0[01]:\d\d/, "countdown on the chip");
    assert.match(qx.window.document.title, /⏱/, "tab title countdown");
    assert.match(qx.window.document.title, /🟢/, "winning marker");
    assert.equal(healthRow(qx, "Trade timers").via, "store");
  } finally {
    qx.close();
  }
});

test("store: a losing open trade shows the loss marker and no phantom profit", async () => {
  const store = quotexStore({ opened: [openDealNow()], quotes: { USDDZD_otc: 256.9 } }); // price above entry = losing
  const qx = await boot({ store });
  try {
    await sleep(700);
    assert.match(qx.window.document.title, /🔴/, "losing marker");
    assert.doesNotMatch(qx.window.document.title, /🟢/);
  } finally {
    qx.close();
  }
});

test("selectors: deal rows with renamed classes are still found by shape", async () => {
  // A running trade's row: pair name + mm:ss countdown, unknown classes.
  const rows = '<div class="Zz9Tt"><div class="Qq1">USD/DZD (OTC)</div><div class="Qq2">00:45</div><div class="Qq3">+3,700.00 ₹</div></div>' +
    '<div class="Zz9Tt"><div class="Qq1">EUR/USD (OTC)</div><div class="Qq2">00:20</div><div class="Qq3">+1,900.00 ₹</div></div>';
  const html = FIXTURE.replace('<div id="graph">', rows + '<div id="graph">');
  const qx = await boot({ html });
  try {
    const row = healthRow(qx, "Open trades list");
    assert.equal(row.value, "2 open");
    assert.match(row.via, /semantic|learned/, "found by shape, then remembered");
    // Two open trades is the default cap, so trading is blocked.
    assert.equal(tradeReachesPlatform(qx), false);
  } finally {
    qx.close();
  }
});

test("selectors: timeframe and expiry menus with renamed classes are still found", async () => {
  const menus =
    '<div class="Mm1"><div class="Mm2">15s</div><div class="Mm2">1m</div><div class="Mm2">5m</div><div class="Mm2">15m</div></div>';
  const times = '<div class="Tt1"><div class="Tt2">18:14</div><div class="Tt2">18:15</div><div class="Tt2">18:16</div></div>';
  const html = FIXTURE.replace('<div id="graph">', menus + times + '<div id="graph">');
  // Quotex renders the time choices inside the expiry box; put them there before the panel starts.
  const setup = (w) => w.document.querySelector(".NEJ1S").appendChild(w.document.querySelector(".Tt1"));
  const qx = await boot({ html, setup });
  try {
    const tf = healthRow(qx, "Timeframe menu");
    assert.equal(tf.status, "fallback");
    assert.equal(tf.value, "4 items");
    const ex = healthRow(qx, "Expiry times");
    assert.equal(ex.status, "fallback");
    assert.equal(ex.value, "3 items");
    // The new classes are remembered so later lookups are plain queries again.
    const learned = JSON.parse(pref(qx, "__tradeCalc_learned_selectors"));
    assert.equal(learned["list:timeframeItems"].sel, ".Mm2");
    assert.equal(learned["list:expiryTimes"].sel, ".Tt2");
  } finally {
    qx.close();
  }
});

test("health: a lone timeframe label on the page is not a menu (v1.25.1)", async () => {
  // The chart toolbar shows the current timeframe ("1m"); that must not read as an open menu.
  const html = FIXTURE.replace('<div id="graph">', '<div class="Toolbar"><div class="Tb1">1m</div></div><div id="graph">');
  const qx = await boot({ html });
  try {
    const tf = healthRow(qx, "Timeframe menu");
    assert.equal(tf.status, "idle");
    assert.equal(tf.value, "not open");
  } finally {
    qx.close();
  }
});

test("health: values are rounded, not raw floating point (v1.25.1)", async () => {
  // 5% of ₹28,004.59 is 1400.2295000000001 in binary floating point.
  const html = FIXTURE.replace("₹15,228.00", "₹28,004.59").replace('value="2000"', 'value="5%"');
  const qx = await boot({ html });
  try {
    assert.equal(healthRow(qx, "Stake").value, "1400.23");
    assert.equal(healthRow(qx, "Balance value").value, "28004.59");
  } finally {
    qx.close();
  }
});
test("health: lists that aren't open right now read as idle, not broken", async () => {
  const qx = await boot({ store: quotexStore() });
  try {
    const report = qx.askPanel({ type: "GET_HEALTH" });
    const byName = Object.fromEntries(report.rows.map((r) => [r.name, r]));
    assert.equal(byName["Open trades list"].status, "idle");
    assert.equal(byName["Asset list rows"].value, "not open");
    assert.equal(byName["Timeframe menu"].status, "idle");
    // Only the tab close button is genuinely absent on this Quotex build.
    assert.equal(report.rows.filter((r) => r.status === "missing").map((r) => r.name).join(","), "Tab close buttons");
  } finally {
    qx.close();
  }
});

// ── v1.26.0: multi-timeframe panel ─────────────────────────────────────────────────────────────────

const mtfStorage = {
  ...slStorage(10000),
  __tradeCalc_mtf_on: "1",
  __tradeCalc_mtf_count: "40",
  __tradeCalc_mtf_tfs: JSON.stringify(["15s", "1m", "5m"]),
};
const mtfCap = (qx, tf) => qx.panelRoot().querySelector('.tcMtfCell[data-tf="' + tf + '"] .tcMtfCap').textContent;
// Point the fake chart at a pair and a timeframe, the way switching pair/timeframe does on the site.
function setChart(store, symbol, periodSec, count = 200) {
  store.chartSettings.chartById.c1.currentAsset.symbol = symbol;
  store.__plot.pointsManager.candles = makeCandles(count, periodSec, 1789830000, symbol === "USDDZD_otc" ? 100 : 200);
}

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
// ── v1.27.0: less visible to the platform ──────────────────────────────────────────────────────────

test("privacy: no __tradeCalc_* keys are left in page storage", async () => {
  const qx = await boot();
  try {
    const keys = Object.keys(qx.window.localStorage);
    assert.equal(keys.filter((k) => /^__tradeCalc|^tc_pos$/.test(k)).length, 0, "old names are gone: " + keys.join(","));
    // The values still work: today's SL is stored under its opaque name (the trailing SL may have raised it).
    assert.ok(Number(pref(qx, "__tradeCalc_sl_ls_value")) >= 10000, "SL value kept");
    assert.equal(pref(qx, "__tradeCalc_sl_ls_date"), istToday());
    assert.ok(keys.length > 0 && keys.every((k) => /^q[0-9a-z]+$/.test(k)), "opaque names only: " + keys.join(","));
  } finally {
    qx.close();
  }
});

test("privacy: nothing in the page <head> names Quotex classes or loads a webfont", async () => {
  const qx = await boot();
  try {
    const css = Array.from(qx.window.document.head.querySelectorAll("style")).map((n) => n.textContent).join(" ");
    assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic/, "no webfont request");
    assert.doesNotMatch(css, /UI2Kh|bvdd_|omlQ2|lCITV|dJ15T/, "no rule naming their classes");
  } finally {
    qx.close();
  }
});

test("privacy: blocked trades never touch the platform's buttons", async () => {
  const store = quotexStore({ opened: [deal("a"), deal("b")] }); // at the 2-trade cap
  const qx = await boot({ store });
  try {
    const buttons = Array.from(qx.window.document.querySelectorAll("#trade-button button"));
    assert.equal(tradeReachesPlatform(qx), false, "click is stopped before their handler");
    assert.ok(buttons.every((b) => !b.disabled), "their disabled state is untouched");
    assert.ok(buttons.every((b) => !b.hasAttribute("aria-disabled")), "no aria-disabled written");
  } finally {
    qx.close();
  }
});

test("privacy: the Live-as-Demo relabel can be switched off and restores the label", async () => {
  const html = FIXTURE.replace(">Demo Account<", ">Live Account<");
  const qx = await boot({ html });
  try {
    const label = () => qx.window.document.querySelector(".v2KPX").textContent;
    assert.equal(label(), "Demo Account", "relabelled by default");
    await qx.sendToPanel({ type: "SET_PAGE_MARKS", relabel: false });
    assert.equal(label(), "Live Account", "platform label restored");
    await qx.sendToPanel({ type: "SET_PAGE_MARKS", relabel: true });
    await sleep(300);
    assert.equal(label(), "Demo Account", "and back again");
  } finally {
    qx.close();
  }
});
// ── v1.30.0: multi-timeframe panel, second pass ───────────────────────────────────

const mtfPairLabel = (qx) => qx.panelRoot().querySelector('[data-mtf="pair"]').textContent;

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

test("MTF: auto-fill stays out of the way when it is switched off, or a trade is open (v1.30.0)", async () => {
  const off = await boot({ storage: { ...mtfStorage, __tradeCalc_mtf_autofill: "0" }, store: (() => { const s = quotexStore(); s.__candles = []; return s; })() });
  try {
    await sleep(4200);
    assert.equal(mtfPairLabel(off), "USD/DZD (OTC)", "switched off: the panel is left alone");
  } finally {
    off.close();
  }
  const busy = (() => { const s = quotexStore({ opened: [deal("a")] }); s.__candles = []; return s; })();
  const qx = await boot({ storage: mtfStorage, store: busy });
  try {
    await sleep(4200);
    assert.equal(mtfPairLabel(qx), "USD/DZD (OTC)", "a trade is open: the chart is not walked around");
  } finally {
    qx.close();
  }
});

// ── v1.30.1: a cell is never left on a snapshot ─────────────────────────────────────

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

// ── v1.31.0: saying why, instead of quietly doing nothing ────────────────────────────

test("health: the auto-fill says what it is waiting for (v1.31.0)", async () => {
  const store = quotexStore({ opened: [deal("a")] }); // a trade is running
  store.__candles = [];
  const qx = await boot({ storage: bigTfStorage, store });
  try {
    await sleep(3600);
    const row = healthRow(qx, "Charts auto-fill");
    assert.ok(row, "the check reports on it at all");
    assert.match(row.value, /trade is open/, "and names the reason: " + row.value);
  } finally {
    qx.close();
  }
});

test("health: auto-fill reports ready when the charts are full (v1.31.0)", async () => {
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
    await sleep(3600);
    const row = healthRow(qx, "Charts auto-fill");
    assert.equal(row.status, "ok");
    assert.match(row.value, /ready/, row.value);
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

test("MTF: a blank chart says why it is still blank (v1.31.1)", async () => {
  const store = quotexStore({ opened: [deal("a")] }); // a trade is running, so no walk
  store.__candles = [];
  const qx = await boot({ storage: bigTfStorage, store });
  try {
    await sleep(3600);
    assert.match(mtfCap(qx, "5m"), /visit once . trade open/, mtfCap(qx, "5m"));
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
    assert.match(diag.autofill, /trade is open/, diag.autofill);
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
  const now = Math.floor(Date.now() / 1000);
  const cache = {
    v: 2,
    symbols: {
      USDDZD_otc: {
        "USDDZD_otc@60": { candles: rows(97, 60, Math.floor(now / 60) * 60), capturedAt: now, periodSeconds: 60, derived: true },
      },
    },
  };
  const store = quotexStore({ opened: [deal("a")] }); // a trade is open, so the fill has to wait
  store.__candles = [];
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_cache: JSON.stringify(cache) }, store });
  try {
    await sleep(3600);
    assert.match(mtfCap(qx, "15m"), /bars . trade open/, mtfCap(qx, "15m"));
  } finally {
    qx.close();
  }
});

// ── v1.28.0: how the trade click is produced ───────────────────────────────────────────────────────

const hkStorage = { ...slStorage(10000), __tradeCalc_hk_updown: "true" };
const pressArrow = (qx, code) =>
  qx.window.document.dispatchEvent(
    new qx.window.KeyboardEvent("keydown", { key: code === "ArrowUp" ? "ArrowUp" : "ArrowDown", code, bubbles: true }),
  );

test("hotkey click carries real coordinates and focus (v1.28.0)", async () => {
  const qx = await boot({ storage: hkStorage });
  try {
    const up = qx.window.document.querySelector("#trade-button button");
    up.getBoundingClientRect = () => ({ left: 100, top: 200, width: 80, height: 40, right: 180, bottom: 240 });
    const seen = [];
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      up.addEventListener(type, (e) => seen.push({ type, x: e.clientX, y: e.clientY, detail: e.detail }));
    }
    pressArrow(qx, "ArrowUp");
    assert.deepEqual(seen.map((e) => e.type), ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
    assert.ok(seen.every((e) => e.x === 140 && e.y === 220), "sent at the button centre");
    assert.ok(seen.every((e) => e.detail === 1), "counts as a single click");
    assert.equal(qx.window.document.activeElement, up, "button focused first");
  } finally {
    qx.close();
  }
});

test("focus mode: ↑ selects the button and places nothing until Enter (v1.28.0)", async () => {
  const qx = await boot({ storage: { ...hkStorage, __tradeCalc_hk_focus_mode: "1" } });
  try {
    const up = qx.window.document.querySelector("#trade-button button");
    let clicks = 0;
    up.addEventListener("click", () => clicks++);
    pressArrow(qx, "ArrowUp");
    assert.equal(clicks, 0, "nothing is sent to the platform");
    assert.equal(qx.window.document.activeElement, up, "the button is selected");
    assert.match(qx.panelRoot().getElementById("__tcWarn").textContent, /Up selected/);
    // Enter with that button focused must be left alone (the panel's own Enter shortcut would
    // preventDefault, which would stop the browser from activating the button).
    const enter = new qx.window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
    qx.window.document.dispatchEvent(enter);
    assert.equal(enter.defaultPrevented, false, "Enter is left to the browser");
    assert.equal(qx.window.document.activeElement, up, "focus stays on the button for repeats");
  } finally {
    qx.close();
  }
});

test("focus mode: guards still stop a trusted click (v1.28.0)", async () => {
  // At the 2-trade cap, a browser-generated click must still be blocked.
  const store = quotexStore({ opened: [deal("a"), deal("b")] });
  const qx = await boot({ storage: { ...hkStorage, __tradeCalc_hk_focus_mode: "1" }, store });
  try {
    assert.equal(tradeReachesPlatform(qx), false, "blocked even without our own click");
  } finally {
    qx.close();
  }
});
// ── v1.29.0: how the investment change is produced ────────────────────────────────

const amtStorage = { ...slStorage(10000), __tradeCalc_hk_leftright: "true" };
const pressSideArrow = (qx, code) =>
  qx.window.document.dispatchEvent(
    new qx.window.KeyboardEvent("keydown", { key: code, code, bubbles: true, cancelable: true }),
  );
const stakeField = (qx) => qx.window.document.querySelector(".deal-amount-input input.input-control__input");

test("← still steps the amount with a click when focus mode is off (v1.29.0)", async () => {
  const qx = await boot({ storage: amtStorage });
  try {
    const minus = qx.window.document.querySelector(".deal-amount-input .VK9Nw");
    let clicks = 0;
    minus.addEventListener("click", () => clicks++);
    pressSideArrow(qx, "ArrowLeft");
    assert.equal(clicks, 1, "the platform's own − button is pressed");
  } finally {
    qx.close();
  }
});

test("focus mode: ← selects the platform's − button and steps nothing until Enter (v1.29.0)", async () => {
  const qx = await boot({ storage: { ...amtStorage, __tradeCalc_hk_focus_mode: "1" } });
  try {
    const [minus, plus] = qx.window.document.querySelectorAll(".deal-amount-input .VK9Nw");
    let clicks = 0;
    minus.addEventListener("click", () => clicks++);
    pressSideArrow(qx, "ArrowLeft");
    assert.equal(clicks, 0, "nothing is sent to the platform");
    assert.equal(qx.window.document.activeElement, minus, "the − button is selected");
    assert.match(qx.panelRoot().getElementById("__tcWarn").textContent, /selected/);
    // The panel's own Enter shortcut must not swallow the key, or the browser never activates it.
    const enter = new qx.window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
    qx.window.document.dispatchEvent(enter);
    assert.equal(enter.defaultPrevented, false, "Enter is left to the browser");
    assert.equal(qx.window.document.activeElement, minus, "focus stays put, so repeats are one key each");
    pressSideArrow(qx, "ArrowRight");
    assert.equal(qx.window.document.activeElement, plus, "→ moves the selection to +");
  } finally {
    qx.close();
  }
});

test("the amount is typed into the field, not written by script (v1.29.0)", async () => {
  const qx = await boot({ storage: { ...amtStorage, __tradeCalc_step_mult: "1.5" } });
  try {
    const input = stakeField(qx);
    const calls = [];
    qx.window.document.execCommand = (cmd, ui, text) => {
      calls.push({ cmd, text });
      if (cmd !== "insertText") {
        return false;
      }
      input.value = text; // what the browser's editing pipeline does on a real keystroke
      input.dispatchEvent(new qx.window.Event("input", { bubbles: true }));
      return true;
    };
    let scriptedChanges = 0;
    input.addEventListener("change", () => scriptedChanges++); // only the fallback path fires `change`
    pressSideArrow(qx, "ArrowRight");
    assert.equal(calls.length, 1, "one editing command");
    assert.equal(calls[0].cmd, "insertText");
    assert.equal(calls[0].text, "3000", "2000 × 1.5");
    assert.equal(input.value, "3000", "the field holds the new amount");
    assert.equal(scriptedChanges, 0, "the scripted setter path was not used");
  } finally {
    qx.close();
  }
});

test("typing falls back to the scripted setter if the browser refuses (v1.29.0)", async () => {
  const qx = await boot({ storage: { ...amtStorage, __tradeCalc_step_mult: "1.5" } });
  try {
    const input = stakeField(qx);
    qx.window.document.execCommand = () => false;
    let inputs = 0;
    input.addEventListener("input", () => inputs++);
    pressSideArrow(qx, "ArrowRight");
    assert.equal(input.value, "3000", "the amount still changes");
    assert.ok(inputs >= 1, "and the platform is still told about it");
  } finally {
    qx.close();
  }
});

test("no uncaught errors while the panel runs", async () => {
  const qx = await boot();
  try {
    await sleep(700); // let the 200 ms / 500 ms timers tick
    assert.deepEqual(qx.errors.map((e) => e.message), []);
  } finally {
    qx.close();
  }
});
