// Tests for the popup (popup.html / popup.js). Since v1.69.0 it holds only Show / Hide Panel and the chart
// settings; the deposit scanner moved to deposit_scan.js (tests/deposits.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const EXT = new URL("../qx-calc-updater/qx-calc-updater/", import.meta.url);
const POPUP_HTML = fs.readFileSync(new URL("popup.html", EXT), "utf8").replace(/<script[^>]*src="popup\.js"[^>]*><\/script>/, "");
const POPUP_JS = fs.readFileSync(new URL("popup.js", EXT), "utf8");

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

// ── v1.69.0: the popup keeps only Show / Hide Panel and the chart settings ─────────────────────────
async function loadPopup() {
  const dom = new JSDOM(POPUP_HTML, { url: "chrome-extension://test/popup.html", runScripts: "outside-only" });
  const { window } = dom;
  window.chrome = {
    storage: { sync: { get: async () => ({}), set: async () => {} } },
    tabs: { query: async () => [], sendMessage: async () => undefined },
  };
  window.eval(POPUP_JS);
  await new Promise((r) => setTimeout(r, 50)); // let the popup's async init() finish before closing
  return window;
}

test("popup: only Show / Hide Panel and the chart settings are left in it (v1.69.0)", async () => {
  const w = await loadPopup();
  try {
    const doc = w.document;
    assert.ok(doc.getElementById("panelToggleBtn"), "Show / Hide Panel stays");
    assert.ok(doc.getElementById("mtfTfsInput"), "the chart settings stay until the chart panel takes them");
    for (const id of ["themeToggle", "sizeSlider", "relabelDemoToggle", "chipPosSelect", "maxTradesSelect", "hkUpDownToggle",
      "hkLeftRightToggle", "hkFocusModeToggle", "healthCheckBtn", "depositCalcBtn"]) {
      assert.equal(doc.getElementById(id), null, id + " moved to the panel or became permanent");
    }
    assert.match(doc.body.textContent, /⚙ menu/, "and it says where they went");
  } finally {
    w.close();
  }
});
