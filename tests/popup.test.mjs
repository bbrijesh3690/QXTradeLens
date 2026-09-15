// Tests for the popup's deposit scanner helpers (popup.js), run in jsdom with a mocked chrome API.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const EXT = new URL("../qx-calc-updater/qx-calc-updater/", import.meta.url);
const POPUP_HTML = fs.readFileSync(new URL("popup.html", EXT), "utf8").replace(/<script[^>]*src="popup\.js"[^>]*><\/script>/, "");
const POPUP_JS = fs.readFileSync(new URL("popup.js", EXT), "utf8");

async function loadPopup() {
  const dom = new JSDOM(POPUP_HTML, { url: "chrome-extension://test/popup.html", runScripts: "outside-only" });
  const { window } = dom;
  window.chrome = {
    storage: { sync: { get: async () => ({}), set: async () => {} } },
    tabs: { query: async () => [], sendMessage: async () => undefined, onUpdated: { addListener() {}, removeListener() {} } },
    scripting: { executeScript: async () => [] },
  };
  window.eval(POPUP_JS);
  await new Promise((r) => setTimeout(r, 50)); // let the popup's async init() finish before closing
  return window;
}

test("deposit scanner: balance page is recognized in any site language and on subdomains", async () => {
  const w = await loadPopup();
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

test("deposit scanner: store rows (language-independent) and page rows both match the same deposits", async () => {
  const w = await loadPopup();
  try {
    // Store row shape (orderState / isDeposit / method), as read live on 2026-09-15.
    assert.equal(w.qxMatchesDeposit({ status: "success", type: "deposit", isDeposit: true, payment: "UPI" }), true);
    assert.equal(w.qxMatchesDeposit({ status: "success", type: "deposit", isDeposit: true, payment: "PhonePe" }), true);
    assert.equal(w.qxMatchesDeposit({ status: "close", type: "deposit", isDeposit: true, payment: "UPI" }), false, "failed");
    assert.equal(w.qxMatchesDeposit({ status: "success", type: "deposit", isDeposit: true, payment: "GPay" }), false, "GPay isn't counted");
    // Page row shape (English labels), unchanged.
    assert.equal(w.qxMatchesDeposit({ status: "Successed", type: "Deposit", payment: "Phone Pe" }), true);
    assert.equal(w.qxMatchesDeposit({ status: "Successed", type: "Withdrawal", payment: "UPI" }), false);
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
  const w = await loadPopup();
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
  const w = await loadPopup();
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
  const w = await loadPopup();
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
