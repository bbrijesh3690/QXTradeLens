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

test("bug 1: turning the panel off from the toolbar icon sticks across navigation", async () => {
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

test("bug 1: a relaunched panel leaves exactly one extension message listener", async () => {
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

// ── v1.64.0: the SL can be typed into, both directions ──────────────────────────────────────────
// It was readonly, and for a reason worth keeping in mind: the trailing ratchet reads the current SL out of
// that field and only ever accepts a higher one. So an edit that lowers it has to widen the day's trail gap
// as well, or the next tick lifts it straight back and the edit looks ignored.

const slField = (qx) => qx.panelRoot().getElementById("__tcSLInput");
const commitSl = (qx, value) => {
  const el = slField(qx);
  typeInto(qx, el, value);
  el.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
};

test("SL: it is not readonly any more (v1.64.0)", async () => {
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(600);
    assert.equal(slField(qx).hasAttribute("readonly"), false, "the field accepts typing");
  } finally {
    qx.close();
  }
});

test("SL: raising it by hand sticks (v1.64.0)", async () => {
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(600);
    commitSl(qx, "14000");
    await sleep(200);
    assert.equal(pref(qx, "__tradeCalc_sl"), "14000", "stored: " + pref(qx, "__tradeCalc_sl"));
    // Long enough for several trailing passes to have had a go at it.
    await sleep(2600);
    assert.equal(parseFloat(String(slShown(qx)).replace(/,/g, "")), 14000, "still showing it: " + slShown(qx));
  } finally {
    qx.close();
  }
});

test("SL: lowering it by hand is not undone by the trail (v1.64.0)", async () => {
  // The case the readonly attribute was hiding. Balance is 15,228 and the day's peak is too, so the ratchet
  // wants 15228 x 0.8 = 12,182 - well above a hand-typed 9,000, which would have been overwritten.
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(600);
    commitSl(qx, "9000");
    await sleep(2600);
    assert.equal(pref(qx, "__tradeCalc_sl"), "9000", "the lower SL was kept: " + pref(qx, "__tradeCalc_sl"));
    assert.equal(parseFloat(String(slShown(qx)).replace(/,/g, "")), 9000, "and is what the panel shows: " + slShown(qx));
  } finally {
    qx.close();
  }
});

test("SL: a value at or above the balance is refused (v1.64.0)", async () => {
  // An SL at the balance is an instant lockout, which is never what someone typing means.
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(600);
    // Read what is in force rather than assuming the fixture's number: the trail has already raised it.
    const before = pref(qx, "__tradeCalc_sl");
    commitSl(qx, "99000");
    await sleep(200);
    assert.equal(pref(qx, "__tradeCalc_sl"), before, "the SL in force is unchanged: " + pref(qx, "__tradeCalc_sl"));
    assert.equal(parseFloat(String(slShown(qx)).replace(/,/g, "")), parseFloat(before), "and shown again: " + slShown(qx));
  } finally {
    qx.close();
  }
});

test("SL: nonsense is refused and the field goes back to what is in force (v1.64.0)", async () => {
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(600);
    const before = pref(qx, "__tradeCalc_sl");
    commitSl(qx, "abc");
    await sleep(200);
    assert.equal(pref(qx, "__tradeCalc_sl"), before, "unchanged: " + pref(qx, "__tradeCalc_sl"));
    assert.equal(parseFloat(String(slShown(qx)).replace(/,/g, "")), parseFloat(before), "reverted: " + slShown(qx));
  } finally {
    qx.close();
  }
});

test("SL: a very low typed value is kept, not lifted to 5% of the peak (v1.64.1)", async () => {
  // Found live on 2026-09-28: typing 1 against a peak of 19,655.32 stored 982. slTrailFor caps the trail gap
  // at 0.95, which is right for the automatic trail but silently overrode an explicit edit - the ratchet's
  // next target became peak x 0.05, which is above 1, so it lifted the SL there.
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(600);
    commitSl(qx, "1");
    await sleep(2600); // several trailing passes
    assert.equal(pref(qx, "__tradeCalc_sl"), "1", "the SL that was typed is the SL in force: " + pref(qx, "__tradeCalc_sl"));
    assert.equal(parseFloat(String(slShown(qx)).replace(/,/g, "")), 1, "and the panel shows it: " + slShown(qx));
  } finally {
    qx.close();
  }
});

// ── v1.66.0: the trade-history "Entry" tags and the section show/hide toggles are gone ─────────────

// A history row shaped the way tagHistoryEntryBalances read them, and a trade-log entry it would have
// matched: same pair, same amount, no open time to rule it out.
const historyRow = (pair, amount) =>
  '<div class="ib6yR"><div class="RxOUE">' + pair + '</div><div class="Fqtla">' + amount + "</div></div>";

test("history: every placed trade is tagged \"Entry\" with the balance it was placed at - always on (v1.68.0)", async () => {
  // v1.66.0 removed the tags with their popup switch; the switch was what was meant to go. They are back with
  // no switch at all, so an "off" left in storage by an older build must not turn them off.
  const log = [{ uuid: null, ts: Date.now() - 30000, pair: "EUR/USD (OTC)", amount: 100, bal: 5000 }];
  const qx = await boot({
    storage: { ...slStorage(10000), __tradeCalc_trade_log: JSON.stringify(log), __tradeCalc_entry_tags: "0" },
  });
  try {
    await sleep(400);
    // Added after load, so the page observer sees it the way it sees a trade settling on the live page.
    const holder = qx.window.document.createElement("div");
    holder.innerHTML = historyRow("EUR/USD (OTC)", "100");
    qx.window.document.body.appendChild(holder);
    await sleep(900); // the tagger is debounced by 300 ms
    const row = holder.querySelector(".ib6yR");
    const tag = [...row.querySelectorAll("*")].find((el) => /^Entry /.test(el.textContent || ""));
    assert.ok(tag, "the row carries its entry balance: " + row.textContent);
    assert.match(tag.textContent, /5,000/, "and it is the balance the trade was placed at: " + tag.textContent);
  } finally {
    qx.close();
  }
});

test("trade log: a placed trade is still recorded, because the win projection falls back on it (v1.66.0)", async () => {
  // The tags were only one reader of this log. projectedPayout also uses it to price an open trade when
  // the store cannot, so removing the tags must not stop recordPlacement.
  const qx = await boot();
  try {
    await sleep(400);
    assert.equal(tradeReachesPlatform(qx), true, "the trade went through");
    const log = JSON.parse(pref(qx, "__tradeCalc_trade_log") || "[]");
    assert.ok(log.length >= 1, "the placement was logged: " + JSON.stringify(log));
    assert.ok(log[0].bal > 0 && log[0].ts > 0, "with the balance and the time: " + JSON.stringify(log[0]));
  } finally {
    qx.close();
  }
});

test("sections: every group of the panel shows, whatever an older setting said (v1.66.0)", async () => {
  // Stored in the four-entry shape the old loader accepted, with everything hidden. It used to take the
  // TP/SL, PAYOUT/MULT and REQ/RISK groups off the panel entirely.
  const qx = await boot({ storage: { ...slStorage(10000), __tradeCalc_visibility: "[0,0,0,0]" } });
  try {
    await sleep(400);
    const root = qx.panelRoot();
    for (const id of ["__tcSecTargets", "__tcSecProtections", "__tcSecProjections"]) {
      assert.ok(root.getElementById(id), id + " is on the panel");
    }
    assert.equal(pref(qx, "__tradeCalc_visibility"), null, "and the old setting is cleared");
  } finally {
    qx.close();
  }
});

// ── v1.67.0: the SL is one number, kept until it is changed ─────────────────────────────────────
// No daily setup screen, no trailing, no per-day backup. The SL does nothing when the balance reaches it -
// the lock went in v1.21.0 and the breach signal left behind had no listener - so it is a reference the
// trader keeps, and the only thing that changes it is the trader.

test("SL: the field is on the panel even with no SL set, and no setup screen appears (v1.67.0)", async () => {
  const qx = await boot({ storage: { __tradeCalc_tb: "20000" } });
  try {
    await sleep(600);
    const root = qx.panelRoot();
    assert.equal(root.getElementById("__tcSLSetup"), null, "no setup screen");
    const fld = root.getElementById("__tcSLFld");
    assert.ok(fld, "the SL field is there");
    assert.notEqual(fld.style.display, "none", "and shown, so there is somewhere to type one");
    assert.notEqual(slField(qx).style.display, "none", "the input too");
    assert.equal(slField(qx).value, "", "empty until one is typed");
  } finally {
    qx.close();
  }
});

test("SL: yesterday's SL is still the SL today - nothing asks again (v1.67.0)", async () => {
  const yesterday = new Date(Date.now() - 36 * 3600000).toISOString().slice(0, 10);
  const qx = await boot({ storage: { ...slStorage(10000), __tradeCalc_sl_ls_date: yesterday } });
  try {
    await sleep(600);
    assert.equal(qx.panelRoot().getElementById("__tcSLSetup"), null, "no setup screen on a new day");
    assert.equal(parseFloat(String(slShown(qx)).replace(/,/g, "")), 10000, "the SL is exactly what it was: " + slShown(qx));
  } finally {
    qx.close();
  }
});

test("SL: it does not move when the balance is above it (v1.67.0)", async () => {
  // Balance 15,228 against an SL of 10,000: the trail used to lift it to 15,228 x 0.8 = 12,182 on its own.
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(2800); // several recalc passes
    assert.equal(pref(qx, "__tradeCalc_sl"), "10000", "stored as set: " + pref(qx, "__tradeCalc_sl"));
    assert.equal(parseFloat(String(slShown(qx)).replace(/,/g, "")), 10000, "shown as set: " + slShown(qx));
  } finally {
    qx.close();
  }
});

test("SL: clearing the field and pressing Enter removes it (v1.67.0)", async () => {
  // This replaces the popup's Daily SL Setup switch as the way to have no SL.
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(600);
    commitSl(qx, "");
    await sleep(200);
    assert.equal(pref(qx, "__tradeCalc_sl"), null, "no SL stored");
    assert.equal(slField(qx).value, "", "and the field is empty");
  } finally {
    qx.close();
  }
});

test("SL: the per-day backup is cleared on load, the SL itself is not (v1.67.0)", async () => {
  const qx = await boot({ storage: slStorage(10000) });
  try {
    await sleep(300);
    for (const k of ["__tradeCalc_sl_ls_date", "__tradeCalc_sl_ls_value", "__tradeCalc_sl_ls_init_bal"]) {
      assert.equal(pref(qx, k), null, k + " is gone");
    }
    assert.equal(pref(qx, "__tradeCalc_sl"), "10000", "__tradeCalc_sl stays");
  } finally {
    qx.close();
  }
});
