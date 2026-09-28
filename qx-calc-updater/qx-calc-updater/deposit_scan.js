/* =========================================================================
 * Deposit scanner - loaded by service_worker.js
 * Walks every page of the QX Broker balance transaction history and sums all
 * successful deposits, of any payment method, with a per-method breakdown
 * (v1.24.2; UPI/PhonePe only before). The table is client-rendered (a
 * fetch of ?page=N returns only the SPA shell), so we drive the user's tab
 * through each ?page=N, let it render, scrape the DOM via chrome.scripting,
 * then return the tab to where it started. 100% read-only.
 *
 * v1.69.0: moved here from the popup, which is going away. The scan is started from the panel's ⚙ menu
 * on the trade page; it walks the Balance pages in the same tab, comes back, and leaves its result in
 * chrome.storage.local for the menu to show. While it runs, each Balance page gets a small status pill
 * with a Stop button (content.js, DEPOSIT_SCAN_STATUS).
 * ========================================================================= */

const QX_MAX_PAGES = 100; // hard safety cap so a bug can't loop forever
const QX_PAGE_TIMEOUT_MS = 15000; // per-page navigation/load timeout
const QX_DEPOSIT_RESULT_KEY = "__qxDepositScan";
const QX_DEPOSIT_SHOW_KEY = "__qxDepositShow"; // tells the panel to open its menu on the result
const QX_RECENT_SHOWN = 12;

let qxScanning = false;
let qxScanCancel = false;

// Balance page in any site language and on subdomains (v1.24.0; was qxbroker.com/en/balance only).
const QX_BALANCE_URL_RE = /^(https?:\/\/(?:[a-z0-9-]+\.)?qxbroker\.com\/[a-z]{2}(?:-[a-z]{2,4})?\/balance)(?:\/|\?|$)/i;
const QX_SITE_RE = /^https?:\/\/(?:[a-z0-9-]+\.)?qxbroker\.com\//i;
const QX_LANG_RE = /^[a-z]{2}(?:-[a-z]{2,4})?$/i;

/** True when a URL points at the balance page (any language, ?page / #hash variant). */
function qxIsBalanceUrl(url) {
  if (typeof url !== "string") return false;
  return QX_BALANCE_URL_RE.test(url.split("#")[0]);
}

/** The balance page URL without query/hash, keeping the tab's language, e.g. https://qxbroker.com/hi/balance. */
function qxBalanceBase(url) {
  const m = String(url || "").split("#")[0].match(QX_BALANCE_URL_RE);
  return m ? m[1] : null;
}

/**
 * The balance page for any Quotex page, in the same language and on the same host: the trade page
 * https://qxbroker.com/hi/demo-trade gives https://qxbroker.com/hi/balance. English when the path has no
 * language. null for anything that is not Quotex.
 */
function qxBalanceUrlFor(url) {
  const raw = String(url || "");
  if (!QX_SITE_RE.test(raw)) return null;
  let u;
  try {
    u = new URL(raw);
  } catch (e) {
    return null;
  }
  const first = u.pathname.split("/")[1] || "";
  return u.origin + "/" + (QX_LANG_RE.test(first) ? first : "en") + "/balance";
}

/**
 * Parse one transaction string "+₹70,000.00" / "$58.31" / "-1,200" into a Number.
 * Strips currency symbols, commas, plus signs and spaces — keeps digits, a
 * single decimal point and a leading minus. Returns 0 on anything unparseable.
 */
function qxParseAmount(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Currency sign of an amount string ("₹70,000.00", "+$1,000.00", "USDT 25") or '' if none. */
function qxDetectSymbol(raw) {
  const m = String(raw || "").trim().replace(/^[+\-]/, "").match(/^[^\d\s.,+\-]+/);
  return m ? m[0].trim() : "";
}

/**
 * A row qualifies if it's a successful deposit, whatever the payment method (UPI, PhonePe, GPay,
 * Binance, cards, …). Store rows (v1.24.0) carry language-independent values: orderState "success",
 * isDeposit true. Page rows carry the English labels "Successed" / "Deposit".
 */
function qxMatchesDeposit(tx) {
  const status = (tx.status || "").trim().toLowerCase();
  const type = (tx.type || "").trim().toLowerCase();
  const ok = status === "success" || status === "successed";
  const deposit = tx.isDeposit === true || type === "deposit";
  return ok && deposit;
}

/** Grouping key for a payment method: case and spaces ignored, so "Phone Pe" and "PhonePe" group together. */
function qxMethodKey(payment) {
  return String(payment || "").trim().toLowerCase().replace(/\s+/g, "") || "other";
}

/**
 * Per-method totals: [{ method, symbol, count, total }], grouped by method AND currency, because deposits
 * come in different currencies (live 2026-09-15: UPI/PhonePe/GPay in ₹, Binance Pay in $). Largest count
 * first. The label is the first spelling seen.
 */
function qxBreakdownByMethod(matched) {
  const groups = new Map();
  for (const tx of matched) {
    const symbol = qxDetectSymbol(tx.amountRaw);
    const key = qxMethodKey(tx.payment) + "|" + symbol;
    const g = groups.get(key) || { method: String(tx.payment || "").trim() || "Other", symbol, count: 0, total: 0 };
    g.count += 1;
    g.total += qxParseAmount(tx.amountRaw);
    groups.set(key, g);
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count || b.total - a.total || a.method.localeCompare(b.method));
}

/** Totals per currency, most deposits first: [{ symbol, count, total }]. Currencies are never added together. */
function qxTotalsByCurrency(matched) {
  const groups = new Map();
  for (const tx of matched) {
    const symbol = qxDetectSymbol(tx.amountRaw);
    const g = groups.get(symbol) || { symbol, count: 0, total: 0 };
    g.count += 1;
    g.total += qxParseAmount(tx.amountRaw);
    groups.set(symbol, g);
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count || b.total - a.total);
}

/**
 * What the panel's menu shows: plain JSON, so it can sit in chrome.storage.local. One total per currency
 * (v1.24.3: v1.24.2 added $ Binance deposits into the ₹ total), the per-method breakdown, and the first
 * few deposits.
 */
function qxSummarise(matched, pagesScanned, cancelled, sources) {
  return {
    at: Date.now(),
    cancelled: !!cancelled,
    pages: pagesScanned,
    count: matched.length,
    sources: Array.from(sources || []),
    totals: qxTotalsByCurrency(matched),
    methods: qxBreakdownByMethod(matched),
    recent: matched.slice(0, QX_RECENT_SHOWN).map((tx) => ({
      id: String(tx.id),
      payment: String(tx.payment || "").trim(),
      symbol: qxDetectSymbol(tx.amountRaw),
      amount: qxParseAmount(tx.amountRaw),
    })),
  };
}

/**
 * INJECTED into the balance tab (runs in the page's MAIN world since v1.24.0). Reads
 * the page's transactions from Quotex's store when it holds `expectedPage`; otherwise
 * waits for the client-rendered rows and parses each `.vDMA1` row. Self-contained:
 * cannot reference anything outside itself.
 * Returns { ok, rows:[{id,status,type,isDeposit?,payment,amountRaw}], count, source }.
 *
 * Page fallback selector strategy — primary = the page's column classes;
 * fallback = column position within the row (0 id, 1 date, 2 status, 3 type,
 * 4 payment, 5 amount). The row container also has the semantic `.transactions-list`
 * parent, used as a fallback row selector if the hashed `.vDMA1` ever rotates.
 */
async function qxScrapeBalancePage(expectedPage) {
  const ROW_SEL = ".vDMA1";
  const txt = (el) => (el && el.textContent ? el.textContent.trim() : "");

  // v1.24.0: first choice is Quotex's own Redux store (runs in the page's MAIN world). Its transaction
  // fields are language-independent (orderState "success", is_deposit, method), unlike the page text.
  // Read-only: the store is found through the React root and only getState() is called.
  function findStore() {
    try {
      const root = document.getElementById("root");
      const key = root && Object.keys(root).find((k) => k.indexOf("__reactContainer$") === 0);
      const queue = key ? [root[key]] : [];
      for (let visited = 0; queue.length && visited < 5000; visited++) {
        const fiber = queue.shift();
        const props = fiber && fiber.memoizedProps;
        if (props && props.store && typeof props.store.getState === "function") return props.store;
        if (fiber && fiber.child) queue.push(fiber.child);
        if (fiber && fiber.sibling) queue.push(fiber.sibling);
      }
    } catch (e) {}
    return null;
  }
  // Right after load the store holds a placeholder {page: 1, pages: 1, list: [], transactionsStatus: "init"},
  // then "loading", then "loaded" (seen live 2026-09-15). Only a loaded list for the requested page counts;
  // accepting the placeholder made page 1 look empty and ended the scan at once (fixed in v1.24.1).
  let store = null;
  function storeRows() {
    store = store || findStore();
    const tx = store && store.getState().transactions;
    if (!tx || !Array.isArray(tx.list) || tx.transactionsStatus !== "loaded") return null;
    if (tx.pages > 0 && expectedPage > tx.pages) return { rows: [], pages: tx.pages }; // past the last page
    if (tx.page !== expectedPage) return null;
    return {
      pages: tx.pages,
      rows: tx.list.map((t) => ({
        id: t.id != null ? String(t.id) : "",
        status: String(t.orderState || ""),
        type: t.is_deposit ? "deposit" : String(t.type || ""),
        isDeposit: t.is_deposit === true,
        payment: String(t.method || ""),
        amountRaw: String(t.currencySign || "") + String(t.amount || ""),
      })),
    };
  }

  // Both the store and the rows arrive after an async data fetch; poll for either.
  const deadline = Date.now() + 13000;
  while (!storeRows() && !document.querySelector(ROW_SEL) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
  }
  // The rows render ~1 s before the store reports "loaded" (seen live); give it up to 2.5 s before
  // falling back to reading the page.
  for (let i = 0; i < 25 && !storeRows(); i++) await new Promise((r) => setTimeout(r, 100));
  const fromStore = storeRows();
  if (fromStore) {
    const rows = fromStore.rows.filter((r) => r.id);
    return { ok: true, rows, count: rows.length, pages: fromStore.pages, url: location.href, source: "store" };
  }

  function getRows() {
    let rows = Array.from(document.querySelectorAll(ROW_SEL));
    if (!rows.length) {
      // Semantic fallback: data rows inside the (non-hashed) list container that
      // actually have 6 cells — skips the header row.
      const list = document.querySelector(".transactions-list");
      if (list) rows = Array.from(list.children).filter((c) => c.children && c.children.length >= 6 && /\d/.test(c.textContent));
    }
    return rows;
  }

  function parseRow(row) {
    const kids = row.children;
    const amtCell = row.querySelector(".vKozV") || kids[5] || null;
    return {
      id: txt(row.querySelector(".VZvOf")) || txt(kids[0]),
      status: txt(row.querySelector(".VgSqu")) || txt(row.querySelector('[class*="status" i]')) || txt(kids[2]),
      type: txt(row.querySelector(".Ed7UM")) || txt(kids[3]),
      payment: txt(row.querySelector(".R1N82")) || txt(kids[4]),
      amountRaw: txt(row.querySelector(".vKozV b")) || txt(amtCell && amtCell.querySelector && amtCell.querySelector("b")) || txt(amtCell),
    };
  }

  const rows = getRows().map(parseRow).filter((r) => r.id);
  return { ok: true, rows: rows, count: rows.length, url: location.href, source: "page" };
}

/** Navigate a tab to `url` and resolve once it reports status 'complete'. */
function qxNavigate(tabId, url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Page load timed out")), QX_PAGE_TIMEOUT_MS);
    function finish(err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      err ? reject(err) : resolve();
    }
    function onUpdated(id, info) {
      if (id === tabId && info.status === "complete") finish();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.update(tabId, { url }).catch((e) => finish(e));
  });
}

async function qxScrapeTab(tabId, page) {
  // MAIN world so the scraper can reach Quotex's store (React internals aren't visible from the
  // isolated world). It only reads and returns plain JSON.
  const results = await chrome.scripting.executeScript({ target: { tabId }, func: qxScrapeBalancePage, args: [page], world: "MAIN" });
  return results && results[0] && results[0].result;
}

/** The status pill on the Balance page (content.js). A page still loading just misses one update. */
function qxTellTab(tabId, page) {
  try {
    const r = chrome.tabs.sendMessage(tabId, { type: "DEPOSIT_SCAN_STATUS", page });
    if (r && typeof r.catch === "function") r.catch(() => {});
  } catch (e) {}
}

/** The Stop button on the pill: the walk ends after the page it is on, and the tab still comes back. */
function qxStopDepositScan() {
  qxScanCancel = true;
}

/** Runs the whole scan for the tab that asked, then brings that tab back to the page it was on. */
async function qxRunDepositScan(tab) {
  if (qxScanning || !tab || tab.id == null) return;
  const balanceBase = qxBalanceUrlFor(tab.url);
  if (!balanceBase) return;

  qxScanning = true;
  qxScanCancel = false;
  const tabId = tab.id;
  const returnUrl = tab.url; // the trade page the scan was started from
  const seen = new Set(); // dedupe transactions by ID across pages
  const matched = [];
  const sources = new Set();
  let pagesScanned = 0;
  let result;

  try {
    for (let page = 1; page <= QX_MAX_PAGES; page++) {
      if (qxScanCancel) break;
      const url = page === 1 ? balanceBase : `${balanceBase}?page=${page}`;
      await qxNavigate(tabId, url);
      qxTellTab(tabId, page);
      if (qxScanCancel) break;

      const res = await qxScrapeTab(tabId, page);
      pagesScanned = page;
      if (!res || !res.ok) throw new Error(`Couldn't read page ${page}`);
      if (res.source) sources.add(res.source);
      if (!res.rows.length) break; // empty page → end of history

      let newRows = 0;
      for (const tx of res.rows) {
        // Store ids are numbers, page ids are text; compare digits so a mixed scan can't double count.
        const key = String(tx.id).replace(/\D/g, "") || String(tx.id);
        if (!tx.id || seen.has(key)) continue; // dedupe across pages
        seen.add(key);
        newRows++;
        if (qxMatchesDeposit(tx)) matched.push(tx);
      }
      if (newRows === 0) break; // no new IDs → last page clamped, stop
      if (res.pages > 0 && page >= res.pages) break; // store knows the page count: don't load an extra page
    }
    result = qxSummarise(matched, pagesScanned, qxScanCancel, sources);
  } catch (e) {
    result = { at: Date.now(), error: e && e.message ? e.message : String(e) };
  } finally {
    try {
      await chrome.storage.local.set({ [QX_DEPOSIT_RESULT_KEY]: result || null, [QX_DEPOSIT_SHOW_KEY]: true });
    } catch (_) {}
    // Always return the tab to where the user started.
    try {
      await qxNavigate(tabId, returnUrl);
    } catch (_) {}
    qxScanning = false;
  }
}
