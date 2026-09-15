// ── QXTradeLens · MAIN-world chart reader ────────────────────────────────────────────────────────
// Passively reads Quotex's OWN already-decoded candle store so the (isolated-world) panel can draw
// the same pair at several timeframes. Expando properties like `__reactFiber$*` live in the page's
// JS heap, which an isolated content script cannot see — hence this file, and hence `"world":"MAIN"`
// in the manifest. The bookmarklet build already runs in MAIN world and reads `plot` directly; this
// script exists only to give the EXTENSION the same reach.
//
// ⚠ STEALTH CONTRACT — the whole reason this approach was chosen over the deleted `ws_tap.js`.
// Every one of these is load-bearing; breaking any of them re-introduces a fingerprintable surface
// on a live broker page where detection risk is a permanent account ban:
//   1. NEVER assign to `window.*` and never define a global. `Object.keys(window)` must stay clean.
//   2. NEVER patch a prototype or replace a built-in (that is exactly what got `ws_tap.js` deleted —
//      a `window.WebSocket` shim is caught by `WebSocket.name` / `Function.prototype.toString.call`
//      / `getOwnPropertyDescriptor(window,'WebSocket')` in about three lines).
//   3. NEVER call `.send()`, `fetch`, or anything else that touches the network. We only READ.
//   4. NEVER use `window.postMessage` — the page can listen for `message` blanket-style and see the
//      payload. The bridge is a `document` CustomEvent request/response pair instead, which the page
//      would have to already know the name of to observe.
//   5. NEVER poll. This script is strictly PULL-ONLY: it answers when asked and is otherwise inert.
//   6. NEVER let an exception escape. A throw inside a page-dispatched event handler is observable.
//   7. NEVER write to the platform's objects. Read-only, always — no `loadRegion`, no mutation.
//
// Live-verified 2026-07-30 against qxbroker.com/en/trade (read-only DevTools):
//   `#graph canvas.layer.plot` → `__reactFiber$*` → walk `.return` (hit at depth 3) → `stateNode.plot`
//   `plot.pointsManager.candles` — 201 entries, ASCENDING, and the trailing one is still FORMING.
//   Candle shape: { time: <epoch s>, enterValue: open, exitValue: close, maxValue: high, minValue: low }
//   `plot.store.getState().chartSettings.chartById[plot.chartId]` → currentAsset, upColor, downColor.
(function () {
  'use strict';

  var REQ_EVENT = '__tcChartReq';
  var RES_EVENT = '__tcChartRes';
  var MAX_FIBER_DEPTH = 40;

  // ── Resolve the platform's chart controller ────────────────────────────────────────────────────
  // Anchored on `#graph` (a stable semantic id) and the `plot` PROPERTY NAME rather than on the
  // component's class, which is minified to garbage (`_0x13d557` on the verified build).
  //
  // ⚠ Resolved FRESH on every call — deliberately NOT cached, and this MIRRORS the same decision in
  // part 06's _mtfResolvePlot. A cache revalidated with `canvas.isConnected && plot.pointsManager
  // .candles` passes even after Quotex remounts its chart controller while REUSING the same <canvas>:
  // the orphaned plot still satisfies both checks, so the panel would read a dead candle array
  // forever (observed 2026-07-30 after a trade-room re-init). Node identity and object shape cannot
  // prove liveness — only re-deriving from the current fiber can.
  function findPlot() {
    var graph = document.getElementById('graph');
    if (!graph) return null;
    var cans = [graph.querySelector('canvas.layer.plot'), graph.querySelector('canvas'), graph];
    for (var i = 0; i < cans.length; i++) {
      var node = cans[i];
      if (!node) continue;
      var key = null, ks = Object.keys(node);
      for (var j = 0; j < ks.length; j++) {
        if (ks[j].indexOf('__reactFiber$') === 0 || ks[j].indexOf('__reactInternalInstance$') === 0) { key = ks[j]; break; }
      }
      if (!key) continue;
      var fiber = node[key], depth = 0;
      while (fiber && depth < MAX_FIBER_DEPTH) {
        var sn = fiber.stateNode;
        if (sn && typeof sn === 'object' && sn.plot && sn.plot.pointsManager && sn.plot.pointsManager.candles) return sn.plot;
        fiber = fiber.return; depth++;
      }
    }
    return null;
  }

  // The redux slice for this chart: currentAsset + the platform's own candle colours.
  function chartSettings(plot) {
    try {
      var st = plot.store && plot.store.getState && plot.store.getState();
      var byId = st && st.chartSettings && st.chartSettings.chartById;
      if (!byId) return null;
      return byId[plot.chartId] || byId[Object.keys(byId)[0]] || null;
    } catch (e) { return null; }
  }

  function symbolOf(cs) {
    try {
      var a = cs && cs.currentAsset;
      if (a && typeof a === 'object') {
        var v = a.symbol || a.ticker || a.name || a.id;
        if (v) return String(v);
      }
    } catch (e) {}
    // Fallback: the active pair tab's visible label (hash-rotation-prone, hence second).
    try {
      var tab = document.querySelector('#tab-active .WRocw, #tab-active .l5ftG, .tab-active .WRocw');
      if (tab && tab.textContent) return tab.textContent.trim();
    } catch (e) {}
    return null;
  }

  // ── Period ────────────────────────────────────────────────────────────────────────────────────
  // Derived from the MODAL gap between candle open times, NOT from `pointsManager.interval` — that
  // read `1` on a confirmed 5m chart (with `intervalFactor` `100`), so neither field is seconds and
  // neither can be trusted. The delta histogram on the verified build was a clean {300: 200}.
  function derivePeriodSeconds(rows) {
    if (!rows || rows.length < 3) return 0;
    var counts = Object.create(null), best = 0, bestN = 0;
    for (var i = 1; i < rows.length; i++) {
      var d = rows[i].time - rows[i - 1].time;
      if (!(d > 0)) continue;
      counts[d] = (counts[d] || 0) + 1;
      if (counts[d] > bestN) { bestN = counts[d]; best = d; }
    }
    return best;
  }

  function snapshot(limit) {
    var plot = findPlot();
    if (!plot) return null;
    var rows = plot.pointsManager && plot.pointsManager.candles;
    if (!rows || !rows.length) return null;

    var periodSeconds = derivePeriodSeconds(rows);
    if (!periodSeconds) return null;

    var n = rows.length;
    var take = (typeof limit === 'number' && limit > 0) ? Math.min(limit, n) : n;
    var out = new Array(take);
    for (var i = 0; i < take; i++) {
      var r = rows[n - take + i];
      out[i] = {
        t: r.time,
        o: r.enterValue,
        h: r.maxValue,
        l: r.minValue,
        c: r.exitValue
      };
    }

    var cs = chartSettings(plot);
    return {
      symbol: symbolOf(cs),
      periodSeconds: periodSeconds,
      // The trailing candle is still FORMING (verified: last point ran 111s into a 300s bucket), so
      // the consumer must treat it as incomplete rather than as a settled bar.
      formingTime: out.length ? out[out.length - 1].t : 0,
      upColor: (cs && cs.upColor) || null,
      downColor: (cs && cs.downColor) || null,
      digits: (plot.pointsManager && plot.pointsManager.digits) || 5,
      candles: out
    };
  }

  // ── Bridge (pull-only) ────────────────────────────────────────────────────────────────────────
  // The isolated-world panel dispatches REQ_EVENT with {id, limit}; we answer once with RES_EVENT
  // carrying plain JSON. `id` correlates concurrent asks. Nothing is emitted unprompted.
  document.addEventListener(REQ_EVENT, function (ev) {
    var id = null, limit = 0;
    try { if (ev && ev.detail) { id = ev.detail.id; limit = ev.detail.limit; } } catch (e) {}
    var data = null;
    try { data = snapshot(limit); } catch (e) { data = null; }
    try {
      document.dispatchEvent(new CustomEvent(RES_EVENT, { detail: { id: id, data: data } }));
    } catch (e) {}
  }, false);
})();
