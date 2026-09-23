// Where the account balance comes from. Quotex's 2026-09-23 build moved their account block into
// <qx-usermenu-trigger>, a custom element with a CLOSED shadow root: the figure is no longer anywhere in
// the document, so the platform's own state is the only source left.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE, sleep, quotexStore, boot, healthRow, slStorage } from "./helpers.mjs";

// The page as it is now: the account block renders an empty custom element and nothing else.
const noAccountBlock = () =>
  FIXTURE.replace(
    '<div class="zfJUm">\n          <div class="v2KPX lTzTl">Demo Account</div>\n          <div class="Zt1hG">₹15,228.00</div>\n        </div>',
    '<div class="uoy2n"><qx-usermenu-trigger></qx-usermenu-trigger></div>',
  );

test("balance: read from Quotex's own state when the account block is a closed component (v1.57.0)", async () => {
  const html = noAccountBlock();
  assert.ok(!/Zt1hG|Demo Account/.test(html), "the fixture really has no balance in its markup");
  const qx = await boot({
    html,
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, liveBalance: 0, activeAccount: "demo" }),
  });
  try {
    await sleep(900);
    const row = healthRow(qx, "Balance value");
    assert.equal(row.status, "ok", "the balance arrived");
    assert.equal(row.via, "store", "from the platform, not the page: " + row.via);
    assert.equal(row.value, "43662.07");
  } finally {
    qx.close();
  }
});

test("balance: the missing element is reported as expected, not as a fault (v1.57.0)", async () => {
  const qx = await boot({
    html: noAccountBlock(),
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, activeAccount: "demo" }),
  });
  try {
    await sleep(900);
    const row = healthRow(qx, "Balance");
    // "missing" would send the next reader hunting for a class that no longer exists.
    assert.notEqual(row.status, "missing", "not reported as broken: " + row.status);
    assert.match(row.via, /closed component/, row.via);
  } finally {
    qx.close();
  }
});

test("balance: the live route shows the live figure, not the demo one (v1.57.0)", async () => {
  const qx = await boot({
    path: "/en/trade",
    html: noAccountBlock(),
    storage: { ...slStorage(4000), __tradeCalc_sl_ls_init_bal: "5000" },
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, liveBalance: 5000, activeAccount: "live" }),
  });
  try {
    await sleep(900);
    assert.equal(healthRow(qx, "Balance value").value, "5000", "the account the page is on decides");
  } finally {
    qx.close();
  }
});

test("balance: a zero belonging to the other account is not 'no balance' (v1.57.0)", async () => {
  // On the live route with the demo account active: liveBalance is 0 because the live side is empty, or
  // because it has not loaded. Announcing "no balance to protect" on that would be a lie either way.
  const qx = await boot({
    path: "/en/trade",
    html: noAccountBlock(),
    store: quotexStore({ balance: 43662.072, demoBalance: 43662.072, liveBalance: 0, activeAccount: "demo" }),
  });
  try {
    await sleep(900);
    const row = healthRow(qx, "Balance value");
    assert.equal(row.status, "missing", "it keeps waiting rather than reporting zero: " + row.value);
    assert.notEqual(row.value, "0");
  } finally {
    qx.close();
  }
});

test("balance: the page still answers when the store cannot (v1.57.0)", async () => {
  // The fallback has to survive: a build where the bridge cannot reach the store must still read markup.
  const qx = await boot({ store: quotexStore() });
  try {
    await sleep(900);
    const row = healthRow(qx, "Balance value");
    assert.equal(row.value, "15228", "read from the page as before");
    assert.equal(row.via, "page", row.via);
  } finally {
    qx.close();
  }
});

// ── the semantic layer crosses open shadow roots ────────────────────────────────────────────────

test("selectors: a balance inside an OPEN shadow root is still found (v1.57.0)", async () => {
  // Quotex's own root is closed, so this cannot rescue the account block - but components are clearly
  // how they are heading, and a finder that stops at the first shadow boundary goes blind at each one.
  const setup = (w) => {
    const host = w.document.createElement("div");
    w.document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = '<div>Demo Account</div><div>₹15,228.00</div>';
  };
  const qx = await boot({ html: noAccountBlock(), store: quotexStore(), setup });
  try {
    await sleep(900);
    const row = healthRow(qx, "Balance value");
    assert.equal(row.value, "15228", "found through the shadow boundary");
    assert.equal(row.via, "page", "by the semantic finder, not the store: " + row.via);
  } finally {
    qx.close();
  }
});

test("selectors: the shadow walk never reads the panel's own UI as Quotex's (v1.57.0)", async () => {
  // The harness forces every shadow root open, including ours. In the page ours is closed and could
  // never be reached; here the guard is what keeps the hard rule true.
  const qx = await boot({ html: noAccountBlock(), store: quotexStore() });
  try {
    await sleep(900);
    const row = healthRow(qx, "Balance value");
    assert.equal(row.status, "missing", "nothing was found at all, rather than something of ours: " + row.value);
  } finally {
    qx.close();
  }
});
