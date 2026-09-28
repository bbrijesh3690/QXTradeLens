// v1.69.0: the deposit scan moved here from the popup; the panel starts it from its ⚙ menu.
importScripts("deposit_scan.js");

const QX_TAB_PATTERNS = ["*://qxbroker.com/*", "*://*.qxbroker.com/*"];
const QX_RELOAD_PENDING = "__qxDevReloadTabs";

// ── Dev hot-reload ────────────────────────────────────────────────────────────
// Press the `dev-reload` command (Alt+Shift+R by default) after a build: we stash
// the open qxbroker tab IDs, then chrome.runtime.reload() restarts the extension so
// the new content.js / popup / SW are picked up. chrome.storage.local survives the
// reload, so on the fresh SW startup (top-level code below) we refresh those tabs to
// re-inject the updated content script. Nothing dev-only ships inside content.js.
chrome.storage.local.get(QX_RELOAD_PENDING, (d) => {
  const ids = d && d[QX_RELOAD_PENDING];
  if (!Array.isArray(ids) || !ids.length) return;
  chrome.storage.local.remove(QX_RELOAD_PENDING);
  ids.forEach((id) => chrome.tabs.reload(id).catch(() => {}));
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "dev-reload") return;
  chrome.tabs.query({ url: QX_TAB_PATTERNS }, (tabs) => {
    const ids = (tabs || []).map((t) => t.id).filter((id) => id != null);
    chrome.storage.local.set({ [QX_RELOAD_PENDING]: ids }, () => chrome.runtime.reload());
  });
});


// ── The system lock is gone (v1.65.0) ─────────────────────────────────────────
// Until v1.64.1 a 3-loss streak made this worker block qxbroker.com through declarativeNetRequest for
// 15 minutes, ask a local daemon on 127.0.0.1:7343 to hosts-block it as well, and close every Quotex tab.
// All of it has been removed, along with the Google Sheet fetch proxy - the extension makes no network
// requests of its own any more.
//
// One thing cannot simply be deleted: the block rule lives inside Chrome, not in this file. A lock that
// was active at the moment of updating would outlive the code that used to lift it, and Quotex would stay
// unreachable with nothing left to clear it. So every start clears the rule, the alarm and the stored
// expiry. It is a no-op when there is nothing to clear, and it is the only reason the
// declarativeNetRequest and alarms permissions are still in the manifest - both can go in a later release
// once this has run everywhere.
const LEGACY_LOCK_RULE_ID = 9001;
const LEGACY_LOCK_UNTIL_KEY = "__qxSysLockUntil";
const LEGACY_LOCK_ALARM = "qxSysLockExpire";

function clearLegacyLock() {
  try {
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [LEGACY_LOCK_RULE_ID] }).catch(() => {});
  } catch (e) {}
  try {
    chrome.alarms.clear(LEGACY_LOCK_ALARM);
  } catch (e) {}
  try {
    chrome.storage.local.remove(LEGACY_LOCK_UNTIL_KEY);
  } catch (e) {}
}
clearLegacyLock();
chrome.runtime.onInstalled.addListener(clearLegacyLock);
chrome.runtime.onStartup.addListener(clearLegacyLock);


// ── Deposit scan (v1.69.0) ─────────────────────────────────────────────────────
// Only our own content script can send these: a web page cannot reach an extension without
// externally_connectable, which the manifest does not declare.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;
  if (msg.type === "DEPOSIT_SCAN_START" && sender && sender.tab) {
    qxRunDepositScan(sender.tab);
  } else if (msg.type === "DEPOSIT_SCAN_STOP") {
    qxStopDepositScan();
  }
});

// ── Settings that no longer exist ─────────────────────────────────────────────
// Cleared from sync so they cannot linger. v1.65.0 did this from the popup, which only ran when it was
// opened; the popup is going away, so it happens here on every start. Best effort and never fatal.
const REMOVED_SYNC_KEYS = [
  "sheetUrl", "__tradeCalc_sl_post_tp_gap", "__tradeCalc_sys_lock_disabled", "__tradeCalc_marquee_msg",
  "__tradeCalc_marquee_speed", "__tradeCalc_mtf_count", "__tradeCalc_entry_tags", "sectionVisibility",
  "__tradeCalc_sl_enabled", "__tradeCalc_sl_value", "__tradeCalc_sl_date", "__tradeCalc_sl_init_bal",
  "__tradeCalc_sl_trail", "__tradeCalc_sl_tp_lock", "__tradeCalc_sl_tp_lock_date",
  // v1.69.0: switches that became permanent, and Focus Mode, which the panel keeps on its own.
  "__tradeCalc_hk_leftright", "__tradeCalc_chip_pos", "__tradeCalc_relabel_demo", "__tradeCalc_hk_focus_mode",
];
function clearRemovedSettings() {
  try {
    const r = chrome.storage.sync.remove(REMOVED_SYNC_KEYS);
    if (r && typeof r.catch === "function") r.catch(() => {});
  } catch (e) {}
}
clearRemovedSettings();
