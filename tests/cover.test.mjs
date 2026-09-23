// "Show Live as Demo" against a build that keeps its account label inside a closed shadow root: the
// label cannot be rewritten any more, so it is covered instead.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE, sleep, quotexStore, boot, prefKey } from "./helpers.mjs";

// Quotex's 2026-09-23 account block: a custom element whose shadow root is closed, so the label and the
// balance inside it are unreachable. jsdom gives it a box through getBoundingClientRect below.
const withComponent = () =>
  FIXTURE.replace(
    '<div class="zfJUm">\n          <div class="v2KPX lTzTl">Demo Account</div>\n          <div class="Zt1hG">₹15,228.00</div>\n        </div>',
    '<div class="uoy2n"><qx-usermenu-trigger></qx-usermenu-trigger></div>',
  );

// jsdom has no layout: give the component a box so the cover has something to sit on.
const giveBox = (w, box = { left: 1544, top: 15, width: 150, height: 44 }) => {
  const el = w.document.querySelector("qx-usermenu-trigger");
  el.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top });
  return el;
};

// The cover carries one of the panel's own hashed ids, so it is found by shape rather than by name.
const coverEl = (qx) =>
  [...qx.panelRoot().children].find((el) => /Demo Account/.test(el.textContent || "") && el.style.position === "fixed") || null;

test("cover: the account label is painted over when Quotex's own is out of reach (v1.58.0)", async () => {
  const qx = await boot({
    html: withComponent(),
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, activeAccount: "demo" }),
    setup: (w) => giveBox(w),
  });
  try {
    await sleep(1200);
    const el = coverEl(qx);
    assert.ok(el, "a cover was drawn");
    assert.match(el.textContent, /Demo Account/, "carrying the label the switch promises");
    assert.match(el.textContent, /43,662/, "and the balance, which their component was showing: " + el.textContent);
  } finally {
    qx.close();
  }
});

test("cover: it sits exactly on their component and lets clicks through (v1.58.0)", async () => {
  const qx = await boot({
    html: withComponent(),
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, activeAccount: "demo" }),
    setup: (w) => giveBox(w),
  });
  try {
    await sleep(1200);
    const el = coverEl(qx);
    assert.equal(el.style.left, "1544px", "positioned on the component: " + el.style.left);
    assert.equal(el.style.top, "15px");
    assert.equal(el.style.width, "150px");
    assert.equal(el.style.height, "44px");
    // Their account menu has to keep opening on a click.
    assert.equal(el.style.pointerEvents, "none", "and transparent to the mouse");
  } finally {
    qx.close();
  }
});

test("cover: it follows their component when the page moves (v1.58.0)", async () => {
  const qx = await boot({
    html: withComponent(),
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, activeAccount: "demo" }),
    setup: (w) => giveBox(w),
  });
  try {
    await sleep(1200);
    assert.equal(coverEl(qx).style.left, "1544px");
    giveBox(qx.window, { left: 900, top: 20, width: 160, height: 40 });
    await sleep(900);
    assert.equal(coverEl(qx).style.left, "900px", "it moved with it: " + coverEl(qx).style.left);
    assert.equal(coverEl(qx).style.width, "160px");
  } finally {
    qx.close();
  }
});

test("cover: with the switch off there is no cover (v1.58.0)", async () => {
  const qx = await boot({
    html: withComponent(),
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, activeAccount: "demo" }),
    storage: { [prefKey("__tradeCalc_relabel_demo")]: "0" },
    setup: (w) => giveBox(w),
  });
  try {
    await sleep(1200);
    assert.equal(coverEl(qx), null, "nothing is painted over their page");
  } finally {
    qx.close();
  }
});

test("cover: a build that still has the label in the page is rewritten, not covered (v1.58.0)", async () => {
  // The old path has to keep working: if Quotex puts the label back, the rewrite takes over and the
  // cover stays away rather than both acting at once.
  const html = FIXTURE.replace('<div class="v2KPX lTzTl">Demo Account</div>', '<div class="v2KPX lTzTl">Live Account</div>');
  const qx = await boot({ html, store: quotexStore() });
  try {
    await sleep(1200);
    assert.equal(coverEl(qx), null, "no cover while their own label is reachable");
    const label = qx.window.document.querySelector(".v2KPX");
    assert.equal(label.textContent, "Demo Account", "it was rewritten in place, as before");
    assert.equal(label.getAttribute("data-tc-relabel"), "1");
  } finally {
    qx.close();
  }
});

test("cover: the panel's own root is never mistaken for Quotex's component (v1.58.0)", async () => {
  // The harness forces every shadow root open and the panel has custom-element-free markup, but the
  // search for a component must still skip anything of ours.
  const qx = await boot({
    html: withComponent(),
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, activeAccount: "demo" }),
    setup: (w) => giveBox(w),
  });
  try {
    await sleep(1200);
    const el = coverEl(qx);
    assert.ok(el, "it found their component");
    // One cover, not one per candidate.
    const all = [...qx.panelRoot().children].filter((n) => /Demo Account/.test(n.textContent || ""));
    assert.equal(all.length, 1, "exactly one cover: " + all.length);
  } finally {
    qx.close();
  }
});
