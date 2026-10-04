// v1.86.0: a refill is one visit to the pair list.
//
// Asked on 2026-10-03, after a refill was watched on 1.85.0: "the way R is doing its job, picking every pair in
// a ms". R opens the list once and picks pair after pair. The refill picked one pair, closed the list and waited
// for the next five-second pass - read live with a recorder on the diagnostics line, four pairs took 17 s and
// brought the list up five times, the last time for a pair it could not reach (another category), finding
// nothing.
//
// The page is helpers.mjs floorPage, the pair list as the live one behaves: a pick leaves it open.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sleep, boot, pref, floorPage, until, healthRow, bigTfStorage, makeCandles } from "./helpers.mjs";

const diag = (qx) => JSON.parse(pref(qx, "__tradeCalc_diag") || "{}");
const count = (page, what) => page.said().filter((e) => e === what).length;
const opened = (page) => page.said().filter((e) => /^opened /.test(e));
const at = (page, what) => (page.events.find((e) => e.what === what) || {}).at;

test("payout floor: a refill opens the list once and picks every pair above the floor in that visit, best first (v1.86.0)", async () => {
  const page = floorPage({
    list: [
      ["EUR/USD (OTC)", 70, "EURUSD_otc"],
      ["AUD/CAD (OTC)", 93, "AUDCAD_otc"],
      ["GBP/JPY (OTC)", 95, "GBPJPY_otc"],
      ["NZD/USD (OTC)", 92, "NZDUSD_otc"],
      ["CAD/CHF (OTC)", 94, "CADCHF_otc"],
    ],
  });
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(600);
    page.fall("EURJPY_otc", 70);
    assert.ok(await until(() => opened(page).length === 4, 12000), "all four pairs above the floor were opened: " + page.said().join(", "));
    assert.ok(await until(() => page.list() === "not on the page", 6000), "and the list was closed after them: " + page.list());
    assert.equal(page.said()[0], "closed EUR/JPY (OTC)", "the close came first");
    assert.deepEqual(
      opened(page),
      ["opened GBP/JPY (OTC)", "opened CAD/CHF (OTC)", "opened AUD/CAD (OTC)", "opened NZD/USD (OTC)"],
      "best first, and never the pair below the floor",
    );
    assert.equal(count(page, "+ opened the list"), 1, "in one visit to the list: " + page.said().join(", "));
    const took = at(page, "opened NZD/USD (OTC)") - at(page, "+ opened the list");
    assert.ok(took < 2500, "one after the other, not a pass apart: the four took " + took + " ms");
    // The diagnostics line is written every 2 s, so the log is waited for rather than read at once.
    const line = "auto-open picked GBP/JPY (OTC), CAD/CHF (OTC), AUD/CAD (OTC), NZD/USD (OTC)";
    assert.ok(await until(() => String(diag(qx).assetLog).includes(line), 5000), "the log has them on one line: " + diag(qx).assetLog);

    await sleep(7000); // more than one five-second pass
    assert.equal(count(page, "+ opened the list"), 1, "and the refill is over with the visit - the list is not brought up again");
    assert.equal(opened(page).length, 4);
  } finally {
    qx.close();
  }
});

test("payout floor: pairs the list is not showing are left out in the same visit, and do not bring it up again (v1.86.0)", async () => {
  // Litecoin and Solana are rated above the floor, but the list is showing another category - as read live.
  // 1.85.0 came back for each of them in turn: one more opening of the list per pair, each finding nothing.
  const page = floorPage({
    list: [
      ["EUR/USD (OTC)", 70, "EURUSD_otc"],
      ["GBP/JPY (OTC)", 95, "GBPJPY_otc"],
    ],
    unlisted: [
      ["Litecoin (OTC)", 93, "LTCUSD_otc"],
      ["Solana (OTC)", 92, "SOLUSD_otc"],
    ],
  });
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(600);
    page.fall("EURJPY_otc", 70);
    assert.ok(await until(() => page.tabs().includes("GBP/JPY (OTC)"), 12000), "the pair in the list was opened: " + page.said().join(", "));
    assert.ok(await until(() => page.list() === "not on the page", 6000), "and the list closed");
    const line = "Litecoin (OTC), Solana (OTC) are not in the list shown - left out for 10 min";
    assert.ok(await until(() => String(diag(qx).assetLog).includes(line), 5000), "both are left out at once: " + diag(qx).assetLog);

    await sleep(12000); // two more passes
    assert.equal(count(page, "+ opened the list"), 1, "the list is not brought up again for them: " + page.said().join(", "));

    // A second close, with nothing in the list left to open: the list stays shut.
    page.fall("GBPJPY_otc", 70);
    assert.ok(await until(() => page.said().includes("closed GBP/JPY (OTC)"), 12000), "the pair that fell was closed");
    await sleep(7000);
    assert.equal(count(page, "+ opened the list"), 1, "with nothing to open, the list is not opened at all: " + page.said().join(", "));
    assert.match(String(diag(qx).autoOpen), /already open|opened one/, diag(qx).autoOpen);
  } finally {
    qx.close();
  }
});

// ── v1.88.0: the chart goes back to the pair it was on ───────────────────────────────────────────────────
// Reported on 2026-10-04: "the auto open switched the asset what currently I am - not good". Quotex puts the
// chart on a pair the moment it is picked from the list, so a refill left the chart on the last pair it opened.

test("payout floor: after a refill the chart is back on the pair it was on (v1.88.0)", async () => {
  const page = floorPage();
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(600);
    assert.equal(page.active(), "USD/DZD (OTC)", "the chart starts on the pair the page opened on");
    page.fall("EURJPY_otc", 70);
    assert.ok(await until(() => opened(page).length === 2, 12000), "both pairs above the floor were opened: " + page.said().join(", "));
    assert.ok(await until(() => page.list() === "not on the page", 6000), "and the list was closed: " + page.list());
    assert.equal(page.active(), "USD/DZD (OTC)", "the chart is back on the pair it was on: " + page.said().join(", "));
    const said = page.said();
    assert.ok(said.lastIndexOf("chart on USD/DZD (OTC)") > said.lastIndexOf("opened AUD/CAD (OTC)"), "it went back after the last pair was opened");
    assert.ok(said.lastIndexOf("chart on USD/DZD (OTC)") < said.lastIndexOf("list closed"), "and before the list was closed: " + said.join(", "));
    const line = "auto-open: back on USD/DZD (OTC)";
    assert.ok(await until(() => String(diag(qx).assetLog).includes(line), 5000), "the log says so: " + diag(qx).assetLog);
  } finally {
    qx.close();
  }
});

test("payout floor: a tab the user clicks while the refill is picking is theirs to keep (v1.88.0)", async () => {
  // NZD/USD (OTC) is open as well; the user clicks its tab as the first pair is picked. The chart is then on a
  // pair the refill did not pick, so it is not taken back to where it was.
  const page = floorPage({ userMovesOnPick: true });
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    await sleep(600);
    page.fall("EURJPY_otc", 70);
    assert.ok(await until(() => opened(page).length >= 1 && page.list() === "not on the page", 15000), "the refill ran: " + page.said().join(", "));
    await sleep(1500);
    assert.equal(page.active(), "NZD/USD (OTC)", "the chart stays where the user put it: " + page.said().join(", "));
  } finally {
    qx.close();
  }
});

test("payout floor: with every open pair below the floor, the chart stays on the pair that was opened (v1.54.0, unchanged in v1.88.0)", async () => {
  // No close stands behind this one, and the pair the chart was on cannot be traded: the pair that is opened is
  // where the chart is meant to go.
  const page = floorPage({ lastTabLow: true });
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup });
  try {
    assert.ok(await until(() => opened(page).length === 1, 20000), "the best pair above the floor was opened: " + page.said().join(", "));
    assert.ok(await until(() => page.list() === "not on the page", 6000), "and the list was closed");
    assert.equal(page.active(), "GBP/JPY (OTC)", "the chart is on it: " + page.said().join(", "));
  } finally {
    qx.close();
  }
});

test("payout floor: a refill does not send the charts of the pair you are on off to be filled again (v1.88.0)", async () => {
  // With the charts open, a change of the chart pair counts as opening it and queues a walk through its
  // timeframes. The refill takes the chart away and brings it back; that is the panel, not the user.
  const page = floorPage();
  page.store.__candles = makeCandles(200, 15);
  const qx = await boot({ html: page.html, store: page.store, setup: page.setup, storage: { ...bigTfStorage, __tradeCalc_mtf_settle: "8" } });
  try {
    const fill = () => String(healthRow(qx, "Charts auto-fill").value);
    assert.ok(await until(() => /filled this pair/.test(fill()), 45000), "the pair the page opened on was filled: " + fill());
    page.fall("EURJPY_otc", 70);
    assert.ok(await until(() => opened(page).length === 2 && page.list() === "not on the page", 15000), "the refill ran: " + page.said().join(", "));
    assert.equal(page.active(), "USD/DZD (OTC)", "and the chart is back on its pair");
    await sleep(1500);
    assert.match(fill(), /filled this pair/, "no walk is queued for it - it would read settling: " + fill());
  } finally {
    qx.close();
  }
});
