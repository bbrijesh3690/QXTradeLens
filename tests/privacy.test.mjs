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
