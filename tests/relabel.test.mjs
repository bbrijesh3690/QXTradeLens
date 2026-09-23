// "Show Live as Demo". The finder is deliberately narrow: a <div> whose own text node reads exactly
// "Live Account". v1.59.1 widened it to match those words anywhere and had to be reverted — it renamed
// the account switcher's own row, leaving two entries both reading "Demo Account", which makes the two
// accounts indistinguishable at the moment of choosing between them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE, sleep, quotexStore, boot, prefKey, pref } from "./helpers.mjs";

const label = (qx, sel) => qx.window.document.querySelector(sel);
const live = (html) => html.replace('<div class="v2KPX lTzTl">Demo Account</div>', '<div class="v2KPX lTzTl">Live Account</div>');
const diag = (qx) => JSON.parse(pref(qx, "__tradeCalc_diag") || "{}");

test("relabel: a div whose own text is the label is rewritten (v1.59.2)", async () => {
  const qx = await boot({ path: "/en/trade", html: live(FIXTURE), store: quotexStore({ activeAccount: "live" }) });
  try {
    await sleep(900);
    const el = label(qx, ".v2KPX");
    assert.equal(el.textContent, "Demo Account", "rewritten in place");
    assert.equal(el.getAttribute("data-tc-relabel"), "1");
    assert.equal(el.style.color, "rgb(255, 138, 0)", "in the orange it has always used");
  } finally {
    qx.close();
  }
});

test("relabel: the account switcher's own rows are left alone (v1.59.2)", async () => {
  // What v1.59.1 got wrong. A switcher listing both accounts must keep telling them apart; renaming the
  // live row to "Demo Account" left two identical entries.
  const listRow = '<div class="switcherRow"><span class="rowName">Live Account</span><span>₹0.00</span></div>';
  const html = live(FIXTURE).replace("</body>", listRow + "</body>");
  const qx = await boot({ path: "/en/trade", html, store: quotexStore({ activeAccount: "live" }) });
  try {
    await sleep(900);
    assert.equal(label(qx, ".rowName").textContent, "Live Account", "the switcher still distinguishes the accounts");
    assert.equal(label(qx, ".rowName").getAttribute("data-tc-relabel"), null, "and was never touched");
  } finally {
    qx.close();
  }
});

test("relabel: it reports what it found, so this is a read rather than a guess (v1.59.2)", async () => {
  const qx = await boot({ path: "/en/trade", html: live(FIXTURE), store: quotexStore({ activeAccount: "live" }) });
  try {
    await sleep(2600);
    // It reports what is relabelled RIGHT NOW, not what the last pass matched: once the label has been
    // rewritten it no longer reads "Live Account", so a per-pass count says "none" about a working feature.
    assert.match(String(diag(qx).relabel), /rewritten . 1/, "the diagnostics line carries it: " + diag(qx).relabel);
  } finally {
    qx.close();
  }
});

test("relabel: with nothing matching, the line says none rather than claiming success (v1.59.2)", async () => {
  const html = FIXTURE.replace('<div class="v2KPX lTzTl">Demo Account</div>', "<div></div>");
  const qx = await boot({ html, store: quotexStore() });
  try {
    await sleep(2600);
    assert.equal(diag(qx).relabel, "nothing matched", "it says so rather than implying success");
  } finally {
    qx.close();
  }
});

test("relabel: switched off, nothing is touched and the line says why (v1.59.2)", async () => {
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
