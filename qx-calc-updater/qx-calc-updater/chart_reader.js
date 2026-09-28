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
  // v1.79.0 (self-healing): "#graph" first; if Quotex renames it, every canvas on the page is tried, since
  // the chart is the one whose React owner holds a plot with candles. Reading only, as everywhere here.
  function findPlot() {
    var graph = document.getElementById('graph');
    var cans = graph ? [graph.querySelector('canvas.layer.plot'), graph.querySelector('canvas'), graph] : [];
    if (!graph) {
      var all = document.getElementsByTagName('canvas');
      for (var c = 0; c < all.length; c++) cans.push(all[c]);
    }
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
    // Fallbacks: the active tab's `data-symbol` attribute (stable, same id as the store), then its
    // visible label (hashed class, rotation-prone).
    try {
      var active = document.getElementById('tab-active');
      var ds = active && active.getAttribute('data-symbol');
      if (ds) return ds;
    } catch (e) {}
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

  // ── Store snapshot (v1.22.0) ──────────────────────────────────────────────────────────────────
  // Plain values the panel otherwise scrapes from hashed CSS classes. Every path below was seen live on
  // 2026-09-15 in `plot.store.getState()`. Same stealth contract: read-only, copies only, no writes.
  var MAX_CLOSED_DEALS = 50;

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }

  // ── v1.81.0 (self-healing): Quotex's data after a field is renamed ─────────────────────────────
  // Known names first. Something is found by its shape only where the data itself says which value is which:
  // a deal's open and close times are its only two epoch-second numbers (the smaller is the open), its pair is
  // the text value that names a known asset, and the deal lists are id-keyed maps of such deals, split into
  // open and settled by their close time against Quotex's own clock. Everything else - balance, payouts,
  // amounts - stays by name, and a missing one is reported in `fields`, never guessed.
  var fieldNotes = {};
  function isEpochSec(v) { return typeof v === 'number' && v > 1.5e9 && v < 2.5e9; }
  function epochKeys(d) {
    var out = [];
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k) && isEpochSec(d[k])) out.push(k);
    return out;
  }
  function pairIn(d, assets) {
    if (!assets) return null;
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k) && typeof d[k] === 'string' && assets[d[k]]) return d[k];
    return null;
  }
  function looksLikeDeal(d, assets) {
    return !!d && typeof d === 'object' && !Array.isArray(d) && epochKeys(d).length === 2 && pairIn(d, assets) !== null;
  }

  // command 0 = Up, 1 = Down (checked against 10 settled trades live on 2026-09-18).
  function dealOut(d, assets) {
    var open = num(d.openTimestamp), close = num(d.closeTimestamp);
    if (open === null || close === null) {
      var ek = epochKeys(d);
      if (ek.length === 2) {
        open = Math.min(d[ek[0]], d[ek[1]]);
        close = Math.max(d[ek[0]], d[ek[1]]);
        fieldNotes['deal times'] = 'by shape';
      } else {
        fieldNotes['deal times'] = 'missing';
      }
    }
    var asset = d.asset != null ? String(d.asset) : null;
    if (asset === null) {
      asset = pairIn(d, assets);
      fieldNotes['deal pair'] = asset === null ? 'missing' : 'by shape';
    }
    return {
      id: d.id != null ? String(d.id) : null,
      asset: asset,
      amount: num(d.amount),
      profit: num(d.profit),
      command: num(d.command),
      isDemo: num(d.isDemo),
      openPrice: num(d.openPrice),
      closePrice: num(d.closePrice),
      percentProfit: num(d.percentProfit),
      openTimestamp: open,
      closeTimestamp: close
    };
  }

  function newestFirst(out, limit) {
    out.sort(function (a, b) {
      return ((b.closeTimestamp || 0) - (a.closeTimestamp || 0)) || ((b.openTimestamp || 0) - (a.openTimestamp || 0));
    });
    return limit > 0 ? out.slice(0, limit) : out;
  }
  // Newest first by close time (then open time), capped at `limit` when > 0. The order of the store's
  // id arrays isn't relied on; without the id array, the map's own keys are used (v1.81.0).
  function dealList(byId, ids, limit, assets) {
    var out = [];
    if (!byId) return out;
    if (!ids) ids = Object.keys(byId);
    for (var i = 0; i < ids.length; i++) {
      var d = byId[ids[i]];
      if (d && typeof d === 'object') out.push(dealOut(d, assets));
    }
    return newestFirst(out, limit);
  }
  // v1.81.0: without Quotex's `deals.openedById` / `closedById`, every id-keyed map in the store whose entries
  // are deals (keys that are not pair symbols, entries shaped as above), split by close time against `nowSec`.
  function dealsByShape(st, assets, nowSec) {
    var seen = [], opened = [], closed = [], where = [];
    var slices = Object.keys(st);
    for (var i = 0; i < slices.length; i++) {
      var slice = st[slices[i]];
      if (!slice || typeof slice !== 'object' || Array.isArray(slice)) continue;
      var keys = Object.keys(slice);
      for (var j = 0; j < keys.length; j++) {
        var m = slice[keys[j]];
        if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
        var ids = Object.keys(m);
        if (!ids.length || assets[ids[0]]) continue;
        var ok = true;
        for (var k = 0; k < ids.length && k < 5 && ok; k++) ok = looksLikeDeal(m[ids[k]], assets);
        if (!ok) continue;
        where.push(slices[i] + '.' + keys[j]);
        for (var n = 0; n < ids.length; n++) {
          var d = m[ids[n]];
          if (seen.indexOf(d) >= 0 || !looksLikeDeal(d, assets)) continue;
          seen.push(d);
          var o = dealOut(d, assets);
          (o.closeTimestamp > nowSec ? opened : closed).push(o);
        }
      }
    }
    fieldNotes['deal lists'] = where.length ? 'by shape: ' + where.join(', ') : 'missing';
    return { opened: newestFirst(opened, 0), closed: newestFirst(closed, MAX_CLOSED_DEALS) };
  }

  // Live price per symbol: { SYMBOL: price }. Lets the panel tell a winning trade from a losing one
  // without reading the platform's markup (v1.25.0).
  function quoteMap(q) {
    var out = {};
    var by = q && q.quoteBySymbol;
    if (!by) return out;
    var keys = Object.keys(by);
    for (var i = 0; i < keys.length; i++) {
      var v = by[keys[i]];
      if (v && typeof v === 'object' && num(v.price) !== null) out[keys[i]] = num(v.price);
    }
    return out;
  }

  function stateSnapshot(withAssets) {
    var plot = findPlot();
    if (!plot || !plot.store || !plot.store.getState) return null;
    var st = plot.store.getState();
    if (!st) return null;
    var cs = chartSettings(plot);
    var cur = cs && cs.currentAsset;
    var symbol = cur && typeof cur === 'object' && cur.symbol ? String(cur.symbol) : null;
    var bySymbol = st.assets && st.assets.assetBySymbol;
    var asset = symbol && bySymbol ? bySymbol[symbol] : null;
    var g = st.global || {};
    var deals = st.deals || {};
    fieldNotes = {};
    var serverTime = plot.pointsManager ? num(plot.pointsManager.targetTime) : null;
    var dealSets = deals.openedById
      ? { opened: dealList(deals.openedById, deals.openedIds, 0, bySymbol), closed: dealList(deals.closedById, deals.closedIds, MAX_CLOSED_DEALS, bySymbol) }
      : bySymbol
        ? dealsByShape(st, bySymbol, serverTime || Date.now() / 1000)
        : { opened: [], closed: [] };
    if (!deals.openedById && !bySymbol) fieldNotes['deal lists'] = 'missing';
    // Names read with no fallback: reported when absent, so Check says which one Quotex renamed.
    if (!st.global) fieldNotes['global'] = 'missing';
    else {
      var gNames = ['balance', 'currency', 'timeZone'];
      for (var gi = 0; gi < gNames.length; gi++) if (!(gNames[gi] in g)) fieldNotes['global.' + gNames[gi]] = 'missing';
    }
    if (!bySymbol) fieldNotes['assets.assetBySymbol'] = 'missing';
    if (!symbol) fieldNotes['chart pair'] = 'missing';
    if (serverTime === null) fieldNotes['server clock'] = 'missing';
    var out = {
      v: 1,
      symbol: symbol,
      label: asset && asset.label ? String(asset.label) : null,
      payout: asset ? num(asset.payout) : null,
      dealValue: cs ? num(cs.dealValue) : null,
      currency: g.currency != null ? String(g.currency) : null,
      currencyCode: g.currencyCode != null ? String(g.currencyCode) : null,
      // v1.57.0: the account balance, read from the same state everything else here comes from.
      // Quotex moved their account block into <qx-usermenu-trigger>, a custom element with a CLOSED
      // shadow root, so the figure is no longer anywhere in the document - no selector reaches it and no
      // text scan finds it. This is the only remaining source. Still pull-only: nothing is written.
      balance: num(g.balance),
      liveBalance: num(g.liveBalance),
      demoBalance: num(g.demoBalance),
      activeAccount: g.activeAccount != null ? String(g.activeAccount) : null,
      balanceVisible: g.isBalanceVisible == null ? null : !!g.isBalanceVisible,
      timeZone: num(g.timeZone),
      tabs: st.navigationSymbols && st.navigationSymbols.list ? st.navigationSymbols.list.map(String) : [],
      openedDeals: dealSets.opened,
      quotes: quoteMap(st.quotes),
      closedDeals: dealSets.closed,
      // v1.74.4: Quotex's own clock - the chart's `targetTime`, server time in seconds - and this
      // computer's clock at the same moment, so the panel can tell how far apart they are. Trade
      // countdowns are measured against the server; a plain value read, nothing is called.
      serverTime: serverTime,
      readAt: Date.now(),
      // v1.81.0: which values were not where Quotex's names say - found by shape, or missing.
      fields: fieldNotes,
      assets: null
    };
    if (withAssets && bySymbol) {
      out.assets = {};
      var keys = Object.keys(bySymbol);
      for (var i = 0; i < keys.length; i++) {
        var a = bySymbol[keys[i]];
        if (!a || typeof a !== 'object') continue;
        out.assets[keys[i]] = { label: a.label != null ? String(a.label) : null, payout: num(a.payout), isOtc: num(a.is_otc), active: !!a.active };
      }
    }
    return out;
  }

  // ── Bridge (pull-only) ────────────────────────────────────────────────────────────────────────
  // The isolated-world panel dispatches REQ_EVENT with {id, limit} (candles) or {id, kind:'state',
  // assets} (store snapshot); we answer once with RES_EVENT. `id` correlates concurrent asks. Nothing
  // is emitted unprompted. The state answer is a JSON string so it crosses worlds as a primitive.
  document.addEventListener(REQ_EVENT, function (ev) {
    var id = null, limit = 0, kind = null, withAssets = false;
    try { if (ev && ev.detail) { id = ev.detail.id; limit = ev.detail.limit; kind = ev.detail.kind; withAssets = !!ev.detail.assets; } } catch (e) {}
    var data = null;
    try {
      if (kind === 'state') { var s = stateSnapshot(withAssets); data = s ? JSON.stringify(s) : null; }
      else data = snapshot(limit);
    } catch (e) { data = null; }
    try {
      document.dispatchEvent(new CustomEvent(RES_EVENT, { detail: { id: id, data: data } }));
    } catch (e) {}
  }, false);
})();
