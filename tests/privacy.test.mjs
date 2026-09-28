// What the platform can see: page storage, the page head, blocked trades, and how the trade and
// investment hotkeys produce their clicks.

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

// ── v1.27.0: less visible to the platform ──────────────────────────────────────────────────────────

test("privacy: no __tradeCalc_* keys are left in page storage", async () => {
  const qx = await boot();
  try {
    const keys = Object.keys(qx.window.localStorage);
    assert.equal(keys.filter((k) => /^__tradeCalc|^tc_pos$/.test(k)).length, 0, "old names are gone: " + keys.join(","));
    // The values still work: the SL is stored under its opaque name, exactly as it was set (v1.67.0: nothing
    // trails it any more).
    assert.equal(pref(qx, "__tradeCalc_sl"), "10000", "SL value kept");
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

test("privacy: the Live-as-Demo relabel is always on (v1.69.0)", async () => {
  // Its popup switch went in v1.69.0, and with it the message that turned it off.
  const html = FIXTURE.replace(">Demo Account<", ">Live Account<");
  const qx = await boot({ html });
  try {
    const label = () => qx.window.document.querySelector(".v2KPX").textContent;
    assert.equal(label(), "Demo Account", "relabelled");
    await qx.sendToPanel({ type: "SET_PAGE_MARKS", relabel: false });
    assert.equal(label(), "Demo Account", "and the old switch-off message does nothing");
  } finally {
    qx.close();
  }
});
// ── v1.28.0: how the trade click is produced ───────────────────────────────────────────────────────

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
// v1.69.0 removed the arrows' other path (pressing Quotex's own -/+ buttons, chosen by a stored factor of
// 1): the step is 2, always, and the amount is typed.

test("arrows: a factor of 1 stored by an older build no longer sends them to Quotex's -/+ (v1.69.0)", async () => {
  const qx = await boot({ storage: { ...amtStorage, __tradeCalc_step_mult: "1", __tradeCalc_hk_focus_mode: "1" } });
  try {
    const minus = qx.window.document.querySelector(".deal-amount-input .VK9Nw");
    let clicks = 0;
    minus.addEventListener("click", () => clicks++);
    pressSideArrow(qx, "ArrowLeft");
    assert.equal(clicks, 0, "the platform's own − button is not pressed");
    assert.notEqual(qx.window.document.activeElement, minus, "nor selected, even in focus mode");
    assert.equal(stakeField(qx).value, "1000", "the amount was halved instead");
    assert.equal(pref(qx, "__tradeCalc_step_mult"), null, "and the old factor is cleared");
  } finally {
    qx.close();
  }
});

test("arrows: ← and → work with no switch turned on (v1.69.0)", async () => {
  // Their popup switch is gone; the arrows are always on. slStorage alone has no hotkey setting at all.
  const qx = await boot({ storage: slStorage(10000) });
  try {
    pressSideArrow(qx, "ArrowRight");
    assert.equal(stakeField(qx).value, "4000", "→ doubled 2000");
    pressSideArrow(qx, "ArrowLeft");
    assert.equal(stakeField(qx).value, "2000", "← halved it back");
  } finally {
    qx.close();
  }
});

test("arrows: a switch-off stored by an older build does not turn them off (v1.69.0)", async () => {
  const qx = await boot({ storage: { ...slStorage(10000), __tradeCalc_hk_leftright: "false" } });
  try {
    pressSideArrow(qx, "ArrowRight");
    assert.equal(stakeField(qx).value, "4000", "→ still doubles");
    assert.equal(pref(qx, "__tradeCalc_hk_leftright"), null, "and the old setting is cleared");
  } finally {
    qx.close();
  }
});

test("arrows: typing in a box is left alone (v1.69.0)", async () => {
  // Always on must not mean the arrows stop moving the caret in the panel's own fields.
  const qx = await boot({ storage: slStorage(10000) });
  try {
    const sl = qx.panelRoot().getElementById("__tcSLInput");
    sl.focus();
    const ev = new qx.window.KeyboardEvent("keydown", { key: "ArrowRight", code: "ArrowRight", bubbles: true, cancelable: true });
    sl.dispatchEvent(ev);
    assert.equal(stakeField(qx).value, "2000", "the amount did not change");
    assert.equal(ev.defaultPrevented, false, "and the caret still moves");
  } finally {
    qx.close();
  }
});

test("the amount is typed into the field, not written by script (v1.29.0)", async () => {
  const qx = await boot({ storage: amtStorage });
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
    assert.equal(calls[0].text, "4000", "2000 × 2");
    assert.equal(input.value, "4000", "the field holds the new amount");
    assert.equal(scriptedChanges, 0, "the scripted setter path was not used");
  } finally {
    qx.close();
  }
});

test("typing falls back to the scripted setter if the browser refuses (v1.29.0)", async () => {
  const qx = await boot({ storage: amtStorage });
  try {
    const input = stakeField(qx);
    qx.window.document.execCommand = () => false;
    let inputs = 0;
    input.addEventListener("input", () => inputs++);
    pressSideArrow(qx, "ArrowRight");
    assert.equal(input.value, "4000", "the amount still changes");
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

// ── v1.63.0: the arrows double and halve, and hiding the x/÷ widget sticks ──────────────────────

test("arrows: with no factor chosen, → doubles the amount and ← halves it (v1.63.0)", async () => {
  // The factor used to default to 1 - which meant the arrows clicked Quotex's own -/+ buttons instead of
  // multiplying, and the only way to get multiplying at all was the floating widget. 2 is the default now.
  const qx = await boot({ storage: amtStorage });
  try {
    const input = stakeField(qx);
    const start = input.value;
    pressSideArrow(qx, "ArrowRight");
    assert.equal(input.value, "4000", "→ doubled it, from " + start);
    pressSideArrow(qx, "ArrowLeft");
    assert.equal(input.value, "2000", "← halved it back");
    pressSideArrow(qx, "ArrowLeft");
    assert.equal(input.value, "1000", "and again");
  } finally {
    qx.close();
  }
});

test("the x/÷ box and its toggle are gone (v1.69.0)", async () => {
  // The arrows do its job: → doubles, ← halves. A factor stored for its 1.5 / 1.3 cycle is ignored.
  const qx = await boot({ storage: { ...amtStorage, __tradeCalc_im_shown: "1", __tradeCalc_step_mult: "1.5" } });
  try {
    assert.equal(qx.panelRoot().querySelector("#__tcInvestMult"), null, "no floating box");
    assert.equal(qx.panelRoot().querySelector("#__tcImToggle"), null, "no button for it on the bar");
    pressSideArrow(qx, "ArrowRight");
    assert.equal(stakeField(qx).value, "4000", "the step is 2, not the stored 1.5");
    assert.equal(pref(qx, "__tradeCalc_im_shown"), null, "its setting is cleared");
  } finally {
    qx.close();
  }
});

// ── v1.65.1: nothing of the removed features stays in the site's storage ────────────────────────

const REMOVED_FEATURE_KEYS = [
  "__tradeCalc_journal_cache", "__tradeCalc_journal_goal_cache", "__tradeCalc_sheet_url", "__tradeCalc_journal_fz",
  "__tradeCalc_loss_streak", "__tradeCalc_seen_trades", "__tradeCalc_streak_date", "__tradeCalc_last_loss_ts",
  "__tradeCalc_sys_lock_disabled", "__tradeCalc_sl_post_tp_gap", "__tradeCalc_marquee_msg", "__tradeCalc_marquee_speed",
];

test("privacy: keys left by the features removed in v1.65.0 are cleared on load (v1.65.1)", async () => {
  // Measured on the live page after updating to 1.65.0: six of these were still sitting there, read by
  // nothing - loss_streak, seen_trades, streak_date, last_loss_ts, journal_fz, sys_lock_disabled.
  const storage = { ...slStorage(10000), __tradeCalc_mtf_count: "60" };
  for (const k of REMOVED_FEATURE_KEYS) {
    storage[k] = k.endsWith("_cache") ? "[]" : "1";
  }
  const qx = await boot({ storage });
  try {
    await sleep(300);
    const left = REMOVED_FEATURE_KEYS.filter((k) => pref(qx, k) !== null);
    assert.deepEqual(left, [], "none of them survive the load: " + left.join(", "));
    // And not one that is still in use.
    assert.equal(pref(qx, "__tradeCalc_mtf_count"), "60", "the starting zoom for an unscrolled timeframe is kept");
  } finally {
    qx.close();
  }
});
