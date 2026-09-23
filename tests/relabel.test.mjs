// "Show Live as Demo": the account label is identified by the words it carries, not by one exact
// markup shape. Quotex rewraps that block from time to time and the words are what survive.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE, sleep, quotexStore, boot, prefKey, pref } from "./helpers.mjs";

const label = (qx, sel) => qx.window.document.querySelector(sel);
const live = (html) => html.replace('<div class="v2KPX lTzTl">Demo Account</div>', '<div class="v2KPX lTzTl">Live Account</div>');
const diag = (qx) => JSON.parse(pref(qx, "__tradeCalc_diag") || "{}");

test("relabel: the original shape still works exactly as before (v1.59.1)", async () => {
  const qx = await boot({ path: "/en/trade", html: live(FIXTURE), store: quotexStore({ activeAccount: "live" }) });
  try {
    await sleep(900);
    const el = label(qx, ".v2KPX");
    assert.equal(el.textContent, "Demo Account", "rewritten in place");
    assert.equal(el.getAttribute("data-tc-relabel"), "1");
    assert.equal(el.style.color, "rgb(255, 138, 0)", "in the same orange as always");
  } finally {
    qx.close();
  }
});

test("relabel: a label wrapped in a span is still found (v1.59.1)", async () => {
  // The old finder demanded a DIV whose own text node was exactly "Live Account". One extra wrapper and
  // it matched nothing - and the feature went quiet with no sign of why.
  const html = FIXTURE.replace('<div class="v2KPX lTzTl">Demo Account</div>', '<div class="v2KPX lTzTl"><span class="inner">Live Account</span></div>');
  const qx = await boot({ path: "/en/trade", html, store: quotexStore({ activeAccount: "live" }) });
  try {
    await sleep(900);
    assert.equal(label(qx, ".inner").textContent, "Demo Account", "the words are what identify it");
    assert.equal(label(qx, ".inner").getAttribute("data-tc-relabel"), "1");
  } finally {
    qx.close();
  }
});

test("relabel: whitespace around the words does not hide them (v1.59.1)", async () => {
  const html = FIXTURE.replace('<div class="v2KPX lTzTl">Demo Account</div>', '<div class="v2KPX lTzTl">\n            Live Account\n          </div>');
  const qx = await boot({ path: "/en/trade", html, store: quotexStore({ activeAccount: "live" }) });
  try {
    await sleep(900);
    assert.equal(label(qx, ".v2KPX").textContent, "Demo Account");
  } finally {
    qx.close();
  }
});

test("relabel: a tag other than div is still found (v1.59.1)", async () => {
  const html = FIXTURE.replace('<div class="v2KPX lTzTl">Demo Account</div>', '<span class="v2KPX lTzTl">Live Account</span>');
  const qx = await boot({ path: "/en/trade", html, store: quotexStore({ activeAccount: "live" }) });
  try {
    await sleep(900);
    assert.equal(label(qx, ".v2KPX").textContent, "Demo Account");
  } finally {
    qx.close();
  }
});

test("relabel: a label inside an open shadow root is found (v1.59.1)", async () => {
  const html = FIXTURE.replace('<div class="v2KPX lTzTl">Demo Account</div>', '<div id="acctHost"></div>');
  const setup = (w) => {
    const root = w.document.getElementById("acctHost").attachShadow({ mode: "open" });
    root.innerHTML = '<div class="inShadow">Live Account</div>';
  };
  const qx = await boot({ path: "/en/trade", html, store: quotexStore({ activeAccount: "live" }), setup });
  try {
    await sleep(900);
    const el = qx.window.document.getElementById("acctHost").shadowRoot.querySelector(".inShadow");
    assert.equal(el.textContent, "Demo Account", "found through the shadow boundary");
  } finally {
    qx.close();
  }
});

test("relabel: it reports what it found, so this never has to be guessed again (v1.59.1)", async () => {
  const qx = await boot({ path: "/en/trade", html: live(FIXTURE), store: quotexStore({ activeAccount: "live" }) });
  try {
    await sleep(2600);
    assert.match(String(diag(qx).relabel), /[0-9]+ found/, "the diagnostics line carries it: " + diag(qx).relabel);
    assert.doesNotMatch(String(diag(qx).relabel), /0 found/, "and it found the label: " + diag(qx).relabel);
  } finally {
    qx.close();
  }
});

test("relabel: with nothing to relabel the line says so rather than claiming success (v1.59.1)", async () => {
  // The fixture's own label already reads "Demo Account" and was never ours.
  const html = FIXTURE.replace('<div class="v2KPX lTzTl">Demo Account</div>', "<div></div>");
  const qx = await boot({ html, store: quotexStore() });
  try {
    await sleep(2600);
    assert.match(String(diag(qx).relabel), /none|0 found/, diag(qx).relabel);
  } finally {
    qx.close();
  }
});

test("relabel: switched off, nothing is touched and the line says why (v1.59.1)", async () => {
  const qx = await boot({
    path: "/en/trade",
    html: live(FIXTURE),
    storage: { [prefKey("__tradeCalc_relabel_demo")]: "0" },
    store: quotexStore({ activeAccount: "live" }),
  });
  try {
    await sleep(2600);
    assert.equal(label(qx, ".v2KPX").textContent, "Live Account", "their own label is left alone");
    assert.equal(diag(qx).relabel, "switched off");
  } finally {
    qx.close();
  }
});
