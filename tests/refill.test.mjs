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
import { sleep, boot, pref, floorPage, until } from "./helpers.mjs";

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
