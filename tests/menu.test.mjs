// v1.69.0: the top bar takes over from the popup. MAX and FAST on the bar; theme, size, the ↑↓ hotkey,
// Focus Mode, the compatibility check and the deposit scan in its ⚙ menu; and the pill a deposit scan
// shows on the Balance page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sleep, pref, quotexStore, deal, boot, tradeReachesPlatform, bigTfStorage, healthRow, slStorage } from "./helpers.mjs";

const $ = (qx, sel) => qx.panelRoot().querySelector(sel);
const click = (qx, el) => el.dispatchEvent(new qx.window.MouseEvent("click", { bubbles: true, composed: true }));
const menu = (qx) => $(qx, "#__tcMenu");
const openMenu = (qx) => click(qx, $(qx, "#__tcMenuBtn"));
const item = (qx, what) => $(qx, '[data-mn="' + what + '"]');
const menuText = (qx) => menu(qx).textContent.replace(/\s+/g, " ");
const press = (qx, el, key) => el.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }));

// ── The bar ──────────────────────────────────────────────────────────────────────────────────────

test("bar: MULT is called FAST, and its hover text says what it really does (v1.69.0)", async () => {
  const qx = await boot();
  try {
    const labels = [...qx.panelRoot().querySelectorAll(".tcLbl")].map((l) => l.textContent.trim());
    assert.ok(labels.includes("FAST"), "FAST is on the bar: " + labels.join(" "));
    assert.ok(!labels.includes("MULT"), "MULT is gone");
    assert.match($(qx, "#__tcMultiStatus").getAttribute("data-tc-tip"), /second click.*1\.5 s/);
  } finally {
    qx.close();
  }
});

test("bar: MAX shows the trade cap, and Enter saves a new one that the trade guard uses (v1.69.0)", async () => {
  const qx = await boot({ sync: {}, store: quotexStore({ opened: [deal("a")] }) });
  try {
    const field = $(qx, "#__tcMaxTradesInput");
    assert.equal(field.value, "2", "the default cap");
    click(qx, $(qx, "#__tcMultiStatus")); // FAST on, so two clicks in a row are both judged by the cap alone
    assert.equal(tradeReachesPlatform(qx), true, "one open, cap 2: a second trade goes through");
    field.focus();
    field.value = "1";
    press(qx, field, "Enter");
    assert.equal(field.value, "1");
    assert.equal(pref(qx, "__tradeCalc_max_trades"), "1", "saved on the page");
    assert.equal(qx.window.chrome.storage.sync.data.__tradeCalc_max_trades, 1, "and in sync, which the next start reads");
    assert.equal(tradeReachesPlatform(qx), false, "one open, cap 1: blocked");
  } finally {
    qx.close();
  }
});

test("MAX: quick clicks cannot place more trades than the cap before Quotex shows them (v1.72.5)", async () => {
  // Reported live: MAX 2, FAST on, and quick clicks on Up placed more than 2. Quotex lists a trade only once
  // its server has it; here it never does within the test, which is the moment the clicks land in.
  const qx = await boot({ storage: { ...slStorage(10000), __tradeCalc_multi: "1" }, store: quotexStore({ opened: [] }) });
  try {
    const reached = [0, 1, 2, 3, 4].map(() => tradeReachesPlatform(qx)).filter(Boolean).length;
    assert.equal(reached, 2, "five quick clicks, two trades");
    // A trade Quotex never shows (it refused it) stops holding a place after a few seconds.
    await sleep(3200);
    assert.equal(tradeReachesPlatform(qx), true, "the places free up again");
  } finally {
    qx.close();
  }
});

test("MAX: quick ↑ presses cannot place more trades than the cap either (v1.72.5)", async () => {
  const qx = await boot({
    storage: { ...slStorage(10000), __tradeCalc_multi: "1", __tradeCalc_hk_updown: "true" },
    store: quotexStore({ opened: [] }),
  });
  try {
    let placed = 0;
    qx.window.document.querySelector("#trade-button button").addEventListener("click", () => placed++);
    for (let i = 0; i < 5; i++) {
      qx.window.document.dispatchEvent(new qx.window.KeyboardEvent("keydown", { key: "ArrowUp", code: "ArrowUp", bubbles: true }));
    }
    assert.equal(placed, 2, "five presses, two trades");
  } finally {
    qx.close();
  }
});

test("bar: MAX keeps to 1-4 and ignores what is not a number (v1.69.0)", async () => {
  const qx = await boot({ sync: {} });
  try {
    const field = $(qx, "#__tcMaxTradesInput");
    field.value = "9";
    press(qx, field, "Enter");
    assert.equal(field.value, "4", "clamped at the top");
    field.value = "x";
    field.dispatchEvent(new qx.window.Event("blur"));
    assert.equal(field.value, "4", "left as it was");
  } finally {
    qx.close();
  }
});

test("bar: TP, SL and RISK show no decimals (v1.71.0)", async () => {
  const qx = await boot({ storage: { ...slStorage(10250.75), __tradeCalc_tb: "20000.5" } });
  try {
    await sleep(500);
    assert.equal($(qx, "#__tcTBInput").value, "20,001", "TP in whole rupees");
    assert.equal($(qx, "#__tcSLInput").value, "10,251", "SL in whole rupees");
    assert.match($(qx, "#__tcRisk").textContent, /^\d+%$/, "RISK as a whole percent: " + $(qx, "#__tcRisk").textContent);
  } finally {
    qx.close();
  }
});

// ── The ⚙ menu ─────────────────────────────────────────────────────────────────────────────────

test("⚙ menu: opens from the bar with everything the popup held (v1.69.0)", async () => {
  const qx = await boot();
  try {
    assert.equal(menu(qx).hidden, true, "closed to start with");
    openMenu(qx);
    assert.equal(menu(qx).hidden, false, "open");
    assert.equal($(qx, "#__tcMenuBtn").getAttribute("aria-expanded"), "true");
    for (const words of [/Theme/, /Size/, /↑↓ places trades/, /Focus Mode/, /Quotex compatibility/, /Deposits/]) {
      assert.match(menuText(qx), words);
    }
    openMenu(qx);
    assert.equal(menu(qx).hidden, true, "and ⚙ again closes it");
  } finally {
    qx.close();
  }
});

test("⚙ menu: a press outside closes it, a press inside does not (v1.69.0)", async () => {
  const qx = await boot();
  try {
    openMenu(qx);
    item(qx, "dark").dispatchEvent(new qx.window.MouseEvent("pointerdown", { bubbles: true, composed: true }));
    assert.equal(menu(qx).hidden, false, "still open after a press on its own button");
    qx.window.document.body.dispatchEvent(new qx.window.MouseEvent("pointerdown", { bubbles: true, composed: true }));
    assert.equal(menu(qx).hidden, true, "closed by a press on the page");
  } finally {
    qx.close();
  }
});

test("⚙ menu: Light and Dark switch the panel and are remembered (v1.69.0)", async () => {
  const qx = await boot();
  try {
    openMenu(qx);
    click(qx, item(qx, "light"));
    assert.ok($(qx, "#__tradeCalc").classList.contains("tcLightMode"), "light panel");
    assert.equal(pref(qx, "__tradeCalc_theme"), "light");
    assert.ok(item(qx, "light").classList.contains("tcOn"), "and the menu shows which is on");
    click(qx, item(qx, "dark"));
    assert.ok(!$(qx, "#__tradeCalc").classList.contains("tcLightMode"), "dark again");
    assert.equal(pref(qx, "__tradeCalc_theme"), "dark");
  } finally {
    qx.close();
  }
});

test("⚙ menu: − and + change the panel size and it is remembered (v1.69.0)", async () => {
  const qx = await boot();
  try {
    openMenu(qx);
    const start = parseInt($(qx, "#__tcMnSize").textContent, 10);
    click(qx, item(qx, "bigger"));
    assert.equal($(qx, "#__tcMnSize").textContent, start + 1 + "px");
    assert.equal($(qx, "#__tradeCalc").style.fontSize, start + 1 + "px", "the bar itself grew");
    assert.equal(pref(qx, "__tradeCalc_fz"), String(start + 1));
    click(qx, item(qx, "smaller"));
    click(qx, item(qx, "smaller"));
    assert.equal(pref(qx, "__tradeCalc_fz"), String(start - 1));
  } finally {
    qx.close();
  }
});

test("⚙ menu: the ↑↓ switch turns the trade keys on, saved where the next start reads it (v1.69.0)", async () => {
  const qx = await boot({ sync: {} });
  try {
    openMenu(qx);
    assert.equal(item(qx, "updown").getAttribute("aria-checked"), "false", "off unless turned on");
    click(qx, item(qx, "updown"));
    assert.equal(item(qx, "updown").getAttribute("aria-checked"), "true");
    assert.equal(pref(qx, "__tradeCalc_hk_updown"), "true");
    assert.equal(qx.window.chrome.storage.sync.data.__tradeCalc_hk_updown, true, "sync too, or the next start would undo it");
  } finally {
    qx.close();
  }
});

test("⚙ menu: the Focus Mode switch (v1.69.0)", async () => {
  const qx = await boot();
  try {
    openMenu(qx);
    assert.equal(item(qx, "focus").getAttribute("aria-checked"), "false");
    click(qx, item(qx, "focus"));
    assert.equal(item(qx, "focus").getAttribute("aria-checked"), "true");
    assert.equal(pref(qx, "__tradeCalc_hk_focus_mode"), "1");
  } finally {
    qx.close();
  }
});

test("⚙ menu: Check lists every lookup, and says when the tab is running an old copy (v1.69.0)", async () => {
  const qx = await boot();
  try {
    openMenu(qx);
    click(qx, item(qx, "health"));
    const out = $(qx, "#__tcMnHealth");
    assert.ok(out.querySelectorAll(".tcMenuLine").length >= 10, "one line per lookup");
    assert.match(out.textContent, /Balance value/);
    assert.doesNotMatch(out.textContent, /refresh this tab/, "the extension is current");
    // What an extension reload does to a tab that was not refreshed.
    delete qx.window.chrome.runtime.id;
    click(qx, item(qx, "health"));
    assert.match(out.textContent, /updated - refresh this tab/);
  } finally {
    qx.close();
  }
});

// ── Charts (v1.70.0: moved from the deleted popup) ───────────────────────────────────────────────

test("⚙ menu: the chart settings are in it, showing their current values (v1.70.0)", async () => {
  const qx = await boot({ storage: bigTfStorage });
  try {
    openMenu(qx);
    assert.match(menuText(qx), /Charts/);
    assert.equal($(qx, "#__tcMnTfs").value, "1m, 5m, 15m");
    assert.equal(item(qx, "mtfFill").getAttribute("aria-checked"), "true", "fill on by default");
    assert.equal(item(qx, "mtfFlip").getAttribute("aria-checked"), "true", "turn marks on by default");
    assert.equal($(qx, "#__tcMnBars").textContent, "3");
    assert.equal($(qx, "#__tcMnWait").value, "3", "the wait stored for the tests");
  } finally {
    qx.close();
  }
});

test("⚙ menu: timeframes are cleaned, saved and shown on the charts at once (v1.70.0)", async () => {
  const qx = await boot({ storage: bigTfStorage, sync: {} });
  try {
    openMenu(qx);
    const box = $(qx, "#__tcMnTfs");
    box.focus();
    box.value = "15m, 1m, 1m, 2h, 5m, 30m";
    press(qx, box, "Enter");
    assert.equal(box.value, "1m, 5m, 15m, 30m", "sorted, duplicates and unknown ones dropped");
    assert.deepEqual(JSON.parse(pref(qx, "__tradeCalc_mtf_tfs")), ["1m", "5m", "15m", "30m"]);
    assert.deepEqual([...qx.window.chrome.storage.sync.data.__tradeCalc_mtf_tfs], ["1m", "5m", "15m", "30m"], "in sync too");
    const cells = [...qx.panelRoot().querySelectorAll("#__tcMTF .tcMtfCell")].map((c) => c.getAttribute("data-tf"));
    assert.deepEqual(cells, ["1m", "5m", "15m", "30m"], "the chart box was rebuilt with them");
  } finally {
    qx.close();
  }
});

test("⚙ menu: the fill switch turns the auto-fill off, and the check says where (v1.70.0)", async () => {
  const qx = await boot({ storage: bigTfStorage, sync: {} });
  try {
    openMenu(qx);
    click(qx, item(qx, "mtfFill"));
    assert.equal(item(qx, "mtfFill").getAttribute("aria-checked"), "false");
    assert.equal(pref(qx, "__tradeCalc_mtf_autofill"), "0");
    assert.equal(qx.window.chrome.storage.sync.data.__tradeCalc_mtf_autofill, false);
    assert.equal(healthRow(qx, "Charts auto-fill").status, "idle", "the check stops expecting fills");
    await sleep(2200); // the diagnostics line is written every 2 s
    assert.equal(JSON.parse(pref(qx, "__tradeCalc_diag")).autofill, "switched off in the ⚙ menu", "and says where it was switched off");
  } finally {
    qx.close();
  }
});

test("charts closed: the auto-fill says so, rather than 'starting up' for good (v1.70.2)", async () => {
  // Seen live on 1.70.1: the charts were never opened after a refresh, so the auto-fill never ran and its
  // label stayed on "starting up" - read as something being stuck.
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_on: "0" } });
  try {
    assert.equal(qx.panelRoot().getElementById("__tcMTF"), null, "the charts are closed");
    await sleep(500); // the panel's 200 ms loop has not run yet the moment it starts
    assert.equal(healthRow(qx, "Charts auto-fill").value, "charts are hidden (press C)");
    await sleep(2200); // the diagnostics line is written every 2 s
    assert.equal(JSON.parse(pref(qx, "__tradeCalc_diag")).autofill, "charts are hidden (press C)");
  } finally {
    qx.close();
  }
});

test("charts closed: the check marks the auto-fill – (nothing to check), not 🔁 (v1.70.3)", async () => {
  const qx = await boot({ storage: { ...bigTfStorage, __tradeCalc_mtf_on: "0" } });
  try {
    await sleep(500);
    assert.equal(healthRow(qx, "Charts auto-fill").status, "idle", "– while the charts are closed");
    openMenu(qx);
    click(qx, item(qx, "health"));
    assert.match($(qx, "#__tcMnHealth").textContent, /– Charts auto-fill/, "and that is the mark shown");
  } finally {
    qx.close();
  }
});

// ── Deposits ─────────────────────────────────────────────────────────────────────────────────────

const RESULT = {
  at: Date.now(),
  cancelled: false,
  pages: 10,
  count: 4,
  sources: ["store"],
  totals: [
    { symbol: "₹", count: 2, total: 90000 },
    { symbol: "$", count: 2, total: 1010 },
  ],
  methods: [
    { method: "UPI", symbol: "₹", count: 2, total: 90000 },
    { method: "Binance Pay", symbol: "$", count: 2, total: 1010 },
  ],
  recent: [{ id: "1", payment: "UPI", symbol: "₹", amount: 50000 }],
};

test("⚙ menu: Scan asks the extension to start the deposit scan (v1.69.0)", async () => {
  const qx = await boot();
  try {
    openMenu(qx);
    click(qx, item(qx, "deposits"));
    assert.ok(qx.sentMessages.some((m) => m.type === "DEPOSIT_SCAN_START"), "the service worker is asked");
    assert.match($(qx, "#__tcMnDeposits").textContent, /Opening your Balance page/);
  } finally {
    qx.close();
  }
});

test("⚙ menu: the deposit result shows one total per currency and the breakdown (v1.69.0)", async () => {
  const qx = await boot({ local: { __qxDepositScan: RESULT, __qxDepositShow: true } });
  try {
    await sleep(20); // chrome.storage.local answers asynchronously
    const text = $(qx, "#__tcMnDeposits").textContent.replace(/\s+/g, " ");
    assert.match(text, /₹90,000\.00 \+ \$1,010\.00/, "₹ and $ never added together");
    assert.match(text, /4 successful deposits · 10 pages/);
    assert.match(text, /Binance Pay × 2/);
    assert.match(text, /\$1,010\.00/);
    assert.match(text, /…and 3 more/);
  } finally {
    qx.close();
  }
});

test("⚙ menu: coming back from a scan, the menu opens on the result by itself, once (v1.69.0)", async () => {
  const qx = await boot({ local: { __qxDepositScan: RESULT, __qxDepositShow: true } });
  try {
    await sleep(20);
    assert.equal(menu(qx).hidden, false, "open without a click");
    assert.match($(qx, "#__tcMnDeposits").textContent, /₹90,000\.00/, "on the result");
    assert.equal("__qxDepositShow" in qx.window.chrome.storage.local.data, false, "and only this once");
    assert.equal("__qxDepositScan" in qx.window.chrome.storage.local.data, false, "the result is not kept (v1.71.0)");
  } finally {
    qx.close();
  }
});

test("⚙ menu: the check and the deposit result are gone the next time it opens (v1.71.0)", async () => {
  const qx = await boot({ local: { __qxDepositScan: RESULT, __qxDepositShow: true } });
  try {
    await sleep(20);
    click(qx, item(qx, "health"));
    assert.notEqual($(qx, "#__tcMnHealth").textContent, "", "the check is shown");
    assert.notEqual($(qx, "#__tcMnDeposits").textContent, "", "and so is the deposit result");
    openMenu(qx); // ⚙ closes it
    openMenu(qx); // and opens it again
    assert.equal(menu(qx).hidden, false);
    assert.equal($(qx, "#__tcMnHealth").textContent, "", "the check is gone");
    assert.equal($(qx, "#__tcMnDeposits").textContent, "", "and so is the deposit result");
    await sleep(20);
    assert.equal($(qx, "#__tcMnDeposits").textContent, "", "and it does not come back from storage");
  } finally {
    qx.close();
  }
});

test("⚙ menu: a failed scan says so (v1.69.0)", async () => {
  const qx = await boot({ local: { __qxDepositScan: { at: Date.now(), error: "Couldn't read page 3" }, __qxDepositShow: true } });
  try {
    await sleep(20);
    assert.match($(qx, "#__tcMnDeposits").textContent, /Scan failed: Couldn't read page 3/);
  } finally {
    qx.close();
  }
});

test("deposit pill: the Balance page shows the page being read, and Stop reaches the extension (v1.69.0)", async () => {
  const qx = await boot({ path: "/en/balance" });
  try {
    await qx.sendToPanel({ type: "DEPOSIT_SCAN_STATUS", page: 3 });
    const pill = qx.shadowRoots.find((r) => /Scanning deposits/.test(r.textContent));
    assert.ok(pill, "a pill is shown");
    assert.match(pill.textContent, /page 3/);
    await qx.sendToPanel({ type: "DEPOSIT_SCAN_STATUS", page: 4 });
    assert.equal(qx.shadowRoots.filter((r) => /Scanning deposits/.test(r.textContent)).length, 1, "one pill, updated");
    assert.match(pill.textContent, /page 4/);
    click(qx, pill.querySelector("button"));
    assert.ok(qx.sentMessages.some((m) => m.type === "DEPOSIT_SCAN_STOP"), "Stop is sent");
  } finally {
    qx.close();
  }
});
