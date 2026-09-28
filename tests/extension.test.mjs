// The extension around the panel: the manifest, the service worker, and what ships. v1.70.0 deleted the
// popup, so the toolbar icon is how the panel is shown and hidden, and the "no network" guard that lived in
// the popup's spec (v1.65.2) now covers every shipped file.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const EXT = new URL("../qx-calc-updater/qx-calc-updater/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, EXT), "utf8");
const MANIFEST = JSON.parse(read("manifest.json"));

// The service worker in a bare context: a chrome stub that records listeners and calls.
function loadWorker() {
  const listeners = {},
    calls = { sent: [], removedSync: null, updated: [] };
  const on = (name) => ({ addListener: (f) => (listeners[name] = f), removeListener() {} });
  const chrome = {
    action: { onClicked: on("action") },
    runtime: { onMessage: on("message"), onInstalled: on("installed"), onStartup: on("startup"), reload() {} },
    commands: { onCommand: on("command") },
    tabs: {
      sendMessage: (id, msg) => (calls.sent.push({ id, msg }), Promise.resolve()),
      update: (id, p) => (calls.updated.push(p.url), Promise.resolve()),
      query() {},
      reload: () => Promise.resolve(),
      onUpdated: { addListener() {}, removeListener() {} },
    },
    storage: {
      local: { get: (k, cb) => cb && cb({}), set: () => Promise.resolve(), remove() {} },
      sync: { remove: (keys) => ((calls.removedSync = keys), Promise.resolve()) },
    },
    declarativeNetRequest: { updateDynamicRules: () => Promise.resolve() },
    alarms: { clear() {} },
    scripting: { executeScript: () => Promise.resolve([]) },
  };
  const ctx = vm.createContext({ chrome, console, setTimeout, clearTimeout, URL });
  ctx.importScripts = (...names) => names.forEach((n) => vm.runInContext(read(n), ctx, { filename: n }));
  vm.runInContext(read("service_worker.js"), ctx, { filename: "service_worker.js" });
  return { ctx, listeners, calls };
}

test("extension: there is no popup any more (v1.70.0)", () => {
  assert.equal(MANIFEST.action.default_popup, undefined, "the manifest names no popup");
  assert.ok(!fs.existsSync(new URL("popup.html", EXT)), "popup.html is gone");
  assert.ok(!fs.existsSync(new URL("popup.js", EXT)), "popup.js is gone");
  assert.match(MANIFEST.action.default_title, /show \/ hide/i, "the icon's tooltip says what a click does");
});

test("extension: clicking the toolbar icon shows or hides the panel on that tab (v1.70.0)", () => {
  const { listeners, calls } = loadWorker();
  assert.equal(typeof listeners.action, "function", "the worker listens for the icon click");
  listeners.action({ id: 42, url: "https://qxbroker.com/en/trade" });
  assert.deepEqual(JSON.parse(JSON.stringify(calls.sent)), [{ id: 42, msg: { type: "TOGGLE_PANEL" } }]);
  listeners.action({}); // a tab with no id (a devtools window, say) is ignored rather than thrown on
  assert.equal(calls.sent.length, 1);
});

test("extension: the worker starts and stops the deposit scan the panel asks for (v1.69.0)", async () => {
  const { ctx, listeners, calls } = loadWorker();
  listeners.message({ type: "DEPOSIT_SCAN_START" }, { tab: { id: 7, url: "https://qxbroker.com/hi/trade" } });
  assert.deepEqual(calls.updated, ["https://qxbroker.com/hi/balance"], "it heads for the Balance page in the same language");
  listeners.message({ type: "DEPOSIT_SCAN_STOP" }, {});
  assert.equal(vm.runInContext("qxScanCancel", ctx), true, "Stop reaches the walk");
  listeners.message({ type: "DEPOSIT_SCAN_START" }, {}); // not from a tab: nothing to scan from
  assert.equal(calls.updated.length, 1);
});

test("extension: settings that no longer exist are cleared from sync on every start (v1.69.0)", () => {
  const { calls } = loadWorker();
  for (const key of ["__tradeCalc_hk_leftright", "__tradeCalc_chip_pos", "__tradeCalc_relabel_demo", "sheetUrl"]) {
    assert.ok(calls.removedSync.includes(key), key);
  }
  assert.ok(!calls.removedSync.includes("__tradeCalc_sl"), "never the SL itself");
  assert.ok(!calls.removedSync.some((k) => /mtf_(tfs|autofill|settle|flip)/.test(k)), "nor the chart settings, which moved");
});

test("extension: no shipped file names a site other than Quotex (v1.70.0; was the popup's v1.65.2 check)", () => {
  const files = fs.readdirSync(EXT).filter((f) => /\.(js|json|html|css)$/.test(f));
  assert.ok(files.includes("content.js") && files.includes("service_worker.js"), "the scan sees the shipped files");
  const outside = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/(?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[/:"'\s)]|$)/gi)) {
      if (!/(^|\.)qxbroker\.com$/i.test(m[1])) outside.push(f + ": " + m[0]);
    }
  }
  assert.deepEqual(outside, []);
});
