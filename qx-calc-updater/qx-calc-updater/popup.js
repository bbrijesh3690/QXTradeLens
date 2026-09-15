const panelToggleBtn = document.getElementById('panelToggleBtn');
const themeToggle = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const sizeSlider = document.getElementById('sizeSlider');
const sizeVal = document.getElementById('sizeVal');
const journalSizeSlider = document.getElementById('journalSizeSlider');
const journalSizeVal = document.getElementById('journalSizeVal');
const visCheckboxes = document.querySelectorAll('.toggles-container input[type="checkbox"][data-idx]');
const saveVisibilityBtn = document.getElementById('saveVisibility');
const sheetUrlInput = document.getElementById('sheetUrlInput');
const sheetSave = document.getElementById('sheetSave');
const sheetClear = document.getElementById('sheetClear');
const sheetStatus = document.getElementById('sheetStatus');
const logToggleRow = document.getElementById('logToggleRow');
const slEnabledToggle = document.getElementById('slEnabledToggle');
const postTpGapInput = document.getElementById('postTpGapInput');
const sysLockDisableToggle = document.getElementById('sysLockDisableToggle');
const hkUpDownToggle = document.getElementById('hkUpDownToggle');
const hkLeftRightToggle = document.getElementById('hkLeftRightToggle');
const marqueeInput = document.getElementById('marqueeInput');
const marqueeSave = document.getElementById('marqueeSave');
const marqueeClear = document.getElementById('marqueeClear');
const marqueeSpeedSlider = document.getElementById('marqueeSpeedSlider');
const marqueeSpeedVal = document.getElementById('marqueeSpeedVal');
const mtfTfsInput = document.getElementById('mtfTfsInput');
const mtfTfsSave = document.getElementById('mtfTfsSave');
const mtfStatus = document.getElementById('mtfStatus');
const mtfCountSlider = document.getElementById('mtfCountSlider');
const mtfCountVal = document.getElementById('mtfCountVal');
const chipPosSelect = document.getElementById('chipPosSelect');
const maxTradesSelect = document.getElementById('maxTradesSelect');

let currentTheme = 'dark';
let currentVisibility = [1, 1, 1, 1];

function marqueeStatusEl() { return document.getElementById('marqueeStatus'); }
function updateMarqueeStatus(msg) {
  const has = msg && msg.trim().length > 0;
  if (!marqueeStatusEl()) return;
  marqueeStatusEl().textContent = has ? 'On' : 'Off';
  marqueeStatusEl().className = 'chip ' + (has ? 'set' : 'unset');
}
function updateSheetStatus(url) {
  const has = url && url.trim().length > 0;
  sheetStatus.textContent = has ? 'Set' : 'Not set';
  sheetStatus.className = 'chip ' + (has ? 'set' : 'unset');
  // The Log section's visibility follows the URL (no manual toggle) — keep idx 3 of the
  // visibility array in sync so "Save Sections" never fights the URL-driven activation.
  currentVisibility[3] = has ? 1 : 0;
}

async function init() {
  // Load sheet URL and SL toggle from storage directly — doesn't need an active tab
  const stored = await chrome.storage.sync.get(['sheetUrl', '__tradeCalc_sl_enabled', '__tradeCalc_sl_post_tp_gap', '__tradeCalc_sys_lock_disabled', '__tradeCalc_chip_pos', '__tradeCalc_max_trades', '__tradeCalc_max_two', 'sectionVisibility', '__tradeCalc_hk_updown', '__tradeCalc_hk_leftright', '__tradeCalc_marquee_msg', '__tradeCalc_marquee_speed', '__tradeCalc_mtf_tfs', '__tradeCalc_mtf_count']);
  const savedUrl = stored.sheetUrl || '';
  sheetUrlInput.value = savedUrl;
  updateSheetStatus(savedUrl);
  if (slEnabledToggle) {
    slEnabledToggle.checked = stored['__tradeCalc_sl_enabled'] !== false;
  }
  if (postTpGapInput) {
    const pg = parseFloat(stored['__tradeCalc_sl_post_tp_gap']);
    postTpGapInput.value = (!isNaN(pg) && pg > 0) ? Math.min(15, Math.max(1, pg)) : 5;
  }
  if (sysLockDisableToggle) {
    // Sticky, default ON (system lock disabled) — unset storage must read as checked.
    sysLockDisableToggle.checked = stored['__tradeCalc_sys_lock_disabled'] !== false;
  }
  if (chipPosSelect) { const cp = stored['__tradeCalc_chip_pos']; chipPosSelect.value = (cp === 'center' || cp === 'anchored') ? cp : 'cursor'; }
  if (maxTradesSelect) {
    // Prefer the new int key; migrate the legacy boolean (max_two===false → 4, else 2); default 2.
    let mt = stored['__tradeCalc_max_trades'];
    if (mt == null) mt = stored['__tradeCalc_max_two'] === false ? 4 : 2;
    mt = Math.max(1, Math.min(4, parseInt(mt, 10) || 2));
    maxTradesSelect.value = String(mt);
  }
  if (hkUpDownToggle) hkUpDownToggle.checked = stored['__tradeCalc_hk_updown'] === true;
  if (hkLeftRightToggle) hkLeftRightToggle.checked = stored['__tradeCalc_hk_leftright'] === true;
  if (marqueeInput) { const m = stored['__tradeCalc_marquee_msg'] || ''; marqueeInput.value = m; updateMarqueeStatus(m); }
  if (marqueeSpeedSlider) { let s = parseInt(stored['__tradeCalc_marquee_speed'], 10); if (isNaN(s)) s = 5; marqueeSpeedSlider.value = s; if (marqueeSpeedVal) marqueeSpeedVal.textContent = s; }
  {
    const tfs = parseTfListPopup(stored['__tradeCalc_mtf_tfs']);
    if (mtfTfsInput) mtfTfsInput.value = tfs.join(', ');
    updateMtfStatus(tfs);
    let c = parseInt(stored['__tradeCalc_mtf_count'], 10);
    if (isNaN(c)) c = 40;
    c = Math.min(120, Math.max(10, c));
    if (mtfCountSlider) mtfCountSlider.value = c;
    if (mtfCountVal) mtfCountVal.textContent = c;
  }
  if (stored.sectionVisibility && Array.isArray(stored.sectionVisibility)) {
    updateUI(undefined, undefined, stored.sectionVisibility, undefined);
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    const state = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
    if (state) {
      updateUI(state.theme, state.fontSize, state.visibility, state.journalFontSize);
      if (state.sheetUrl !== undefined) {
        sheetUrlInput.value = state.sheetUrl;
        updateSheetStatus(state.sheetUrl);
      }
      if (state.chipPos !== undefined && chipPosSelect) chipPosSelect.value = state.chipPos;
      if (state.maxTrades !== undefined && maxTradesSelect) maxTradesSelect.value = String(Math.max(1, Math.min(4, parseInt(state.maxTrades, 10) || 2)));
      if (state.hkUpDown !== undefined && hkUpDownToggle) hkUpDownToggle.checked = state.hkUpDown === true;
      if (state.hkLeftRight !== undefined && hkLeftRightToggle) hkLeftRightToggle.checked = state.hkLeftRight === true;
      if (state.marquee !== undefined && marqueeInput) { marqueeInput.value = state.marquee; updateMarqueeStatus(state.marquee); }
      if (state.marqueeSpeed !== undefined && marqueeSpeedSlider) { marqueeSpeedSlider.value = state.marqueeSpeed; if (marqueeSpeedVal) marqueeSpeedVal.textContent = state.marqueeSpeed; }
      if (state.mtfTfs !== undefined) { const t = parseTfListPopup(state.mtfTfs); if (mtfTfsInput) mtfTfsInput.value = t.join(', '); updateMtfStatus(t); }
      if (state.mtfCount !== undefined) { if (mtfCountSlider) mtfCountSlider.value = state.mtfCount; if (mtfCountVal) mtfCountVal.textContent = state.mtfCount; }
    }
  } catch (e) {
    console.log('Could not get state from content script', e);
  }
}

function updateUI(theme, fontSize, visibility, journalFontSize) {
  if (theme !== undefined) currentTheme = theme;
  if (theme !== undefined) {
    if (theme === 'light') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }

  if (fontSize) {
    sizeSlider.value = fontSize;
    sizeVal.textContent = fontSize + 'px';
  }

  if (journalFontSize) {
    journalSizeSlider.value = journalFontSize;
    journalSizeVal.textContent = journalFontSize + 'px';
  }

  if (visibility && Array.isArray(visibility)) {
    currentVisibility = visibility;
    visCheckboxes.forEach(cb => {
      const idx = parseInt(cb.dataset.idx, 10);
      cb.checked = !!currentVisibility[idx];
    });
  }
}

async function sendMessage(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  }
}

async function broadcastMessage(msg) {
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, msg).catch(() => {}));
}

if (panelToggleBtn) {
  panelToggleBtn.addEventListener('click', () => sendMessage({ type: 'TOGGLE_PANEL' }));
}

function saveSheetUrl(url) {
  const trimmed = url.trim();
  chrome.storage.sync.set({ sheetUrl: trimmed });
  sendMessage({ type: 'SET_SHEET_URL', url: trimmed });
  updateSheetStatus(trimmed);
}

themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  updateUI(currentTheme);
  sendMessage({ type: 'SET_THEME', theme: currentTheme });
});

sizeSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  sizeVal.textContent = val + 'px';
  sendMessage({ type: 'SET_SIZE', size: parseInt(val, 10) });
});

journalSizeSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  journalSizeVal.textContent = val + 'px';
  sendMessage({ type: 'SET_JOURNAL_SIZE', size: parseInt(val, 10) });
});

visCheckboxes.forEach(cb => {
  cb.addEventListener('change', (e) => {
    const idx = parseInt(e.target.dataset.idx, 10);
    currentVisibility[idx] = e.target.checked ? 1 : 0;
    if (saveVisibilityBtn) {
      saveVisibilityBtn.textContent = 'Save Sections';
      saveVisibilityBtn.style.color = '';
      saveVisibilityBtn.style.borderColor = '';
    }
  });
});

if (saveVisibilityBtn) {
  saveVisibilityBtn.addEventListener('click', async () => {
    await chrome.storage.sync.set({ sectionVisibility: currentVisibility });
    broadcastMessage({ type: 'SET_VISIBILITY', visibility: currentVisibility });
    saveVisibilityBtn.textContent = 'Saved ✓';
    saveVisibilityBtn.style.color = 'oklch(76% 0.16 145)';
    saveVisibilityBtn.style.borderColor = 'oklch(76% 0.16 145 / 0.35)';
    setTimeout(() => {
      saveVisibilityBtn.textContent = 'Save Sections';
      saveVisibilityBtn.style.color = '';
      saveVisibilityBtn.style.borderColor = '';
    }, 1500);
  });
}

if (slEnabledToggle) {
  slEnabledToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ '__tradeCalc_sl_enabled': slEnabledToggle.checked });
  });
}

if (hkUpDownToggle) {
  hkUpDownToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ '__tradeCalc_hk_updown': hkUpDownToggle.checked });
    broadcastMessage({ type: 'SET_HOTKEYS', upDown: hkUpDownToggle.checked });
  });
}
if (hkLeftRightToggle) {
  hkLeftRightToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ '__tradeCalc_hk_leftright': hkLeftRightToggle.checked });
    broadcastMessage({ type: 'SET_HOTKEYS', leftRight: hkLeftRightToggle.checked });
  });
}
function saveMarqueeMsg(msg) {
  const m = (msg || '').trim();
  chrome.storage.sync.set({ '__tradeCalc_marquee_msg': m });
  broadcastMessage({ type: 'SET_MARQUEE', message: m });
  updateMarqueeStatus(m);
}
if (marqueeSave) marqueeSave.addEventListener('click', () => saveMarqueeMsg(marqueeInput.value));
if (marqueeInput) marqueeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveMarqueeMsg(marqueeInput.value); });
if (marqueeClear) marqueeClear.addEventListener('click', () => { marqueeInput.value = ''; saveMarqueeMsg(''); });
if (marqueeSpeedSlider) {
  marqueeSpeedSlider.addEventListener('input', (e) => {
    const s = parseInt(e.target.value, 10);
    if (marqueeSpeedVal) marqueeSpeedVal.textContent = s;
    chrome.storage.sync.set({ '__tradeCalc_marquee_speed': s });
    broadcastMessage({ type: 'SET_MARQUEE', speed: s });
  });
}

// ── Multi-timeframe charts ────────────────────────────────────────────────────
// Mirrors parseTfList in part 01 (the panel re-validates whatever arrives, so this clamp is for the
// popup's own display; the panel's is the real enforcement). Unknown labels are dropped rather than
// rejected, and an empty result falls back to the default instead of blanking the panel.
const MTF_TF_SECONDS = { '5s': 5, '10s': 10, '15s': 15, '30s': 30, '1m': 60, '2m': 120, '3m': 180, '5m': 300, '10m': 600, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400 };
const MTF_TFS_DEFAULT = ['1m', '5m', '15m'];
function parseTfListPopup(v) {
  let arr = v;
  if (typeof arr === 'string') arr = arr.split(',');
  if (!Array.isArray(arr)) return MTF_TFS_DEFAULT.slice();
  const seen = {}, out = [];
  for (const raw of arr) {
    const label = String(raw || '').trim().toLowerCase();
    if (!MTF_TF_SECONDS[label] || seen[label]) continue;
    seen[label] = 1; out.push(label);
  }
  out.sort((a, b) => MTF_TF_SECONDS[a] - MTF_TF_SECONDS[b]);
  return out.length ? out.slice(0, 4) : MTF_TFS_DEFAULT.slice();
}
function updateMtfStatus(tfs) {
  if (!mtfStatus) return;
  mtfStatus.textContent = tfs.join(', ');
  mtfStatus.classList.remove('unset');
}
function saveMtfTfs(raw) {
  const tfs = parseTfListPopup(raw);
  if (mtfTfsInput) mtfTfsInput.value = tfs.join(', ');
  chrome.storage.sync.set({ '__tradeCalc_mtf_tfs': tfs });
  broadcastMessage({ type: 'SET_MTF', tfs });
  updateMtfStatus(tfs);
}
if (mtfTfsSave) mtfTfsSave.addEventListener('click', () => saveMtfTfs(mtfTfsInput.value));
if (mtfTfsInput) mtfTfsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveMtfTfs(mtfTfsInput.value); });
if (mtfCountSlider) {
  mtfCountSlider.addEventListener('input', (e) => {
    const n = Math.min(120, Math.max(10, parseInt(e.target.value, 10) || 40));
    if (mtfCountVal) mtfCountVal.textContent = n;
    chrome.storage.sync.set({ '__tradeCalc_mtf_count': n });
    broadcastMessage({ type: 'SET_MTF', count: n });
  });
}

if (postTpGapInput) {
  const savePostTpGap = () => {
    let n = parseFloat(postTpGapInput.value);
    if (isNaN(n)) n = 5;
    n = Math.min(15, Math.max(1, n)); // hard cap — unbreakable, mirrors clampPostTpGapPct (part 01)
    postTpGapInput.value = n;
    chrome.storage.sync.set({ '__tradeCalc_sl_post_tp_gap': n });
    broadcastMessage({ type: 'SET_POST_TP_GAP', value: n });
  };
  postTpGapInput.addEventListener('change', savePostTpGap);
}

if (sysLockDisableToggle) {
  sysLockDisableToggle.addEventListener('change', () => {
    const disabled = sysLockDisableToggle.checked;
    chrome.storage.sync.set({ '__tradeCalc_sys_lock_disabled': disabled });
    broadcastMessage({ type: 'SET_SYS_LOCK_DISABLED', disabled });
  });
}

if (chipPosSelect) {
  chipPosSelect.addEventListener('change', () => {
    const mode = chipPosSelect.value;
    // Popup owns the sync write; broadcast SET_CHIP_POS so open tabs apply it live (no reload).
    chrome.storage.sync.set({ '__tradeCalc_chip_pos': mode });
    broadcastMessage({ type: 'SET_CHIP_POS', mode });
  });
}

if (maxTradesSelect) {
  maxTradesSelect.addEventListener('change', () => {
    const value = Math.max(1, Math.min(4, parseInt(maxTradesSelect.value, 10) || 2));
    // Popup owns the sync write; broadcast SET_MAX_TRADES so open tabs apply it live (no reload).
    chrome.storage.sync.set({ '__tradeCalc_max_trades': value });
    broadcastMessage({ type: 'SET_MAX_TRADES', value });
  });
}

sheetSave.addEventListener('click', () => saveSheetUrl(sheetUrlInput.value));
sheetUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSheetUrl(sheetUrlInput.value); });
sheetClear.addEventListener('click', () => {
  sheetUrlInput.value = '';
  saveSheetUrl('');
});

/* =========================================================================
 * UPI / PhonePe deposit scanner
 * Walks every page of the QX Broker balance transaction history and sums all
 * Successed + Deposit + UPI/PhonePe rows. The table is client-rendered (a
 * fetch of ?page=N returns only the SPA shell), so we drive the user's active
 * balance tab through each ?page=N, let it render, scrape the DOM via
 * chrome.scripting, then restore the tab to where it started. 100% read-only.
 * ========================================================================= */
const depositCalcBtn = document.getElementById('depositCalcBtn');
const depositCancelBtn = document.getElementById('depositCancelBtn');
const depositStatusEl = document.getElementById('depositStatus');
const depositResultEl = document.getElementById('depositResult');

const QX_BALANCE_URL = 'https://qxbroker.com/en/balance';
const QX_MAX_PAGES = 100;              // hard safety cap so a bug can't loop forever
const QX_PAGE_TIMEOUT_MS = 15000;      // per-page navigation/load timeout

let qxScanning = false;
let qxScanCancel = false;

/** True when a URL points at the balance page (any ?page / #hash variant). */
function qxIsBalanceUrl(url) {
  if (typeof url !== 'string') return false;
  const base = url.split('#')[0];
  return /^https?:\/\/qxbroker\.com\/en\/balance(?:\/|\?|$)/i.test(base);
}

/** Short state chip (Idle / Scanning / Done / Error / Stopped). */
function qxSetChip(text, kind) {
  if (!depositStatusEl) return;
  depositStatusEl.textContent = text;
  const cls = kind === 'ok' ? 'set' : kind === 'err' ? 'err' : kind === 'warn' ? 'warn' : 'unset';
  depositStatusEl.className = 'chip ' + cls;
  depositStatusEl.style.color = '';
  depositStatusEl.style.background = '';
}

function qxSetScanningUI(on) {
  if (depositCalcBtn) depositCalcBtn.style.display = on ? 'none' : '';
  if (depositCancelBtn) depositCancelBtn.style.display = on ? '' : 'none';
}

/**
 * Parse one transaction string "+₹70,000.00" / "$58.31" / "-1,200" into a Number.
 * Strips currency symbols, commas, plus signs and spaces — keeps digits, a
 * single decimal point and a leading minus. Returns 0 on anything unparseable.
 */
function qxParseAmount(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** First currency symbol found in the amount string (₹, $, €, £), else ''. */
function qxDetectSymbol(raw) {
  const m = String(raw || '').match(/[₹$€£]/);
  return m ? m[0] : '';
}

/** A row qualifies only if Successed + Deposit + UPI/PhonePe (case/space tolerant). */
function qxMatchesDeposit(tx) {
  const status = (tx.status || '').trim().toLowerCase();
  const type = (tx.type || '').trim().toLowerCase();
  const pay = (tx.payment || '').trim().toLowerCase().replace(/\s+/g, ''); // "Phone Pe" -> "phonepe"
  return status === 'successed' && type === 'deposit' && (pay === 'upi' || pay === 'phonepe');
}

/** Format a number as currency, e.g. 1253.31 -> "$1,253.31". */
function qxFormatMoney(n, symbol) {
  return (symbol || '$') + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * INJECTED into the balance tab (runs in the page, isolated world). Waits for the
 * client-rendered rows, then parses each `.vDMA1` row. Self-contained: cannot
 * reference popup scope. Returns { ok, rows:[{id,status,type,payment,amountRaw}], count }.
 *
 * Selector strategy — primary = the page's column classes (as given in the spec);
 * fallback = column position within the row (0 id, 1 date, 2 status, 3 type,
 * 4 payment, 5 amount). The row container also has the semantic `.transactions-list`
 * parent, used as a fallback row selector if the hashed `.vDMA1` ever rotates.
 */
async function qxScrapeBalancePage() {
  const ROW_SEL = '.vDMA1';
  const txt = (el) => (el && el.textContent ? el.textContent.trim() : '');

  // The list is rendered after an async data fetch — poll until rows appear.
  const deadline = Date.now() + 13000;
  while (!document.querySelector(ROW_SEL) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
  }

  function getRows() {
    let rows = Array.from(document.querySelectorAll(ROW_SEL));
    if (!rows.length) {
      // Semantic fallback: data rows inside the (non-hashed) list container that
      // actually have 6 cells — skips the header row.
      const list = document.querySelector('.transactions-list');
      if (list) rows = Array.from(list.children).filter((c) => c.children && c.children.length >= 6 && /\d/.test(c.textContent));
    }
    return rows;
  }

  function parseRow(row) {
    const kids = row.children;
    const amtCell = row.querySelector('.vKozV') || kids[5] || null;
    return {
      id: txt(row.querySelector('.VZvOf')) || txt(kids[0]),
      status: txt(row.querySelector('.VgSqu')) || txt(row.querySelector('[class*="status" i]')) || txt(kids[2]),
      type: txt(row.querySelector('.Ed7UM')) || txt(kids[3]),
      payment: txt(row.querySelector('.R1N82')) || txt(kids[4]),
      amountRaw: txt(row.querySelector('.vKozV b')) || txt(amtCell && amtCell.querySelector && amtCell.querySelector('b')) || txt(amtCell)
    };
  }

  const rows = getRows().map(parseRow).filter((r) => r.id);
  return { ok: true, rows: rows, count: rows.length, url: location.href };
}

/** Navigate a tab to `url` and resolve once it reports status 'complete'. */
function qxNavigate(tabId, url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('Page load timed out')), QX_PAGE_TIMEOUT_MS);
    function finish(err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      err ? reject(err) : resolve();
    }
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') finish();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.update(tabId, { url }).catch((e) => finish(e));
  });
}

async function qxScrapeTab(tabId) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func: qxScrapeBalancePage });
  return results && results[0] && results[0].result;
}

function qxRenderResults(matched, pagesScanned, cancelled) {
  let total = 0;
  const symCount = {};
  matched.forEach((tx) => {
    total += qxParseAmount(tx.amountRaw);
    const s = qxDetectSymbol(tx.amountRaw);
    if (s) symCount[s] = (symCount[s] || 0) + 1;
  });
  const symbol = Object.keys(symCount).sort((a, b) => symCount[b] - symCount[a])[0] || '$';

  qxSetChip(cancelled ? 'Stopped' : 'Done', cancelled ? 'warn' : 'ok');

  const SHOW = 12;
  const listHtml = matched.slice(0, SHOW).map((tx) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;">
       <span style="font-family:'DM Mono',monospace;color:oklch(62% 0.016 257);font-size:10px;">${tx.id}</span>
       <span style="font-family:'DM Mono',monospace;font-size:11px;">${qxFormatMoney(qxParseAmount(tx.amountRaw), symbol)}</span>
     </div>`).join('');
  const more = matched.length > SHOW ? `<div style="opacity:0.5;margin-top:2px;font-size:10px;">…and ${matched.length - SHOW} more</div>` : '';

  depositResultEl.innerHTML =
    `<div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:oklch(76% 0.16 145);margin:4px 0 3px;">${qxFormatMoney(total, symbol)}</div>
     <div style="font-size:11px;color:oklch(62% 0.016 257);margin-bottom:4px;">${matched.length} deposit${matched.length === 1 ? '' : 's'} · ${pagesScanned} page${pagesScanned === 1 ? '' : 's'} scanned</div>
     ${matched.length ? `<div style="display:flex;flex-direction:column;gap:3px;">${listHtml}${more}</div>` : '<div style="opacity:0.5;margin-top:2px;font-size:11px;">No matching deposits found.</div>'}`;
}

async function qxRunDepositScan() {
  if (qxScanning) return;

  // Gate: the active tab must be the balance page (per spec).
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active || !qxIsBalanceUrl(active.url)) {
    qxSetChip('Error', 'err');
    depositResultEl.textContent = 'Open the QX Broker Balance page first.';
    return;
  }

  qxScanning = true;
  qxScanCancel = false;
  qxSetScanningUI(true);
  qxSetChip('Scanning', '');
  depositResultEl.textContent = 'Starting scan…';

  const tabId = active.id;
  const originalUrl = active.url;       // restored when finished
  const seen = new Set();              // dedupe transactions by ID across pages
  const matched = [];
  let pagesScanned = 0;

  try {
    for (let page = 1; page <= QX_MAX_PAGES; page++) {
      if (qxScanCancel) break;
      depositResultEl.textContent = `Scanning page ${page}…`;
      const url = page === 1 ? QX_BALANCE_URL : `${QX_BALANCE_URL}?page=${page}`;
      await qxNavigate(tabId, url);
      if (qxScanCancel) break;

      const res = await qxScrapeTab(tabId);
      pagesScanned = page;
      if (!res || !res.ok) throw new Error(`Couldn't read page ${page}`);
      if (!res.rows.length) break;     // empty page → end of history

      let newRows = 0;
      for (const tx of res.rows) {
        if (!tx.id || seen.has(tx.id)) continue; // dedupe across pages
        seen.add(tx.id);
        newRows++;
        if (qxMatchesDeposit(tx)) matched.push(tx);
      }
      if (newRows === 0) break;        // no new IDs → last page clamped, stop
    }
    qxRenderResults(matched, pagesScanned, qxScanCancel);
  } catch (e) {
    qxSetChip('Error', 'err');
    depositResultEl.textContent = 'Scan failed: ' + (e && e.message ? e.message : String(e)) +
      '. Make sure you are logged in and try again.';
  } finally {
    // Always return the tab to where the user started.
    try { await qxNavigate(tabId, originalUrl); } catch (_) {}
    qxScanning = false;
    qxSetScanningUI(false);
  }
}

if (depositCalcBtn) depositCalcBtn.addEventListener('click', qxRunDepositScan);
if (depositCancelBtn) depositCancelBtn.addEventListener('click', () => {
  qxScanCancel = true;
  qxSetChip('Stopping', 'warn');
});

init();
