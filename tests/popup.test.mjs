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

test("deposit scanner: every successful deposit counts, whatever the payment method (v1.24.2)", async () => {
  const w = await loadPopup();
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
  const w = await loadPopup();
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
  const w = await loadPopup();
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
    assert.equal(w.qxFormatMoney(609030, "₹"), "₹6,09,030.00");
    w.qxRenderResults(rows, 10, false, new Set(["store"]));
    const text = w.document.getElementById("depositResult").textContent.replace(/\s+/g, " ");
    assert.match(text, /₹90,000\.00 \+ \$1,010\.00/);
    assert.match(text, /4 successful deposits · 10 pages scanned · read from Quotex data/);
    assert.match(text, /Binance Pay × 2 \$1,010\.00/);
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

// ── v1.65.2: the popup loads nothing from the network ──────────────────────────────────────────
// It fetched two typefaces from Google Fonts every time it opened, which was the last outbound request the
// extension made. Checked against the markup and the stylesheet rather than a running browser, because a
// request that is never written into the file cannot be made.
function externalRefs(html) {
  const refs = [];
  for (const m of html.matchAll(/<(link|script|img|iframe|source)\b[^>]*\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    if (/^(https?:)?\/\//i.test(m[2])) refs.push(m[1] + " " + m[2]);
  }
  for (const m of html.matchAll(/@import\s+(?:url\()?["']?([^"')\s;]+)/gi)) {
    if (/^(https?:)?\/\//i.test(m[1])) refs.push("@import " + m[1]);
  }
  for (const m of html.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi)) refs.push("url() " + m[1]);
  return refs;
}

test("popup: nothing in its markup or stylesheet is loaded from another origin (v1.65.2)", () => {
  const html = fs.readFileSync(new URL("popup.html", EXT), "utf8");
  assert.deepEqual(externalRefs(html), [], "external references in popup.html");
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/, "no Google Fonts");
});

test("popup: the fonts come from the system, through two variables (v1.65.2)", () => {
  const html = fs.readFileSync(new URL("popup.html", EXT), "utf8");
  assert.match(html, /--font-sans:\s*system-ui/, "a system sans stack is defined");
  assert.match(html, /--font-mono:\s*ui-monospace/, "a system mono stack is defined");
  // Every font-family points at one of the two, so no hardcoded webfont name can come back one rule at a time.
  const families = [...html.matchAll(/font-family:\s*([^;"]+)[;"]/g)].map((m) => m[1].trim());
  const stray = families.filter((f) => !/^var\(--font-(sans|mono)\)$/.test(f));
  assert.deepEqual(stray, [], "font-family declarations that do not use the variables");
  assert.doesNotMatch(POPUP_JS, /DM Sans|DM Mono/, "and popup.js names neither of the old typefaces");
});
