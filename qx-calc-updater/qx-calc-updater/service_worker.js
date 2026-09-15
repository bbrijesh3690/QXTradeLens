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

// ── Sheet/journal fetch proxy (unchanged) ─────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "QX_FETCH" && message.url) {
    fetch(message.url, { method: "GET" })
      .then(r => r.json().then(data => ({ ok: true, data })))
      .catch(err => ({ ok: false, error: err.message }))
      .then(sendResponse);
    return true; // keep channel open for async sendResponse
  }
  return false;
});

// ── System-level lock: declarativeNetRequest block (2026-07-17, PRIMARY enforcement) ──
// Live-verified failure (2026-07-17): the hosts-file daemon below correctly wrote its block
// and reported locked=true, yet the qxbroker tab kept trading through it — Chrome's Secure
// DNS (confirmed ON, chrome://settings/security) and/or Chrome's own internal DNS cache
// (separate from the OS cache the daemon flushes) can both bypass a hosts-file edit for an
// already-running browser. This blocks at Chrome's own network layer instead — before DNS
// is even consulted — so it can't be bypassed the same way, and it also blocks a BRAND NEW
// tab opened during the lock (not just the ones open at trigger time). Self-clears via
// chrome.alarms at `until` (no unlock endpoint here either, matching the daemon's philosophy).
// Reapplied on SW startup/restart from chrome.storage.local so an unexpired lock survives a
// service-worker respawn; a stale one still in storage past its `until` is cleared instead.
const SYS_LOCK_RULE_ID = 9001;
const SYS_LOCK_UNTIL_KEY = "__qxSysLockUntil";
const SYS_LOCK_ALARM = "qxSysLockExpire";
const SYS_LOCK_DOMAINS = ["qxbroker.com"]; // declarativeNetRequest requestDomains also matches subdomains

function applyDnrLock(untilMs) {
  chrome.storage.local.set({ [SYS_LOCK_UNTIL_KEY]: untilMs });
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [SYS_LOCK_RULE_ID],
    addRules: [{
      id: SYS_LOCK_RULE_ID,
      priority: 1,
      action: { type: "block" },
      condition: {
        requestDomains: SYS_LOCK_DOMAINS,
        resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "websocket", "script", "image", "stylesheet", "font", "media", "other"],
      },
    }],
  }).catch(() => {});
  chrome.alarms.create(SYS_LOCK_ALARM, { when: untilMs });
}

function clearDnrLock() {
  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [SYS_LOCK_RULE_ID] }).catch(() => {});
  chrome.storage.local.remove(SYS_LOCK_UNTIL_KEY);
}

chrome.storage.local.get(SYS_LOCK_UNTIL_KEY, (d) => {
  const until = d && d[SYS_LOCK_UNTIL_KEY];
  if (typeof until === "number" && until > Date.now()) applyDnrLock(until);
  else if (until != null) clearDnrLock();
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === SYS_LOCK_ALARM) clearDnrLock(); });

// ── System-level lock bridge (2026-07-16) ─────────────────────────────────────
// The page relays SYS_LOCK on an SL breach (mode 'sl' → flat 6h block from the breach moment,
// 2026-08-11 — was "until next 5:30 AM IST / next 00:00 UTC", which gave almost no penalty for
// a late-night breach (e.g. 23:00 IST → ~6.5h) yet nearly a full day for an early-morning one —
// the trading-day boundary itself still resets at 5:30 AM IST as always (SL peak/TP-lock, tracked
// elsewhere in the panel), this only changes how long the SYS_LOCK enforcement layer stays armed)
// or a 3-loss streak (mode 'streak' → 15 min). Three actions, all fired in
// parallel: (1) the declarativeNetRequest block above (PRIMARY — works regardless of DNS
// settings); (2) tell the local lock daemon (repo system-lock/, root LaunchDaemon on
// 127.0.0.1:7343) to hosts-block the trading domain too — fire-and-forget, secondary/
// system-wide layer for non-Chrome access, a missing daemon degrades harmlessly; (3) close
// every open trading tab (kills live WebSockets a network-layer block can't reach once
// already connected). No unlock path here by design — both layers self-clear at expiry.
const LOCK_DAEMON_URL = "http://127.0.0.1:7343/lock";
const LOCK_HOSTS = ["qxbroker.com", "www.qxbroker.com"];
// v1.21.0: only the 3-loss streak locks. An SL breach no longer locks anything, so mode 'sl' (sent by
// a tab still running an older content script) is ignored.
chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "SYS_LOCK") return false;
  if (message.mode !== "streak") return false;
  const until = Date.now() + 15 * 60000;
  applyDnrLock(until);
  fetch(LOCK_DAEMON_URL, {
    method: "POST",
    body: JSON.stringify({ until, hosts: LOCK_HOSTS, reason: message.mode }),
  }).catch(() => {});
  chrome.tabs.query({ url: QX_TAB_PATTERNS }, (tabs) => {
    (tabs || []).forEach((t) => { if (t.id != null) chrome.tabs.remove(t.id).catch(() => {}); });
  });
  return false;
});
