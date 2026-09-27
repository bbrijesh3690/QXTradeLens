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
