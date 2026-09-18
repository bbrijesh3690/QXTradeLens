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

const CHART_READER = fs.readFileSync(new URL("../qx-calc-updater/qx-calc-updater/chart_reader.js", import.meta.url), "utf8");

// A Redux state shaped like Quotex's (paths seen live on 2026-09-15). Tests mutate it to simulate the app.
function quotexStore({ payout = 91, opened = [], closed = [], timeZone = 19800 } = {}) {
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
    navigationSymbols: { list: ["USDDZD_otc"] },
  };
}
const deal = (id, { profit = 0, isDemo = 1, close = 1789464960 } = {}) => ({
  id, asset: "USDDZD_otc", amount: 2000, profit, isDemo, command: 1, openTimestamp: close - 60, closeTimestamp: close,
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
  window.HTMLCanvasElement.prototype.getContext = () => null;

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
    const plot = { chartId: "c1", pointsManager: { candles: [] }, store: { getState: () => store } };
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

const tradeButtonsEnabled = (qx) =>
  Array.from(qx.window.document.querySelectorAll("#trade-button button")).every((b) => !b.disabled);

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
    assert.equal(qx.window.localStorage.getItem("__tradeCalc_native_limit_lock_date"), null);
    assert.deepEqual(qx.sentMessages.filter((m) => m.type === "SYS_LOCK"), [], "no SYS_LOCK sent");
  } finally {
    qx.close();
  }
});

test("SL: a lock date stored by an older version is cleared", async () => {
  const storage = { ...slStorage(10000), __tradeCalc_native_limit_lock_date: istToday() };
  const qx = await boot({ storage });
  try {
    assert.equal(qx.window.localStorage.getItem("__tradeCalc_native_limit_lock_date"), null);
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
    assert.ok(Array.from(buttons).every((b) => !b.disabled), "not blocked when SL is safe");
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
    assert.ok(buttons.every((b) => b.disabled), "blocked at 2 open trades");
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
    assert.ok(buttons.every((b) => !b.disabled), "live-account deals ignored on the demo page");
  } finally {
    qx.close();
  }
});

test("store: the loss streak counts newly closed deals, not history", async () => {
  const store = quotexStore({ closed: [deal("old1"), deal("old2"), deal("old3")] });
  const qx = await boot({ store });
  try {
    await sleep(600);
    assert.equal(qx.window.localStorage.getItem("__tradeCalc_loss_streak"), "0", "history isn't counted");
    const add = (d) => {
      store.deals.closedById[d.id] = d;
      store.deals.closedIds.push(d.id);
    };
    add(deal("l1", { close: 1789465000 }));
    add(deal("l2", { close: 1789465060 }));
    await sleep(900);
    assert.equal(qx.window.localStorage.getItem("__tradeCalc_loss_streak"), "2");
    add(deal("w1", { profit: 1700, close: 1789465120 }));
    await sleep(900);
    assert.equal(qx.window.localStorage.getItem("__tradeCalc_loss_streak"), "0", "a win resets the streak");
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
    assert.deepEqual(JSON.parse(qx.window.localStorage.getItem("__tradeCalc_monitor_pairs")), ["usddzdotc"]);
  } finally {
    qx.close();
  }
});

test("selectors: renamed payout-amount class is found by its text and the new class is learned", async () => {
  const html = FIXTURE.replace('<div class="omlQ2">', '<div class="Zq9Xy">');
  const qx = await boot({ html });
  try {
    assert.equal(qx.window.document.querySelector(".__tcProjBalWin").textContent, "↑ 16,808.00 ₹", "payout 3,580 still read");
    const learned = JSON.parse(qx.window.localStorage.getItem("__tradeCalc_learned_selectors"));
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
    assert.equal(row.via, "semantic");
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
    assert.equal(qx.window.localStorage.getItem("__tradeCalc_loss_streak"), "1");
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
    const ls = qx.window.localStorage;
    assert.equal(ls.getItem("__tradeCalc_sl_ls_value"), "10500");
    assert.equal(ls.getItem("__tradeCalc_sl_ls_trail"), String(Math.round((1 - 10500 / 15228) * 10000) / 10000));
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
    assert.equal(qx.window.localStorage.getItem("__tradeCalc_tz_offset_sec"), "50400");
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

test("no uncaught errors while the panel runs", async () => {
  const qx = await boot();
  try {
    await sleep(700); // let the 200 ms / 500 ms timers tick
    assert.deepEqual(qx.errors.map((e) => e.message), []);
  } finally {
    qx.close();
  }
});
