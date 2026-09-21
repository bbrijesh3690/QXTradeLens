// The panel itself: when it runs, the daily stop loss, the projections and the take-profit shortcut.

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


// ── v1.54.0: the build is on the panel, not only in the popup ──────────────────────────────────────

test("panel: the build it is running is visible on the panel (v1.54.0)", async () => {
  const qx = await boot({ store: quotexStore() });
  try {
    await sleep(1200);
    const el = qx.panelRoot().getElementById("__tcVer");
    assert.ok(el, "the panel shows a version");
    assert.match(el.textContent, /^v[0-9]+[.][0-9]+[.][0-9]+$/, "as a version number: " + el.textContent);
    assert.match(el.getAttribute("data-tc-tip") || "", /refresh this tab/, "and says what to do when it looks stale");
    assert.equal(el.closest("#__tcSecLog"), null, "not inside the section that hides without a sheet URL");
    assert.ok(el.closest("#__tcContent"), "but inside the panel's own row");
  } finally {
    qx.close();
  }
});
