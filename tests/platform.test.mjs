// Reading Quotex: the store bridge, self-repairing lookups, the health report, resource use, the payout
// floor, timezone, other languages, and leaving the page alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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

test("system lock: three losses in a row lock nothing and count nothing (v1.65.0)", async () => {
  // Until v1.64.1 a third straight loss sent SYS_LOCK, and the service worker blocked qxbroker.com in Chrome
  // for 15 minutes and closed every Quotex tab. The lock, the streak that fired it and the tracker that fed
  // the streak were all removed in v1.65.0. This keeps them removed.
  const store = quotexStore({ closed: [deal("old1")] });
  // With the lock explicitly ARMED, as it was for anyone who had switched "Disable System Lock" off. The
  // setting may still be sitting in someone's storage; it must not be able to bring the lock back.
  const qx = await boot({ store, storage: { ...slStorage(10000), __tradeCalc_sys_lock_disabled: "0" } });
  try {
    await sleep(600);
    const add = (d) => {
      store.deals.closedById[d.id] = d;
      store.deals.closedIds.push(d.id);
    };
    add(deal("l1", { close: 1789465000 }));
    add(deal("l2", { close: 1789465060 }));
    add(deal("l3", { close: 1789465120 }));
    await sleep(1500);
    assert.deepEqual(qx.sentMessages.filter((m) => m && m.type === "SYS_LOCK"), [], "no lock was asked for");
    assert.equal(pref(qx, "__tradeCalc_loss_streak"), null, "and no streak is being kept");
    assert.equal(healthRow(qx, "Settled trades (loss streak)"), undefined, "nor reported on");
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

test("perf: the scheduler still runs periodic work (v1.65.0: the diagnostics line as the canary)", async () => {
  // This used the 500 ms loss-streak tracker as its canary; that tracker went with the system lock in v1.65.0.
  // The diagnostics line is written on its own 2 s timer through the same scheduler, and every write stamps
  // `at`, so two reads a little over one period apart must see it move.
  const qx = await boot({ store: quotexStore() });
  try {
    await sleep(2300);
    const first = JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").at;
    assert.ok(first > 0, "the line has been written: " + first);
    await sleep(2300);
    const second = JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").at;
    assert.ok(second > first, "and written again on schedule: " + first + " -> " + second);
  } finally {
    qx.close();
  }
});

// ── v1.24.0: account timezone, any-language fallbacks, clean page head ──────────

test("timezone: the trading day follows the account timezone from the store and is cached", async () => {
  // The SL setup screen used to be what exercised this; it went in v1.67.0. The trading day now dates the TP
  // you save, so that is where it is observed: UTC+14 and UTC-10 are always on different calendar days.
  const saveTp = (qx) => {
    const tp = qx.panelRoot().getElementById("__tcTBInput");
    tp.focus();
    typeInto(qx, tp, "25000");
    tp.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  };
  const qx = await boot({ store: quotexStore({ timeZone: 50400 }) });
  try {
    await sleep(300);
    saveTp(qx);
    assert.equal(pref(qx, "__tradeCalc_tp_manual_date"), dayKeyAt(50400), "the TP is dated by the account's day");
    assert.equal(pref(qx, "__tradeCalc_tz_offset_sec"), "50400", "and the timezone is cached");
  } finally {
    qx.close();
  }
  const other = await boot({ store: quotexStore({ timeZone: -36000 }) });
  try {
    await sleep(300);
    saveTp(other);
    assert.equal(pref(other, "__tradeCalc_tp_manual_date"), dayKeyAt(-36000), "a UTC-10 account dates it by its own day");
  } finally {
    other.close();
  }
});

test("timezone: without the store the cached timezone is used", async () => {
  const qx = await boot({ storage: { ...slStorage(10000), __tradeCalc_tz_offset_sec: "50400" } });
  try {
    await sleep(300);
    const tp = qx.panelRoot().getElementById("__tcTBInput");
    tp.focus();
    typeInto(qx, tp, "25000");
    tp.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert.equal(pref(qx, "__tradeCalc_tp_manual_date"), dayKeyAt(50400), "the cached UTC+14 day was used");
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

test("health: with Quotex's data saying nothing is open, page rows that look like trades are not counted (v1.83.0)", async () => {
  // Read live on 1.81.0: "Open trades list 1 open" and "Trade timers 1 tracked" beside "Open trades 0 store",
  // with no trade running - a settled history row was read as one.
  const rows = '<div class="Zz9Tt"><div class="Qq1">USD/DZD (OTC)</div><div class="Qq2">00:45</div><div class="Qq3">+3,700.00 ₹</div></div>';
  const html = FIXTURE.replace('<div id="graph">', rows + '<div id="graph">');
  const qx = await boot({ html, store: quotexStore({ opened: [] }) });
  try {
    const list = healthRow(qx, "Open trades list");
    assert.equal(list.status, "idle", JSON.stringify(list));
    // v1.84.0: and the page's rows are not counted either - their pair is not one Quotex says is open.
    assert.equal(list.value, "no open trades", list.value);
    assert.equal(healthRow(qx, "Trade timers").value, "no open trades");
  } finally {
    qx.close();
  }
});

test("health: Check reports the timeframe button - by its name, and by what it shows once renamed (v1.84.0)", async () => {
  const known = await boot({ html: FIXTURE.replace('<div id="graph">', '<div class="HgaSf">1m</div><div id="graph">') });
  try {
    const row = healthRow(known, "Timeframe button");
    assert.equal(row.status, "ok", JSON.stringify(row));
    assert.equal(row.value, "1m");
  } finally {
    known.close();
  }
  const renamed = await boot({ html: FIXTURE.replace('<div id="graph">', '<div class="zT7qe">1m</div><div id="graph">') });
  try {
    const row = healthRow(renamed, "Timeframe button");
    assert.equal(row.status, "fallback", "found, not by its name: " + JSON.stringify(row));
    assert.equal(row.value, "1m");
  } finally {
    renamed.close();
  }
});

test("self-healing: a remembered trade-row name that Quotex's data contradicts is forgotten (v1.84.0)", async () => {
  // Read live on 1.83.0: "Open trades list · no open trades · 1 on the page" - a name learnt on 2026-09-20
  // (.hdbFu) still matched a block holding a pair and a clock, with nothing running.
  const block = '<div class="hdbFu"><div>USD/DZD (OTC)</div><div>00:45</div></div>';
  const html = FIXTURE.replace('<div id="graph">', block + '<div id="graph">');
  const learned = { "list:openTradeRows": { sel: ".hdbFu", at: "2026-09-20T05:54:08.645Z" } };
  const qx = await boot({ html, store: quotexStore({ opened: [] }), storage: { ...slStorage(10000), [prefKey("__tradeCalc_learned_selectors")]: JSON.stringify(learned) } });
  try {
    await sleep(2500); // long enough for it to be looked for again - and not re-learnt (v1.84.1)
    const list = healthRow(qx, "Open trades list");
    assert.equal(list.value, "no open trades", JSON.stringify(list));
    const now = JSON.parse(pref(qx, "__tradeCalc_learned_selectors") || "{}");
    assert.equal(now["list:openTradeRows"], undefined, "the wrong name is forgotten: " + JSON.stringify(now));
  } finally {
    qx.close();
  }
});

test("self-healing: renamed trade buttons reading Buy / Sell are still guarded (v1.84.0)", async () => {
  // Read live on 1.83.0: Check showed Quotex's Up button as "Buy". The word fallback knew only Up / Down.
  const html = FIXTURE.replace('<div class="DSGsX" id="trade-button">', '<div class="zQ9xT">')
    .replace('<span class="oQ4Z4">Up</span>', '<span class="kP3wL">Buy</span>')
    .replace('<span class="oQ4Z4">Down</span>', '<span class="kP3wL">Sell</span>');
  const qx = await boot({ html, store: quotexStore({ opened: [deal("a"), deal("b")] }) });
  try {
    const buy = Array.from(qx.window.document.querySelectorAll("button")).find((b) => /^Buy$/.test(b.textContent.trim()));
    let reached = false;
    buy.addEventListener("click", () => (reached = true));
    buy.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(reached, false, "two open, MAX 2: the Buy click is stopped");
    assert.notEqual(healthRow(qx, "Up/Down buttons").status, "missing");
  } finally {
    qx.close();
  }
});

test("health: Open trades is one number - \"0 open\" - with the page's only when it differs (v1.84.1)", async () => {
  // Asked from the live Check on 1.84.0: "0 page · 0 store" should read "0 open".
  const none = await boot({ store: quotexStore({ opened: [] }) });
  try {
    assert.equal(healthRow(none, "Open trades").value, "0 open");
  } finally {
    none.close();
  }
  const two = await boot({ store: quotexStore({ opened: [deal("a"), deal("b")] }) });
  try {
    assert.equal(healthRow(two, "Open trades").value, "2 open · 0 on the page", "Quotex's count, the page's beside it when it differs");
  } finally {
    two.close();
  }
});

test("health: Check shows the amount and the expiry time, and finds the expiry switch (v1.84.0)", async () => {
  const html = FIXTURE.replace('<div class="NEJ1S" aria-expanded="false">', '<div class="NEJ1S" aria-expanded="false"><button class="EWNJc">Timer</button>');
  const qx = await boot({ html });
  try {
    assert.equal(healthRow(qx, "Investment field").value, "2000", "the amount, not \"input\"");
    const box = healthRow(qx, "Expiry box");
    assert.equal(box.status, "ok", JSON.stringify(box));
    assert.equal(box.value, "18:14");
    const sw = healthRow(qx, "Expiry switch (T)");
    assert.equal(sw.status, "ok", JSON.stringify(sw));
    assert.equal(sw.value, "on Time");
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
    // Only the tab close button and (v1.84.0) the timeframe button and expiry switch are genuinely absent on
    // this test page.
    assert.equal(report.rows.filter((r) => r.status === "missing").map((r) => r.name).join(","), "Tab close buttons,Timeframe button,Expiry switch (T)");
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

test("auto-open closes the pair list after it opens a pair, when the list has no id (v1.72.4)", async () => {
  // Reported live on 1.72.3: auto-open opened a pair and left the "select trade pair" list open. The list
  // was found for opening by any of its names, but checked for "open" - and closed - by its id alone. Here it
  // has no id, appears when + is pressed, and goes when its own Close button is pressed, as the platform's does.
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const row = (name, pct, id) =>
    '<div class="R2Rgm" id="' + id + '"><div class="teoXG">' + name + '</div><div class="mQX6T">' + pct + ' %</div></div>';
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>')
    .replace('<div id="graph">', '<div id="asset-select--button"><button id="plus">+</button></div><div id="graph">');
  const events = [];
  const setup = (w) => {
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      // jsdom has no layout: the list and its rows get a box while they are on the page.
      if (this.classList && (this.classList.contains("a_IoG") || this.classList.contains("R2Rgm"))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    w.document.getElementById("plus").addEventListener("click", () => {
      if (w.document.querySelector(".a_IoG")) return;
      events.push("opened list");
      const list = w.document.createElement("div");
      list.className = "a_IoG";
      list.innerHTML = row("EUR/USD (OTC)", 70, "rowEur") + row("AUD/CAD (OTC)", 93, "rowAud") + '<button aria-label="Close">x</button>';
      w.document.getElementById("graph").before(list);
      list.querySelector('[aria-label="Close"]').addEventListener("click", () => {
        events.push("closed list");
        list.remove();
      });
      w.document.getElementById("rowAud").addEventListener("click", () => {
        if (events.includes("picked AUD/CAD")) return;
        events.push("picked AUD/CAD");
        const tab = w.document.createElement("div");
        tab.className = "dJ15T vXMlv";
        tab.setAttribute("data-symbol", "AUDCAD_otc");
        tab.innerHTML = '<div class="WRocw">AUD/CAD (OTC)</div><div class="ElyTP">93 %</div>';
        w.document.querySelector(".Q02Z1").appendChild(tab);
      });
    });
  };
  const qx = await boot({ html, store, setup });
  try {
    await sleep(9000);
    assert.deepEqual(events, ["opened list", "picked AUD/CAD", "closed list"], "the list was closed after the pick: " + events.join(", "));
    assert.equal(qx.window.document.querySelector(".a_IoG"), null, "and is gone from the page");
    assert.match(String(JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").assetList), /last close: closed at try/);
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
// ── v1.62.0: a close refills the board ──────────────────────────────────────────────────────────
// The trigger is a close and nothing else. Auto-close removing a pair puts the panel into a fill: it opens
// every instrument the platform rates at or above the floor that is not already open, best first, one per
// pass, and stops when there are none left. No count of open pairs and no count of pairs clearing the
// floor is consulted - v1.61.0 kept two clear of the floor, which was a rule nobody asked for.

test("payout floor: a close refills the board with every pair that clears it (v1.62.0)", async () => {
  const store = quotexStore({ payout: 91 });
  const A = store.assets.assetBySymbol;
  A.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  A.GBPJPY_otc = { symbol: "GBPJPY_otc", label: "GBP/JPY (OTC)", payout: 95, is_otc: 1, active: true };
  // The fixture's own tab pays 91%, over the floor, so the old rule would have stopped after one. Beside it
  // a pair at 70% with a working close button, which is what starts the fill.
  const lowTab =
    '<div class="dJ15T vXMlv" data-symbol="EURJPY_otc"><div class="WRocw">EUR/JPY (OTC)</div><div class="ElyTP">70 %</div>' +
    '<button id="closeLow" aria-label="Close"><svg class="icon-close-tiny"><use href="#icon-close-tiny"></use></svg></button></div>';
  const html = lowTabWithAssetList()
    .replace('<div class="ElyTP">70 %</div>', '<div class="ElyTP">91 %</div>')
    .replace('<span class="UI2Kh">70 %</span>', '<span class="UI2Kh">91 %</span>')
    .replace('<div class="ElyTP">91 %</div>\n          </div>', '<div class="ElyTP">91 %</div>\n          </div>' + lowTab);
  const clicked = [];
  const setup = (w) => {
    w.document.getElementById("closeLow").addEventListener("click", (e) => e.currentTarget.closest("[data-symbol]").remove());
    [["rowAud", "AUDCAD_otc", 93], ["rowGbp", "GBPJPY_otc", 95], ["rowEur", "EURUSD_otc", 70]].forEach(([id, sym, pct]) =>
      w.document.getElementById(id).addEventListener("click", () => {
        if (clicked.includes(id)) return;
        clicked.push(id);
        const tab = w.document.createElement("div");
        tab.className = "dJ15T vXMlv";
        tab.setAttribute("data-symbol", sym);
        tab.innerHTML = '<div class="WRocw">' + (sym === "AUDCAD_otc" ? "AUD/CAD (OTC)" : "GBP/JPY (OTC)") + '</div><div class="ElyTP">' + pct + ' %</div>';
        w.document.querySelector(".Q02Z1").appendChild(tab);
      }),
    );
  };
  const qx = await boot({ html, store, setup });
  try {
    // The reason is sampled as it goes: "already open" holds for a single pass before the 30 s throttle
    // message replaces it, so reading it at the end would miss the moment the fill decided it was done.
    const reasons = [];
    for (let i = 0; i < 28; i++) {
      await sleep(500);
      const r = JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").autoOpen;
      if (r && reasons[reasons.length - 1] !== r) {
        reasons.push(r);
      }
    }
    assert.equal(qx.window.document.querySelector('[data-symbol="EURJPY_otc"]'), null, "the pair below the floor was closed");
    // BOTH qualifying pairs, not one. The 91% tab already clearing the floor is no longer a reason to stop.
    assert.deepEqual(clicked.slice().sort(), ["rowAud", "rowGbp"], "every pair above the floor was opened: " + clicked.join(","));
    // "refilling the board" is not asserted: in jsdom the whole fill is over inside 500 ms, faster than the
    // line can be sampled. That it happened is what `clicked` above proves.
    assert.ok(
      reasons.some((r) => /already open/.test(r)),
      "and stopped once there were none left: " + reasons.join(" | "),
    );
  } finally {
    qx.close();
  }
});

test("payout floor: with nothing closed, nothing is opened (v1.62.0)", async () => {
  // The pass runs every five seconds and usually closes nothing. Triggering on the run rather than on a
  // close would open pairs for ever.
  const store = quotexStore({ payout: 91 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const html = lowTabWithAssetList().replace('<div class="ElyTP">70 %</div>', '<div class="ElyTP">91 %</div>');
  const clicked = [];
  const setup = (w) =>
    ["rowEur", "rowAud", "rowGbp"].forEach((id) =>
      w.document.getElementById(id).addEventListener("click", (e) => clicked.push(e.currentTarget.id)),
    );
  const qx = await boot({ html, store, setup });
  try {
    await sleep(12000);
    assert.deepEqual(clicked, [], "no close happened, so nothing was opened: " + clicked.join(","));
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

test("diagnostics: the payout floor says what it is looking at (v1.54.1)", async () => {
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const qx = await boot({ html: lowTabWithAssetList(), store });
  try {
    await sleep(3000);
    const diag = JSON.parse(pref(qx, "__tradeCalc_diag"));
    assert.equal(diag.floor, 89, "the floor it is holding to");
    assert.deepEqual(diag.pairs, { "USD/DZD (OTC)": 70 }, "and what each open pair pays: " + JSON.stringify(diag.pairs));
    assert.match(String(diag.autoOpen), /below 89%/, "and what it decided: " + diag.autoOpen);
  } finally {
    qx.close();
  }
});

test("diagnostics: with a pair above the floor, the line says so (v1.54.1)", async () => {
  const html = lowTabWithAssetList().replace('<div class="ElyTP">70 %</div>', '<div class="ElyTP">91 %</div>');
  const qx = await boot({ html, store: quotexStore({ payout: 91 }) });
  try {
    await sleep(3000);
    const diag = JSON.parse(pref(qx, "__tradeCalc_diag"));
    assert.match(String(diag.autoOpen), /at or above 89%/, diag.autoOpen);
  } finally {
    qx.close();
  }
});

test("payout floor: the floor in force is the committed one, not what is in the box (v1.61.1)", async () => {
  // The five-second tick read minPayoutInput.value while the diagnostics line reported the stored floor, so
  // a number typed and not yet entered had the board acting on one figure and the line stating another.
  // Measured on the 1.60.1 build: floor reported 89 while the decision read "every pair below 95%". Found
  // on 2026-09-27 while raising the floor to test v1.61.0 - storage said 90, the typed 93 had not
  // committed, and that is when the two sources became visible.
  const qx = await boot({ store: quotexStore({ payout: 91 }) });
  try {
    await sleep(600);
    const input = qx.panelRoot().querySelector("#__tcMinRpInput");
    assert.ok(input, "the payout field is there");
    // Typed, never entered, never blurred - the state the field sits in while someone is still deciding.
    input.value = "95%";
    await sleep(5800);
    const diag = JSON.parse(pref(qx, "__tradeCalc_diag"));
    assert.equal(diag.floor, 89, "the line reports the committed floor: " + diag.floor);
    // The decision has to be about the SAME number the line just stated.
    assert.match(String(diag.autoOpen), /89%/, "and the decision was made on it: " + diag.autoOpen);
    assert.doesNotMatch(String(diag.autoOpen), /95%/, "not on the uncommitted 95: " + diag.autoOpen);
  } finally {
    qx.close();
  }
});

// ── v1.67.1: every decision about the floor reads the saved floor, not the box ──────────────────────
// v1.61.1 fixed this for the five-second pass only. The recalculation - which runs on every relevant page
// change, not when the box is left - still called auto-close and auto-open with whatever was typed, and so
// did both trade-blocking paths, the OTC rebuild, the Q hotkey, the payout cap and the mobile bar. A slip
// like "99" could close every tab below 99 before it was corrected.

test("payout floor: a trade is judged against the saved floor, not a number still being typed (v1.67.1)", async () => {
  const qx = await boot();
  try {
    await sleep(400);
    // Typed, never entered: the box says 95, the saved floor is the default 89, the pair pays 91.
    qx.panelRoot().querySelector("#__tcMinRpInput").value = "95%";
    assert.equal(tradeReachesPlatform(qx), true, "a 91% pair is tradeable against the floor in force");
  } finally {
    qx.close();
  }
});

test("payout floor: Q closes against the saved floor, not a number still being typed (v1.67.1)", async () => {
  const lowTab =
    '<div class="dJ15T vXMlv" data-symbol="EURJPY_otc"><div class="WRocw">EUR/JPY (OTC)</div><div class="ElyTP">91 %</div>' +
    '<button id="closeLow" aria-label="Close"><svg class="icon-close-tiny"><use href="#icon-close-tiny"></use></svg></button></div>';
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>\n          </div>', '<div class="ElyTP">91 %</div>\n          </div>' + lowTab);
  const setup = (w) => w.document.getElementById("closeLow").addEventListener("click", (e) => e.currentTarget.closest("[data-symbol]").remove());
  const qx = await boot({ html, setup });
  try {
    await sleep(400);
    qx.panelRoot().querySelector("#__tcMinRpInput").value = "95%";
    qx.window.document.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "q", code: "KeyQ", bubbles: true, cancelable: true }));
    await sleep(900);
    assert.ok(qx.window.document.querySelector('[data-symbol="EURJPY_otc"]'), "the 91% pair is still open");
  } finally {
    qx.close();
  }
});

test("payout floor: in the source, only the box's own save routine reads what is typed (v1.67.1)", () => {
  // The built file renames variables, so this reads the source. The one read that must stay is the commit
  // itself, which parses the box to save it.
  const src = fs.readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
  const reads = src.split("\n").filter((l) => /minPayoutInput\.value(?!\s*=)/.test(l));
  assert.equal(reads.length, 1, "reads of the box: " + reads.map((l) => l.trim()).join(" | "));
  assert.match(reads[0], /minPayoutInput\.value\.replace\(/, "and it is the save routine parsing the box");
});

// ── v1.75.1: auto-open opens OTC pairs only ─────────────────────────────────────────────────────────
function otcOnlyPage(withOtc) {
  const row = (name, pct, id) =>
    '<div class="R2Rgm" id="' + id + '"><div class="teoXG">' + name + '</div><div class="mQX6T">' + pct + ' %</div></div>';
  return FIXTURE.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>')
    .replace(
      '<div id="graph">',
      '<div id="asset-select-dropdown">' + row("GBP/USD", 96, "rowGbpUsd") + (withOtc ? row("AUD/CAD (OTC)", 93, "rowAud") : "") + '</div><div id="graph">',
    );
}
function otcOnlyStore(withOtc) {
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.GBPUSD = { symbol: "GBPUSD", label: "GBP/USD", payout: 96, is_otc: 0, active: true };
  if (withOtc) store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  return store;
}
const recordClicks = (clicked, ids) => (w) =>
  ids.forEach((id) => {
    const el = w.document.getElementById(id);
    if (el) el.addEventListener("click", (e) => clicked.push(e.currentTarget.id));
  });

test("auto-open: an OTC pair is opened even when a regular pair pays more (v1.75.1)", async () => {
  const clicked = [];
  const qx = await boot({ html: otcOnlyPage(true), store: otcOnlyStore(true), setup: recordClicks(clicked, ["rowGbpUsd", "rowAud"]) });
  try {
    await sleep(7000);
    assert.ok(clicked.includes("rowAud"), "AUD/CAD (OTC) was opened: " + clicked.join(","));
    assert.ok(!clicked.includes("rowGbpUsd"), "GBP/USD, not OTC, was not - though it pays 96%");
  } finally {
    qx.close();
  }
});

test("auto-open: with only a regular pair clearing the floor, nothing is opened (v1.75.1)", async () => {
  const clicked = [];
  const qx = await boot({ html: otcOnlyPage(false), store: otcOnlyStore(false), setup: recordClicks(clicked, ["rowGbpUsd"]) });
  try {
    await sleep(7000);
    assert.deepEqual(clicked, [], "GBP/USD was not opened");
    assert.match(String(JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").autoOpen), /OTC/);
  } finally {
    qx.close();
  }
});

test("auto-open: every step with the pair list is on the diagnostics line, with times (v1.75.3)", async () => {
  // Reported live: the list opened again 2-3 s after it closed when auto-open ran. Two causes fit; the log
  // says which after the next time it happens.
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const row = (name, pct, id) =>
    '<div class="R2Rgm" id="' + id + '"><div class="teoXG">' + name + '</div><div class="mQX6T">' + pct + ' %</div></div>';
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>')
    .replace('<div id="graph">', '<div id="asset-select--button"><button id="plus">+</button></div><div id="graph">');
  const setup = (w) => {
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      if (this.classList && (this.classList.contains("a_IoG") || this.classList.contains("R2Rgm"))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    w.document.getElementById("plus").addEventListener("click", () => {
      if (w.document.querySelector(".a_IoG")) return;
      const list = w.document.createElement("div");
      list.className = "a_IoG";
      list.innerHTML = row("AUD/CAD (OTC)", 93, "rowAud");
      w.document.getElementById("graph").before(list);
      // As on the live page: picking a pair closes the list by itself.
      w.document.getElementById("rowAud").addEventListener("click", () => {
        const tab = w.document.createElement("div");
        tab.className = "dJ15T vXMlv";
        tab.setAttribute("data-symbol", "AUDCAD_otc");
        tab.innerHTML = '<div class="WRocw">AUD/CAD (OTC)</div><div class="ElyTP">93 %</div>';
        w.document.querySelector(".Q02Z1").appendChild(tab);
        list.remove();
      });
    });
  };
  const qx = await boot({ html, store, setup });
  try {
    await sleep(9000);
    const log = String(JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").assetLog);
    for (const step of ["auto-open", "pressed + to open the list", "list appeared", "auto-open picked AUD/CAD (OTC)", "list went", "close: closed by itself"]) {
      assert.ok(log.includes(step), "the log has \"" + step + "\": " + log);
    }
    assert.match(log, /\d+\.\ds ago: /, "with times");
  } finally {
    qx.close();
  }
});

test("auto-open: a list that is still opening when auto-open gives up is closed once it is there (v1.75.4)", async () => {
  // Read live on 1.75.3 (assetLog): the refill wanted Toncoin (OTC), pressed +, found nothing to pick and ran
  // its close within half a second - before the list was on screen. The close saw nothing open, the list then
  // arrived and stayed open. Here the list's rows are in the page at once but it becomes visible 400 ms later,
  // and Toncoin is not in it (Quotex shows one category at a time).
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.TONUSD_otc = { symbol: "TONUSD_otc", label: "Toncoin (OTC)", payout: 93, is_otc: 1, active: true };
  const row = (name, pct, id) =>
    '<div class="R2Rgm" id="' + id + '"><div class="teoXG">' + name + '</div><div class="mQX6T">' + pct + ' %</div></div>';
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>')
    .replace('<div id="graph">', '<div id="asset-select--button"><button id="plus">+</button></div><div id="graph">');
  const setup = (w) => {
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      if (this.classList && (this.classList.contains("a_IoG") || this.classList.contains("R2Rgm"))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    w.document.getElementById("plus").addEventListener("click", () => {
      if (w.document.querySelector(".a_IoG")) return;
      const list = w.document.createElement("div");
      list.className = "a_IoG";
      list.style.opacity = "0"; // on its way in
      list.innerHTML = row("EUR/USD (OTC)", 70, "rowEur") + '<button aria-label="Close">x</button>';
      w.document.getElementById("graph").before(list);
      w.setTimeout(() => (list.style.opacity = "1"), 400);
      list.querySelector('[aria-label="Close"]').addEventListener("click", () => list.remove());
    });
  };
  const qx = await boot({ html, store, setup });
  try {
    await sleep(9000);
    assert.equal(qx.window.document.querySelector(".a_IoG"), null, "the list is not left open");
    const log = String(JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").assetLog);
    assert.ok(log.includes("Toncoin (OTC) is not in the list shown"), log);
    assert.ok(log.includes("close waits for the list it opened"), log);
  } finally {
    qx.close();
  }
});

// ── v1.76.0: self-healing, step 1 - the Up / Down buttons ──────────────────────────────────────────
// Quotex renames its markup every few weeks. The buttons here have lost their id and every class name.
const renamedButtons = () =>
  FIXTURE.replace('<div class="DSGsX" id="trade-button">', '<div class="zQ9xT">').replace(/class="oQ4Z4"/g, 'class="kP3wL"');
const clickUp = (qx) => {
  const up = Array.from(qx.window.document.querySelectorAll("button")).find((b) => /^Up$/.test(b.textContent.trim()));
  let reached = false;
  up.addEventListener("click", () => (reached = true));
  up.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return reached;
};

test("self-healing: renamed Up / Down buttons are still guarded - MAX blocks the third trade (v1.76.0)", async () => {
  const qx = await boot({ html: renamedButtons(), store: quotexStore({ opened: [deal("a"), deal("b")] }) });
  try {
    assert.equal(clickUp(qx), false, "two open, MAX 2: the click is stopped");
  } finally {
    qx.close();
  }
});

test("self-healing: renamed Up / Down buttons still let a trade through when nothing blocks it (v1.76.0)", async () => {
  const qx = await boot({ html: renamedButtons(), store: quotexStore({ opened: [] }) });
  try {
    assert.equal(clickUp(qx), true, "nothing open: the click goes through");
    await sleep(2200);
    const row = qx.askPanel({ type: "GET_HEALTH" }).rows.find((r) => r.name === "Up/Down buttons");
    assert.notEqual(row.status, "missing", "and Check finds them: " + JSON.stringify(row));
  } finally {
    qx.close();
  }
});

test("self-healing: the win/loss preview still sits above renamed Up / Down buttons (v1.76.0)", async () => {
  const qx = await boot({ html: renamedButtons(), store: quotexStore({ opened: [] }) });
  try {
    await sleep(900);
    const block = qx.window.document.querySelector(".zQ9xT");
    const before = block.previousElementSibling;
    assert.ok(before && /\d/.test(before.textContent) && /↑|↓/.test(before.textContent), "the preview is right above them: " + (before && before.textContent));
  } finally {
    qx.close();
  }
});

// ── v1.77.0: self-healing, step 2 - the pair list, its "+", the timeframe button, middle-click ──────
test("self-healing: auto-open works with the pair list and its + renamed (v1.77.0)", async () => {
  // No id and no known class on the list or on "+": the list is found as the block of asset rows, and "+"
  // as the plus sign beside the pair tabs.
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>')
    .replace('<div class="Q02Z1">', '<div class="Q02Z1"></div><button class="xP4qa" id="plus">+</button><div class="Hm2vT">');
  const events = [];
  const setup = (w) => {
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      if (this.classList && (this.classList.contains("zL8kq") || this.classList.contains("rT5wy"))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    w.document.getElementById("plus").addEventListener("click", () => {
      if (w.document.querySelector(".zL8kq")) return;
      events.push("opened list");
      const list = w.document.createElement("div");
      list.className = "zL8kq";
      const row = (name, pct, id) => '<div class="rT5wy" id="' + id + '"><span>' + name + "</span><b>" + pct + " %</b></div>";
      list.innerHTML = '<input type="text" placeholder="Search">' + row("EUR/USD (OTC)", 70, "rEur") + row("GBP/JPY (OTC)", 71, "rGbp") + row("AUD/CAD (OTC)", 93, "rAud") + '<button aria-label="Close">x</button>';
      w.document.getElementById("graph").before(list);
      list.querySelector('[aria-label="Close"]').addEventListener("click", () => {
        events.push("closed list");
        list.remove();
      });
      w.document.getElementById("rAud").addEventListener("click", () => {
        if (events.includes("picked AUD/CAD")) return;
        events.push("picked AUD/CAD");
        const tab = w.document.createElement("div");
        tab.className = "dJ15T vXMlv";
        tab.setAttribute("data-symbol", "AUDCAD_otc");
        tab.innerHTML = '<div class="WRocw">AUD/CAD (OTC)</div><div class="ElyTP">93 %</div>';
        w.document.querySelector(".Hm2vT").appendChild(tab);
      });
    });
  };
  const qx = await boot({ html, store, setup });
  try {
    await sleep(10000);
    assert.ok(events.includes("opened list") && events.includes("picked AUD/CAD"), "the renamed list was opened and used: " + events.join(", "));
    assert.equal(qx.window.document.querySelector(".zL8kq"), null, "and closed after");
  } finally {
    qx.close();
  }
});

// ── v1.80.0: reported live on 1.79.0 - R opened the deposit window ─────────────────────────────────
// The pair list had been renamed. The fallback took a block that is always on the page (rows of pairs and
// percents) for the list, so the list never looked closed, and the close steps pressed "+" - the first plus
// icon on the page, the deposit button in the header. Both guesses were remembered, and a remembered name is
// tried first, so they stuck. The page here has both, and both wrong names already remembered.
async function autoOpenBesideDeposit(remembered) {
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const topRow = (name, pct) => "<div><span>" + name + "</span><b>" + pct + " %</b></div>";
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>')
    .replace('<div class="QE4Zb">', '<div class="ze4yk"><button class="dP0sT" id="deposit"><svg class="icon-plus"></svg>Deposit</button></div><div class="QE4Zb">')
    .replace('<div class="Q02Z1">', '<div class="Q02Z1"></div><button class="xP4qa" id="plus"><svg class="icon-plus"></svg></button><div class="Hm2vT">')
    .replace('<div id="graph">', '<div class="wN3Yc">' + topRow("EUR/JPY (OTC)", 80) + topRow("NZD/USD (OTC)", 82) + topRow("USD/INR (OTC)", 85) + '</div><div id="graph">');
  const learned = { assetDropdown: { sel: ".wN3Yc", at: "2026-09-28T16:53:20.835Z" }, assetAddButton: { sel: ".ze4yk > button", at: "2026-09-28T16:55:04.385Z" } };
  const events = [];
  const setup = (w) => {
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      if (this.classList && (this.classList.contains("zL8kq") || this.classList.contains("rT5wy") || this.classList.contains("wN3Yc"))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    w.document.getElementById("deposit").addEventListener("click", () => events.push("DEPOSIT"));
    w.document.getElementById("plus").addEventListener("click", () => {
      if (w.document.querySelector(".zL8kq")) return;
      events.push("opened list");
      const list = w.document.createElement("div");
      list.className = "zL8kq";
      const row = (name, pct, id) => '<div class="rT5wy" id="' + id + '"><span>' + name + "</span><b>" + pct + " %</b></div>";
      list.innerHTML = '<input type="text" placeholder="Search">' + row("EUR/USD (OTC)", 70, "rEur") + row("GBP/JPY (OTC)", 71, "rGbp") + row("AUD/CAD (OTC)", 93, "rAud") + '<button aria-label="Close">x</button>';
      w.document.getElementById("graph").before(list);
      list.querySelector('[aria-label="Close"]').addEventListener("click", () => {
        events.push("closed list");
        list.remove();
      });
      w.document.getElementById("rAud").addEventListener("click", () => {
        if (events.includes("picked AUD/CAD")) return;
        events.push("picked AUD/CAD");
        const tab = w.document.createElement("div");
        tab.className = "dJ15T vXMlv";
        tab.setAttribute("data-symbol", "AUDCAD_otc");
        tab.innerHTML = '<div class="WRocw">AUD/CAD (OTC)</div><div class="ElyTP">93 %</div>';
        w.document.querySelector(".Hm2vT").appendChild(tab);
      });
    });
  };
  const storage = { ...slStorage(10000) };
  if (remembered) storage[prefKey("__tradeCalc_learned_selectors")] = JSON.stringify(learned);
  const qx = await boot({ html, store, setup, storage });
  try {
    await sleep(10000);
    assert.ok(!events.includes("DEPOSIT"), "the deposit button was never pressed: " + events.join(", "));
    assert.ok(events.includes("opened list") && events.includes("picked AUD/CAD"), "the pair list was opened and used: " + events.join(", "));
    assert.equal(qx.window.document.querySelector(".zL8kq"), null, "and closed after");
    const now = JSON.parse(pref(qx, "__tradeCalc_learned_selectors") || "{}");
    assert.notEqual((now.assetDropdown || {}).sel, ".wN3Yc", "the wrong list is forgotten");
    assert.notEqual((now.assetAddButton || {}).sel, ".ze4yk > button", "and so is the deposit button");
  } finally {
    qx.close();
  }
}
test("self-healing: auto-open presses the + beside the tabs, not the deposit + in the header (v1.80.0)", () => autoOpenBesideDeposit(false));
test("self-healing: a wrong list and + learnt earlier are forgotten, and auto-open works (v1.80.0)", () => autoOpenBesideDeposit(true));

// ── v1.80.2: read live on 1.80.1 - "list appeared", 0.3 s later "list went", "+" pressed again ─────────
// The list found by what it is is looked for at most every 150 ms; in between the finder said "no list", so an
// open list looked closed and auto-open pressed "+" again - which, on Quotex, closes it. The list here has no
// class to remember it by (as live, where nothing was learnt for it), and "+" toggles it, as theirs does.
test("R: works on a renamed pair list, and each pair it picks is on the pair-list log (v1.80.3)", async () => {
  // Read live on 1.80.2: R opens the list once per pair, and Quotex closes it on each pick - which looked like a
  // flicker because R's picks were not logged. The chart's pair is above the floor here, so auto-open stays out.
  const store = quotexStore({ payout: 91 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const html = FIXTURE.replace('<div class="Q02Z1">', '<div class="Q02Z1"></div><button class="xP4qa" id="plus"><svg class="icon-plus"></svg></button><div class="Hm2vT">');
  const setup = (w) => {
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute && (this.hasAttribute("data-list") || (this.classList && this.classList.contains("rT5wy")))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    let list = null;
    w.document.getElementById("plus").addEventListener("click", () => {
      if (list) {
        list.remove();
        list = null;
        return;
      }
      list = w.document.createElement("div");
      list.setAttribute("data-list", "");
      const row = (name, pct, id) => '<div class="rT5wy" id="' + id + '"><span>' + name + "</span><b>" + pct + " %</b></div>";
      list.innerHTML = '<input type="text" placeholder="Search">' + row("EUR/USD (OTC)", 70, "rEur") + row("GBP/JPY (OTC)", 71, "rGbp") + row("AUD/CAD (OTC)", 93, "rAud");
      w.document.getElementById("graph").before(list);
      w.document.getElementById("rAud").addEventListener("click", () => {
        list.remove(); // Quotex closes its list on a pick
        list = null;
        const tab = w.document.createElement("div");
        tab.className = "dJ15T vXMlv";
        tab.setAttribute("data-symbol", "AUDCAD_otc");
        tab.innerHTML = '<div class="WRocw">AUD/CAD (OTC)</div><div class="ElyTP">93 %</div>';
        w.document.querySelector(".Hm2vT").appendChild(tab);
      });
    });
  };
  const qx = await boot({ html, store, setup });
  try {
    await sleep(500);
    qx.window.document.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "r", code: "KeyR", bubbles: true, cancelable: true }));
    await sleep(5000);
    const log = JSON.parse(pref(qx, "__tradeCalc_diag") || "{}").assetLog || "";
    assert.match(log, /R picked AUD\/CAD \(OTC\)/, log);
  } finally {
    qx.close();
  }
});

test("self-healing: an open pair list found by what it is does not look closed between looks (v1.80.2)", async () => {
  const store = quotexStore({ payout: 70 });
  store.assets.assetBySymbol.AUDCAD_otc = { symbol: "AUDCAD_otc", label: "AUD/CAD (OTC)", payout: 93, is_otc: 1, active: true };
  const html = FIXTURE.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>')
    .replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>')
    .replace('<div class="Q02Z1">', '<div class="Q02Z1"></div><button class="xP4qa" id="plus"><svg class="icon-plus"></svg></button><div class="Hm2vT">');
  const events = [];
  const setup = (w) => {
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute && (this.hasAttribute("data-list") || (this.classList && this.classList.contains("rT5wy")))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    let list = null;
    w.document.getElementById("plus").addEventListener("click", () => {
      if (list) {
        events.push("+ closed the list");
        list.remove();
        list = null;
        return;
      }
      events.push("opened list");
      list = w.document.createElement("div");
      list.setAttribute("data-list", "");
      const row = (name, pct, id) => '<div class="rT5wy" id="' + id + '"><span>' + name + "</span><b>" + pct + " %</b></div>";
      list.innerHTML = '<input type="text" placeholder="Search">' + row("EUR/USD (OTC)", 70, "rEur") + row("GBP/JPY (OTC)", 71, "rGbp") + row("AUD/CAD (OTC)", 93, "rAud");
      w.document.getElementById("graph").before(list);
      w.document.getElementById("rAud").addEventListener("click", () => {
        if (events.includes("picked AUD/CAD")) return;
        events.push("picked AUD/CAD");
        const tab = w.document.createElement("div");
        tab.className = "dJ15T vXMlv";
        tab.setAttribute("data-symbol", "AUDCAD_otc");
        tab.innerHTML = '<div class="WRocw">AUD/CAD (OTC)</div><div class="ElyTP">93 %</div>';
        w.document.querySelector(".Hm2vT").appendChild(tab);
      });
    });
  };
  const qx = await boot({ html, store, setup });
  try {
    await sleep(10000);
    const picked = events.indexOf("picked AUD/CAD");
    assert.ok(picked > 0, "the pair was picked: " + events.join(", "));
    assert.ok(!events.slice(0, picked).includes("+ closed the list"), "the list was not closed by a second + before the pick: " + events.join(", "));
    assert.equal(events.filter((e) => e === "opened list").length, 1, "one open was enough: " + events.join(", "));
  } finally {
    qx.close();
  }
});

test("self-healing: middle-click closes a pair tab whose class was renamed (v1.77.0)", async () => {
  const html = FIXTURE.replace('<div class="dJ15T vXMlv" id="tab-active" data-symbol="USDDZD_otc">', '<div class="kW3nb" id="tab-active" data-symbol="USDDZD_otc"><button aria-label="Close" id="closeMe">x</button>');
  const qx = await boot({ html });
  try {
    let closed = 0;
    qx.window.document.getElementById("closeMe").addEventListener("click", () => closed++);
    const tabName = qx.window.document.querySelector(".WRocw");
    tabName.dispatchEvent(new qx.window.MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));
    assert.equal(closed, 1, "its close button was pressed");
  } finally {
    qx.close();
  }
});
