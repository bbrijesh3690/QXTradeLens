// v1.85.0: the payout floor in a background tab.
//
// Reported on 2026-10-03 and read from the live page the same day (assetLog, build 1.84.1): after working in
// another browser tab, the "select trade pair" list was open on the way back and pairs kept opening with no
// close in sight. Auto-close and auto-open had kept working in the background, where Chrome wakes a tab's
// timers once a minute (the log's steps were exactly 60 s apart) and draws nothing - and where Quotex's pair
// list never finishes appearing: its rows are in the page, but it reads as closed. So the refill used the
// list without pressing "+", logged "close: closed by itself", and left it open for the return.
//
// The page here behaves the way that log read: "+" opens the list, whose rows are there at once while the
// list itself fades in on the next frame; a pick opens the pair's tab and leaves the list open (the panel
// closes it); its Close button takes it away.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE, sleep, quotexStore, boot, pref, backgroundTab } from "./helpers.mjs";

const LIST = [
  ["EUR/USD (OTC)", 70, "EURUSD_otc"],
  ["AUD/CAD (OTC)", 93, "AUDCAD_otc"],
  ["GBP/JPY (OTC)", 95, "GBPJPY_otc"],
];

// lastTabLow: one tab only, below the floor, with no close control (Quotex gives the last tab none).
// awayOnPlus: the user switches to another tab at the moment "+" is pressed.
function floorPage({ lastTabLow = false, awayOnPlus = false, list = LIST } = {}) {
  const store = quotexStore({ payout: lastTabLow ? 70 : 91 });
  const A = store.assets.assetBySymbol;
  for (const [label, payout, symbol] of list) A[symbol] = { symbol, label, payout, is_otc: 1, active: true };
  if (!lastTabLow) A.EURJPY_otc = { symbol: "EURJPY_otc", label: "EUR/JPY (OTC)", payout: 91, is_otc: 1, active: true };
  let html = FIXTURE.replace('<div id="graph">', '<div id="asset-select--button"><button id="plus">+</button></div><div id="graph">');
  if (lastTabLow) {
    html = html.replace('<div class="ElyTP">91 %</div>', '<div class="ElyTP">70 %</div>').replace('<span class="UI2Kh">91 %</span>', '<span class="UI2Kh">70 %</span>');
  }
  const events = []; // what the page saw: { what, hidden }
  const page = { store, html, events, tab: null };
  page.setup = (w) => {
    const doc = w.document;
    page.tab = backgroundTab(w);
    const note = (what) => events.push({ what, hidden: page.tab.hidden });
    const rect = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      // jsdom has no layout: the list and its rows get a box while they are on the page.
      if (this.classList && (this.classList.contains("a_IoG") || this.classList.contains("R2Rgm"))) {
        return { left: 10, top: 60, width: 300, height: 40, right: 310, bottom: 100, x: 10, y: 60 };
      }
      return rect.call(this);
    };
    const addTab = (symbol, label, pct) => {
      const tab = doc.createElement("div");
      tab.className = "dJ15T vXMlv";
      tab.setAttribute("data-symbol", symbol);
      tab.innerHTML =
        '<div class="WRocw">' + label + '</div><div class="ElyTP">' + pct + ' %</div>' +
        '<button aria-label="Close"><svg class="icon-close-tiny"><use href="#icon-close-tiny"></use></svg></button>';
      tab.querySelector("button").addEventListener("click", () => {
        note("closed " + label);
        tab.remove();
      });
      doc.querySelector(".Q02Z1").appendChild(tab);
    };
    if (!lastTabLow) addTab("EURJPY_otc", "EUR/JPY (OTC)", 91);
    let away = awayOnPlus;
    doc.getElementById("plus").addEventListener("click", () => {
      const open = doc.querySelector(".a_IoG");
      if (open) {
        note("+ closed the list");
        open.remove();
        return;
      }
      note("+ opened the list");
      if (away) {
        away = false;
        page.tab.hide();
      }
      const el = doc.createElement("div");
      el.className = "a_IoG";
      el.style.opacity = "0"; // fades in on the next frame - which a background tab never draws
      el.innerHTML =
        list.map(([label, pct, symbol]) => '<div class="R2Rgm" data-row="' + symbol + '"><div class="teoXG">' + label + '</div><div class="mQX6T">' + pct + ' %</div></div>').join("") +
        '<button aria-label="Close">x</button>';
      doc.getElementById("graph").before(el);
      w.requestAnimationFrame(() => (el.style.opacity = "1"));
      el.querySelector('[aria-label="Close"]').addEventListener("click", () => {
        note("list closed");
        el.remove();
      });
      for (const [label, pct, symbol] of list) {
        el.querySelector('[data-row="' + symbol + '"]').addEventListener("click", () => {
          if (doc.querySelector('.Q02Z1 [data-symbol="' + symbol + '"]')) return;
          note("opened " + label);
          addTab(symbol, label, pct);
        });
      }
    });
    // A pair's payout falls: the platform's own figure and what its tab prints.
    page.fall = (symbol, pct) => {
      store.assets.assetBySymbol[symbol].payout = pct;
      doc.querySelector('.Q02Z1 [data-symbol="' + symbol + '"] .ElyTP').textContent = pct + " %";
    };
    page.tabs = () => [...doc.querySelectorAll(".Q02Z1 [data-symbol]")].map((t) => t.querySelector(".WRocw").textContent);
    page.list = () => {
      const el = doc.querySelector(".a_IoG");
      return !el ? "not on the page" : el.style.opacity === "1" ? "open, on screen" : "in the page, not on screen";
    };
  };
  page.said = (hidden) => events.filter((e) => hidden === undefined || e.hidden === hidden).map((e) => e.what);
  return page;
}

const until = async (ok, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (ok()) return true;
    await sleep(100);
  }
  return ok();
};
const diag = (qx) => JSON.parse(pref(qx, "__tradeCalc_diag") || "{}");

test("background tab: no pair is closed and none is opened; in front again the close comes first, then the refill (v1.85.0)", async () => {
  const page = floorPage();
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(600);
    page.tab.hide();
    page.fall("EURJPY_otc", 70);
    // Eleven wake-ups, with two five-second passes among them: the first can still be inside auto-close's own
    // five-second spacing from its last run in front, so it is the second that 1.84.1 closed the pair on.
    await sleep(14000);
    assert.deepEqual(page.said(), [], "in the background the board is left alone");
    assert.ok(page.tabs().includes("EUR/JPY (OTC)"), "the pair below the floor is still open");
    assert.equal(page.list(), "not on the page", "and the pair list was not opened");

    page.tab.show();
    assert.ok(await until(() => ["AUD/CAD (OTC)", "GBP/JPY (OTC)"].every((n) => page.tabs().includes(n)), 30000), "in front, the refill opened both pairs above the floor: " + page.tabs().join(", "));
    assert.ok(await until(() => page.list() === "not on the page", 6000), "and the list is not left open: " + page.list());
    assert.equal(page.said()[0], "closed EUR/JPY (OTC)", "the close came first, on screen: " + page.said().join(", "));
    assert.deepEqual(page.said(true), [], "nothing at all happened while the tab was in the background");
  } finally {
    qx.close();
  }
});

test("background tab: a refill in progress stops there, its list is closed on the way back, and nothing opens later (v1.85.0)", async () => {
  const page = floorPage({ awayOnPlus: true });
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(600);
    page.fall("EURJPY_otc", 70); // in front: closed, and the refill presses "+" - at which moment the user leaves
    assert.ok(await until(() => page.tab.hidden, 15000), "the refill pressed + : " + page.said().join(", "));
    await sleep(6000); // five wake-ups in the background
    assert.deepEqual(page.said().filter((e) => /^opened /.test(e)), [], "no pair was opened in the background");
    assert.equal(page.list(), "in the page, not on screen", "the list it had opened is still there, unread");

    page.tab.show();
    assert.ok(await until(() => page.list() === "not on the page", 8000), "back in front, the panel closed the list it had opened: " + page.list());
    await sleep(7000); // more than one five-second pass
    assert.deepEqual(page.said().filter((e) => /^opened /.test(e)), [], "and the refill did not carry on - nothing opens without a close: " + page.said().join(", "));
    assert.equal(page.list(), "not on the page", "nor is the list opened again");
    assert.doesNotMatch(String(diag(qx).autoOpen), /asset list is open/, "auto-open is not held behind a list: " + diag(qx).autoOpen);
  } finally {
    qx.close();
  }
});

test("background tab: with every open pair below the floor, a pair is opened only once the tab is in front (v1.85.0)", async () => {
  // The path with no close behind it (v1.54.0): the last tab has no close control, so one pair is opened.
  const page = floorPage({ lastTabLow: true });
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(300);
    page.tab.hide();
    await sleep(13000); // long enough for the pass to see it, wait its four seconds, and act
    assert.deepEqual(page.said(), [], "in the background nothing is opened");
    page.tab.show();
    assert.ok(await until(() => page.tabs().includes("GBP/JPY (OTC)"), 15000), "in front, the best pair above the floor is opened: " + page.tabs().join(", "));
    assert.ok(await until(() => page.list() === "not on the page", 6000), "and the list is closed after it: " + page.list());
    assert.deepEqual(page.said(true), [], "nothing happened while the tab was in the background");
  } finally {
    qx.close();
  }
});

test("payout floor: the log names each close, and the refill says which close started it (v1.85.0)", async () => {
  // Asked on 2026-10-03: a refill was read on the live page with no way to tell which close had started it -
  // the log did not record closes at all.
  const page = floorPage({ list: [LIST[0], LIST[2]] });
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(600);
    page.fall("EURJPY_otc", 70);
    const seen = new Set();
    for (let i = 0; i < 56; i++) {
      await sleep(250);
      String(diag(qx).assetLog || "")
        .split(" | ")
        .forEach((line) => seen.add(line.replace(/^[\d.]+s ago: /, "")));
    }
    const log = [...seen].join(" | ");
    assert.ok(seen.has("auto-close closed EUR/JPY (OTC) at 70%"), "the close is in the log: " + log);
    assert.ok(seen.has("auto-open (refill after closing EUR/JPY (OTC) at 70%): opening GBP/JPY (OTC) at 95%"), "and the refill names it: " + log);
  } finally {
    qx.close();
  }
});
