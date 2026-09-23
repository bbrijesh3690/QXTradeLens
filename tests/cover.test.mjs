// "Show Live as Demo" against a build that keeps its account label inside a closed shadow root. The
// label cannot be rewritten any more, so the name — and only the name — is covered.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE, SOURCE, sleep, quotexStore, boot, prefKey, slStorage } from "./helpers.mjs";

// Quotex's 2026-09-23 account block: a custom element whose shadow root is closed, so the label and the
// balance inside it are unreachable.
const withComponent = () =>
  FIXTURE.replace(
    '<div class="zfJUm">\n          <div class="v2KPX lTzTl">Demo Account</div>\n          <div class="Zt1hG">₹15,228.00</div>\n        </div>',
    '<div class="uoy2n"><qx-usermenu-trigger></qx-usermenu-trigger></div>',
  );

// jsdom has no layout: give the component a box so the cover has something to sit on.
const giveBox = (w, box = { left: 1544, top: 15, width: 150, height: 38 }) => {
  const el = w.document.querySelector("qx-usermenu-trigger");
  el.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top });
  return el;
};

// The cover carries one of the panel's own hashed ids, so it is found by shape rather than by name.
const coverEl = (qx) =>
  [...qx.panelRoot().children].find((el) => /Demo Account/.test(el.textContent || "") && el.style.position === "fixed") || null;

// A live account on the live route: the only situation where there is anything to hide.
const bootLive = (extra = {}) =>
  boot({
    path: "/en/trade",
    html: withComponent(),
    storage: { ...slStorage(50000), __tradeCalc_sl_ls_init_bal: "69036" },
    store: quotexStore({ balance: 69036.96, liveBalance: 69036.96, demoBalance: 0, activeAccount: "live" }),
    setup: (w) => giveBox(w),
    ...extra,
  });

test("cover: on a live account the name is covered (v1.58.1)", async () => {
  const qx = await bootLive();
  try {
    await sleep(1200);
    const el = coverEl(qx);
    assert.ok(el, "a cover was drawn");
    assert.equal(el.textContent, "Demo Account", "carrying the name and nothing else");
  } finally {
    qx.close();
  }
});

test("cover: the balance is left alone (v1.58.1)", async () => {
  // The first cut repainted the balance too. It is theirs; the ask was the name.
  const qx = await bootLive();
  try {
    await sleep(1200);
    const el = coverEl(qx);
    assert.doesNotMatch(el.textContent, /[0-9]/, "no number of ours is drawn: " + el.textContent);
    assert.doesNotMatch(el.textContent, /₹/, "and no currency either");
  } finally {
    qx.close();
  }
});

test("cover: it covers the first line only, not the whole block (v1.58.1)", async () => {
  const qx = await bootLive();
  try {
    await sleep(1200);
    const el = coverEl(qx);
    assert.equal(el.style.left, "1544px", "on their block: " + el.style.left);
    assert.equal(el.style.top, "15px");
    assert.equal(el.style.width, "150px", "the full width of it");
    assert.equal(el.style.height, "19px", "but only its first line, where the label is: " + el.style.height);
  } finally {
    qx.close();
  }
});

test("cover: it names no colour of its own (v1.58.1)", async () => {
  // Nothing in their header paints a background - every ancestor is transparent up to <body>, which
  // computes to white while the page renders dark. A sampled colour put a white slab on a dark header.
  const qx = await bootLive();
  try {
    await sleep(1200);
    const el = coverEl(qx);
    assert.equal(el.style.background, "", "no background of ours: " + el.style.background);
    assert.equal(el.style.backgroundColor, "", "and no background colour either");
    // jsdom drops backdrop-filter as an unknown property, so the build itself is the witness that the
    // cover takes its appearance from whatever the page paints rather than naming a colour.
    assert.match(SOURCE, /backdrop-filter:\s*blur/, "the cover uses a backdrop filter");
    assert.equal(el.style.pointerEvents, "none", "and their account menu still opens");
  } finally {
    qx.close();
  }
});

test("cover: nothing is drawn on a demo account (v1.58.1)", async () => {
  // Their own label already reads "Demo Account" there, so covering it would be pure noise.
  const qx = await boot({
    html: withComponent(),
    store: quotexStore({ balance: 43662.07, demoBalance: 43662.07, activeAccount: "demo" }),
    setup: (w) => giveBox(w),
  });
  try {
    await sleep(1200);
    assert.equal(coverEl(qx), null, "nothing painted over their page");
  } finally {
    qx.close();
  }
});

test("cover: it follows their component when the page moves (v1.58.1)", async () => {
  const qx = await bootLive();
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

test("cover: with the switch off there is no cover (v1.58.1)", async () => {
  const qx = await bootLive({ storage: { ...slStorage(50000), [prefKey("__tradeCalc_relabel_demo")]: "0" } });
  try {
    await sleep(1200);
    assert.equal(coverEl(qx), null, "nothing is painted over their page");
  } finally {
    qx.close();
  }
});

test("cover: a build that still has the label in the page is rewritten, not covered (v1.58.1)", async () => {
  // If Quotex puts the label back, the original rewrite takes over and the cover stands down.
  const html = FIXTURE.replace('<div class="v2KPX lTzTl">Demo Account</div>', '<div class="v2KPX lTzTl">Live Account</div>');
  const qx = await boot({ path: "/en/trade", html, storage: slStorage(10000), store: quotexStore({ activeAccount: "live" }) });
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
