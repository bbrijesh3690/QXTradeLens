// v1.80.0 (self-healing, step 4): the whole trade page renamed at once. Every class and id in the fixture is
// replaced with a fresh name, every data- attribute is dropped, and the field labels are in another
// language - the harshest rename Quotex could ship. The words on the Up / Down buttons, the pair names and
// the numbers stay: those are what a trader reads, so they are what the finders read too.
// Each spec here names one feature and checks it still works on that page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE, sleep, quotexStore, boot, deal, slStorage, overlayShown, pressSideArrow } from "./helpers.mjs";

function scrambled(html = FIXTURE, { dropData = true } = {}) {
  let n = 0;
  const names = new Map();
  const fresh = (old) => {
    if (!names.has(old)) names.set(old, "z" + (++n).toString(36) + "Qx");
    return names.get(old);
  };
  let out = html
    .replace(/<!--[^]*?-->/g, "")
    .replace(">Investment<", ">Investimento<")
    .replace("<p>Payout</p>", "<p>Pagamento</p>")
    .replace(">Time<", ">Tempo<")
    .replace(/ (class|id)="([^"]*)"/g, (m, attr, v) => ` ${attr}="${v.split(/\s+/).map(fresh).join(" ")}"`);
  if (dropData) out = out.replace(/ data-[a-z-]+="[^"]*"/g, "");
  return out;
}
const PAGE = scrambled();
const now = () => Math.floor(Date.now() / 1000);
const running = (id) => ({ id, asset: "USDDZD_otc", amount: 1000, profit: 0, isDemo: 1, command: 0, openPrice: 100, percentProfit: 80, openTimestamp: now() - 10, closeTimestamp: now() + 50 });
const clickUp = (qx) => {
  const up = Array.from(qx.window.document.querySelectorAll("button")).find((b) => /^Up$/.test(b.textContent.trim()));
  let reached = false;
  up.addEventListener("click", () => (reached = true));
  up.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return reached;
};

test("renamed page: the fixture really has no known name left", () => {
  for (const known of ['id="graph"', 'id="trade-button"', 'id="tab-active"', "deal-amount-input", "data-symbol", "UI2Kh", "dJ15T", "NEJ1S", ">Investment<", "<p>Payout</p>"]) {
    assert.ok(!PAGE.includes(known), "still carries " + known);
  }
});

test("renamed page: every lookup the health check makes still finds its element (v1.80.0)", async () => {
  // Rows that are ok on the page as it was must not be missing on the renamed one. Tab close buttons are
  // not in the fixture at all, so they are missing on both.
  const rowsOf = async (html) => {
    const qx = await boot({ html, store: quotexStore({ balance: 43662.07, demoBalance: 43662.07, activeAccount: "demo", opened: [running("a")] }) });
    try {
      await sleep(900);
      return qx.askPanel({ type: "GET_HEALTH" }).rows;
    } finally {
      qx.close();
    }
  };
  const before = await rowsOf(FIXTURE);
  for (const html of [scrambled(FIXTURE, { dropData: false }), PAGE]) {
    const after = await rowsOf(html);
    for (const row of before.filter((r) => r.status !== "missing")) {
      const now = after.find((r) => r.name === row.name);
      assert.ok(now, "row still reported: " + row.name);
      assert.notEqual(now.status, "missing", row.name + " is lost after the rename: " + JSON.stringify(now));
    }
  }
});

test("renamed page: a payout under the floor still blocks the trade (v1.80.0)", async () => {
  const html = scrambled(FIXTURE.replace(/91 %/g, "79 %"));
  const qx = await boot({ html, store: quotexStore({ payout: 79 }) });
  try {
    await sleep(300);
    assert.equal(overlayShown(qx), true, "79% is below the 89% floor");
    assert.equal(clickUp(qx), false, "and the click is stopped");
  } finally {
    qx.close();
  }
});

test("renamed page: MAX still stops the third trade, and a trade goes through when nothing blocks it (v1.80.0)", async () => {
  const full = await boot({ html: PAGE, store: quotexStore({ opened: [deal("a"), deal("b")] }) });
  try {
    assert.equal(clickUp(full), false, "two open, MAX 2: stopped");
  } finally {
    full.close();
  }
  const empty = await boot({ html: PAGE, store: quotexStore({ opened: [] }) });
  try {
    assert.equal(clickUp(empty), true, "nothing open: it goes through");
  } finally {
    empty.close();
  }
});

test("renamed page: → doubles the amount and leaves the expiry time alone (v1.80.0)", async () => {
  const qx = await boot({ html: PAGE, storage: slStorage(10000) });
  try {
    const inputs = Array.from(qx.window.document.querySelectorAll("input"));
    const time = inputs.find((i) => i.value === "18:14"),
      amount = inputs.find((i) => i.value === "2000");
    pressSideArrow(qx, "ArrowRight");
    assert.equal(time.value, "18:14", "the expiry time is untouched");
    assert.equal(amount.value, "4000", "the amount doubled");
  } finally {
    qx.close();
  }
});

test("renamed page: the chips stand on the chart and the balance comes through (v1.80.0)", async () => {
  const qx = await boot({ html: PAGE, store: quotexStore({ balance: 43662.07, demoBalance: 43662.07, activeAccount: "demo", opened: [running("a")] }) });
  try {
    await sleep(900);
    const canvas = qx.window.document.querySelector("canvas");
    const chips = [...canvas.parentElement.children].filter((d) => (d.style.cssText || "").includes("translate(-50%"));
    assert.ok(chips.some((d) => /[⏱]/.test(d.textContent || "") && d.style.display === "block"), "the countdown chip is up");
    assert.ok(chips.some((d) => /win/.test(d.textContent || "") && d.style.display === "block"), "and the amount chip");
    const row = qx.askPanel({ type: "GET_HEALTH" }).rows.find((r) => r.name === "Balance value");
    assert.equal(row.value, "43662.07", "the balance: " + JSON.stringify(row));
  } finally {
    qx.close();
  }
});

// ── v1.81.0: Quotex's data renamed ──────────────────────────────────────────────────────────────────
// The deal lists moved and their fields renamed. The open and close times are found as the deal's only two
// epoch-second numbers, the pair as the value naming a known asset, the lists as id-keyed maps of such deals.
function renamedDeals(store) {
  const rename = (d) => ({ id: d.id, symbolCode: d.asset, amount: d.amount, profit: d.profit, isDemo: d.isDemo, command: d.command, openPrice: d.openPrice, percentProfit: d.percentProfit, openedAt: d.openTimestamp, closesAt: d.closeTimestamp });
  const map = (byId) => Object.fromEntries(Object.entries(byId).map(([k, d]) => [k, rename(d)]));
  store.trades = { activeById: map(store.deals.openedById), historyById: map(store.deals.closedById) };
  delete store.deals;
  return store;
}
const healthOf = (qx, name) => qx.askPanel({ type: "GET_HEALTH" }).rows.find((r) => r.name === name);

test("renamed data: MAX still counts the open trades when Quotex renames its deal lists and fields (v1.81.0)", async () => {
  const qx = await boot({ store: renamedDeals(quotexStore({ opened: [running("a"), running("b")] })) });
  try {
    await sleep(300);
    assert.equal(clickUp(qx), false, "two open, MAX 2: stopped");
  } finally {
    qx.close();
  }
});

test("renamed data: the countdown chip still counts down, and Check says what was found by shape (v1.81.0)", async () => {
  const qx = await boot({ store: renamedDeals(quotexStore({ opened: [running("a")], closed: [deal("z")] })) });
  try {
    await sleep(900);
    const canvas = qx.window.document.querySelector("canvas");
    const chip = [...canvas.parentElement.children].find((d) => /[⏱]/.test(d.textContent || "") && d.style.display === "block");
    assert.ok(chip, "the countdown chip is up");
    assert.match(chip.textContent, /00:(4\d|50)/, "about 50 s left: " + chip.textContent);
    const row = healthOf(qx, "Quotex data fields");
    assert.match(row.value, /deal lists by shape: trades\.activeById, trades\.historyById/, row.value);
    assert.match(row.value, /deal times by shape/, row.value);
    assert.match(row.value, /deal pair by shape/, row.value);
    const open = healthOf(qx, "Open trades list");
    assert.match(String(open.value), /^1 open/, "the settled deal is not counted as open: " + JSON.stringify(open));
  } finally {
    qx.close();
  }
});

test("renamed data: a renamed balance is reported by name, not guessed (v1.81.0)", async () => {
  const store = quotexStore({ balance: 43662.07 });
  store.global.money = store.global.balance;
  delete store.global.balance;
  const qx = await boot({ store });
  try {
    await sleep(900);
    const row = healthOf(qx, "Quotex data fields");
    assert.equal(row.status, "missing");
    assert.match(row.value, /missing: .*global\.balance/, row.value);
  } finally {
    qx.close();
  }
});

test("renamed page: the pair tab and its name are found from Quotex's data (v1.80.0)", async () => {
  const qx = await boot({ html: PAGE, store: quotexStore({}) });
  try {
    await sleep(900);
    const row = qx.askPanel({ type: "GET_HEALTH" }).rows.find((r) => r.name === "Pair tabs");
    assert.notEqual(row.status, "missing", JSON.stringify(row));
    assert.match(String(row.value), /^1 open/, "the one tab: " + JSON.stringify(row));
    const pct = qx.askPanel({ type: "GET_HEALTH" }).rows.find((r) => r.name === "Payout % element");
    assert.equal(pct.value, "91 %", "the payout % beside it: " + JSON.stringify(pct));
  } finally {
    qx.close();
  }
});
