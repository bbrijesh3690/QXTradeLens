// v1.69.0: the popup keeps only Show / Hide Panel and the chart settings. Theme, size, the trade cap, the
// hotkeys, the compatibility check and the deposit scan moved into the panel itself (its ⚙ menu and the
// MAX field); the chart settings move into the chart panel next, and then the popup goes.
const panelToggleBtn = document.getElementById('panelToggleBtn');
const mtfTfsInput = document.getElementById('mtfTfsInput');
const mtfTfsSave = document.getElementById('mtfTfsSave');
const mtfStatus = document.getElementById('mtfStatus');
const mtfAutofillToggle = document.getElementById('mtfAutofillToggle');
const mtfSettleInput = document.getElementById('mtfSettleInput');
const mtfFlipToggle = document.getElementById('mtfFlipToggle');
const mtfFlipBarsInput = document.getElementById('mtfFlipBarsInput');


async function init() {
  // Load the settings from storage directly — doesn’t need an active tab
  const stored = await chrome.storage.sync.get(['__tradeCalc_mtf_tfs', '__tradeCalc_mtf_autofill', '__tradeCalc_mtf_settle', '__tradeCalc_mtf_flip', '__tradeCalc_mtf_flip_bars']);
  {
    const tfs = parseTfListPopup(stored['__tradeCalc_mtf_tfs']);
    if (mtfTfsInput) mtfTfsInput.value = tfs.join(', ');
    updateMtfStatus(tfs);
    // On by default, so only an explicit false unticks it.
    if (mtfAutofillToggle) mtfAutofillToggle.checked = stored['__tradeCalc_mtf_autofill'] !== false;
    if (mtfSettleInput) mtfSettleInput.value = clampSettle(stored['__tradeCalc_mtf_settle']);
    if (mtfFlipToggle) mtfFlipToggle.checked = stored['__tradeCalc_mtf_flip'] !== false;
    if (mtfFlipBarsInput) mtfFlipBarsInput.value = clampFlipBars(stored['__tradeCalc_mtf_flip_bars']);
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    const state = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
    if (state) {
      if (state.mtfTfs !== undefined) { const t = parseTfListPopup(state.mtfTfs); if (mtfTfsInput) mtfTfsInput.value = t.join(', '); updateMtfStatus(t); }
      if (state.mtfAutofill !== undefined && mtfAutofillToggle) mtfAutofillToggle.checked = state.mtfAutofill === true;
      if (state.mtfSettle !== undefined && mtfSettleInput) mtfSettleInput.value = clampSettle(state.mtfSettle);
      if (state.mtfFlip !== undefined && mtfFlipToggle) mtfFlipToggle.checked = state.mtfFlip === true;
      if (state.mtfFlipBars !== undefined && mtfFlipBarsInput) mtfFlipBarsInput.value = clampFlipBars(state.mtfFlipBars);
    }
  } catch (e) {
    console.log('Could not get state from content script', e);
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
function clampFlipBars(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 3 : Math.min(10, Math.max(2, n));
}
function clampSettle(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : Math.min(120, Math.max(0, n));
}
if (mtfAutofillToggle) {
  mtfAutofillToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ '__tradeCalc_mtf_autofill': mtfAutofillToggle.checked });
    broadcastMessage({ type: 'SET_MTF', autofill: mtfAutofillToggle.checked });
  });
}
if (mtfFlipToggle) {
  mtfFlipToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ '__tradeCalc_mtf_flip': mtfFlipToggle.checked });
    broadcastMessage({ type: 'SET_MTF', flip: mtfFlipToggle.checked });
  });
}
if (mtfFlipBarsInput) {
  const saveFlipBars = () => {
    const n = clampFlipBars(mtfFlipBarsInput.value);
    mtfFlipBarsInput.value = n;
    chrome.storage.sync.set({ '__tradeCalc_mtf_flip_bars': n });
    broadcastMessage({ type: 'SET_MTF', flipBars: n });
  };
  mtfFlipBarsInput.addEventListener('change', saveFlipBars);
  mtfFlipBarsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveFlipBars(); });
}
if (mtfSettleInput) {
  const saveSettle = () => {
    const n = clampSettle(mtfSettleInput.value);
    mtfSettleInput.value = n;
    chrome.storage.sync.set({ '__tradeCalc_mtf_settle': n });
    broadcastMessage({ type: 'SET_MTF', settle: n });
  };
  mtfSettleInput.addEventListener('change', saveSettle);
  mtfSettleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSettle(); });
}

init();
