// Reading Quotex: the store bridge, self-repairing lookups, the health report, resource use, the SL
// setup screen, timezone, other languages, and leaving the page alone.

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

// ── v1.22.0: store bridge, self-repairing selectors, health report ─────────────────────────────────

test("store: payout % falls back to the store when Quotex's payout elements are gone", async () => {
  // Remove every payout % element the class selectors and the semantic finder could use.
  const html = FIXTURE.replace('<span class="UI2Kh">91 %</span>', "").replace('<div class="ElyTP">91 %</div>', "");
  const withStore = await boot({ html, store: quotexStore({ payout: 79 }) });
  try {
    assert.equal(overlayShown(withStore), true, "79% from the store is below the 89% minimum");
  } finally {
    withStore.close();
  }
  const withoutStore = await boot({ html });
  try {
    assert.equal(overlayShown(withoutStore), false, "no payout readable without the store");
  } finally {
    withoutStore.close();
  }
});

test("store: open trades from the store enforce the max-trades cap", async () => {
  const store = quotexStore({ opened: [deal("a"), deal("b")] });
  const qx = await boot({ store });
  try {
    const buttons = Array.from(qx.window.document.querySelectorAll("#trade-button button"));
    assert.equal(tradeReachesPlatform(qx), false, "blocked at 2 open trades");
    assert.equal(tradeButtonsGreyed(qx), true, "and shown as blocked");
    assert.match(qx.panelRoot().getElementById("__tcWarn").textContent, /Max 2 active trades/);
  } finally {
    qx.close();
  }
});

test("store: open trades on the other account don't count", async () => {
  const store = quotexStore({ opened: [deal("a", { isDemo: 0 }), deal("b", { isDemo: 0 })] });
  const qx = await boot({ store });
  try {
    const buttons = Array.from(qx.window.document.querySelectorAll("#trade-button button"));
    assert.equal(tradeReachesPlatform(qx), true, "live-account deals ignored on the demo page");
  } finally {
    qx.close();
  }
});

test("store: the loss streak counts newly closed deals, not history", async () => {
  const store = quotexStore({ closed: [deal("old1"), deal("old2"), deal("old3")] });
  const qx = await boot({ store });
  try {
    await sleep(600);
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), "0", "history isn't counted");
    const add = (d) => {
      store.deals.closedById[d.id] = d;
      store.deals.closedIds.push(d.id);
    };
    add(deal("l1", { close: 1789465000 }));
    add(deal("l2", { close: 1789465060 }));
    await sleep(900);
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), "2");
    add(deal("w1", { profit: 1700, close: 1789465120 }));
    await sleep(900);
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), "0", "a win resets the streak");
    assert.equal(healthRow(qx, "Settled trades (loss streak)").via, "store");
  } finally {
    qx.close();
  }
});

test("store: tab name comes from the store label when the name element is gone", async () => {
  const html = FIXTURE.replace('<div class="WRocw">USD/DZD (OTC)</div>', "");
  const qx = await boot({ html, store: quotexStore() });
  try {
    // X marks the active tab as monitored, saving its normalized name.
    qx.window.document.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "x", code: "KeyX", bubbles: true }));
    assert.deepEqual(JSON.parse(pref(qx, "__tradeCalc_monitor_pairs")), ["usddzdotc"]);
  } finally {
    qx.close();
  }
});

test("selectors: renamed payout-amount class is found by its text and the new class is learned", async () => {
  const html = FIXTURE.replace('<div class="omlQ2">', '<div class="Zq9Xy">');
  const qx = await boot({ html });
  try {
    assert.equal(qx.window.document.querySelector(".__tcProjBalWin").textContent, "↑ 16,808.00 ₹", "payout 3,580 still read");
    const learned = JSON.parse(pref(qx, "__tradeCalc_learned_selectors"));
    assert.equal(learned.payoutTotal.sel, ".Zq9Xy > b");
    const row = healthRow(qx, "Payout amount");
    assert.equal(row.status, "fallback");
    assert.match(row.via, /^learned /);
  } finally {
    qx.close();
  }
});

test("selectors: renamed pair-tab classes are found through data-symbol", async () => {
  const html = FIXTURE.replace('class="dJ15T vXMlv"', 'class="Qq1Aa vXMlv"');
  const qx = await boot({ html });
  try {
    const row = healthRow(qx, "Pair tabs");
    assert.match(row.via, /semantic|learned/, "found by shape (and remembered afterwards)");
    assert.equal(row.value, "1 open");
  } finally {
    qx.close();
  }
});

test("health: report shows the store bridge and page reads", async () => {
  const qx = await boot({ store: quotexStore({ payout: 91 }) });
  try {
    const report = qx.askPanel({ type: "GET_HEALTH" });
    const byName = Object.fromEntries(report.rows.map((r) => [r.name, r]));
    assert.equal(byName["Store bridge (chart_reader.js)"].status, "ok");
    assert.equal(byName["Balance value"].value, "15228");
    assert.equal(byName["Payout % value"].value, "91% page · 91% store");
    assert.equal(byName["Stake"].value, "2000");
    assert.equal(byName["Currency"].via, "store");
    assert.equal(report.url, "/en/demo-trade");
  } finally {
    qx.close();
  }
});

test("health: without the store the report says so instead of failing", async () => {
  const qx = await boot();
  try {
    const row = healthRow(qx, "Store bridge (chart_reader.js)");
    assert.equal(row.status, "missing");
  } finally {
    qx.close();
  }
});

// ── v1.23.0: resource use ──────────────────────────────────────────────────────────────────────────

test("perf: the panel runs one DOM observer and one scheduler interval", async () => {
  const qx = await boot({ store: quotexStore() });
  try {
    assert.equal(qx.observers.length, 1, "MutationObservers created (v1.22.0 had 4: launcher + 3 in the panel)");
    assert.equal(qx.intervals.size, 2, "intervals: launcher URL poll + panel scheduler");
  } finally {
    qx.close();
  }
});

test("perf: turning the panel off stops its observer and scheduler", async () => {
  const qx = await boot();
  try {
    await qx.sendToPanel({ type: "TOGGLE_PANEL" });
    assert.equal(qx.intervals.size, 1, "only the launcher URL poll remains");
  } finally {
    qx.close();
  }
});

test("perf: the scheduler still runs periodic work (loss streak tracking at 500 ms)", async () => {
  const store = quotexStore();
  const qx = await boot({ store });
  try {
    await sleep(600);
    const l = deal("late-loss", { close: 1789466000 });
    store.deals.closedById[l.id] = l;
    store.deals.closedIds.push(l.id);
    await sleep(800);
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), "1");
  } finally {
    qx.close();
  }
});

// ── v1.24.0: editable SL setup, account timezone, any-language fallbacks, clean page head ──────────

test("SL setup: suggests 85% of the balance in an editable field", async () => {
  const { qx, input, confirm } = await openSetup();
  try {
    assert.equal(input.disabled, false);
    assert.equal(input.value, "12943"); // floor(15,228 × 0.85)
    assert.equal(confirm.disabled, false);
    assert.match(confirm.textContent, /Set SL: ₹12,943\.00/);
  } finally {
    qx.close();
  }
});

test("SL setup: a typed amount is saved and not pulled back up by the trailing SL", async () => {
  const { qx, root, input, confirm } = await openSetup();
  try {
    typeInto(qx, input, "10,500");
    assert.equal(root.getElementById("__tcSLSetupPct").textContent, "69%");
    confirm.click();
    await sleep(900); // close animation + a few recalc ticks (trailing SL runs on recalc)
    assert.equal(root.getElementById("__tcSLSetup"), null, "setup closed");
    assert.equal(root.getElementById("__tcSLInput").value, "10,500.00", "SL kept at the typed value");
    assert.equal(pref(qx, "__tradeCalc_sl_ls_value"), "10500");
    assert.equal(pref(qx, "__tradeCalc_sl_ls_trail"), String(Math.round((1 - 10500 / 15228) * 10000) / 10000));
  } finally {
    qx.close();
  }
});

test("SL setup: % buttons fill the amount, and an amount at or above the balance can't be confirmed", async () => {
  const { qx, root, input, confirm } = await openSetup();
  try {
    root.querySelector('[data-sl-pct="75"]').click();
    assert.equal(input.value, "11421"); // floor(15,228 × 0.75)
    typeInto(qx, input, "15228");
    assert.equal(confirm.disabled, true);
    assert.match(confirm.textContent, /below your balance/);
  } finally {
    qx.close();
  }
});

test("SL setup: Enter in the field confirms", async () => {
  const { qx, root, input } = await openSetup();
  try {
    typeInto(qx, input, "12000");
    input.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(400);
    assert.equal(root.getElementById("__tcSLInput").value, "12,000.00");
  } finally {
    qx.close();
  }
});

test("SL setup: a zero balance says so instead of 'Balance not found', and unblocks the page (v1.24.5)", async () => {
  // A live account with no funds: the balance reads ₹0.00, which used to be treated as unreadable.
  const html = FIXTURE.replace("₹15,228.00", "₹0.00");
  const qx = await boot({ storage: noSl, html });
  await sleep(2000);
  try {
    const root = qx.panelRoot();
    assert.match(root.getElementById("__tcSLSetupMeta").textContent, /no funds|once the account has funds/i);
    assert.equal(root.getElementById("__tcSLConfirmBtn").disabled, true);
    assert.ok(root.getElementById("__tcSLSkipBtn"), "a way out of the screen");
    // The page must not stay click-blocked.
    let clicked = false;
    const up = qx.window.document.querySelector("#trade-button button");
    up.addEventListener("click", () => (clicked = true));
    up.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(clicked, true, "page clicks work again");
    // When the account is funded (or switched), the screen picks the balance up.
    qx.window.document.querySelector(".Zt1hG").textContent = "₹15,228.00";
    await sleep(2600);
    assert.equal(root.getElementById("__tcSLSetupInput").value, "12943");
    assert.equal(root.getElementById("__tcSLSkipBtn"), null, "skip button gone once a balance exists");
  } finally {
    qx.close();
  }
});

test("SL setup: keeps waiting when the balance is slow, and offers a way out (v1.24.5)", async () => {
  const html = FIXTURE.replace('<div class="Zt1hG">₹15,228.00</div>', "");
  const qx = await boot({ storage: noSl, html });
  try {
    const root = qx.panelRoot();
    await sleep(11000); // the skip button appears after ~10 tries
    assert.match(root.getElementById("__tcSLSetupMeta").textContent, /Waiting for your balance/i);
    assert.ok(root.getElementById("__tcSLSkipBtn"), "skip offered instead of a dead end");
    assert.equal(qx.window.__tcSLBlocker, undefined, "page no longer blocked");
    // Still watching: a balance that appears later is picked up.
    const bal = qx.window.document.createElement("div");
    bal.className = "Zt1hG";
    bal.textContent = "₹15,228.00";
    qx.window.document.querySelector(".zfJUm").appendChild(bal);
    await sleep(3200);
    assert.equal(root.getElementById("__tcSLSetupInput").value, "12943");
  } finally {
    qx.close();
  }
});

test("SL setup: page clicks stay blocked while the setup screen is open", async () => {
  const { qx } = await openSetup();
  try {
    let clicked = false;
    const up = qx.window.document.querySelector("#trade-button button");
    up.addEventListener("click", () => (clicked = true));
    up.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(clicked, false);
  } finally {
    qx.close();
  }
});

test("timezone: the trading day follows the account timezone from the store and is cached", async () => {
  const qx = await boot({ storage: slForDay(dayKeyAt(50400)), store: quotexStore({ timeZone: 50400 }) });
  try {
    assert.equal(qx.panelRoot().getElementById("__tcSLSetup"), null, "today's SL (UTC+14 day) recognized");
    assert.equal(pref(qx, "__tradeCalc_tz_offset_sec"), "50400");
  } finally {
    qx.close();
  }
  const other = await boot({ storage: slForDay(dayKeyAt(50400)), store: quotexStore({ timeZone: -36000 }) });
  try {
    await sleep(300);
    assert.ok(other.panelRoot().getElementById("__tcSLSetup"), "a different day in UTC−10 asks for a new SL");
  } finally {
    other.close();
  }
});

test("timezone: without the store the cached timezone is used", async () => {
  const storage = { ...slForDay(dayKeyAt(50400)), __tradeCalc_tz_offset_sec: "50400" };
  const qx = await boot({ storage });
  try {
    assert.equal(qx.panelRoot().getElementById("__tcSLSetup"), null);
  } finally {
    qx.close();
  }
});

test("any language: balance and payout amount are found without English labels or known classes", async () => {
  const html = FIXTURE.replace(">Demo Account<", ">Cuenta demo<")
    .replace('class="Zt1hG"', 'class="Kk2Jj"')
    .replace('<div class="omlQ2">', '<div class="Pp0Oo">')
    .replace("<p>Payout</p>", "<p>Pago</p>");
  const qx = await boot({ html });
  try {
    const doc = qx.window.document;
    assert.equal(doc.querySelector(".__tcProjBalWin").textContent, "↑ 16,808.00 ₹");
    assert.equal(doc.querySelector(".__tcProjBalLoss").textContent, "↓ 13,228.00 ₹");
  } finally {
    qx.close();
  }
});

test("page head: no --tc-* tokens or id-tagged styles in <head>; tokens live in the shadow root", async () => {
  const qx = await boot();
  try {
    await sleep(1500); // let a trade-less panel settle
    const head = qx.window.document.head;
    const headCss = Array.from(head.querySelectorAll("style")).map((s) => s.textContent).join("\n");
    assert.doesNotMatch(headCss, /--tc-/, "no design tokens in the page head");
    assert.equal(head.querySelectorAll("style[id]").length, 0, "no id-tagged style elements");
    const shadowCss = Array.from(qx.panelRoot().querySelectorAll("style")).map((s) => s.textContent).join("\n");
    assert.match(shadowCss, /:host \{ --s-1/);
    await qx.sendToPanel({ type: "TOGGLE_PANEL" });
    assert.equal(head.querySelectorAll("style").length, 0, "cleanup removes the head styles");
  } finally {
    qx.close();
  }
});

test("Quotex's promo banners are left alone (remover removed in v1.24.1)", async () => {
  const html = FIXTURE.replace(
    '<div id="graph">',
    '<div id="promo"><svg class="icon-rocket-banner"></svg><button aria-label="Close"></button></div><div id="bonus"><img alt="welcome bonus"></div><div id="graph">',
  );
  const qx = await boot({ html });
  try {
    await sleep(500);
    assert.ok(qx.window.document.getElementById("promo"), "rocket banner still there");
    assert.ok(qx.window.document.getElementById("bonus"), "welcome bonus still there");
  } finally {
    qx.close();
  }
});

// ── v1.24.4: auto-close must never click a tab that has no close button ─────────────────────────────

test("auto-close: a low-payout tab without a close button isn't clicked (asset panel flicker)", async () => {
  // Live 2026-09-15: tabs have name, payout and a dropdown caret, no close button. Payout 77% < 89% minimum.
  const html = FIXTURE.replace('<div class="dJ15T vXMlv" id="tab-active" data-symbol="USDDZD_otc">', '<div class="dJ15T vXMlv" id="tab-active" data-symbol="USDDZD_otc"><div class="ZyIJD" id="tabBody">')
    .replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">77 %</div><div class="uLwPP"><svg xmlns="http://www.w3.org/2000/svg" class="icon-caret"><use href="#icon-caret"></use></svg></div></div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">77 %</span>');
  const qx = await boot({ html });
  try {
    let clicks = 0;
    qx.window.document.getElementById("tab-active").addEventListener("click", () => clicks++, true);
    await sleep(5600); // auto-close runs on recalc and every 5 s
    assert.equal(clicks, 0, "the tab (which opens the asset panel) was never clicked");
    assert.equal(healthRow(qx, "Tab close buttons").value, "0 of 1");
  } finally {
    qx.close();
  }
});

test("auto-close: a low-payout tab with a real close button is closed", async () => {
  const lowTab =
    '<div class="dJ15T vXMlv" data-symbol="EURUSD_otc"><div class="WRocw">EUR/USD (OTC)</div><div class="ElyTP">70 %</div>' +
    '<button id="closeLow" aria-label="Close"><svg class="icon-close-tiny"><use href="#icon-close-tiny"></use></svg></button></div>';
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>\n          </div>', '<div class="ElyTP">91 %</div>\n          </div>' + lowTab);
  // Quotex removes a tab when its close button is clicked.
  const setup = (w) => w.document.getElementById("closeLow").addEventListener("click", (e) => e.currentTarget.closest("[data-symbol]").remove());
  const qx = await boot({ html, setup });
  try {
    const doc = qx.window.document;
    assert.equal(doc.querySelector('[data-symbol="EURUSD_otc"]'), null, "low-payout tab closed");
    assert.ok(doc.getElementById("tab-active"), "the 91% tab stays");
  } finally {
    qx.close();
  }
});

// ── v1.25.0: the rest of the panel repairs itself too ──────────────────────────────────────────────

test("store: chart countdown chips work with no readable deal rows", async () => {
  const store = quotexStore({ opened: [openDealNow()], quotes: { USDDZD_otc: 256.2 } }); // price below entry = winning
  const qx = await boot({ store });
  try {
    await sleep(700);
    const graphText = qx.window.document.getElementById("graph").textContent;
    assert.match(graphText, /USD\/DZD \(OTC\)/, "pair on the chip");
    assert.match(graphText, /0[01]:\d\d/, "countdown on the chip");
    assert.match(qx.window.document.title, /⏱/, "tab title countdown");
    assert.match(qx.window.document.title, /🟢/, "winning marker");
    assert.equal(healthRow(qx, "Trade timers").via, "store");
  } finally {
    qx.close();
  }
});

test("store: a losing open trade shows the loss marker and no phantom profit", async () => {
  const store = quotexStore({ opened: [openDealNow()], quotes: { USDDZD_otc: 256.9 } }); // price above entry = losing
  const qx = await boot({ store });
  try {
    await sleep(700);
    assert.match(qx.window.document.title, /🔴/, "losing marker");
    assert.doesNotMatch(qx.window.document.title, /🟢/);
  } finally {
    qx.close();
  }
});

test("selectors: deal rows with renamed classes are still found by shape", async () => {
  // A running trade's row: pair name + mm:ss countdown, unknown classes.
  const rows = '<div class="Zz9Tt"><div class="Qq1">USD/DZD (OTC)</div><div class="Qq2">00:45</div><div class="Qq3">+3,700.00 ₹</div></div>' +
    '<div class="Zz9Tt"><div class="Qq1">EUR/USD (OTC)</div><div class="Qq2">00:20</div><div class="Qq3">+1,900.00 ₹</div></div>';
  const html = FIXTURE.replace('<div id="graph">', rows + '<div id="graph">');
  const qx = await boot({ html });
  try {
    const row = healthRow(qx, "Open trades list");
    assert.equal(row.value, "2 open");
    assert.match(row.via, /semantic|learned/, "found by shape, then remembered");
    // Two open trades is the default cap, so trading is blocked.
    assert.equal(tradeReachesPlatform(qx), false);
  } finally {
    qx.close();
  }
});

test("selectors: timeframe and expiry menus with renamed classes are still found", async () => {
  const menus =
    '<div class="Mm1"><div class="Mm2">15s</div><div class="Mm2">1m</div><div class="Mm2">5m</div><div class="Mm2">15m</div></div>';
  const times = '<div class="Tt1"><div class="Tt2">18:14</div><div class="Tt2">18:15</div><div class="Tt2">18:16</div></div>';
  const html = FIXTURE.replace('<div id="graph">', menus + times + '<div id="graph">');
  // Quotex renders the time choices inside the expiry box; put them there before the panel starts.
  const setup = (w) => w.document.querySelector(".NEJ1S").appendChild(w.document.querySelector(".Tt1"));
  const qx = await boot({ html, setup });
  try {
    const tf = healthRow(qx, "Timeframe menu");
    assert.equal(tf.status, "fallback");
    assert.equal(tf.value, "4 items");
    const ex = healthRow(qx, "Expiry times");
    assert.equal(ex.status, "fallback");
    assert.equal(ex.value, "3 items");
    // The new classes are remembered so later lookups are plain queries again.
    const learned = JSON.parse(pref(qx, "__tradeCalc_learned_selectors"));
    assert.equal(learned["list:timeframeItems"].sel, ".Mm2");
    assert.equal(learned["list:expiryTimes"].sel, ".Tt2");
  } finally {
    qx.close();
  }
});

test("health: a lone timeframe label on the page is not a menu (v1.25.1)", async () => {
  // The chart toolbar shows the current timeframe ("1m"); that must not read as an open menu.
  const html = FIXTURE.replace('<div id="graph">', '<div class="Toolbar"><div class="Tb1">1m</div></div><div id="graph">');
  const qx = await boot({ html });
  try {
    const tf = healthRow(qx, "Timeframe menu");
    assert.equal(tf.status, "idle");
    assert.equal(tf.value, "not open");
  } finally {
    qx.close();
  }
});

test("health: values are rounded, not raw floating point (v1.25.1)", async () => {
  // 5% of ₹28,004.59 is 1400.2295000000001 in binary floating point.
  const html = FIXTURE.replace("₹15,228.00", "₹28,004.59").replace('value="2000"', 'value="5%"');
  const qx = await boot({ html });
  try {
    assert.equal(healthRow(qx, "Stake").value, "1400.23");
    assert.equal(healthRow(qx, "Balance value").value, "28004.59");
  } finally {
    qx.close();
  }
});
test("health: lists that aren't open right now read as idle, not broken", async () => {
  const qx = await boot({ store: quotexStore() });
  try {
    const report = qx.askPanel({ type: "GET_HEALTH" });
    const byName = Object.fromEntries(report.rows.map((r) => [r.name, r]));
    assert.equal(byName["Open trades list"].status, "idle");
    assert.equal(byName["Asset list rows"].value, "not open");
    assert.equal(byName["Timeframe menu"].status, "idle");
    // Only the tab close button is genuinely absent on this Quotex build.
    assert.equal(report.rows.filter((r) => r.status === "missing").map((r) => r.name).join(","), "Tab close buttons");
  } finally {
    qx.close();
  }
});


// ── v1.54.0: the payout floor opens a pair as well as closing them ─────────────────────────────────

// One tab, below the floor, with no close control - Quotex gives the last tab none - and an asset list
// holding three OTC pairs. GBP/JPY prints the biggest number but the platform does not list it; the
// store's own asset table is what decides, so AUD/CAD is the one that should open.
function lowTabWithAssetList() {
  const row = (name, pct, id) =>
    '<div class="R2Rgm" id="' + id + '"><div class="teoXG">' + name + '</div><div class="mQX6T">' + pct + ' %</div></div>';
  return FIXTURE.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>')
    .replace(
      '<div id="graph">',
      '<div id="asset-select-dropdown">' +
        row("EUR/USD (OTC)", 70, "rowEur") +
        row("AUD/CAD (OTC)", 93, "rowAud") +
        row("GBP/JPY (OTC)", 95, "rowGbp") +
        '</div><div id="graph">',
    );
}

test("payout floor: with every open pair below it, one that clears it is opened (v1.54.0)", async () => {
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const clicked = [];
  // Quotex adds a pair tab when a row in the asset list is clicked.
  const setup = (w) => {
    ["rowEur", "rowAud", "rowGbp"].forEach((id) => {
      w.document.getElementById(id).addEventListener("click", (e) => {
        const el = e.currentTarget;
        if (clicked.includes(el.id)) return;
        clicked.push(el.id);
        const tab = w.document.createElement("div");
        tab.className = "dJ15T vXMlv";
        tab.setAttribute("data-symbol", "AUDCAD_otc");
        tab.innerHTML = '<div class="WRocw">' + el.querySelector(".teoXG").textContent + '</div><div class="ElyTP">93 %</div>';
        w.document.querySelector(".Q02Z1").appendChild(tab);
      });
    });
  };
  const qx = await boot({ html: lowTabWithAssetList(), store, setup });
  try {
    await sleep(7000);
    assert.deepEqual(clicked, ["rowAud"], "the pair the platform rates highest was opened, once: " + clicked.join(","));
    assert.ok(qx.window.document.querySelector('[data-symbol="AUDCAD_otc"]'), "and its tab is there now");
  } finally {
    qx.close();
  }
});

test("payout floor: a pair above it is reason enough to open nothing (v1.54.0)", async () => {
  const clicked = [];
  const setup = (w) => {
    ["rowEur", "rowAud", "rowGbp"].forEach((id) =>
      w.document.getElementById(id).addEventListener("click", (e) => clicked.push(e.currentTarget.id)),
    );
  };
  // The same page, except the open tab still pays 91% - over the 89% floor.
  const html = lowTabWithAssetList().replace('<div class="ElyTP">70 %</div>', '<div class="ElyTP">91 %</div>');
  const qx = await boot({ html, store: quotexStore({ payout: 91 }), setup });
  try {
    await sleep(7000);
    assert.deepEqual(clicked, [], "nothing in the asset list was clicked");
  } finally {
    qx.close();
  }
});

test("payout floor: nothing is opened while a trade is running (v1.54.0)", async () => {
  const store = quotexStore({ payout: 70, opened: [openDealNow()] });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const clicked = [];
  const setup = (w) => {
    ["rowEur", "rowAud", "rowGbp"].forEach((id) =>
      w.document.getElementById(id).addEventListener("click", (e) => clicked.push(e.currentTarget.id)),
    );
  };
  const qx = await boot({ html: lowTabWithAssetList(), store, setup });
  try {
    await sleep(7000);
    assert.deepEqual(clicked, [], "the board is left alone until the trade settles");
  } finally {
    qx.close();
  }
});

// ── v1.54.0: the projection chip reports itself, so a live trade can confirm it ────────────────────

test("diagnostics: the win projection says what it is showing (v1.54.0)", async () => {
  const store = quotexStore({ opened: [openDealNow()], quotes: { USDDZD_otc: 256.2 } });
  const qx = await boot({ store });
  try {
    await sleep(3000);
    const diag = JSON.parse(pref(qx, "__tradeCalc_diag"));
    assert.match(String(diag.projChip), /win/, "the chip's own text is in the line: " + diag.projChip);
    assert.match(String(diag.projChip), /[0-9]/, "including the number it is projecting: " + diag.projChip);
  } finally {
    qx.close();
  }
});

test("diagnostics: with nothing running, the projection chip reports itself hidden (v1.54.0)", async () => {
  const qx = await boot({ store: quotexStore() });
  try {
    await sleep(3000);
    const diag = JSON.parse(pref(qx, "__tradeCalc_diag"));
    assert.equal(diag.projChip, "hidden");
  } finally {
    qx.close();
  }
});
