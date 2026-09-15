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

async function boot({ path = "/en/demo-trade", storage = slStorage(10000), html = FIXTURE } = {}) {
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
  // Track observers so teardown can disconnect them; otherwise closing the window fires the content
  // script's URL watcher against a destroyed `location`.
  const observers = [];
  const NativeObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    constructor(cb) {
      super(cb);
      observers.push(this);
    }
  };
  window.PointerEvent = window.MouseEvent; // not implemented by jsdom
  window.HTMLCanvasElement.prototype.getContext = () => null;

  const listeners = new Set();
  window.chrome = {
    runtime: {
      onMessage: { addListener: (f) => listeners.add(f), removeListener: (f) => listeners.delete(f) },
      sendMessage() {},
    },
  };
  for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);

  window.eval(SOURCE);
  await sleep(1100); // the launcher starts the panel after 800 ms

  const api = {
    window,
    errors,
    listeners,
    isRunning: () => typeof window.__tcCleanup === "function",
    panelRoot: () => shadowRoots.filter((r) => r.host.isConnected).at(-1),
    async navigate(p) {
      window.history.pushState({}, "", p);
      window.document.body.appendChild(window.document.createElement("i")); // any DOM change wakes the URL watcher
      await sleep(80);
    },
    async sendToPanel(msg) {
      for (const f of Array.from(listeners)) f(msg, {}, () => {});
      await sleep(80);
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

test("bug 2: a stake that would push balance below the stop loss is blocked", async () => {
  // balance 15,228 − stake 2,000 = 13,228, which is ≤ SL 14,000
  const qx = await boot({ storage: slStorage(14000) });
  try {
    const warn = qx.panelRoot().getElementById("__tcWarn");
    assert.match(warn.textContent, /breach stop loss/i);
    const buttons = qx.window.document.querySelectorAll("#trade-button button");
    assert.ok(Array.from(buttons).every((b) => b.disabled), "Up/Down disabled");
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

test("no uncaught errors while the panel runs", async () => {
  const qx = await boot();
  try {
    await sleep(700); // let the 200 ms / 500 ms timers tick
    assert.deepEqual(qx.errors.map((e) => e.message), []);
  } finally {
    qx.close();
  }
});
