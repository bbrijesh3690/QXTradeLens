// v1.85.0: the payout floor in a background tab.
//
// Reported on 2026-10-03 and read from the live page the same day (assetLog, build 1.84.1): after working in
// another browser tab, the "select trade pair" list was open on the way back and pairs kept opening with no
// close in sight. Auto-close and auto-open had kept working in the background, where Chrome wakes a tab's
// timers once a minute (the log's steps were exactly 60 s apart) and draws nothing - and where Quotex's pair
// list never finishes appearing: its rows are in the page, but it reads as closed. So the refill used the
// list without pressing "+", logged "close: closed by itself", and left it open for the return.
//
// The page is helpers.mjs floorPage: "+" opens the list, whose rows are there at once while the list itself
// fades in on the next frame; a pick opens the pair tab and leaves the list open (the panel closes it).

import { test } from "node:test";
import assert from "node:assert/strict";
import { sleep, boot, pref, floorPage, until, FLOOR_LIST as LIST } from "./helpers.mjs";

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

test("background tab: a refill cut short after a pick puts the chart back on its pair on the way back (v1.88.0)", async () => {
  // The user leaves at the moment the first pair is picked: the chart is on that pair, and nothing is driven in
  // the background. In front again the list is closed (v1.85.0) and the chart goes back to the pair it was on.
  const page = floorPage({ awayOnPick: true });
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(600);
    page.fall("EURJPY_otc", 70);
    assert.ok(await until(() => page.tab.hidden, 15000), "the refill picked a pair, and the user left: " + page.said().join(", "));
    await sleep(5000); // four wake-ups in the background
    const opened = () => page.said().filter((e) => /^opened /.test(e));
    assert.equal(opened().length, 1, "nothing more was picked in the background: " + page.said().join(", "));
    assert.equal(page.active(), "GBP/JPY (OTC)", "the chart is still on the pair that was picked");
    page.tab.show();
    assert.ok(await until(() => page.active() === "USD/DZD (OTC)", 5000), "back in front, the chart is put back on the pair it was on: " + page.said().join(", "));
    assert.ok(await until(() => page.list() === "not on the page", 8000), "and the list is closed: " + page.list());
    await sleep(6000);
    assert.equal(opened().length, 1, "the refill did not carry on");
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
