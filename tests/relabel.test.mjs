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

test("relabel: always on - a switch-off stored by an older build no longer stops it (v1.69.0)", async () => {
  // The popup switch is gone. Anyone who had turned it off still has "0" stored; it must not keep the
  // relabel off with no way left to turn it back on.
  const qx = await boot({
    path: "/en/trade",
    html: live(FIXTURE),
    storage: { [prefKey("__tradeCalc_relabel_demo")]: "0" },
    store: quotexStore({ activeAccount: "live" }),
  });
  try {
    await sleep(2600);
    assert.equal(label(qx, ".v2KPX").textContent, "Demo Account", "relabelled anyway");
    assert.match(String(diag(qx).relabel), /rewritten/);
    assert.equal(pref(qx, "__tradeCalc_relabel_demo"), null, "and the old setting is cleared");
  } finally {
    qx.close();
  }
});

// ── v1.72.7: step 1 of our own "Demo Account" block - read what is behind theirs ─────────────────
test("account block: the line reports its box, what paints behind it and its font (v1.72.7)", async () => {
  // The v1.58 tries looked up through the block's parents, which are all transparent; the dark background is
  // painted by a layer beside it. jsdom has no layout, so the page gets a stack at every point: the block,
  // then a header strip painting the colour, then the body (white, as on the live page).
  const setup = (w) => {
    const bg = w.document.createElement("div");
    bg.className = "qHeaderBg";
    bg.style.backgroundColor = "rgb(28, 31, 45)";
    const host = w.document.createElement("qx-usermenu-trigger");
    w.document.body.append(bg, host);
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      if (this === host) return { left: 1500, top: 8, width: 180, height: 40, right: 1680, bottom: 48, x: 1500, y: 8 };
      return rect.call(this);
    };
    w.document.elementsFromPoint = (x) => (x >= 1500 && x <= 1680 ? [host, bg, w.document.body] : [bg, w.document.body]);
  };
  const qx = await boot({ path: "/en/trade", setup });
  try {
    await sleep(2200);
    const line = String(diag(qx).accountBlock);
    assert.match(line, /^box 1500,8 180x40/);
    assert.match(line, /behind centre: div\.qHeaderBg rgb\(28, 31, 45\)/, line);
    assert.match(line, /left of it: div\.qHeaderBg rgb\(28, 31, 45\)/, line);
  } finally {
    qx.close();
  }
});
