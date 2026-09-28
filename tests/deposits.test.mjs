// The deposit scanner (deposit_scan.js, loaded by the service worker since v1.69.0 - it was in the popup).
// Run in jsdom with a mocked chrome API: the helpers, the MAIN-world page reader, and the whole walk.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const EXT = new URL("../qx-calc-updater/qx-calc-updater/", import.meta.url);
const SCANNER_JS = fs.readFileSync(new URL("deposit_scan.js", EXT), "utf8");

// A tab that "loads" each URL it is sent to, a scripting stub answering per page, and storage.
async function loadScanner({ pages = {} } = {}) {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "https://qxbroker.com/en/balance", runScripts: "outside-only" });
  const { window } = dom;
  const updated = new Set();
  const log = { visited: [], told: [], stored: {} };
  window.chrome = {
    tabs: {
      onUpdated: { addListener: (f) => updated.add(f), removeListener: (f) => updated.delete(f) },
      update: async (tabId, { url }) => {
        log.visited.push(url);
        setTimeout(() => updated.forEach((f) => f(tabId, { status: "complete" })), 5);
      },
      sendMessage: async (tabId, msg) => log.told.push(msg),
    },
    scripting: {
      executeScript: async ({ args: [page] }) => [{ result: pages[page] || { ok: true, rows: [], source: "store" } }],
    },
    storage: { local: { set: async (obj) => Object.assign(log.stored, obj) } },
  };
  window.eval(SCANNER_JS);
  window.log = log;
  return window;
}

test("deposit scanner: balance page is recognized in any site language and on subdomains", async () => {
  const w = await loadScanner();
  try {
    assert.equal(w.qxIsBalanceUrl("https://qxbroker.com/en/balance"), true);
    assert.equal(w.qxIsBalanceUrl("https://qxbroker.com/hi/balance?page=3#x"), true);
    assert.equal(w.qxIsBalanceUrl("https://qxbroker.com/pt-br/balance"), true);
    assert.equal(w.qxIsBalanceUrl("https://market.qxbroker.com/es/balance"), true);
    assert.equal(w.qxIsBalanceUrl("https://qxbroker.com/en/trade"), false);
    assert.equal(w.qxIsBalanceUrl("https://evil.example/qxbroker.com/en/balance"), false);
    assert.equal(w.qxBalanceBase("https://qxbroker.com/hi/balance?page=3#x"), "https://qxbroker.com/hi/balance");
  } finally {
    w.close();
  }
});

test("deposit scanner: every successful deposit counts, whatever the payment method (v1.24.2)", async () => {
  const w = await loadScanner();
  try {
    // Store row shape (orderState / isDeposit / method), as read live on 2026-09-15.
    for (const payment of ["UPI", "PhonePe", "GPay", "Binance", "Visa", ""]) {
      assert.equal(w.qxMatchesDeposit({ status: "success", type: "deposit", isDeposit: true, payment }), true, payment || "no method");
    }
    assert.equal(w.qxMatchesDeposit({ status: "close", type: "deposit", isDeposit: true, payment: "GPay" }), false, "failed");
    // Page row shape (English labels).
    assert.equal(w.qxMatchesDeposit({ status: "Successed", type: "Deposit", payment: "Phone Pe" }), true);
    assert.equal(w.qxMatchesDeposit({ status: "Failed", type: "Deposit", payment: "Binance" }), false);
    assert.equal(w.qxMatchesDeposit({ status: "Successed", type: "Withdrawal", payment: "UPI" }), false, "withdrawal");
  } finally {
    w.close();
  }
});

test("deposit scanner: per-method breakdown groups spellings, keeps currencies apart, sorts by count", async () => {
  const w = await loadScanner();
  try {
    const rows = [
      { payment: "UPI", amountRaw: "₹1000.00" },
      { payment: "GPay", amountRaw: "₹5000.00" },
      { payment: "Phone Pe", amountRaw: "₹300.00" },
      { payment: "PhonePe", amountRaw: "₹200.00" },
      { payment: "upi", amountRaw: "₹500.00" },
      { payment: "Binance Pay", amountRaw: "$1000.00" },
      { payment: "", amountRaw: "₹50.00" },
    ];
    assert.deepEqual(JSON.parse(JSON.stringify(w.qxBreakdownByMethod(rows))), [
      { method: "UPI", symbol: "₹", count: 2, total: 1500 },
      { method: "Phone Pe", symbol: "₹", count: 2, total: 500 },
      { method: "GPay", symbol: "₹", count: 1, total: 5000 },
      { method: "Binance Pay", symbol: "$", count: 1, total: 1000 },
      { method: "Other", symbol: "₹", count: 1, total: 50 },
    ]);
  } finally {
    w.close();
  }
});

test("deposit scanner: ₹ and $ deposits get separate totals, never added together (v1.24.3)", async () => {
  const w = await loadScanner();
  try {
    // Live 2026-09-15: UPI in ₹, Binance Pay in $ (store currencySign).
    const rows = [
      { id: "1", payment: "UPI", amountRaw: "₹50000.00" },
      { id: "2", payment: "Binance Pay", amountRaw: "$1000.00" },
      { id: "3", payment: "UPI", amountRaw: "₹40000.00" },
      { id: "4", payment: "Binance Pay", amountRaw: "$10.00" },
    ];
    assert.deepEqual(JSON.parse(JSON.stringify(w.qxTotalsByCurrency(rows))), [
      { symbol: "₹", count: 2, total: 90000 },
      { symbol: "$", count: 2, total: 1010 },
    ]);
    assert.equal(w.qxDetectSymbol("+$1,000.00"), "$");
    assert.equal(w.qxDetectSymbol("USDT 25.00"), "USDT");
  } finally {
    w.close();
  }
});

function mountStore(w, getState) {
  const root = w.document.createElement("div");
  root.id = "root";
  w.document.body.appendChild(root);
  root["__reactContainer$test"] = { memoizedProps: null, child: { memoizedProps: { store: { getState } }, child: null, sibling: null }, sibling: null };
}

test("deposit scanner: the store's empty placeholder right after load isn't taken as an empty page (v1.24.1)", async () => {
  const w = await loadScanner();
  try {
    // Live sequence: placeholder {page 1, pages 1, [], "init"} → "loading" → "loaded" with the real list.
    const row = { id: 987654321, orderState: "success", is_deposit: true, method: "UPI", amount: "1000.00", currencySign: "₹" };
    let tx = { page: 1, pages: 1, list: [], transactionsStatus: "init" };
    mountStore(w, () => ({ transactions: tx }));
    setTimeout(() => (tx = { page: 1, pages: 10, list: [row], transactionsStatus: "loading" }), 300);
    setTimeout(() => (tx = { page: 1, pages: 10, list: [row], transactionsStatus: "loaded" }), 900);
    const res = await w.qxScrapeBalancePage(1);
    assert.equal(res.source, "store");
    assert.equal(res.count, 1);
    assert.equal(res.pages, 10);
  } finally {
    w.close();
  }
});

test("deposit scanner: a page past the store's page count ends the scan", async () => {
  const w = await loadScanner();
  try {
    mountStore(w, () => ({ transactions: { page: 10, pages: 10, list: [{ id: 1 }], transactionsStatus: "loaded" } }));
    const res = await w.qxScrapeBalancePage(11);
    assert.equal(res.source, "store");
    assert.equal(res.count, 0);
  } finally {
    w.close();
  }
});

test("deposit scanner: page scraper reads transactions from Quotex's store for the expected page", async () => {
  const w = await loadScanner();
  try {
    const root = w.document.createElement("div");
    root.id = "root";
    w.document.body.appendChild(root);
    const store = {
      getState: () => ({
        transactions: {
          page: 2,
          pages: 10,
          transactionsStatus: "loaded",
          list: [
            { id: 123456789, orderState: "success", is_deposit: true, method: "UPI", amount: "70000.00", currencySign: "₹" },
            { id: 123456788, orderState: "close", is_deposit: true, method: "GPay", amount: "500.00", currencySign: "₹" },
          ],
        },
      }),
    };
    root["__reactContainer$test"] = { memoizedProps: null, child: { memoizedProps: { store }, child: null, sibling: null }, sibling: null };
    const res = await w.qxScrapeBalancePage(2);
    assert.equal(res.source, "store");
    assert.equal(res.count, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(res.rows[0])), {
      id: "123456789",
      status: "success",
      type: "deposit",
      isDeposit: true,
      payment: "UPI",
      amountRaw: "₹70000.00",
    });
    assert.equal(w.qxMatchesDeposit(res.rows[0]), true);
    assert.equal(w.qxParseAmount(res.rows[0].amountRaw), 70000);
  } finally {
    w.close();
  }
});

test("deposit scanner: the Balance page is found from the trade page, keeping language and host (v1.69.0)", async () => {
  const w = await loadScanner();
  try {
    assert.equal(w.qxBalanceUrlFor("https://qxbroker.com/en/demo-trade"), "https://qxbroker.com/en/balance");
    assert.equal(w.qxBalanceUrlFor("https://qxbroker.com/hi/trade?x=1#y"), "https://qxbroker.com/hi/balance");
    assert.equal(w.qxBalanceUrlFor("https://qxbroker.com/pt-br/trade"), "https://qxbroker.com/pt-br/balance");
    assert.equal(w.qxBalanceUrlFor("https://market.qxbroker.com/es/trade"), "https://market.qxbroker.com/es/balance");
    assert.equal(w.qxBalanceUrlFor("https://qxbroker.com/trade"), "https://qxbroker.com/en/balance", "no language → English");
    assert.equal(w.qxBalanceUrlFor("https://evil.example/qxbroker.com/en/trade"), null, "not Quotex");
  } finally {
    w.close();
  }
});

const txRow = (id, amountRaw, payment = "UPI", ok = true, deposit = true) =>
  ({ id: String(id), status: ok ? "success" : "close", type: deposit ? "deposit" : "withdrawal", isDeposit: deposit, payment, amountRaw });

test("deposit scanner: it walks the pages from the trade page, reports each one, stores the result and comes back (v1.69.0)", async () => {
  const w = await loadScanner({
    pages: {
      1: { ok: true, pages: 2, source: "store", rows: [txRow(1, "₹50000.00"), txRow(2, "₹900.00", "UPI", true, false), txRow(3, "$1000.00", "Binance Pay")] },
      2: { ok: true, pages: 2, source: "store", rows: [txRow(4, "₹40000.00"), txRow(5, "₹10.00", "GPay", false)] },
    },
  });
  try {
    await w.qxRunDepositScan({ id: 7, url: "https://qxbroker.com/en/demo-trade" });
    assert.deepEqual([...w.log.visited], [
      "https://qxbroker.com/en/balance",
      "https://qxbroker.com/en/balance?page=2",
      "https://qxbroker.com/en/demo-trade",
    ], "two Balance pages, then back to the trade page");
    assert.deepEqual(w.log.told.map((m) => m.type + " " + m.page), ["DEPOSIT_SCAN_STATUS 1", "DEPOSIT_SCAN_STATUS 2"]);
    const res = w.log.stored.__qxDepositScan;
    assert.equal(w.log.stored.__qxDepositShow, true, "the panel is told to open its menu on the result");
    assert.equal(res.count, 3, "three successful deposits - not the withdrawal, not the failed one");
    assert.equal(res.pages, 2);
    assert.equal(res.cancelled, false);
    assert.deepEqual(JSON.parse(JSON.stringify(res.totals)), [
      { symbol: "₹", count: 2, total: 90000 },
      { symbol: "$", count: 1, total: 1000 },
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(res.recent[0])), { id: "1", payment: "UPI", symbol: "₹", amount: 50000 });
  } finally {
    w.close();
  }
});

test("deposit scanner: Stop ends it early, keeps what was read, and still comes back (v1.69.0)", async () => {
  const w = await loadScanner({
    pages: {
      1: { ok: true, pages: 5, source: "store", rows: [txRow(1, "₹100.00")] },
      2: { ok: true, pages: 5, source: "store", rows: [txRow(2, "₹200.00")] },
    },
  });
  try {
    // What the pill's Stop button does, arriving while page 2 is on screen.
    w.chrome.tabs.sendMessage = async (tabId, msg) => {
      w.log.told.push(msg);
      if (msg.page === 2) w.qxStopDepositScan();
    };
    await w.qxRunDepositScan({ id: 7, url: "https://qxbroker.com/en/trade" });
    const res = w.log.stored.__qxDepositScan;
    assert.equal(res.cancelled, true);
    assert.equal(res.count, 1, "page 1 was kept");
    assert.equal(w.log.visited.at(-1), "https://qxbroker.com/en/trade", "back where it started");
  } finally {
    w.close();
  }
});

test("deposit scanner: a page that cannot be read is reported, and the tab still comes back (v1.69.0)", async () => {
  const w = await loadScanner({ pages: { 1: { ok: false } } });
  try {
    await w.qxRunDepositScan({ id: 7, url: "https://qxbroker.com/en/trade" });
    assert.match(w.log.stored.__qxDepositScan.error, /page 1/);
    assert.equal(w.log.visited.at(-1), "https://qxbroker.com/en/trade");
  } finally {
    w.close();
  }
});
