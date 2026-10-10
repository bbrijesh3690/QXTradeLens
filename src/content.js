/*
 * QXTradeLens Controller: content script (panel on Quotex's trade pages: quotex.com, qxbroker.com)
 *
 * SOURCE OF TRUTH. `npm run build` generates qx-calc-updater/qx-calc-updater/content.js from this file.
 *
 * Recovered on 2026-09-15 from the minified v1.19.0 build with tools/unminify.mjs (safe AST rewrites +
 * scope-aware renames from tools/rename-map.json). `npm run verify` proves the build is the same
 * program as the original release. Short parameter names (t, e, n, …) inside functions are
 * left over from minification and get renamed as each area is refactored.
 *
 * Runs in the extension's ISOLATED world: it can read/modify the DOM but can't see the page's JS
 * objects. Quotex's React/Redux data is reached through chart_reader.js (MAIN world).
 */
(function () {
  // ────────────────────────────────────────────────────────────────────────────────────────────────
  // The panel only runs on the trade pages (/en/trade, /en/demo-trade, …). Quotex is a single-page
  // app, so the launcher at the bottom also follows in-app navigation to and from those pages.
  // ────────────────────────────────────────────────────────────────────────────────────────────────
  var TRADE_PATH_RE = /\/(demo-)?trade(\/|\?|$)/;
  // ────────────────────────────────────────────────────────────────────────────────────────────────
  // _tc(): builds the whole panel. Calling it again while it exists toggles it off (cleanup).
  // ────────────────────────────────────────────────────────────────────────────────────────────────
  var _tc = function () {
    // <style> elements this panel adds to the page <head>, removed on cleanup.
    const headStyleEls = [];
    if (window.__tcCleanup) {
      document.dispatchEvent(new CustomEvent("__tcToggle"));
      return;
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Cleanup / toggle-off: removes every element, listener, timer and observer _tc() created
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    window.__tcCleanup = () => {
      document.removeEventListener("__tcToggle", window.__tcCleanup);
      document.removeEventListener("keydown", window.__tcKeydownDispatch, {
        capture: true,
      });
      document.removeEventListener("click", window.__tcClickDispatch, {
        capture: true,
      });
      document.removeEventListener("pointerdown", window.__tcPointerdownDispatch, {
        capture: true,
      });
      document.removeEventListener("auxclick", window.__tcMiddleClickClose, {
        capture: true,
      });
      document.removeEventListener("input", window.__tcInputDelegator, {
        capture: true,
      });
      delete window.__tcKeydownDispatch;
      delete window.__tcClickDispatch;
      delete window.__tcPointerdownDispatch;
      delete window.__tcClickDelegator;
      delete window.__tcInputDelegator;
      delete window.__tcKeyDelegator;
      delete window.__tcTradeBlocker;
      delete window.__tcAudioUnlock;
      document.body.style.animation = "none";
      if (window.__tcViewportMeta) {
        if (window.__tcViewportMetaOld === null) {
          window.__tcViewportMeta.remove();
        } else {
          window.__tcViewportMeta.setAttribute("content", window.__tcViewportMetaOld);
        }
        delete window.__tcViewportMeta;
        delete window.__tcViewportMetaOld;
      }
      if (window.__tradeCalcObs) {
        window.__tradeCalcObs.disconnect();
        delete window.__tradeCalcObs;
      }
      document.querySelectorAll("." + ids.tcPlacedBal).forEach((t) => t.remove());
      if (window.__tcScheduler) {
        clearInterval(window.__tcScheduler);
        delete window.__tcScheduler;
      }
      if (window.__tcAssetCloseTimer) {
        clearTimeout(window.__tcAssetCloseTimer);
        delete window.__tcAssetCloseTimer;
      }
      if (window.__tcOtcRebuildTimer) {
        clearTimeout(window.__tcOtcRebuildTimer);
        delete window.__tcOtcRebuildTimer;
      }
      if (window.__tcAutoCloseStepTimer) {
        clearTimeout(window.__tcAutoCloseStepTimer);
        delete window.__tcAutoCloseStepTimer;
      }
      if (window.__tcAutoOpenTimer) {
        clearTimeout(window.__tcAutoOpenTimer);
        delete window.__tcAutoOpenTimer;
      }
      if (window.__tcMtfViewClamp) {
        clearTimeout(window.__tcMtfViewClamp);
        delete window.__tcMtfViewClamp;
      }
      if (window.__tcSweepTimer) {
        clearTimeout(window.__tcSweepTimer);
        delete window.__tcSweepTimer;
      }
      stopTimerLoop();
      try {
        document.title = document.title.replace(TITLE_PREFIX_RE, "");
      } catch (t) {}
      window.removeEventListener("resize", window.__tcScrollAffordance);
      setTradeButtonsDisabled(false);
      if (window.__tcAudioCtx) {
        window.__tcAudioCtx.close().catch(() => {});
        delete window.__tcAudioCtx;
      }
      delete window.__tcAudioUnlock;
      const e = byId("__tcDangerOverlay");
      if (e) {
        e.remove();
      }
      const o = byId("__tradeCalc");
      if (o) {
        o.remove();
      }
      const r = byId("__tcRestoreBtn");
      if (r) {
        r.remove();
      }
      if (window.__tcLayoutResize) {
        window.removeEventListener("resize", window.__tcLayoutResize);
        delete window.__tcLayoutResize;
      }
      headStyleEls.forEach((el) => el.remove());
      headStyleEls.length = 0;
      const s = byId(ids.tcTradeTimer);
      if (s) {
        const t = s.parentElement;
        s.remove();
        if (t && t._tcWasStatic) {
          t.style.position = "";
          delete t._tcWasStatic;
        }
      }
      const l = byId(ids.tcProjChip);
      if (l) {
        l.remove();
      }
      const d = byId("__tcEdgeFlash");
      if (d) {
        d.remove();
      }
      const u = byId("__tcLossNudge");
      if (u) {
        u.remove();
      }
      const p = byId(ids.tcProjBalRow);
      if (p) {
        p.remove();
      }
      if (window.__tcMenuOutside) {
        document.removeEventListener("pointerdown", window.__tcMenuOutside, true);
        delete window.__tcMenuOutside;
      }
      const h = byId("__tcMTF");
      if (h) {
        h.remove();
      }
      if (window.__tcMtfDrag) {
        window.removeEventListener("mousemove", window.__tcMtfDrag.onMouseMove);
        window.removeEventListener("touchmove", window.__tcMtfDrag.onTouchMove);
        window.removeEventListener("mouseup", window.__tcMtfDrag.end);
        window.removeEventListener("touchend", window.__tcMtfDrag.end);
        delete window.__tcMtfDrag;
      }
      if (window.__tcTimerGraph) {
        window.__tcTimerGraph.removeEventListener("mousemove", window.__tcTimerMouseMove);
        window.__tcTimerGraph.removeEventListener("mouseleave", window.__tcTimerMouseLeave);
        delete window.__tcTimerGraph;
      }
      delete window.__tcTimerMouseMove;
      delete window.__tcTimerMouseLeave;
      if (window.__tcLiveMouseMove) {
        document.removeEventListener("mousemove", window.__tcLiveMouseMove);
        delete window.__tcLiveMouseMove;
      }
      delete window.__tcLiveMX;
      delete window.__tcLiveMY;
      [
        ".Zt1hG",
        ".UI2Kh",
        ".omlQ2 b",
        ".lCITV",
        ".pVBHU",
        ".bvdd_",
        ".UloGw",
        ".lW6FD b",
        ".EalHv span",
      ].forEach((t) => {
        document.querySelectorAll(t).forEach((t) => {
          t.style.color = "";
          t.style.textShadow = "";
          t.style.fontWeight = "";
          t._tcClr = void 0;
          if (t._tcLiveTag) {
            const e = t._tcLiveTag.parentElement;
            t._tcLiveTag.remove();
            t._tcLiveTag = null;
            if (e && e._tcWasStatic) {
              e.style.position = "";
              delete e._tcWasStatic;
            }
          }
        });
      });
      document.querySelectorAll("." + ids.tcMonitored).forEach((t) => t.classList.remove(ids.tcMonitored));
      try {
        if (shadowHost && shadowHost.parentNode) {
          shadowHost.remove();
        }
      } catch (t) {}
      if (window.__tcMsgListener) {
        try {
          chrome.runtime.onMessage.removeListener(window.__tcMsgListener);
        } catch (t) {}
        delete window.__tcMsgListener;
      }
      delete window.__tcCleanup;
    };
    document.addEventListener("__tcToggle", window.__tcCleanup);
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Scheduler (v1.23.0): one 100 ms interval runs every periodic task, replacing three separate
    // intervals. Cleanup stops it through window.__tcScheduler. A failing task doesn't stop the others;
    // its error is rethrown asynchronously so it still shows up in the console.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const SCHEDULER_TICK_MS = 100;
    const scheduledTasks = [];
    function every(periodMs, fn) {
      // First run after one full period, like setInterval.
      scheduledTasks.push({ periodMs, fn, lastRun: Date.now() });
      if (window.__tcScheduler) {
        return;
      }
      window.__tcScheduler = setInterval(() => {
        const now = Date.now();
        for (const task of scheduledTasks) {
          // Small slack so a 200 ms task isn't pushed to 300 ms by timer jitter.
          if (now - task.lastRun < task.periodMs - SCHEDULER_TICK_MS / 2) {
            continue;
          }
          task.lastRun = now;
          try {
            task.fn();
          } catch (err) {
            setTimeout(() => {
              throw err;
            });
          }
        }
      }, SCHEDULER_TICK_MS);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Quotex DOM selectors + number/currency helpers
    // ⚠ Most entries are hashed CSS-module classes that rotate when Quotex ships a new build.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const SELECTORS = {
        balance: [".Zt1hG", ".pVBHU", ".account-balance__balance", ".account__balance", ".account-balance"],
        returnPct: [
          ".UI2Kh",
          "#tab-active .UloGw",
          ".UloGw",
          ".bvdd_",
          ".gDH53",
          ".payout-percent",
          ".asset-payout",
        ],
        payoutTotal: [".omlQ2 b", ".MYMK0 .lW6FD b", ".lW6FD b"],
        investment: [".GmATb span", ".EalHv span"],
        tradeButtons: ["#trade-button button", ".hkjXJ button", ".bSenO button"],
        dealsRow: [".ib6yR", ".RLj1p"],
        dealsPnl: [".lCITV", ".saoxT"],
        dealsPair: [".RxOUE", ".JJ_i9"],
        settledFlag: [".Fqtla"],
        livePayoutPct: [".y8jJs"],
        liveDetail: [".esVdy"],
        timeframeCTA: [".HgaSf", ".M6Rz0 .Wy5Or"],
        timeframeMenu: [".kCc27", ".PY5Eb"],
        timeframeItem: [".Dy2a9", ".blYud"],
        historyRow: [".ib6yR", ".SDEZP"],
        assetDropdown: ["#asset-select-dropdown", ".a_IoG", ".yejPg", ".nu9IG"],
        assetAddButton: ["#asset-select--button button", "#asset-select--button"],
        assetRow: [".vPvlJ", ".R2Rgm", ".fZEV1"],
        assetRowName: [".e4qZ6 span", ".Z2fyK", ".pC7xL"],
        assetRowPayout: [".mQX6T span", ".bQodW span", ".dkV9n span"],
        assetRowClick: [".e4qZ6", ".vPvlJ"],
        investmentBtns: [".deal-amount-input .VK9Nw", ".deal-amount-input .YqVwL"],
        amountInput: [".deal-amount-input input.input-control__input", ".deal-amount-input input"],
        expiryBox: [".NEJ1S"],
        expiryToggle: [".NEJ1S .EWNJc"],
        tabClose: [".LtauB", ".rGA6o"],
        chartClose: ["#graph canvas", "canvas.layer.plot", "#graph"],
        chartCanvas: ["#graph canvas.layer.plot", "#graph canvas", "#graph"],
        chartBox: ["#graph"],
      },
      queryFirstWithin = (t, e) => {
        if (!t) {
          return null;
        }
        for (let n = 0; n < e.length; n++) {
          const o = t.querySelector(e[n]);
          if (o) {
            return o;
          }
        }
        return null;
      },
      selectorCache = {};
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Settings storage (v1.27.0)
    // Values live in localStorage, which the page can read on its own origin. Thirty keys named
    // "__tradeCalc_*" announced the extension (and survived uninstalling it), so each name is now an
    // opaque hash. The values are unchanged; old keys are imported once and deleted.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    function prefKey(name) {
      let h = 2166136261;
      for (let i = 0; i < name.length; i++) {
        h ^= name.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return "q" + (h >>> 0).toString(36) + name.length.toString(36);
    }
    function prefGet(name) {
      try {
        return localStorage.getItem(prefKey(name));
      } catch (t) {
        return null;
      }
    }
    function prefSet(name, value) {
      try {
        localStorage.setItem(prefKey(name), value);
      } catch (t) {}
    }
    function prefRemove(name) {
      try {
        localStorage.removeItem(prefKey(name));
      } catch (t) {}
    }
    (function migrateLegacyPrefs() {
      try {
        for (const key of Object.keys(localStorage)) {
          if (!/^__tradeCalc_|^tc_pos$/.test(key)) {
            continue;
          }
          const value = localStorage.getItem(key);
          if (value != null && localStorage.getItem(prefKey(key)) == null) {
            localStorage.setItem(prefKey(key), value);
          }
          localStorage.removeItem(key);
        }
      } catch (t) {}
    })();
    // v1.65.1: settings and state left behind by features removed in v1.65.0 - the sheet journal, the
    // loss-streak lock, the marquee, and the popup's journal-scale and post-TP-gap controls. Nothing reads
    // them any more; they are removed so nothing of those features stays in the site's storage. Runs after
    // the legacy migration above, so an old unhashed copy is converted first and then removed with the rest.
    // Idempotent: once they are gone it removes nothing. `__tradeCalc_mtf_count` is NOT here - it is still
    // the starting zoom for a timeframe that has never been scrolled.
    (function dropRemovedFeatureKeys() {
      for (const name of [
        "__tradeCalc_journal_cache",
        "__tradeCalc_journal_goal_cache",
        "__tradeCalc_sheet_url",
        "__tradeCalc_journal_fz",
        "__tradeCalc_loss_streak",
        "__tradeCalc_seen_trades",
        "__tradeCalc_streak_date",
        "__tradeCalc_last_loss_ts",
        "__tradeCalc_sys_lock_disabled",
        "__tradeCalc_sl_post_tp_gap",
        "__tradeCalc_marquee_msg",
        "__tradeCalc_marquee_speed",
        // v1.66.0: the trade-history tags and the section show/hide toggles.
        "__tradeCalc_entry_tags",
        "__tradeCalc_visibility",
        // v1.67.0: the per-day SL backup. __tradeCalc_sl is NOT here - it is the SL itself.
        "__tradeCalc_sl_ls_date",
        "__tradeCalc_sl_ls_value",
        "__tradeCalc_sl_ls_init_bal",
        "__tradeCalc_sl_ls_trail",
        "__tradeCalc_sl_ls_tp_lock",
        "__tradeCalc_sl_ls_tp_lock_date",
        // v1.69.0: the x/÷ box, its factor, and the popup switches that became permanent.
        "__tradeCalc_im_shown",
        "__tradeCalc_step_mult",
        "__tradeCalc_hk_leftright",
        "__tradeCalc_chip_pos",
        "__tradeCalc_relabel_demo",
        // v1.83.0: the mobile bar's position.
        "__tradeCalc_mobile_pos_v3",
      ]) {
        prefRemove(name);
      }
    })();
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Self-repairing element lookup (v1.22.0)
    // Order: last element (if still attached) → learned selector → SELECTORS (hashed classes) →
    // semantic finder (ids, visible text, attributes). When only the semantic finder works, the
    // element's current class is learned and stored, so the next lookup is a cheap querySelector again.
    // `selectorVia[name]` records which strategy won, for the health report.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const KEY_LEARNED_SELECTORS = "__tradeCalc_learned_selectors";
    let learnedSelectors = (() => {
      try {
        const v = JSON.parse(prefGet(KEY_LEARNED_SELECTORS) || "{}");
        return v && typeof v == "object" ? v : {};
      } catch (t) {
        return {};
      }
    })();
    const selectorVia = {};
    const textOf = (el) => (el && el.textContent ? el.textContent.trim() : "");
    // v1.57.0: search that crosses OPEN shadow roots. Quotex has started moving parts of the page into
    // custom elements, and `document.querySelectorAll` stops dead at a shadow boundary - so a finder that
    // only walks the light DOM goes blind the moment a component appears, which is exactly what happened
    // to the account block. A CLOSED root cannot be read by anyone, which is what the store is for; an
    // OPEN one stays findable, and this keeps the semantic layer working across those.
    const SHADOW_MAX_DEPTH = 5;
    function deepQueryAll(selector, root, depth) {
      const out = [];
      const scope = root || document;
      try {
        scope.querySelectorAll(selector).forEach((el) => out.push(el));
      } catch (t) {}
      if ((depth || 0) >= SHADOW_MAX_DEPTH) {
        return out;
      }
      try {
        scope.querySelectorAll("*").forEach((el) => {
          // Never our own root. In the page it is closed and unreachable anyway, but the test harness
          // forces every root open, and a finder that wandered into our UI would read it as Quotex's.
          if (el.shadowRoot && el !== shadowHost) {
            deepQueryAll(selector, el.shadowRoot, (depth || 0) + 1).forEach((found) => out.push(found));
          }
        });
      } catch (t) {}
      return out;
    }
    let assetListLookAt = 0,
      assetListLast = null;
    // The page's largest canvas, at least 200 px wide: Quotex's chart is one canvas and nothing else on the
    // page comes near its size.
    function largestCanvas() {
      let best = null,
        bestArea = 0;
      for (const c of document.querySelectorAll("canvas")) {
        if (isOurElement(c)) {
          continue;
        }
        const r = c.getBoundingClientRect(),
          w = r.width || c.clientWidth || 0,
          h = r.height || c.clientHeight || 0;
        if (w >= 200 && w * h > bestArea) {
          best = c;
          bestArea = w * h;
        }
      }
      return best;
    }
    // A box a trader can type a search into: a visible text input that is not ours and not a time.
    const hasSearchBox = (box) =>
      Array.from(box.querySelectorAll("input")).some((i) => !isOurElement(i) && i.type !== "hidden" && !CLOCK_VALUE_RE.test((i.value || "").trim()));
    // v1.80.0: the controls showing a plus (icon or "+") nearest the pair tabs, nearest first: the tab strip's
    // own block, then up to three blocks out, stopping before one holding the chart or the Up / Down buttons.
    // Never a link, nothing with a word on it ("Deposit"), nothing in a field (the amount's and expiry's +).
    function plusBesideTabs() {
      const tabs = getPairTabs();
      if (!tabs.length) {
        return [];
      }
      const chart = getChartBox(),
        trade = tradeButtonsBlock();
      const clickable = (el) => el.closest("button, [role='button']") || el;
      const ok = (el) =>
        !isOurElement(el) && !tabs.some((t) => t.contains(el)) && !el.closest("a[href], fieldset, .deal-amount-input") && !/[A-Za-z]{2,}/.test(textOf(el));
      let scope = tabs[0].parentElement;
      for (let i = 0; i < 4 && scope && scope !== document.body; i++, scope = scope.parentElement) {
        if ((chart && scope.contains(chart)) || (trade && scope.contains(trade))) {
          break;
        }
        const icons = Array.from(scope.querySelectorAll('svg.icon-plus, svg[class*="icon-plus"], use[href*="plus"], use[xlink\\:href*="plus"]')).map(
          (el) => clickable(el.closest("svg") || el),
        );
        const signs = Array.from(scope.querySelectorAll("button, [role='button'], div, span")).filter((el) => el.children.length <= 1 && /^\+$/.test(textOf(el)));
        const found = [...icons, ...signs].map(clickable).filter((el, k, all) => ok(el) && all.indexOf(el) === k);
        if (found.length) {
          // Nearest the tabs first: the first one after the last tab, then the rest in reverse page order.
          const last = tabs[tabs.length - 1];
          const after = found.filter((el) => last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
          return [...after, ...found.filter((el) => !after.includes(el)).reverse()];
        }
      }
      return [];
    }
    // v1.80.0: a remembered name is checked before it is used, and forgotten if it no longer fits - a name
    // learned from a wrong guess would otherwise be tried first for ever.
    const LEARNED_CHECKS = {
      assetDropdown: (el) => hasSearchBox(el) && !getPairTabs().some((t) => el.contains(t)),
      assetAddButton: (el) => plusBesideTabs().includes(el.closest("button, [role='button']") || el),
    };
    // Quotex's chart block: "#graph", a remembered name, or the block around the largest canvas.
    function getChartBox() {
      return findEl("chartBox");
    }
    const CLOCK_VALUE_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;
    // The inputs of Quotex's trade panel: those in the few blocks around the Up / Down buttons.
    function tradePanelInputs() {
      let panel = tradeButtonsBlock();
      for (let i = 0; i < 4 && panel && panel.parentElement && panel.parentElement !== document.body; i++) {
        panel = panel.parentElement;
        if (panel.querySelectorAll("input").length >= 2) {
          break;
        }
      }
      return panel ? Array.from(panel.querySelectorAll("input")).filter((el) => !isOurElement(el) && el.type !== "hidden") : [];
    }
    const SEMANTIC_FINDERS = {
      // The balance sits next to the "Live Account" / "Demo Account" label.
      balance: () => {
        const label = deepQueryAll("div").find(
          (d) => d.children.length === 0 && /^(Live|Demo) Account$/.test(textOf(d)),
        );
        if (label && label.nextElementSibling) {
          return label.nextElementSibling;
        }
        // Any site language (v1.24.0): a money value ("₹15,228.00") right after a short text label
        // near the top of the page, which is the account block's shape.
        return (
          deepQueryAll("div").find((d) => {
            if (d.children.length !== 0 || !/^[^\d\s]{1,3}\s?\d[\d,.\s]*\d$/.test(textOf(d))) {
              return false;
            }
            const prev = d.previousElementSibling;
            return !!prev && prev.children.length === 0 && /\D/.test(textOf(prev)) && d.getBoundingClientRect().top < 100;
          }) || null
        );
      },
      // Payout % inside the active pair tab (e.g. "79 %").
      returnPct: () => {
        const tab = activePairTab();
        if (!tab) {
          return null;
        }
        return Array.from(tab.querySelectorAll("*")).find((el) => el.children.length === 0 && /^\d{1,3}\s*%$/.test(textOf(el))) || null;
      },
      // <p>Payout</p> … <b>3,580 ₹</b>
      payoutTotal: () => {
        const p = Array.from(document.querySelectorAll("p")).find((el) => textOf(el).toLowerCase() === "payout");
        if (p && p.parentElement && p.parentElement.querySelector("b")) {
          return p.parentElement.querySelector("b");
        }
        // Any site language (v1.24.0): the <p>label</p> + <b>amount</b> block above the Up/Down buttons.
        const trade = tradeButtonsBlock();
        for (let el = trade && trade.previousElementSibling; el; el = el.previousElementSibling) {
          const b = el.querySelector(":scope > b");
          if (b && el.querySelector(":scope > p") && /\d/.test(textOf(b))) {
            return b;
          }
        }
        return null;
      },
      tradeButtons: () => getTradeButtons()[0] || null,
      // v1.77.0 (self-healing, step 2): the pair list - the block holding several asset rows (a pair name and
      // a payout %) that is not the pair tabs, the chart or the trade buttons. A full walk of the page, so it
      // runs at most every 1.5 s, or every 150 ms for the 5 s after "+" was pressed.
      assetDropdown: () => {
        const now = Date.now(),
          busy = now - lastPlusAt < 5000;
        // v1.80.2: between walks, the list last found while it is still on the page - reported live, "no list"
        // here made an open list look closed for a moment, and auto-open pressed "+" a second time.
        if (now - assetListLookAt < (busy ? 150 : 1500)) {
          return assetListLast && assetListLast.isConnected ? assetListLast : null;
        }
        assetListLookAt = now;
        const tabs = getPairTabs(),
          avoid = [...tabs, getChartBox(), tradeButtonsBlock()].filter(Boolean);
        const rows = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n && rows.length < 60; n = walker.nextNode()) {
          if (!/\d{2,3}\s*%/.test(n.textContent || "")) {
            continue;
          }
          for (let el = n.parentElement, hop = 0; el && hop < 4; el = el.parentElement, hop++) {
            if (PAIR_TEXT_RE.test(el.textContent || "")) {
              // A row is small: a pair and its payout, never a block holding the tabs, chart or buttons.
              const small = (el.textContent || "").length <= 120 && !avoid.some((a) => el.contains(a));
              if (small && !isOurElement(el) && !avoid.some((a) => a.contains(el)) && !rows.includes(el)) {
                rows.push(el);
              }
              break;
            }
          }
        }
        if (rows.length < 3) {
          return null;
        }
        // v1.80.0: the list is the block around three or more rows that also holds its search box. Reported
        // live: without that, a block that is always on the page (rows of pairs and percents) was taken for
        // the list, so the list never looked closed - and the close steps kept pressing "+".
        let best = null,
          bestCount = 0;
        for (const r of rows) {
          for (let box = r.parentElement, hop = 0; box && box !== document.body && hop < 8; box = box.parentElement, hop++) {
            if (avoid.some((a) => box.contains(a))) {
              break;
            }
            const count = rows.filter((x) => box.contains(x)).length;
            if (count >= 3 && hasSearchBox(box)) {
              if (count > bestCount) {
                best = box;
                bestCount = count;
              }
              break;
            }
          }
        }
        assetListLast = best;
        return best;
      },
      // The "+" that opens the pair list. v1.80.0: only the plus nearest the pair tabs - reported live, the first plus icon on the page was the
      // deposit button in the header, so R opened the deposit window.
      assetAddButton: () => plusBesideTabs()[0] || null,
      // The button that opens the timeframe menu: the one element on the page showing a single timeframe
      // label ("1m", "15s") - the open menu shows several side by side, and is not it.
      timeframeCTA: () => {
        const labels = leafMatches(document, TF_LABEL_RE, isVisible).filter((el) => !isOurElement(el));
        const lone = labels.find((el) => {
          const siblings = el.parentElement ? Array.from(el.parentElement.children).filter((c) => TF_LABEL_RE.test(textOf(c))) : [];
          return siblings.length < 3;
        });
        return lone ? lone.closest("button, [role='button']") || lone : null;
      },
      // v1.78.0 (self-healing, step 3): the amount box - its "Investment" label, else, in any language, the
      // box in the trade panel (around the Up / Down buttons) holding an amount or a percent: never the one
      // holding a time, which is the expiry. Its old second name matched the expiry box first.
      amountInput: () => {
        const legend = Array.from(document.querySelectorAll("legend")).find((el) => textOf(el).toLowerCase() === "investment");
        const field = legend && legend.closest("fieldset");
        if (field && field.querySelector("input")) {
          return field.querySelector("input");
        }
        return tradePanelInputs().find((el) => !CLOCK_VALUE_RE.test(el.value.trim()) && /\d/.test(el.value) && !isNaN(parseMoney(el.value))) || null;
      },
      // The expiry box: the block around the box holding a time (18:14, or 00:01:00 as a timer).
      expiryBox: () => {
        const input = tradePanelInputs().find((el) => CLOCK_VALUE_RE.test(el.value.trim()));
        if (!input) {
          return null;
        }
        const field = input.closest("fieldset");
        return (field && field.parentElement) || (input.parentElement && input.parentElement.parentElement) || null;
      },
      // The expiry's Time / Timer switch: the one control in the expiry box outside the time field and its
      // - / + steppers. Nothing is pressed unless there is exactly one.
      expiryToggle: () => {
        const box = findEl("expiryBox", { cache: false });
        const input = box && box.querySelector("input");
        const field = input && (input.closest("fieldset") || input.parentElement);
        if (!box || !field) {
          return null;
        }
        const others = Array.from(box.querySelectorAll("button, [role='button']")).filter((el) => !field.contains(el));
        return others.length === 1 ? others[0] : null;
      },
      // v1.79.0 (self-healing): the chart - the largest canvas on the page - and the block holding it. Until
      // now both were known only as "#graph"; a rename would have taken the chips and the chart clicks with it.
      chartCanvas: () => largestCanvas(),
      chartBox: () => {
        const c = largestCanvas();
        return (c && c.parentElement) || null;
      },
    };
    // A selector that finds `el` first in the document: its first class, or parent class + tag.
    function selectorFor(el) {
      const cssEscape = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, "\\$&"));
      const candidates = [];
      if (el.classList && el.classList.length) {
        candidates.push("." + cssEscape(el.classList[0]));
      }
      const parent = el.parentElement;
      if (parent && parent.classList && parent.classList.length) {
        candidates.push("." + cssEscape(parent.classList[0]) + " > " + el.tagName.toLowerCase());
      }
      return candidates.find((sel) => {
        try {
          return document.querySelector(sel) === el;
        } catch (t) {
          return false;
        }
      });
    }
    function forgetLearned(name) {
      if (learnedSelectors[name]) {
        delete learnedSelectors[name];
        try {
          prefSet(KEY_LEARNED_SELECTORS, JSON.stringify(learnedSelectors));
        } catch (t) {}
      }
    }
    function learnSelector(name, el) {
      const sel = selectorFor(el);
      if (!sel || (learnedSelectors[name] && learnedSelectors[name].sel === sel)) {
        return;
      }
      learnedSelectors[name] = { sel, at: new Date().toISOString() };
      try {
        prefSet(KEY_LEARNED_SELECTORS, JSON.stringify(learnedSelectors));
      } catch (t) {}
    }
    function findEl(e, o) {
      const r = !o || o.cache !== false;
      if (r) {
        const t = selectorCache[e];
        if (t && t.isConnected) {
          return t;
        }
      }
      let via = "missing";
      let a = null;
      const learned = learnedSelectors[e];
      if (learned) {
        try {
          a = document.querySelector(learned.sel);
        } catch (t) {}
        if (a && LEARNED_CHECKS[e] && !LEARNED_CHECKS[e](a)) {
          a = null;
          delete learnedSelectors[e];
          try {
            prefSet(KEY_LEARNED_SELECTORS, JSON.stringify(learnedSelectors));
          } catch (t) {}
        }
        if (a) {
          via = "learned";
        }
      }
      if (!a) {
        const list = SELECTORS[e] || [];
        for (let i = 0; i < list.length && !a; i++) {
          a = document.querySelector(list[i]);
        }
        if (a) {
          via = "class";
        }
      }
      if (!a && SEMANTIC_FINDERS[e]) {
        try {
          a = SEMANTIC_FINDERS[e]();
        } catch (t) {
          a = null;
        }
        if (a) {
          via = "semantic";
          learnSelector(e, a);
        }
      }
      selectorVia[e] = via;
      if (r) {
        selectorCache[e] = a;
      }
      return a;
    }
    // Same idea as findEl but for groups of elements (deal rows, asset rows, menu items) — v1.25.0.
    // learned selector -> known classes -> a finder that matches on shape and text. Records how it
    // resolved (for the health check) and learns the current class when only the finder worked.
    const listVia = {};
    // "On screen" without relying on layout boxes: a hidden ancestor sets display/visibility, and a
    // headless DOM reports no boxes at all.
    const isVisible = (el) => {
      if (!el) {
        return false;
      }
      if (el.offsetWidth || el.offsetHeight || el.getClientRects().length) {
        return true;
      }
      try {
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden";
      } catch (t) {
        return true;
      }
    };
    function resolveList(name, scope, selectors, semantic) {
      const root = scope || document;
      const learned = learnedSelectors["list:" + name];
      if (learned) {
        try {
          const hit = Array.from(root.querySelectorAll(learned.sel));
          if (hit.length) {
            listVia[name] = "learned";
            return hit;
          }
        } catch (t) {}
      }
      for (const sel of selectors) {
        const hit = Array.from(root.querySelectorAll(sel));
        if (hit.length) {
          listVia[name] = "class";
          return hit;
        }
      }
      let found = [];
      try {
        found = semantic ? semantic(root) || [] : [];
      } catch (t) {
        found = [];
      }
      if (found.length) {
        listVia[name] = "semantic";
        const sel = found[0].classList && found[0].classList.length ? "." + found[0].classList[0] : null;
        if (sel) {
          try {
            if (Array.from(root.querySelectorAll(sel)).length === found.length) {
              learnedSelectors["list:" + name] = { sel, at: new Date().toISOString() };
              prefSet(KEY_LEARNED_SELECTORS, JSON.stringify(learnedSelectors));
            }
          } catch (t) {}
        }
        return found;
      }
      listVia[name] = "missing";
      return [];
    }
    // A trade row shows a pair name and a mm:ss countdown; a menu item is just a short label.
    const PAIR_TEXT_RE = /[A-Z]{3}\/[A-Z]{3}|OTC/;
    const TF_TEXT_RE = /^\d+\s*[smhd]$/i;
    const TIME_TEXT_RE = /^\d{1,2}:\d{2}$/;
    const CLOCK_ONLY_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;
    const textIn = (el) => (el && el.textContent ? el.textContent.trim() : "");
    // v1.45.0: anything WE put on the page is not evidence about the platform. The S/R rail carries
    // timeframe labels, and the semantic timeframe-menu finder promptly read its own chips as Quotex's
    // menu. Our page-level pieces all carry ids built from one random token, so they are recognised by
    // that prefix - no marker attribute, nothing new for the page to notice.
    function isOurElement(el) {
      try {
        return !!(el && el.closest && el.closest('[id^="x' + idToken + '"]'));
      } catch (t) {
        return false;
      }
    }
    function leafMatches(root, re, extra) {
      return Array.from(root.querySelectorAll("div, span, button, li")).filter(
        (el) => el.children.length === 0 && !isOurElement(el) && re.test(textIn(el)) && (!extra || extra(el)),
      );
    }

    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Quotex data layer (v1.22.0): plain values from Quotex's own Redux store, answered by
    // chart_reader.js in the page's MAIN world. The CustomEvent round trip is synchronous (DOM event
    // dispatch runs listeners in every world before returning). Returns null when the bridge or chart
    // isn't available; callers always keep a DOM fallback. Event names are literals here because the
    // MTF constants are declared further down.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const STATE_TTL_MS = 250,
      ASSETS_TTL_MS = 5000;
    let quotexState = null,
      quotexStateAt = 0,
      quotexAssets = null,
      quotexAssetsAt = 0,
      quotexStateSeq = 0;
    function requestQuotexState(withAssets) {
      const id = "state-" + ++quotexStateSeq;
      let raw = null;
      const onRes = (ev) => {
        try {
          if (ev.detail && ev.detail.id === id) {
            raw = ev.detail.data;
          }
        } catch (t) {}
      };
      document.addEventListener("__tcChartRes", onRes);
      try {
        document.dispatchEvent(new CustomEvent("__tcChartReq", { detail: { id, kind: "state", assets: !!withAssets } }));
      } catch (t) {}
      document.removeEventListener("__tcChartRes", onRes);
      if (typeof raw !== "string") {
        return null;
      }
      try {
        const state = JSON.parse(raw);
        return state && state.v === 1 ? state : null;
      } catch (t) {
        return null;
      }
    }
    function readQuotexState() {
      const now = Date.now();
      if (now - quotexStateAt >= STATE_TTL_MS) {
        quotexState = requestQuotexState(false);
        quotexStateAt = now;
      }
      return quotexState;
    }
    // symbol -> { label, payout, isOtc, active }, refreshed every 5 s - or now, when `fresh` is asked for
    // (v1.86.0: a refill decides on the figures as they are when the close ends, not up to 5 s before).
    function readQuotexAssets(fresh) {
      const now = Date.now();
      if (fresh || now - quotexAssetsAt >= ASSETS_TTL_MS) {
        const state = requestQuotexState(true);
        quotexAssets = state && state.assets ? state.assets : null;
        quotexAssetsAt = now;
      }
      return quotexAssets;
    }
    // Account timezone (v1.24.0): Quotex's `global.timeZone` is the UTC offset in seconds the account uses
    // (19800 = UTC+5:30, seen live). The last known value is cached so the trading day doesn't jump if the
    // store isn't reachable yet; IST is the fallback, matching every earlier version.
    const KEY_TZ_OFFSET = "__tradeCalc_tz_offset_sec",
      DEFAULT_TZ_OFFSET_SEC = 19800;
    let cachedTzOffsetSec = (() => {
      try {
        const v = parseInt(prefGet(KEY_TZ_OFFSET), 10);
        return Number.isFinite(v) && Math.abs(v) <= 14 * 3600 ? v : DEFAULT_TZ_OFFSET_SEC;
      } catch (t) {
        return DEFAULT_TZ_OFFSET_SEC;
      }
    })();
    function accountTzOffsetMs() {
      const state = readQuotexState();
      const sec = state ? state.timeZone : null;
      if (typeof sec == "number" && Number.isFinite(sec) && Math.abs(sec) <= 14 * 3600 && sec !== cachedTzOffsetSec) {
        cachedTzOffsetSec = sec;
        try {
          prefSet(KEY_TZ_OFFSET, String(sec));
        } catch (t) {}
      }
      return cachedTzOffsetSec * 1000;
    }
    const isDemoPage = () => /\/demo-trade(\/|\?|$)/.test(location.pathname);
    // Deals for the account this page shows (demo or live). Deals without an isDemo flag are kept.
    function dealsForThisAccount(list) {
      const mode = isDemoPage() ? 1 : 0;
      return (list || []).filter((d) => d && (d.isDemo == null || d.isDemo === mode));
    }
    function storeOpenTradeCount() {
      const state = readQuotexState();
      return state ? dealsForThisAccount(state.openedDeals).length : NaN;
    }
    // Open trades for the max-trades cap: the higher of the page count and the store count, because
    // for a cap over-counting is the safe side.
    function openTradeCount() {
      // v1.34.0: Quotex's own data decides. Taking the HIGHEST of the page and the store let stale markup
      // outvote the platform: a settled deal keeps its row, and when no deal cells exist at all the pair
      // tabs' own P/L cells stood in for them - so a page with nothing running reported two open trades.
      // That silently ate the trade cap and held the chart auto-fill off with "a trade is open".
      const store = storeOpenTradeCount();
      if (!isNaN(store)) {
        return store;
      }
      return Math.max(getOpenTradePnlEls().length, getOpenTradeRows().length);
    }
    // Open trades straight from Quotex's data (v1.25.0): pair, seconds left, winning/losing and the
    // amount a win would return. Independent of the platform's markup, so the chart countdown chips, the
    // tab-title countdown and the live totals keep working when the deal-list classes rotate.
    // command 0 = Up, 1 = Down (checked against 10 settled trades live on 2026-09-18).
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.75.0: a trade's seconds left, the way Quotex shows it - and kept right by itself
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Reported live: the chip's countdown did not match Quotex's own for the same trade in their trade
    // history. The chip counted against this computer's clock (Quotex counts against its server's) and
    // rounded to the nearest second. Now, in order:
    //  1. Quotex's own number, from the trade's row in their trade history, when that row is on screen. The
    //     row is matched to the trade by pair and by time, and only taken if it agrees with the trade's close
    //     time to within a couple of seconds - so a finished row or some other clock on the page is never
    //     copied, which is what made the rows the second source in v1.34.0.
    //  2. Otherwise the close time against Quotex's server clock (the chart's own time, read every quote),
    //     rounded the way Quotex's rows were seen to round.
    // Every agreeing row teaches the rounding, so the fallback keeps matching Quotex even if they change it.
    // The rows are found by the self-repairing finders (class first, then by what a deal row holds).
    const TRADE_ROW_AGREE_SEC = 2.5;
    const serverClock = { samples: [], lastServer: NaN, offset: NaN };
    // How far Quotex's clock is ahead of this computer's, in seconds. Sampled only when the chart's time has
    // moved (a frozen chart in a hidden tab would otherwise drag it down); the highest of the last 10 s is
    // kept, because the chart's time is that of its latest quote and trails the server's by up to one quote.
    function serverClockOffset(state) {
      const now = Date.now();
      if (state && typeof state.serverTime === "number" && typeof state.readAt === "number" && state.serverTime !== serverClock.lastServer) {
        serverClock.lastServer = state.serverTime;
        const off = state.serverTime - state.readAt / 1000;
        if (Math.abs(off) < 3600) {
          serverClock.samples.push({ at: now, off });
        }
      }
      serverClock.samples = serverClock.samples.filter((p) => now - p.at < 10000).slice(-120);
      if (serverClock.samples.length) {
        serverClock.offset = Math.max(...serverClock.samples.map((p) => p.off));
      }
      return isNaN(serverClock.offset) ? 0 : serverClock.offset;
    }
    // v1.75.2: how Quotex turns seconds left into the number it shows, learnt from its own rows. Read live on
    // 1.75.1: by Quotex's clock a trade had 8.84 s left while its row showed 00:10 - their number runs about
    // 0.2 s ahead of a plain round-up, so a fixed "up or down" rule was one second out at times. Instead, one
    // shift s is learnt such that rounding up (seconds left + s) gives their number. Each agreeing row says s
    // lies in (shown - 1 - left, shown - left], widened by 0.15 s for the moment their text takes to update;
    // the overlap of all of them is kept and its middle used. Rounding down is the same with s near -1, so
    // either way it is learnt. A row that cannot fit the overlap means their clock or rounding changed: the
    // learning starts again from that row.
    const TRADE_SHIFT_SLACK = 0.15;
    const tradeShift = { lo: -Infinity, hi: Infinity, rows: 0, restarts: 0 };
    function learnTradeShift(shown, exact) {
      const lo = shown - 1 - exact - TRADE_SHIFT_SLACK,
        hi = shown - exact + TRADE_SHIFT_SLACK,
        nlo = Math.max(tradeShift.lo, lo),
        nhi = Math.min(tradeShift.hi, hi);
      if (nlo < nhi) {
        tradeShift.lo = nlo;
        tradeShift.hi = nhi;
      } else {
        tradeShift.lo = lo;
        tradeShift.hi = hi;
        tradeShift.restarts++;
      }
      tradeShift.rows++;
    }
    const tradeShiftNow = () => (tradeShift.rows ? (tradeShift.lo + tradeShift.hi) / 2 : 0);
    const roundSecondsLeft = (exact) => Math.max(0, Math.ceil(exact + tradeShiftNow()));
    // Quotex's trade history, read at most every 200 ms: [{ secs, pair, text }] for each open trade's row.
    let tradeRowsCache = { at: 0, rows: [] };
    function tradeHistoryCountdowns() {
      const now = Date.now();
      if (now - tradeRowsCache.at < 200) {
        return tradeRowsCache.rows;
      }
      const rows = [];
      let found = [];
      try {
        // The row finders are set up further down the panel; before that there is simply nothing to read.
        found = getOpenTradeRows();
      } catch (e) {}
      for (const row of found) {
        const clock = row.querySelector(".PiYD4") || row.querySelector(".xEiET") || row.querySelector(".wcb43") || findClockEl(row);
        const text = clock ? (clock.textContent || "").trim() : "";
        const secs = /^\d{1,2}:\d{2}(:\d{2})?$/.test(text) ? parseClock(text) : NaN;
        if (isNaN(secs)) {
          continue;
        }
        const nameEl =
          row.querySelector(".DBihS") || row.querySelector(".RxOUE") || row.querySelector(".JJ_i9") ||
          Array.from(row.querySelectorAll("*")).find((el) => el.children.length === 0 && PAIR_TEXT_RE.test(el.textContent || ""));
        rows.push({ secs, text, pair: nameEl ? normKey(nameEl.textContent) : "" });
      }
      tradeRowsCache = { at: now, rows };
      return rows;
    }
    // What the diagnostics line reports about the last pass.
    let tradeClockNote = "no trade open";
    function tradeSecondsLeft(deals, labelOf) {
      const state = readQuotexState(),
        offset = serverClockOffset(state),
        nowMs = Date.now(),
        now = nowMs / 1000 + offset,
        rows = tradeHistoryCountdowns(),
        // How much longer every trade had when those rows were read (v1.80.1).
        rowsAge = (nowMs - tradeRowsCache.at) / 1000,
        used = new Set(),
        notes = [];
      const out = deals.map((d) => {
        if (!d.closeTimestamp) {
          return { secs: NaN, via: "no close time" };
        }
        const exact = d.closeTimestamp - now,
          pair = normKey(labelOf(d));
        let match = null,
          samePairOff = null;
        for (const r of rows) {
          if (used.has(r) || (r.pair && pair && r.pair !== pair)) {
            continue;
          }
          const off = Math.abs(r.secs - exact);
          if (off <= TRADE_ROW_AGREE_SEC) {
            if (!match || off < Math.abs(match.secs - exact)) {
              match = r;
            }
          } else if (r.pair && r.pair === pair && samePairOff == null) {
            samePairOff = Math.round((r.secs - exact) * 10) / 10;
          }
        }
        if (match) {
          used.add(match);
          // v1.80.1: the rows can be up to 200 ms old, and what a row says is what was left when it was read.
          // Learning it against the seconds left now pushed the shift up by as much as the 0.2 s it is there to
          // learn, so the fallback turned a second early.
          learnTradeShift(match.secs, exact + rowsAge);
          notes.push("Quotex shows " + match.text + " (copied)");
          return { secs: match.secs, via: "trade history" };
        }
        notes.push(
          samePairOff != null
            ? "its row is " + samePairOff + " s off the close time - not trusted, the clock is used"
            : rows.length
              ? "no row agrees - the clock is used"
              : "trade history not on screen - the clock is used",
        );
        return { secs: roundSecondsLeft(exact), via: "Quotex clock" };
      });
      tradeClockNote = deals.length
        ? "Quotex clock " + (offset >= 0 ? "+" : "") + offset.toFixed(2) + " s against this computer \u00b7 shift " +
          (tradeShiftNow() >= 0 ? "+" : "") + tradeShiftNow().toFixed(2) + " s learnt from " + tradeShift.rows + " rows" +
          (tradeShift.restarts ? " (" + tradeShift.restarts + " restarts)" : "") + " \u00b7 " + notes.join("; ")
        : "no trade open";
      return out;
    }
    function storeOpenTrades() {
      const state = readQuotexState();
      if (!state || !Array.isArray(state.openedDeals)) {
        return null;
      }
      const quotes = state.quotes || {};
      const assets = readQuotexAssets() || {};
      const deals = dealsForThisAccount(state.openedDeals),
        labelOf = (d) => (assets[d.asset] && assets[d.asset].label) || d.asset || "",
        left = tradeSecondsLeft(deals, labelOf);
      return deals.map((d, i) => {
        const price = quotes[d.asset];
        const isUp = d.command === 0;
        const winning =
          price == null || d.openPrice == null ? null : isUp ? price > d.openPrice : price < d.openPrice;
        const pct = d.percentProfit;
        return {
          id: d.id,
          symbol: d.asset,
          pair: labelOf(d),
          amount: d.amount,
          secondsLeft: left[i].secs,
          secondsVia: left[i].via,
          winning,
          // What the platform shows in the deal row while it runs: the full return on a win, 0 on a loss.
          liveReturn: winning && pct != null ? d.amount * (1 + pct / 100) : 0,
          // v1.34.0: what this trade pays IF it wins, whichever way it is currently going. The projection
          // chip needs this; it used to be derivable only from the deal row's markup.
          winReturn: pct != null && d.amount != null ? d.amount * (1 + pct / 100) : NaN,
        };
      });
    }
    // [winning, losing] for the tab title. Falls back to Quotex's data when the deal rows can't be read.
    function storeOutcomeFlags() {
      const fromStore = storeOpenTrades();
      if (!fromStore || !fromStore.length) {
        return null;
      }
      return [fromStore.some((t) => t.winning === true), fromStore.some((t) => t.winning === false)];
    }
    function storeAssetFor(tab) {
      const symbol = tab && tab.getAttribute && tab.getAttribute("data-symbol");
      const assets = symbol ? readQuotexAssets() : null;
      return assets && assets[symbol] ? assets[symbol] : null;
    }
    const NON_NUMERIC_RE = /[^\d.-]/g,
      TITLE_PREFIX_RE = /^(?:[🟢🔴]+\s*)?(?:⏱\d{1,2}:\d{2}(?::\d{2})?(?:\s*\(\d+\))?\s*)?/;
    let currencySymbol = "₹";
    function detectCurrency() {
      const state = readQuotexState();
      if (state && state.currency) {
        currencySymbol = state.currency;
        return currencySymbol;
      }
      const t =
        balanceEl && balanceEl.isConnected
          ? balanceEl
          : document.querySelector(".Zt1hG") ||
            document.querySelector(".pVBHU") ||
            document.querySelector(".account-balance__balance");
      if (t) {
        const e = t.textContent.match(/[₹$€£¥]/);
        if (e) {
          currencySymbol = e[0];
        }
      }
      return currencySymbol;
    }
    const isInr = () => detectCurrency() === "₹",
      fmtInr2 = new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      fmtInr0 = new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 0,
      }),
      fmtUsd2 = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      fmtUsd0 = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }),
      fmtMoney = (t) => (isInr() ? fmtInr2 : fmtUsd2).format(t),
      fmtMoney0 = (t) => (isInr() ? fmtInr0 : fmtUsd0).format(t);
    const docBody = document.body,
      shadowHost = document.createElement("div"),
      shadow = shadowHost.attachShadow({
        mode: "closed",
      });
    if (docBody) {
      docBody.appendChild(shadowHost);
    }
    const idToken = (() => {
        let t = "";
        for (let e = 0; e < 8; e++) {
          t += "abcdefghijklmnopqrstuvwxyz"[Math.floor(26 * Math.random())];
        }
        return t;
      })(),
      ids = {};
    [
      "tcProjBalRow",
      "tcTradeTimer",
      "tcProjChip",
      "tcPlacedBal",
      "tcMonitored",
    ].forEach((t, e) => {
      ids[t] = "x" + idToken + (e + 1).toString(36);
    });
    const byId = (t) => shadow.getElementById(t) || document.getElementById(t),
      qs = (t) => shadow.querySelector(t) || document.querySelector(t),
      activeEl = () => shadow.activeElement || document.activeElement,
      parseNum = (t) => (t ? parseFloat(t.replace(NON_NUMERIC_RE, "")) : NaN),
      parseMoney = parseNum,
      parsePct = parseNum,
      AudioCtor = window.AudioContext || window.webkitAudioContext,
      isMobileWidth = () => window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    // Stamped by tools/build.mjs at build time. The manifest version says which extension is
    // INSTALLED; this says which code the tab is actually running. They differ when the extension was
    // reloaded but the Quotex tab was never refreshed — which looks exactly like "the fix did nothing".
    const BUILD_VERSION = "__TC_BUILD_VERSION__";
    function normKey(t) {
      return t ? t.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    }
    // v1.28.0: the element is focused and the full pointer sequence is sent at the element's own
    // coordinates, so the events look like a real click in every field. `isTrusted` still reads false —
    // no extension can set it — which is what "focus mode" (hkFocusMode) avoids entirely.
    const synthClick = (t) => {
      if (!t) {
        return;
      }
      const rect = t.getBoundingClientRect ? t.getBoundingClientRect() : null;
      const x = rect ? Math.round(rect.left + rect.width / 2) : 0;
      const y = rect ? Math.round(rect.top + rect.height / 2) : 0;
      const base = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        detail: 1,
        button: 0,
        clientX: x,
        clientY: y,
        screenX: x + (window.screenX || 0),
        screenY: y + (window.screenY || 0),
      };
      const pointer = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true, width: 1, height: 1, pressure: 0.5 };
      try {
        if (typeof t.focus == "function") {
          t.focus({ preventScroll: true });
        }
      } catch (e) {}
      t.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, buttons: 1 }));
      t.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
      t.dispatchEvent(new PointerEvent("pointerup", { ...pointer, buttons: 0, pressure: 0 }));
      t.dispatchEvent(new MouseEvent("mouseup", base));
      const e = new MouseEvent("click", base);
      e._tcFired = true;
      t.dispatchEvent(e);
    };
    // v1.29.0: writes a value into a platform input the way typing does. `execCommand("insertText")`
    // is carried out by the browser's own editing pipeline, so the `input` event it produces reads
    // `isTrusted: true`; a constructed `new Event("input")` reads false and marks the change as
    // scripted. Live-verified on qxbroker.com 2026-09-19: the deal amount took the value and
    // reformatted it ("3 %" -> "4 %"). Falls back to the old native-setter path if the command is
    // unavailable or the field refuses it, so the feature never depends on it.
    const typeInto = (el, text) => {
      if (!el) {
        return false;
      }
      // Success is judged on the VALUE, not on execCommand's return: the field reformats what it
      // takes ("4" -> "4 %", "1516.5" -> "1,516.50"), so compare numerically and allow for rounding.
      const num = (t) => parseFloat(String(t == null ? "" : t).replace(NON_NUMERIC_RE, ""));
      try {
        el.focus({ preventScroll: true });
        if (typeof el.select == "function") {
          el.select();
        } else if (typeof el.setSelectionRange == "function") {
          el.setSelectionRange(0, String(el.value || "").length);
        }
        if (document.execCommand("insertText", false, text) && Math.abs(num(el.value) - num(text)) < 0.01) {
          try {
            el.blur();
          } catch (e) {}
          return true;
        }
      } catch (e) {}
      try {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, String(text));
        el.dispatchEvent(
          new Event("input", {
            bubbles: true,
          }),
        );
        el.dispatchEvent(
          new Event("change", {
            bubbles: true,
          }),
        );
      } catch (e) {}
      try {
        el.blur();
      } catch (e) {}
      return false;
    };
    let pairTabsVia = "missing";
    function getPairTabs() {
      let t = Array.from(document.querySelectorAll(".dJ15T, .pPomf"));
      if (t.length > 0) {
        pairTabsVia = "class";
        return t;
      }
      const bySymbol = getPairTabsBySymbol();
      if (bySymbol.length) {
        pairTabsVia = "semantic";
        return bySymbol;
      }
      const byText = getPairTabsByText();
      if (byText.length) {
        pairTabsVia = "semantic";
        return byText;
      }
      pairTabsVia = "heuristic";
      const e =
        document.getElementById("tab-active") ||
        document.querySelector('[id*="active"]') ||
        document.querySelector(".tab-active") ||
        document.querySelector('[class*="tab--active"]');
      if (e && e.parentElement) {
        const n = e.parentElement;
        t = Array.from(n.children).filter((t) => {
          if (
            t.querySelector(".LtauB") ||
            t.querySelector(".rGA6o") ||
            t.classList.contains("dJ15T") ||
            t.classList.contains("pPomf")
          ) {
            return true;
          }
          const e = t.textContent || "",
            n = /[A-Z]{3}\/[A-Z]{3}/.test(e) || e.includes("OTC"),
            o = /\d+%/.test(e);
          return (
            n ||
            o ||
            t.id === "tab-active" ||
            t.classList.contains("tab-active") ||
            t.className.includes("active")
          );
        });
        if (t.length > 0) {
          return t;
        }
      }
      t = Array.from(document.querySelectorAll('[class*="tab"]')).filter((t) => {
        if (t.closest("#__tradeCalc")) {
          return false;
        }
        const e = t.textContent || "",
          n = /[A-Z]{3}\/[A-Z]{3}/.test(e) || e.includes("OTC"),
          o = /\d+%/.test(e);
        return n && o && t.tagName !== "SPAN" && t.tagName !== "A";
      });
      if (!t.length) {
        pairTabsVia = "missing";
      }
      return t;
    }
    // Pair tabs carry `data-symbol` (e.g. "USDDZD_otc"). Tabs may each sit in their own wrapper, so
    // climb from the active tab and use the ancestor level that holds the most tabs.
    // v1.80.0: without "#tab-active", the tab carrying the chart's own symbol (from Quotex's data) is the start.
    function getPairTabsBySymbol() {
      let active = document.getElementById("tab-active");
      if (!active) {
        const state = readQuotexState();
        const sym = state && state.symbol;
        active = sym ? Array.from(document.querySelectorAll("[data-symbol]")).find((el) => el.getAttribute("data-symbol") === sym && !isOurElement(el)) : null;
      }
      if (!active || !active.hasAttribute("data-symbol")) {
        return [];
      }
      return tabsAround(active, (scope) => Array.from(scope.querySelectorAll("[data-symbol]")));
    }
    // From one tab, the ancestor level (up to three up) that holds the most tabs - tabs may each sit in their
    // own wrapper - stopping before a block that also holds the chart or the Up / Down buttons.
    function tabsAround(active, tabsIn) {
      let best = [active];
      const chart = getChartBox(),
        trade = tradeButtonsBlock();
      let scope = active.parentElement;
      for (let i = 0; i < 3 && scope && scope !== document.body; i++, scope = scope.parentElement) {
        if ((chart && scope.contains(chart)) || (trade && scope.contains(trade))) {
          break;
        }
        const found = tabsIn(scope);
        if (found.length > best.length) {
          best = found;
        }
      }
      return best;
    }
    // The chart's pair name as Quotex labels it ("USD/DZD (OTC)"), from its data; "" without it.
    function currentPairLabel() {
      const state = readQuotexState(),
        assets = state && state.symbol ? readQuotexAssets() : null;
      const asset = assets && assets[state.symbol];
      return (asset && asset.label) || "";
    }
    // True when a leaf inside el reads exactly the given pair name.
    const showsPair = (el, label) => !!label && [el, ...el.querySelectorAll("*")].some((c) => c.children.length === 0 && textOf(c) === label);
    // v1.80.0 (self-healing): the pair tabs with no known name, no id and no data-symbol left - the small
    // blocks showing a pair name and a payout %, found from the one showing the chart's pair. When the pair
    // list is open it shows that pair too; its block holds far more rows, so the smaller group is the tabs.
    // A walk of the page, so the answer is kept for a second.
    let tabsByText = { at: 0, tabs: [] };
    function getPairTabsByText() {
      const now = Date.now();
      if (now - tabsByText.at < 1000 && tabsByText.tabs.every((t) => t.isConnected)) {
        return tabsByText.tabs;
      }
      tabsByText = { at: now, tabs: [] };
      const label = currentPairLabel();
      if (!label) {
        return [];
      }
      const blocks = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n && blocks.length < 300; n = walker.nextNode()) {
        const t = (n.nodeValue || "").trim();
        if (t.length > 30 || !PAIR_TEXT_RE.test(t)) {
          continue;
        }
        for (let el = n.parentElement, hop = 0; el && hop < 3; el = el.parentElement, hop++) {
          const text = textOf(el);
          if (text.length > 40) {
            break;
          }
          if (/\d{1,3}\s*%/.test(text)) {
            if (!isOurElement(el) && !blocks.includes(el)) {
              blocks.push(el);
            }
            break;
          }
        }
      }
      let best = [];
      for (const active of blocks.filter((b) => showsPair(b, label))) {
        const group = tabsAround(active, (scope) => blocks.filter((b) => scope.contains(b)));
        if (!best.length || group.length < best.length) {
          best = group;
        }
      }
      tabsByText.tabs = best;
      return best;
    }
    // The tab of the chart's pair.
    function activePairTab() {
      return document.getElementById("tab-active") || getPairTabs().find(isActiveTab) || null;
    }
    function getTabName(t) {
      if (!t) {
        return "";
      }
      const e =
        t.querySelector(".WRocw") ||
        t.querySelector(".l5ftG") ||
        t.querySelector(".pC7xL") ||
        t.querySelector('[class*="name"]');
      if (e && e.textContent.trim()) {
        return e.textContent.trim();
      }
      const asset = storeAssetFor(t);
      if (asset && asset.label) {
        return asset.label;
      }
      // v1.87.0 (self-healing): the name the tab itself prints comes before its id. Probed on a page with every
      // name changed and the pair code (`data-symbol`) gone: the one tab that had an id - the active one - was
      // named by that id ("zeQx"), so it matched neither its row in the list nor its pair in Quotex's data. A
      // pair name first, then any worded text that is not the payout (Gold, Bitcoin).
      const leaves = Array.from(t.querySelectorAll("*")).filter((c) => c.children.length === 0 && textOf(c) && !/%/.test(textOf(c)));
      const leaf = leaves.find((c) => PAIR_TEXT_RE.test(textOf(c))) || leaves.find((c) => /\p{L}{2}/u.test(textOf(c)));
      if (leaf) {
        return textOf(leaf);
      }
      const n = (t.textContent || "").match(/[A-Z]{3}\/[A-Z]{3}/);
      if (n) {
        return n[0] + (t.textContent.includes("OTC") ? " (OTC)" : "");
      }
      return t.id && t.id !== "tab-active" ? t.id : "";
    }
    // A pair tab's close control, or null when the tab has none.
    // v1.24.4: only real close controls count. The old last-resort guesses (any child whose HTML contains
    // "close" or even just the letter "x", or any svg inside a button) matched the tab's own content block on
    // the current Quotex build, whose tabs have no close button, only a dropdown caret. Clicking that opened
    // the asset selection panel, and auto-close repeated it every 300 ms: the "flickering" asset panel.
    function getTabCloseBtn(t) {
      if (!t) {
        return null;
      }
      const iconUse = t.querySelector(
        'use[href*="icon-close"], use[xlink\\:href*="icon-close"], use[href*="icon-cross"], use[xlink\\:href*="icon-cross"]',
      );
      const candidate =
        t.querySelector(".LtauB") ||
        t.querySelector(".rGA6o") ||
        Array.from(t.querySelectorAll("button[aria-label], [role='button'][aria-label]")).find((el) =>
          /close/i.test(el.getAttribute("aria-label")),
        ) ||
        (iconUse && iconUse.closest("button, [role='button'], span, div")) ||
        t.querySelector('svg[class*="icon-close"], svg[class*="icon-cross"]')?.closest("button, [role='button'], span, div") ||
        null;
      // Never the tab itself or a block holding the dropdown caret (that opens the asset panel).
      if (!candidate || candidate === t || candidate.querySelector('[class*="icon-caret"], use[href*="icon-caret"]')) {
        return null;
      }
      return candidate;
    }
    function tradesToTarget(t, e, n, o) {
      if (!t || !e || !n || !o || t <= 0 || e <= 0 || n <= 0 || o <= 0) {
        return null;
      }
      if (e <= t) {
        return 0;
      }
      const r = 1 + (n / 100) * (o / 100);
      return r <= 1 ? null : Math.ceil(Math.log(e / t) / Math.log(r));
    }
    let balanceEl = null,
      stakeInputCache = null,
      payoutPctEl = null;
    function readBalance() {
      balanceEl = findEl("balance");
      return balanceEl ? parseMoney(balanceEl.textContent) : NaN;
    }
    const stakeState = {
      val: NaN,
      isPercent: false,
    };
    function readStake() {
      var t, e;
      stakeInputCache = (t = stakeInputCache) && t.isConnected ? t : findEl("amountInput", { cache: false });
      if (!stakeInputCache) {
        stakeState.val = NaN;
        stakeState.isPercent = false;
        return stakeState;
      }
      const n = stakeInputCache.value;
      stakeState.val = parseMoney(n);
      stakeState.isPercent = n.includes("%");
      return stakeState;
    }
    function readPayoutPct() {
      const t = findEl("returnPct", {
        cache: false,
      });
      if (t && payoutPctEl && t !== payoutPctEl) {
        payoutPctEl.style.color = "";
        payoutPctEl.style.textShadow = "";
        payoutPctEl._tcClr = void 0;
      }
      payoutPctEl = t;
      const shown = payoutPctEl ? parsePct(payoutPctEl.textContent) : NaN;
      if (!isNaN(shown)) {
        return shown;
      }
      // The page is the source of truth for what the user sees; the store covers a missing element.
      const state = readQuotexState();
      return state && state.payout != null ? state.payout : NaN;
    }
    let payoutTotalEl = null,
      investmentEl = null;
    function readPayoutAndInvestment() {
      payoutTotalEl = findEl("payoutTotal");
      investmentEl = findEl("investment");
      let investment = investmentEl ? parseMoney(investmentEl.textContent) : NaN;
      if (isNaN(investment)) {
        investment = readInvestmentFromStakeInput();
      }
      return {
        payout: payoutTotalEl ? parseMoney(payoutTotalEl.textContent) : NaN,
        investment,
      };
    }
    // Hotfix v1.20.1: Quotex no longer renders a separate investment label (`.GmATb` / `.EalHv` match
    // nothing), which silently disabled the "trade would breach stop loss" guard and the win/loss
    // projection. The stake now only lives in the Investment field, so read it from there. A percent
    // stake ("2%") is converted to money using the account balance.
    // Deliberately not readStake(): its last-resort fallback takes the first `input.input-control__input`
    // on the page, which is the expiry Time field ("18:14" would read as 1814).
    function readInvestmentFromStakeInput() {
      const el = findEl("amountInput", { cache: false });
      if (!el) {
        return NaN;
      }
      const input = parseMoney(el.value);
      if (isNaN(input) || input <= 0) {
        return NaN;
      }
      if (!el.value.includes("%")) {
        return input;
      }
      const balance = readAccountBalance();
      return isNaN(balance) ? NaN : (balance * input) / 100;
    }
    let recalcQueued = false,
      tradingBlocked = false;
    function scheduleRecalc() {
      if (!recalcQueued) {
        recalcQueued = true;
        requestAnimationFrame(() => {
          recalcQueued = false;
          recalc();
        });
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Persisted settings (localStorage, mirrored to chrome.storage.sync where noted)
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const KEY_TP = "__tradeCalc_tb",
      KEY_SL = "__tradeCalc_sl",
      KEY_FONT_SIZE = "__tradeCalc_fz",
      KEY_MIN_PAYOUT = "__tradeCalc_minrp",
      KEY_THEME = "__tradeCalc_theme",
      getTheme = () => {
        try {
          return prefGet(KEY_THEME) || "dark";
        } catch (t) {
          return "dark";
        }
      },
      setThemeStored = (t) => {
        try {
          prefSet(KEY_THEME, t);
        } catch (t) {}
      },
      readJson = (t, e) => {
        try {
          const n = JSON.parse(prefGet(t));
          return n == null ? e : n;
        } catch (t) {
          return e;
        }
      },
      writeJson = (t, e) => {
        try {
          prefSet(t, JSON.stringify(e));
        } catch (t) {}
      },
      readFlag = (t, e) => {
        try {
          const n = prefGet(t);
          return n === null ? e : n !== "0";
        } catch (t) {
          return e;
        }
      },
      KEY_MONITOR_PAIRS = "__tradeCalc_monitor_pairs";
    let monitoredPairs = readJson(KEY_MONITOR_PAIRS, []);
    const TF_SECONDS = {
        "5s": 5,
        "10s": 10,
        "15s": 15,
        "30s": 30,
        "1m": 60,
        "2m": 120,
        "3m": 180,
        "5m": 300,
        "10m": 600,
        "15m": 900,
        "30m": 1800,
        "1h": 3600,
        "4h": 14400,
      },
      KEY_MTF_TFS = "__tradeCalc_mtf_tfs",
      KEY_MTF_VIEW = "__tradeCalc_mtf_view",
      KEY_MTF_COUNT = "__tradeCalc_mtf_count",
      KEY_MTF_CACHE = "__tradeCalc_mtf_cache",
      MTF_DEFAULT_TFS = ["1m", "5m", "15m"],
      tfSeconds = (t) =>
        TF_SECONDS[
          String(t || "")
            .trim()
            .toLowerCase()
        ] || 0;
    function parseTfList(t) {
      let e = t;
      if (typeof e == "string") {
        e = e.split(",");
      }
      if (!Array.isArray(e)) {
        return MTF_DEFAULT_TFS.slice();
      }
      const n = {},
        o = [];
      for (let t = 0; t < e.length; t++) {
        const r = String(e[t] || "")
          .trim()
          .toLowerCase();
        if (tfSeconds(r) && !n[r]) {
          n[r] = 1;
          o.push(r);
        }
      }
      o.sort((t, e) => tfSeconds(t) - tfSeconds(e));
      return o.length ? o.slice(0, 4) : MTF_DEFAULT_TFS.slice();
    }
    const clampMtfCount = (t) => {
        const e = parseInt(t, 10);
        return isNaN(e) ? 40 : Math.min(120, Math.max(10, e));
      },
      getMtfTfs = () => parseTfList(readJson(KEY_MTF_TFS, null)),
      setMtfTfs = (t) => writeJson(KEY_MTF_TFS, parseTfList(t)),
      // v1.65.0: the popup's "Candles per chart" slider is gone. This is now only the starting zoom for a
      // timeframe that has never been scrolled - every one that has keeps its own in KEY_MTF_ZOOM - and it
      // still honours a value set before the slider went.
      getMtfCount = () => {
        try {
          return clampMtfCount(prefGet(KEY_MTF_COUNT));
        } catch (t) {
          return 40;
        }
      },
      KEY_MTF_AUTOFILL = "__tradeCalc_mtf_autofill",
      KEY_MTF_SETTLE = "__tradeCalc_mtf_settle",
      KEY_MTF_ZOOM = "__tradeCalc_mtf_zoom",
      KEY_SR_TFS = "__tradeCalc_sr_tfs",
      // One colour per timeframe, so a level is read at a glance for what it is.
      SR_COLOURS = { "1m": "#5aa9ff", "2m": "#5aa9ff", "3m": "#5aa9ff", "5m": "#ffb454", "10m": "#ffb454", "15m": "#c792ea", "30m": "#c792ea", "1h": "#ff7ab6", "4h": "#ff7ab6" },
      // v1.44.0: the wheel sets how many candles a chart shows, per timeframe. Wider than the panel's own
      // "candles per chart" setting, which is the starting point rather than a limit.
      clampZoom = (t) => {
        const n = Math.round(t);
        return isNaN(n) ? 40 : Math.min(240, Math.max(8, n));
      },
      KEY_MTF_FLIP = "__tradeCalc_mtf_flip",
      KEY_MTF_FLIP_BARS = "__tradeCalc_mtf_flip_bars",
      // v1.39.0: how many closed bars decide which way a chart is pointing. Three is short enough to
      // matter on a 15s expiry and long enough not to call every other bar a turn.
      clampFlipBars = (t) => {
        const n = parseInt(t, 10);
        return isNaN(n) ? 3 : Math.min(10, Math.max(2, n));
      },
      getMtfFlipBars = () => {
        try {
          return clampFlipBars(prefGet(KEY_MTF_FLIP_BARS));
        } catch (t) {
          return 3;
        }
      },
      setMtfFlipBars = (t) => {
        try {
          prefSet(KEY_MTF_FLIP_BARS, String(clampFlipBars(t)));
        } catch (t) {}
      },
      KEY_DIAG = "__tradeCalc_diag",
      // v1.33.0: how long a pair has to stay on screen before its charts are filled. v1.36.0 makes the
      // default 0 — the charts fill the moment you open the pair. Flicking through tabs is handled by the
      // pending pair being overwritten as you go, so only the one you land on is walked; set a wait here
      // if you would rather it hold off.
      clampMtfSettle = (t) => {
        const n = parseInt(t, 10);
        return isNaN(n) ? 0 : Math.min(120, Math.max(0, n));
      },
      getMtfSettle = () => {
        try {
          return clampMtfSettle(prefGet(KEY_MTF_SETTLE));
        } catch (t) {
          return 0;
        }
      },
      setMtfSettle = (t) => {
        try {
          prefSet(KEY_MTF_SETTLE, String(clampMtfSettle(t)));
        } catch (t) {}
      },
      parsePlainNumber = (t) => parseFloat(String(t).replace(/,/g, "")),
      // v1.71.0: whole numbers on the bar (TP, SL) - the decimals were noise. What is saved is what was
      // typed; only the display is rounded.
      fmtInputMoney = (t) => {
        const e = parseFloat(t);
        return isNaN(e) ? "" : fmtMoney0(e);
      },
      getTpStored = () => {
        try {
          return prefGet(KEY_TP) || "";
        } catch (t) {
          return "";
        }
      },
      setTpStored = (t) => {
        try {
          prefSet(KEY_TP, t);
        } catch (t) {}
      },
      KEY_TP_MANUAL_DATE = "__tradeCalc_tp_manual_date",
      getTpManualDate = () => {
        try {
          return prefGet(KEY_TP_MANUAL_DATE) || "";
        } catch (t) {
          return "";
        }
      },
      setTpManualDate = (t) => {
        try {
          prefSet(KEY_TP_MANUAL_DATE, t);
        } catch (t) {}
      },
      setSlStored = (t) => {
        try {
          prefSet(KEY_SL, t);
        } catch (t) {}
      },
      getFontSizeStored = () => {
        try {
          return prefGet(KEY_FONT_SIZE) || "16";
        } catch (t) {
          return "16";
        }
      },
      getMinPayoutStored = () => {
        try {
          return prefGet(KEY_MIN_PAYOUT) || "89";
        } catch (t) {
          return "89";
        }
      },
      setMinPayoutStored = (t) => {
        try {
          prefSet(KEY_MIN_PAYOUT, t);
        } catch (t) {}
      },
      KEY_OTC_AUTO = "__tradeCalc_otc_auto",
      setOtcAutoStored = (t) => {
        try {
          prefSet(KEY_OTC_AUTO, t ? "true" : "false");
        } catch (t) {}
      };
    let otcAuto = (() => {
      try {
        return prefGet(KEY_OTC_AUTO) === "true";
      } catch (t) {
        return false;
      }
    })();
    const KEY_TIMER_X = "__tradeCalc_timer_x",
      KEY_TIMER_Y = "__tradeCalc_timer_y",
      clampPercent = (t, e) => {
        const n = parseFloat(t);
        return isNaN(n) ? e : Math.max(0, Math.min(100, n));
      },
      setTimerXStored = (t) => {
        try {
          prefSet(KEY_TIMER_X, String(clampPercent(t, 50)));
        } catch (t) {}
      },
      setTimerYStored = (t) => {
        try {
          prefSet(KEY_TIMER_Y, String(clampPercent(t, 90)));
        } catch (t) {}
      };
    let timerX = (() => {
        try {
          return clampPercent(prefGet(KEY_TIMER_X), 50);
        } catch (t) {
          return 50;
        }
      })(),
      timerY = (() => {
        try {
          return clampPercent(prefGet(KEY_TIMER_Y), 90);
        } catch (t) {
          return 90;
        }
      })();
    const KEY_HK_UPDOWN = "__tradeCalc_hk_updown",
      setHkUpDownStored = (t) => {
        try {
          prefSet(KEY_HK_UPDOWN, t ? "true" : "false");
        } catch (t) {}
      };
    let hkUpDown = (() => {
      try {
        return prefGet(KEY_HK_UPDOWN) === "true";
      } catch (t) {
        return false;
      }
    })();
    const KEY_MAX_TWO = "__tradeCalc_max_two",
      KEY_MAX_TRADES = "__tradeCalc_max_trades",
      clampMaxTrades = (t) => {
        const e = parseInt(t, 10);
        return isNaN(e) ? 2 : Math.max(1, Math.min(4, e));
      },
      setMaxTradesStored = (t) => {
        try {
          prefSet(KEY_MAX_TRADES, String(clampMaxTrades(t)));
        } catch (t) {}
      };
    let maxTrades = (() => {
      try {
        const t = prefGet(KEY_MAX_TRADES);
        return t != null && t !== "" ? clampMaxTrades(t) : prefGet(KEY_MAX_TWO) === "0" ? 4 : 2;
      } catch (t) {
        return 2;
      }
    })();
    // Trades let through but not yet in Quotex's data (v1.72.5, see effectiveOpenTrades).
    const PENDING_TRADE_MS = 3000;
    let pendingTrades = [];
    const KEY_BAL_LOGGED_DATE = "__tradeCalc_bal_logged_date",
      KEY_NATIVE_LIMIT_LOCK_DATE = "__tradeCalc_native_limit_lock_date";
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Account label spoof: rewrites "Live Account" as "Demo Account" everywhere
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const KEY_HK_FOCUS_MODE = "__tradeCalc_hk_focus_mode";
    // Off by default: ↑/↓ keep placing the trade directly.
    let hkFocusMode = readFlag(KEY_HK_FOCUS_MODE, false);
    // v1.30.0: fill a pair's empty charts once, by itself. On by default; one switch in the ⚙ menu.
    let mtfAutofill = readFlag(KEY_MTF_AUTOFILL, true);
    // { "1m": 60, "15m": 25 } — a timeframe with no entry uses the panel's own count.
    let mtfZoom = readJson(KEY_MTF_ZOOM, {}) || {};
    // { "1m": true, "5m": false } - a timeframe with no entry is shown.
    let srShown = readJson(KEY_SR_TFS, {}) || {};
    const srOn = (tf) => srShown[tf] !== false;
    function setSrShown(tf, on) {
      srShown[tf] = !!on;
      try {
        writeJson(KEY_SR_TFS, srShown);
      } catch (t) {}
    }
    const srColour = (tf) => SR_COLOURS[tf] || "#9fb3d9";
    function cellCount(cell) {
      const tf = cell && cell.getAttribute && cell.getAttribute("data-tf");
      const z = tf && mtfZoom[tf];
      return z > 0 ? clampZoom(z) : getMtfCount();
    }
    function setCellZoom(tf, n) {
      if (!tf) {
        return;
      }
      mtfZoom[tf] = clampZoom(n);
      try {
        writeJson(KEY_MTF_ZOOM, mtfZoom);
      } catch (t) {}
    }
    function widestZoom() {
      let most = 0;
      for (const tf in mtfZoom) {
        const z = clampZoom(mtfZoom[tf]);
        if (z > most) {
          most = z;
        }
      }
      return most;
    }
    // v1.39.0: mark a chart when it turns. On by default; it only ever adds a mark, never a trade.
    let mtfFlipOn = readFlag(KEY_MTF_FLIP, true);
    function setMtfFlip(on) {
      mtfFlipOn = !!on;
      try {
        prefSet(KEY_MTF_FLIP, mtfFlipOn ? "1" : "0");
      } catch (t) {}
    }
    // The label, exactly as frozen in v1.54.4: a DIV whose own text node reads "Live Account". v1.59.1
    // tried matching on the words wherever they appeared and had to be reverted - it renamed the account
    // switcher's own row for the live account, leaving two entries both reading "Demo Account". Being
    // unable to tell two accounts apart is a worse failure than the relabel being quiet.
    // v1.69.0: always on - the popup switch is gone.
    function spoofLiveAccountLabel() {
      const found = [];
      try {
        const x = document.evaluate("//div[text()='Live Account']", document, null, 7, null);
        for (let i = 0; i < x.snapshotLength; i++) {
          found.push(x.snapshotItem(i));
        }
      } catch (t) {}
      for (const n of found) {
        n.setAttribute("data-tc-relabel", "1");
        n.textContent = "Demo Account";
        n.style.color = "#ff8a00";
        const o = n.parentElement?.parentElement;
        if (o) {
          const t = o.querySelector("svg");
          if (t?.parentElement) {
            t.parentElement.innerHTML =
              '<svg class="icon-academic"><use xlink:href="/profile/images/spritemap.svg#icon-academic"></use></svg>';
          }
        }
      }
    }
    // v1.59.0: no cover here. v1.58.0 painted our own label over Quotex's account component, because
    // their 2026-09-23 build put theirs inside a closed shadow root where the rewrite above cannot reach
    // it. Reverted at the user's request: covering their UI to win back a cosmetic relabel was not worth
    // what it cost, and the two attempts at it both looked wrong on the real page.
    //
    // The consequence is plain: while Quotex keeps that label inside a closed component, "Show Live as
    // Demo" has nothing to rewrite and does nothing on a live account. The tab-title cover still works.
    // If a later build puts the label back in the page, the rewrite below starts working again by itself.
    spoofLiveAccountLabel();
    // Re-applied after DOM additions by the shared page observer (see "Page observer" below).
    let spoofQueued = false;
    function onPageMutationsForSpoof(t) {
      if (!spoofQueued) {
        for (let e = 0; e < t.length; e++) {
          if (t[e].addedNodes.length > 0) {
            spoofQueued = true;
            requestAnimationFrame(() => {
              spoofQueued = false;
              spoofLiveAccountLabel();
            });
            return;
          }
        }
      }
    }
    (function () {
      if (!isMobileWidth()) {
        return;
      }
      const t = document.querySelector('meta[name="viewport"]');
      if (!window.__tcViewportMeta) {
        window.__tcViewportMeta = t || document.createElement("meta");
        window.__tcViewportMetaOld = t ? t.getAttribute("content") : null;
        if (!t) {
          window.__tcViewportMeta.name = "viewport";
          document.head.appendChild(window.__tcViewportMeta);
        }
      }
      window.__tcViewportMeta.setAttribute("content", "width=device-width,initial-scale=1");
    })();
    // v1.65.0: the payout overlay was sized by a "Journal Scale" slider (as was the SL setup screen, removed in
    // v1.67.0). Fixed at 20px, which is what it was set to and what it defaulted to.
    const MODAL_FONT_PX = 20;
    let panelFontSize = parseInt(getFontSizeStored(), 10) || 16,
      isLightTheme = getTheme() === "light";
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Styles: design tokens + panel CSS (shadow root), font import + Quotex tweaks (page head)
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.24.0 (B11): the design tokens used to be a `:root { --tc-* }` block in the page's <head>, readable by
    // any page script (getComputedStyle(document.documentElement)). They now live on the shadow host
    // (`:host`); the two chart chips outside the shadow root get them as inline custom properties. Only the
    // font import stays in <head> (fonts can't be declared inside a shadow root), with no id.
    const TOKEN_VARS_CSS =
      ":host { --s-1: 0.25em; --s-2: 0.5em; --s-3: 0.75em; --s-4: 1em; --s-5: 1.25em; --s-6: 1.5em; --s-7: 1.75em; --s-8: 2em; --density: 1; --fz-label: 0.769em; --fz-body: 1em; --fz-value: 1.154em; --fz-value-lg: 1.385em; --fz-decimal: 0.833em; --fz-pl: 1.538em; --fz-currency: 1.692em; --fz-hero: 1.5em; --tc-grn: #7ddc8f; --tc-red: var(--color-red, oklch(64% 0.18 25)); --tc-amb: var(--color-yellow, oklch(80% 0.15 75)); --tc-ylw: var(--color-yellow, oklch(90% 0.17 95)); --tc-blu: var(--color-blue, oklch(72% 0.16 250)); --tc-pur: oklch(72% 0.14 285); --tc-cyn: oklch(80% 0.13 210); --tc-accent: #d0bcff; --m3-primary: #d0bcff; --m3-on-primary: #381e72; --m3-primary-cont: #4f378b; --m3-on-primary-cont: #eaddff; --m3-surface: #1c1b20; --m3-surface-2: #262529; --m3-surface-3: #302f34; --m3-on-surface: #e6e0e9; --m3-on-surface-var: #cac4d0; --m3-outline: #938f99; --m3-outline-var: #48464c; --m3-green: #7ddc8f; --m3-error: #f2b8b5; --m3-shape-xs: 0.25em; --m3-shape-sm: 0.5em; --m3-shape-md: 0.75em; --m3-shape-lg: 1em; --m3-shape-xl: 1.75em; --m3-shape-full: 999px; --m3-elev-1: 0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15); --m3-elev-2: 0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15); --m3-elev-3: 0 1px 3px rgba(0,0,0,.3), 0 4px 8px 3px rgba(0,0,0,.15); --tc-bg: var(--m3-surface-2); --tc-sec-bg: transparent; --tc-sec-border: var(--m3-outline-var); --tc-text-pri: var(--m3-on-surface); --tc-text-dim: var(--m3-on-surface-var); --tc-text-mut: oklch(from var(--m3-on-surface-var) l c h / 0.78); --tc-btn-text: var(--m3-on-primary); --tc-input-bg: var(--m3-surface-3); --tc-input-border: var(--m3-outline-var); --tc-hover-bg: oklch(from var(--tc-accent) l c h / 0.08); --tc-hover-border: var(--m3-outline); --tc-panel-shadow: var(--m3-elev-2); }";
    const TOKEN_VARS = Array.from(TOKEN_VARS_CSS.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)).map((m) => [m[1], m[2].trim()]);
    function applyTokenVars(el) {
      for (const [name, value] of TOKEN_VARS) {
        el.style.setProperty(name, value);
      }
    }
    {
      // v1.27.0: no webfont request from their page — it was a stylesheet they never asked for. The
      // panel falls back to the system UI font.
      const tokens = document.createElement("style");
      tokens.textContent = TOKEN_VARS_CSS;
      shadow.appendChild(tokens);
    }
    if (!shadow.getElementById("__tcStyles")) {
      const t = document.createElement("style");
      t.id = "__tcStyles";
      t.innerHTML =
        " #__tradeCalc { position: fixed; top: 5px; right: 375px; width: max-content; min-height: 3.5em; max-width: 90em; border-radius: 999px; z-index: 2147483647; font-size: 13px; font-family: 'DM Sans', system-ui, sans-serif; background: var(--tc-bg); box-shadow: var(--tc-panel-shadow); display: flex; align-items: center; padding: 0.3em 1.5em; gap: 0; cursor: default; user-select: none; overflow: visible; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); } #__tradeCalc.dragging { transition: none; cursor: grabbing; } .tcGrip { display: flex; align-items: center; flex-shrink: 0; pointer-events: none; width: 0.7em; height: 1.1em; color: var(--m3-on-surface-var); opacity: 0.4; } .tcGrip svg { width: 100%; height: 100%; } .tcGripLeft { margin-right: 0.7em; } .tcVer { align-self: center; font-size: max(9px, 0.58em); font-weight: 800; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; color: var(--tc-text-mut); opacity: 0.65; cursor: default; } .tcGripRight { margin-left: 0.7em; } #__tcContent { display: flex; align-items: stretch; flex: 1; gap: 0.75em; scrollbar-width: none; } #__tcContent::-webkit-scrollbar { display: none; } .tcSec { display: flex; flex-direction: row; align-items: stretch; background: transparent; border: none; flex:1; padding: 0; gap: 0; position: relative; flex-shrink: 0; } #__tcSecTargets { cursor: grab; } #__tcSecProtections { margin-left: auto; margin-right: auto; } #__tcSecProjections { } .tcSec:has([data-tc-tip]:hover) { z-index: 100; } [data-tc-tip] { position: relative; } [data-tc-tip]::after { content: attr(data-tc-tip); position: absolute; top: calc(100% + 0.46em); left: 50%; white-space: nowrap; pointer-events: none; background: oklch(16% 0.02 257 / 0.98); color: oklch(96% 0.01 240); font-size: max(11px, 0.72em); font-weight: 600; letter-spacing: 0.04em; text-transform: none; padding: 0.4em 0.7em; border-radius: 0.42em; border: 1px solid oklch(100% 0 0 / 0.14); box-shadow: 0 4px 12px oklch(0% 0 0 / 0.45); opacity: 0; transition: opacity 0.18s, transform 0.18s; transform: translateX(-50%) translateY(-0.31em); z-index: 2147483647; } [data-tc-tip]::before { content: ''; position: absolute; top: calc(100% + 0.15em); left: 50%; transform: translateX(-50%); border: 0.31em solid transparent; border-bottom-color: oklch(16% 0.02 257 / 0.98); pointer-events: none; opacity: 0; transition: opacity 0.18s; z-index: 2147483647; } [data-tc-tip]:hover, [data-tc-tip]:focus-visible { z-index: 2147483646; } [data-tc-tip]:hover::after, [data-tc-tip]:focus-visible::after { opacity: 1; transform: translateX(-50%) translateY(0); } [data-tc-tip]:hover::before, [data-tc-tip]:focus-visible::before { opacity: 1; } #__tcSecTargets [data-tc-tip]::after { left: 0; transform: translateY(-0.31em); } #__tcSecTargets [data-tc-tip]:hover::after, #__tcSecTargets [data-tc-tip]:focus-visible::after { transform: translateY(0); } #__tcSecTargets [data-tc-tip]::before { left: 0.7em; transform: none; } .tcSecFields { display: flex; align-items: stretch; gap: 0.6em; flex: 1; position: relative; } .tcFld { display: flex; flex-direction: column; gap: 0.25em; position: relative; flex:1;} .tcFld > .tcLbl { min-height: 0; display: flex; align-items: center; padding-bottom: 0; font-weight: bold; flex: 0 0 auto; } .tcFld > *:not(.tcLbl) { margin-top: auto; margin-bottom: auto; } .tcLbl { font-size: var(--fz-label); text-transform: uppercase; color: var(--tc-text-mut); font-weight: 500; letter-spacing: 0.16em; line-height: 1; white-space: nowrap; display: flex; align-items: center; gap: 0.3em; } .tcLbl svg { opacity: 0.75; } .tcLbl .tcDot { display: none; } .tcVal { font-family: 'DM Mono', monospace; font-size: var(--fz-value); color: var(--tc-text-pri); font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums; transition: color 0.3s, text-shadow 0.3s; letter-spacing: 0.031em; white-space: nowrap; } .tcValLg { font-family: 'DM Mono', monospace; font-size: var(--fz-value-lg); font-weight: 400; color: var(--tc-text-pri); letter-spacing: 0.015em; line-height: 1; font-variant-numeric: tabular-nums; transition: text-shadow 0.3s; } .tcValLg .tcDec { color: var(--tc-text-mut); font-weight: 400; font-size: var(--fz-decimal); letter-spacing: 0.015em; margin-left: 0.05em; } .tcValLg[style*=\"--tc-grn\"] { text-shadow: 0 0 18px oklch(76% 0.16 145 / 0.4); } .tcValLg[style*=\"--tc-red\"] { text-shadow: 0 0 18px oklch(64% 0.18 25 / 0.4); } .tcProjMarks { display: none; } .tcProjMark { width: 1.077em; height: 0.154em; border-radius: 0.231em; background: oklch(76% 0.16 145 / 0.18); } .tcProjMark.tcProjMarkFill { background: var(--tc-grn); box-shadow: 0 0 6px oklch(76% 0.16 145 / 0.5); } .tcControlGroup { display: inline-flex; align-items: center; gap: 0.18em; background: var(--m3-surface-3); box-shadow: none; border: 1px solid var(--m3-outline-var); border-radius: var(--m3-shape-full); padding: 0.25em 0.8em; min-height: 1.3em; box-sizing: border-box; transition: border-color 0.2s, border-width 0.1s; overflow: visible; } .tcControlGroup:hover:not(:focus-within) { border-color: var(--m3-outline); } .tcControlGroup:focus-within { border: 1px solid var(--tc-accent); padding: calc(0.25em - 1px) calc(0.6em - 1px); } #__tcSLInputWrap, #__tcSLInputWrap:hover, #__tcSLInputWrap:focus-within { border-color: var(--m3-outline-var); padding: 0.25em 0.8em; } #__tcSLInput { cursor: default; } .tcInput { font-family: 'DM Mono', monospace; font-size: 1em; color: var(--m3-on-surface); background: transparent; border: none; outline: none; padding: 0; font-weight: 400; font-variant-numeric: tabular-nums; min-width: 0; letter-spacing: 0.031em; -moz-appearance: textfield; } .tcInput::-webkit-outer-spin-button, .tcInput::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .tcInput::placeholder { color: var(--m3-on-surface-var); opacity: 0.7; } .tcInput:-webkit-autofill, .tcInput:-webkit-autofill:hover, .tcInput:-webkit-autofill:focus, .tcInput:-webkit-autofill:active { -webkit-box-shadow: 0 0 0 100px transparent inset !important; box-shadow: 0 0 0 100px transparent inset !important; -webkit-text-fill-color: var(--m3-on-surface) !important; background-color: transparent !important; transition: background-color 99999s ease-in-out 0s; } .tcInput.tcUnsaved { border-bottom-color: var(--tc-ylw) !important; color: var(--tc-ylw) !important; } .tcControlGroup:has(.tcUnsaved)::after { content: \"↵ Enter\"; position: absolute; bottom: -1.35em; left: 0; font-size: max(8px, 0.5em); font-weight: 700; letter-spacing: 0.08em; color: var(--tc-ylw); white-space: nowrap; pointer-events: none; opacity: 0.9; } .tcPill { width: 2.308em; height: 2.308em; border-radius: 50%; background: transparent; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; min-width: 0; color: var(--m3-on-surface-var); transition: background 0.14s, color 0.15s, border-color 0.2s, box-shadow 0.2s; } .tcPill svg { width: 1.15em; height: 1.15em; } .tcPill:hover { background: oklch(from var(--tc-accent) l c h / 0.08); color: var(--m3-on-surface); } .tcPill:active { background: oklch(from var(--tc-accent) l c h / 0.12); transform: scale(0.94); } .tcPill:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; } .tcPill.on, #__tcMultiStatus.on { color: var(--tc-grn); border-color: oklch(from var(--tc-grn) l c h / 0.4); box-shadow: 0 0 10px oklch(from var(--tc-grn) l c h / 0.35); } .tcPill.tcPillSnap { animation: __tcPillSnap 0.22s cubic-bezier(0.16, 1, 0.3, 1); } .tcPillCircle::after { content: none !important; } .tcPillCircle, .tcLogBtn { border-radius: 50%; background: transparent; box-shadow: none; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--m3-on-surface-var); transition: background 0.14s, color 0.15s; } .tcPillCircle:hover, .tcLogBtn:hover { transform: none; background: oklch(from var(--tc-accent) l c h / 0.08); color: var(--m3-on-surface); } .tcPillCircle:active, .tcLogBtn:active { background: oklch(from var(--tc-accent) l c h / 0.12); box-shadow: none; } .tcPillCircle:focus-visible, .tcLogBtn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; } .tcPillCircle { width: 1.733em; height: 1.733em; min-width: 0; padding: 0; align-self: center; font-weight: 500; font-size: var(--fz-value); line-height: 1; font-family: 'DM Sans', system-ui, sans-serif; } .tcLogBtn { width: 2.308em; height: 2.308em; padding: 0; font-size: 1em; } .tcLogBtn svg { width: 1.077em; height: 1.077em; } .tcCloseBtn { position: absolute; right: -0.4em; top: 50%; transform: translateY(-50%); width: 1.5em; height: 1.5em; border-radius: 50%; background: var(--m3-surface-3); border: 1px solid var(--m3-outline-var); color: var(--m3-on-surface-var); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; box-shadow: none; transition: color 0.2s, opacity 0.2s, background 0.2s; opacity: 0; } .tcCloseBtn::before { content: \"\"; position: absolute; inset: 50% 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); border-radius: 50%; } #__tradeCalc:hover .tcCloseBtn, .tcCloseBtn:focus-visible { opacity: 1; } .tcCloseBtn:hover { background: var(--tc-red); color: oklch(98% 0 0); border-color: transparent; box-shadow: 0 3px 10px oklch(64% 0.18 25 / 0.4); transform: translateY(-50%); } .tcCloseBtn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; opacity: 1; } .tcCloseBtn:focus-visible:hover { transform: translateY(-50%) rotate(90deg); transition: background 0.25s, color 0.25s, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); } .tcSparklineBg { position: absolute; inset: 0; opacity: 0.22; pointer-events: none; border-radius: inherit; overflow: hidden; z-index: 0; mask-image: linear-gradient(to bottom, black 20%, transparent); -webkit-mask-image: linear-gradient(to bottom, black 20%, transparent); } @keyframes __tcDataFlash { 0% { color: var(--tc-accent); transform: translateY(-1px); } 100% { color: inherit; transform: translateY(0); } } .tcFlashData { animation: __tcDataFlash 0.55s cubic-bezier(0.16, 1, 0.3, 1); display: inline-block; } @keyframes tcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes __tcEntrance { 0% { opacity: 0; transform: scale(0.92) translateY(16px); filter: blur(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } } #__tradeCalc.tcLightMode { --tc-grn: #146c2e; --tc-red: oklch(44% 0.18 25); --tc-amb: oklch(44% 0.16 60); --tc-ylw: oklch(52% 0.17 70); --tc-pur: oklch(42% 0.16 285); --tc-cyn: oklch(40% 0.13 210); --tc-accent: #6750a4; --m3-surface: #fef7ff; --m3-surface-2: #f4eefa; --m3-surface-3: #ece6f0; --m3-on-surface: #1d1b20; --m3-on-surface-var: #49454f; --m3-outline: #79747e; --m3-outline-var: #cac4d0; --m3-primary: #6750a4; --m3-on-primary: #ffffff; --tc-text-pri: var(--m3-on-surface); --tc-text-dim: var(--m3-on-surface-var); --tc-text-mut: oklch(from var(--m3-on-surface-var) l c h / 0.78); --tc-input-bg: var(--m3-surface-3); --tc-input-border: var(--m3-outline-var); --tc-bg: var(--m3-surface-2); --tc-panel-shadow: var(--m3-elev-2); background: var(--tc-bg); } #__tradeCalc.tcLightMode .tcControlGroup { background: var(--m3-surface-3); border-color: var(--m3-outline-var); } #__tradeCalc.tcLightMode .tcPillCircle, #__tradeCalc.tcLightMode .tcLogBtn, #__tradeCalc.tcLightMode .tcPill { background: transparent; border-color: transparent; } #__tcDangerOverlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; background: radial-gradient(circle at center, transparent 0%, oklch(0% 0 0 / 0.88) 100%); opacity: 0; transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1); } .tcLockContent { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; padding: var(--s-6); border-radius: 1.4em; background: var(--tc-bg); border: 1px solid var(--tc-sec-border); box-shadow: 0 48px 120px oklch(0% 0 0 / 0.8), inset 0 1px 1px oklch(100% 0 0 / 0.2); } .tcLockLabel { display: block; font-size: 0.78em; font-weight: 900; text-transform: uppercase; letter-spacing: 0.28em; color: var(--tc-text-mut); margin-bottom: var(--s-5); opacity: 1; } .tcLockTimer { display: block; font-family: 'DM Mono', monospace; font-size: 7.5em; font-weight: 800; color: var(--tc-text-pri); letter-spacing: -0.04em; line-height: 1; } .tcLockMeta { display: block; font-size: 0.85em; font-weight: 600; color: var(--tc-text-dim); margin-top: var(--s-5); letter-spacing: 0.05em; } #__tradeCalc.tcDangerMode { box-shadow: var(--tc-panel-shadow), 0 0 0 2px oklch(64% 0.18 25 / 0.55); } #__tradeCalc.tcDangerMode.tcActive { box-shadow: var(--tc-panel-shadow), 0 0 0 2px oklch(64% 0.18 25 / 0.5); } #__tcDangerOverlay.tcPercentVisible { opacity: 1; background: radial-gradient(circle at center, transparent 0%, oklch(64% 0.18 25 / 0.15) 100%); } #__tcDangerOverlay.tcPercentVisible .tcLockCard { display: block; } #__tcDangerOverlay.tcPercentVisible .tcLockContent { box-shadow: 0 0 0 1px oklch(64% 0.18 25 / 0.5), 0 32px 100px -16px oklch(0% 0 0 / 0.9); background: radial-gradient(circle at top, oklch(64% 0.18 25 / 0.15) 0%, transparent 100%), var(--tc-bg); } #__tcRestoreBtn { position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; background: oklch(from var(--tc-bg) l c h / 0.85); color: var(--tc-text-pri); border: 1px solid oklch(from var(--tc-accent) l c h / 0.3); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); padding: 0.6em 1.2em; border-radius: 99px; font-family: 'DM Sans', system-ui, sans-serif; font-weight: 600; font-size: 13px; cursor: pointer; box-shadow: 0 4px 16px oklch(0% 0 0 / 0.28); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s, border-color 0.2s; display: flex; align-items: center; gap: 8px; transform-origin: center; } #__tcRestoreBtn svg { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); color: var(--tc-accent); width: 14px; height: 14px; } #__tcRestoreBtn:hover { transform: translateY(-3px) scale(1.02); background: oklch(from var(--tc-bg) l c h / 0.95); box-shadow: 0 8px 24px oklch(from var(--tc-accent) l c h / 0.2); border-color: var(--tc-accent); } #__tcRestoreBtn:hover svg { transform: rotate(90deg) scale(1.1); } #__tcRestoreBtn:active { transform: translateY(1px) scale(0.97); box-shadow: 0 2px 8px oklch(0% 0 0 / 0.2); transition: transform 0.1s; } #__tcRestoreBtn.tcLightMode { background: oklch(96% 0.02 88 / 0.92); box-shadow: 0 8px 24px -14px oklch(37% 0.06 78 / 0.45); } #__tcRestoreBtn.tcLightMode:hover { background: oklch(99% 0.016 88 / 0.98); box-shadow: 0 8px 24px oklch(48% 0.18 245 / 0.15); } @keyframes __tcPillSnap { 0% { transform: scale(1); } 40% { transform: scale(0.88); } 100% { transform: scale(1); } } .tcPill.tcPillSnap { animation: __tcPillSnap 0.22s cubic-bezier(0.16, 1, 0.3, 1); } @keyframes __tcInputCommit { 0% { border-color: oklch(76% 0.16 145 / 0.9); box-shadow: 0 0 0 2px oklch(76% 0.16 145 / 0.18), inset 0 1px 2px oklch(0% 0 0 / 0.18); } 100% { border-color: var(--tc-input-border); box-shadow: inset 0 1px 2px oklch(0% 0 0 / 0.18); } } .tcControlGroup.tcCommit { animation: __tcInputCommit 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; } .tcReqWrap { display: flex; align-items: baseline; gap: 0.12em; } .tcReqFrom { font-size: 0.78em; font-weight: 600; color: var(--tc-text-dim); font-variant-numeric: tabular-nums; letter-spacing: 0.01em; } .tcValLg.tcTradeCritical { color: var(--tc-ylw) !important; text-shadow: 0 0 24px oklch(90% 0.17 95 / 0.6), 0 0 48px oklch(90% 0.17 95 / 0.25); } .tcSecHdr .tcDot.tcDotLive { opacity: 1; box-shadow: 0 0 5px currentColor; } @keyframes __tcBtnReveal { 0% { transform: scale(0.96); box-shadow: 0 0 0 0 oklch(76% 0.16 145 / 0.5); } 55% { transform: scale(1.02); box-shadow: 0 0 0 8px oklch(76% 0.16 145 / 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 oklch(76% 0.16 145 / 0); } } .tcSLBtnReveal { animation: __tcBtnReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; } @keyframes __tcWarnIn { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } } #__tcWarn.tcWarnVisible { animation: __tcWarnIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; } @keyframes __tcLiveResolve { 0% { opacity: 0.72; transform: scale(1); } 45% { opacity: 1; transform: scale(1.06); } 100% { opacity: 0; transform: scale(0.96) translateY(2px); } } .tcLiveResolving { animation: __tcLiveResolve 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards !important; } @keyframes __tcValPop { 0% { transform: scale(1); } 45% { transform: scale(1.12) translateY(-1px); } 100% { transform: scale(1) translateY(0); } } .tcValLg.tcValPop { animation: __tcValPop 0.28s cubic-bezier(0.16, 1, 0.3, 1); } @media (prefers-reduced-motion: reduce) { #__tradeCalc, #__tradeCalc *, #__tcRestoreBtn, #__tcDangerOverlay { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; } #__tradeCalc.tcDangerMode.tcActive { animation: none !important; } .tcFlashData { animation: none !important; } .tcCloseBtn:focus-visible:hover { transform: none; } .tcLogBtn:hover { transform: none; } #__tcRestoreBtn:hover { transform: none; } #__tcRestoreBtn:hover svg { transform: none; } .tcPill.tcPillSnap { animation: none !important; } .tcControlGroup.tcCommit { animation: none !important; } .tcSecHdr .tcDot.tcDotLive { animation: none !important; } .tcSLBtnReveal { animation: none !important; } #__tcWarn.tcWarnVisible { animation: none !important; } .tcLiveResolving { animation: none !important; opacity: 0 !important; } .tcValLg.tcValPop { animation: none !important; } .tcPill { transition: none !important; } } .tcControlGroup.tcTPGroup { gap: 0.15em; } .tcTPCur { color: var(--tc-text-dim); font-family: 'DM Mono', monospace; } @keyframes __tcTimerIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } } @keyframes __tcEdgeFlash { 0% { opacity:0; } 25% { opacity:1; } 100% { opacity:0; } } @media (prefers-reduced-motion: reduce) { #__tcEdgeFlash { animation: none !important; opacity: 0 !important; } } #__tradeCalc { --tc-v-fz: 1.08em; --tc-v-h: 2.15em; padding: 0.45em 1.6em; } #__tradeCalc #__tcContent { gap: 1.4em; align-items: flex-start; } #__tradeCalc .tcSecFields { gap: 0.9em !important; align-items: flex-start !important; } #__tradeCalc .tcFld { flex: 0 0 auto; align-items: center; gap: 0.4em; } #__tradeCalc .tcFld > .tcLbl { justify-content: center; } #__tradeCalc .tcFld > *:not(.tcLbl) { margin: 0; height: var(--tc-v-h); box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; } #__tradeCalc .tcControlGroup, #__tradeCalc .tcControlGroup:focus-within, #__tradeCalc #__tcSLInputWrap { min-height: 0; padding: 0 0.75em; } #__tradeCalc .tcInput, #__tradeCalc .tcVal, #__tradeCalc .tcValLg, #__tradeCalc .tcTPCur { font-size: var(--tc-v-fz); font-weight: 600; line-height: 1; letter-spacing: 0.02em; } #__tradeCalc .tcFld > .tcPill { font-size: inherit; width: var(--tc-v-h); padding: 0; } #__tradeCalc .tcControlGroup .tcInput { text-align: center; } #__tradeCalc .tcSecFields > .tcLogBtn { align-self: center !important; width: var(--tc-v-h); height: var(--tc-v-h); } #__tradeCalc .tcVer { align-self: center; } #__tcDemoCover { position: fixed; z-index: 2147483000; box-sizing: border-box; pointer-events: none; background: #1c1f2d; font-family: Roboto, Arial, Helvetica, sans-serif; } #__tcDemoCover[hidden] { display: none; } #__tcDemoCover .dcBox { position: absolute; inset: 0; background: #2b3040; border-radius: 4px; } #__tcDemoCover .dcCap { position: absolute; left: 11px; top: 10px; width: 21px; height: 18px; fill: #fff; } #__tcDemoCover .dcLbl { position: absolute; left: 42px; top: 5px; font-size: 10px; line-height: 10px; font-weight: 900; color: #ff8a00; white-space: nowrap; } #__tcDemoCover .dcBal { position: absolute; left: 42px; top: 18px; font-size: 14px; line-height: 14px; font-weight: 700; color: #fff; white-space: nowrap; } #__tcDemoCover .dcChev { position: absolute; top: 16px; width: 9px; height: 5px; fill: none; stroke: rgba(255, 255, 255, 0.8); stroke-width: 1.5; } .tcMenu { position: absolute; top: calc(100% + 0.6em); right: 0.6em; z-index: 200; width: 23em; max-height: min(70vh, 42em); overflow-y: auto; scrollbar-width: thin; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.1em; padding: 0.6em; background: var(--tc-bg); color: var(--tc-text-pri); border: 1px solid var(--m3-outline-var); border-radius: var(--m3-shape-md); box-shadow: var(--m3-elev-3); cursor: default; } .tcMenu[hidden] { display: none; } .tcMenuHd { font-size: var(--fz-label); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--tc-text-mut); padding: 0.2em 0.3em 0.4em; } .tcMenuRow { display: flex; align-items: center; justify-content: space-between; gap: 0.8em; padding: 0.35em 0.3em; } .tcMenuLbl { display: block; font-weight: 600; } .tcMenuSub { display: block; font-size: 0.82em; color: var(--tc-text-mut); margin-top: 0.15em; } .tcMenuSep { height: 1px; background: var(--m3-outline-var); margin: 0.3em 0; flex-shrink: 0; } .tcSeg { display: inline-flex; align-items: center; gap: 0.3em; flex-shrink: 0; } .tcMenuVal { min-width: 3em; text-align: center; font-family: 'DM Mono', monospace; font-variant-numeric: tabular-nums; } .tcMenuBtn { all: unset; box-sizing: border-box; cursor: pointer; flex-shrink: 0; padding: 0.25em 0.8em; border-radius: var(--m3-shape-full); border: 1px solid var(--m3-outline-var); font-weight: 600; font-size: 0.9em; color: var(--tc-text-pri); transition: border-color 0.15s, background 0.15s; } .tcMenuBtn:hover { border-color: var(--tc-accent); } .tcMenuBtn.tcOn { background: var(--tc-accent); color: var(--m3-on-primary); border-color: transparent; } .tcMenuBtn:disabled { opacity: 0.5; cursor: default; } .tcMenuBtn:focus-visible, .tcSwitch:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; } .tcSwitch { all: unset; box-sizing: border-box; position: relative; flex-shrink: 0; width: 2.4em; height: 1.35em; border-radius: 999px; cursor: pointer; background: var(--m3-surface-3); border: 1px solid var(--m3-outline); transition: background 0.15s, border-color 0.15s; } .tcSwitch::after { content: ''; position: absolute; top: 50%; left: 0.2em; width: 0.85em; height: 0.85em; border-radius: 50%; background: var(--m3-outline); transform: translateY(-50%); transition: left 0.15s, background 0.15s; } .tcSwitch[aria-checked=\"true\"] { background: var(--tc-accent); border-color: var(--tc-accent); } .tcSwitch[aria-checked=\"true\"]::after { left: 1.3em; background: var(--m3-on-primary); } .tcMenuInput { box-sizing: border-box; width: 3.4em; padding: 0.25em 0.5em; border-radius: var(--m3-shape-sm); border: 1px solid var(--m3-outline-var); background: var(--m3-surface-3); color: var(--tc-text-pri); font-family: 'DM Mono', monospace; font-size: 0.95em; text-align: right; outline: none; flex-shrink: 0; } .tcMenuInput:focus { border-color: var(--tc-accent); } .tcMenuInputWide { width: 8.5em; text-align: left; } .tcMenuOut { display: flex; flex-direction: column; gap: 0.2em; padding: 0 0.3em 0.3em; font-size: 0.85em; } .tcMenuOut:empty { display: none; } .tcMenuNote { color: var(--tc-text-mut); } .tcMenuWarn { color: var(--tc-amb); font-weight: 600; } .tcMenuBig { font-family: 'DM Mono', monospace; font-size: 1.35em; font-weight: 700; color: var(--tc-grn); line-height: 1.3; } .tcMenuLine { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6em; } .tcMenuLine > :first-child { white-space: nowrap; } .tcMenuLine > :last-child { font-family: 'DM Mono', monospace; font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; max-width: 13em; } .tcMenuList { display: flex; flex-direction: column; gap: 0.15em; padding: 0.3em 0; border-top: 1px solid var(--m3-outline-var); margin-top: 0.2em; } #__tcMTF { position: fixed; top: 96px; right: 220px; z-index: 2147483000; display: flex; flex-direction: column; gap: 10px; width: 268px; padding: 10px; box-sizing: border-box; border-radius: var(--m3-shape-lg); background: var(--tc-bg); box-shadow: var(--m3-elev-2); border: 1px solid var(--m3-outline-var); font-family: 'DM Mono', monospace; user-select: none; -webkit-user-select: none; touch-action: none; } #__tcMTF .tcMtfBar { display: flex; align-items: center; gap: 6px; cursor: grab; padding-bottom: 2px; } #__tcMTF .tcMtfBar:active { cursor: grabbing; } #__tcMTF .tcMtfPair { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; color: var(--tc-text-pri); } #__tcMTF .tcMtfSync { all: unset; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: var(--m3-shape-full); cursor: pointer; color: var(--tc-text-dim); transition: background 0.12s, color 0.12s; } #__tcMTF .tcMtfSync:hover { background: oklch(from var(--tc-accent) l c h / 0.12); color: var(--tc-accent); } #__tcMTF .tcMtfSync:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 1px; } #__tcMTF .tcMtfGrip { width: 16px; height: 3px; border-radius: 2px; background: var(--m3-outline-var); } #__tcMTF .tcMtfCell { display: flex; flex-direction: column; gap: 1px; } #__tcMTF .tcMtfHd { display: flex; align-items: center; justify-content: space-between; } #__tcMTF .tcMtfViews { display: flex; gap: 3px; flex-shrink: 0; } #__tcMTF .tcMtfViewBtn { all: unset; box-sizing: border-box; font-family: inherit; font-size: 9px; font-weight: 800; letter-spacing: 0.04em; padding: 0 6px; line-height: 15px; border-radius: 4px; border: 1px solid var(--tc-sec-border); color: var(--tc-text-mut); cursor: pointer; } #__tcMTF .tcMtfViewBtn:hover { color: var(--tc-text-pri); } #__tcMTF .tcMtfViewBtn.tcOn { color: #0b1020; background: var(--tc-accent); border-color: transparent; } #__tcMTF .tcMtfScan { display: none; } #__tcMTF.tcMtfScanOn .tcMtfCell { display: none; } #__tcMTF.tcMtfScanOn .tcMtfScan { display: flex; flex-direction: column; gap: 3px; } #__tcMTF .tcMtfScanHdr { font-size: 9px; font-weight: 700; letter-spacing: 0.04em; color: var(--tc-text-mut); padding: 0 2px 2px; } #__tcMTF .tcMtfScanList { display: flex; flex-direction: column; gap: 1px; max-height: min(240px, 40vh); overflow-y: auto; scrollbar-width: thin; } #__tcMTF .tcScanAge { font-size: 8px; font-weight: 700; color: var(--tc-text-mut); opacity: 0.8; flex-shrink: 0; font-variant-numeric: tabular-nums; } #__tcMTF .tcMtfScanRow { display: flex; align-items: center; gap: 6px; font-size: 10px; line-height: 17px; padding: 0 4px; border-radius: 4px; cursor: pointer; border: 1px solid transparent; } #__tcMTF .tcMtfScanRow:hover { background: oklch(100% 0 0 / 0.08); } #__tcMTF .tcMtfScanRow.tcScanHot { background: oklch(100% 0 0 / 0.06); border-color: var(--tc-sec-border); } #__tcMTF .tcMtfScanRow.tcScanOpen .tcScanPair { color: var(--tc-text-pri); } #__tcMTF .tcScanPair { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; color: var(--tc-text-dim); } #__tcMTF .tcScanPay { font-variant-numeric: tabular-nums; color: var(--tc-text-mut); flex-shrink: 0; } #__tcMTF .tcScanTr { display: flex; gap: 1px; flex-shrink: 0; font-size: 9px; } #__tcMTF .tcScanNear { font-variant-numeric: tabular-nums; font-weight: 800; flex-shrink: 0; min-width: 54px; text-align: right; } #__tcMTF .tcScanNear.tcScanNone { color: var(--tc-text-mut); font-weight: 600; } #__tcMTF .tcScanEmpty { font-size: 10px; color: var(--tc-text-mut); padding: 6px 4px; } #__tcMTF .tcMtfScanFoot { display: flex; align-items: center; gap: 6px; padding-top: 4px; border-top: 1px solid var(--tc-sec-border); } #__tcMTF.tcMtfSweeping .tcMtfSync { color: var(--tc-accent); animation: tcSpin 1.4s linear infinite; } #__tcMTF .tcScanFootMsg { font-size: 9px; color: var(--tc-text-mut); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } #__tcMTF .tcMtfTf { color: var(--tc-text-pri); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; padding: 0 5px; border-radius: 4px; margin-right: 5px; border: 1px solid transparent; line-height: 15px; } .tcMtfTf:hover { filter: brightness(1.3); } #__tcMTF .tcMtfPct { font-size: 10px; font-variant-numeric: tabular-nums; color: var(--tc-text-dim); } .tcMtfSr { font-size: 9px; font-weight: 800; letter-spacing: 0.04em; cursor: pointer; padding: 0 5px; border-radius: 4px; margin-right: 5px; border: 1px solid transparent; line-height: 15px; } .tcMtfCd { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--tc-text-mut); margin-left: auto; margin-right: 6px; } .tcMtfCd.tcMtfCdSoon { color: var(--tc-accent); } .tcMtfFlip { display: none; font-size: 9px; font-weight: 800; line-height: 15px; padding: 0 5px; border-radius: 4px; margin-right: 5px; border: 1px solid transparent; color: #0b1020; } .tcMtfFlip.tcFlipOn { display: inline-block; } #__tcMTF .tcMtfCv { display: block; width: 100%; height: var(--tc-mtf-cvh, 88px); cursor: grab; touch-action: none; border-radius: var(--m3-shape-xs); background: var(--m3-surface-3); } #__tcMTF .tcMtfRz { position: absolute; z-index: 2; background: transparent; touch-action: none; } #__tcMTF .tcMtfRz[data-rz=\"e\"] { top: 8px; bottom: 8px; right: -3px; width: 8px; cursor: ew-resize; } #__tcMTF .tcMtfRz[data-rz=\"w\"] { top: 8px; bottom: 8px; left: -3px; width: 8px; cursor: ew-resize; } #__tcMTF .tcMtfRz[data-rz=\"s\"] { left: 8px; right: 8px; bottom: -3px; height: 8px; cursor: ns-resize; } #__tcMTF .tcMtfRz[data-rz=\"n\"] { left: 8px; right: 8px; top: -3px; height: 8px; cursor: ns-resize; } #__tcMTF .tcMtfRz[data-rz=\"se\"] { right: -3px; bottom: -3px; width: 14px; height: 14px; cursor: nwse-resize; } #__tcMTF .tcMtfRz[data-rz=\"sw\"] { left: -3px; bottom: -3px; width: 14px; height: 14px; cursor: nesw-resize; } #__tcMTF .tcMtfRz[data-rz=\"ne\"] { right: -3px; top: -3px; width: 14px; height: 14px; cursor: nesw-resize; } #__tcMTF .tcMtfRz[data-rz=\"nw\"] { left: -3px; top: -3px; width: 14px; height: 14px; cursor: nwse-resize; } #__tcMTF .tcMtfRz[data-rz=\"se\"]::after { content: ''; position: absolute; right: 4px; bottom: 4px; width: 6px; height: 6px; border-right: 2px solid var(--m3-outline-var); border-bottom: 2px solid var(--m3-outline-var); } #__tcMTF.tcMtfResizing { user-select: none; } #__tcMTF .tcMtfCv:active { cursor: grabbing; } #__tcMTF .tcMtfPanned .tcMtfCv { box-shadow: inset 0 0 0 1px oklch(from var(--tc-accent) l c h / 0.55); } #__tcMTF .tcMtfPanned .tcMtfCap { color: var(--tc-accent); } #__tcMTF .tcMtfCap { font-size: 10px; letter-spacing: 0.03em; color: var(--tc-text-dim); text-align: right; } #__tcMTF .tcMtfStale .tcMtfCv { opacity: 0.45; } #__tcMTF .tcMtfStale .tcMtfCap { color: var(--tc-amb); } #__tcMTF .tcMtfEmpty .tcMtfCv { background: transparent; border: 1px dashed var(--m3-outline-var); } #__tcMTF .tcMtfEmpty .tcMtfCap { color: var(--tc-accent); } #__tcMTF.tcMtfBusy { opacity: 0.7; } #__tcMTF.tcMtfBusy .tcMtfSync { color: var(--tc-accent); } @media (max-width: 900px) { #__tradeCalc input { font-size: 16px !important; } } ";
      shadow.appendChild(t);
    }
    // v1.27.0: the old <style> here listed Quotex's own hashed classes (".UI2Kh, .bvdd_ { … }"), which only
    // something reading their markup would write. The same emphasis is applied element by element now, so no
    // rule ever names their internals.
    function emphasize(el, styles) {
      if (!el || el._tcEmph) {
        return;
      }
      el._tcEmph = true;
      for (const prop in styles) {
        el.style.setProperty(prop, styles[prop], "important");
      }
    }
    // v1.72.0: with no spot of the user's own, the bar lives in Quotex's header (placeBarInHeader).
    let barInHeader = false,
      barAnchor = "not looked for yet";
    let panelPos = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        tx: 0,
        ty: 0,
      },
      tabStripBottomCache = {
        ts: 0,
        val: 3,
      };
    const getPanelOrigin = () => {
        const t = panel.getBoundingClientRect();
        return {
          left: t.left - panelPos.x,
          top: t.top - panelPos.y,
        };
      },
      clampPanelPos = (t) => {
        const e = panel.offsetWidth,
          n = panel.offsetHeight,
          o = window.innerWidth,
          r = window.innerHeight,
          a = getPanelOrigin(),
          i = a.left,
          c = a.top;
        if (prefGet("tc_pos")) {
          if (panelPos.isAbsolute) {
            panelPos.tx = panelPos.tx - i;
            panelPos.ty = panelPos.ty - c;
            panelPos.x = panelPos.x - i;
            panelPos.y = panelPos.y - c;
            delete panelPos.isAbsolute;
          }
        } else if (!barInHeader) {
          panelPos.tx = 0;
          panelPos.ty = 0;
          panelPos.x = 0;
          panelPos.y = 0;
        }
        let s = i + panelPos.tx,
          l = c + panelPos.ty,
          d = i + panelPos.x,
          u = c + panelPos.y;
        // v1.70.1: a spot the user dragged the bar to is theirs - it is only kept inside the window. Pushing it
        // below the pair tabs is for a bar that has never been moved. The push used to apply to a saved spot
        // too, but only when the tabs were already drawn as the bar was built: not on a page refresh (they
        // come later), yes when the toolbar icon brought it back - so it came back somewhere else.
        const p = t || prefGet("tc_pos") || barInHeader
          ? 3
          : ((t, e) => {
              if (isMobileWidth()) {
                return 3;
              }
              const n = Date.now();
              if (n - tabStripBottomCache.ts < 500) {
                return tabStripBottomCache.val;
              }
              const o = getPairTabs();
              let r = 0;
              for (let n = 0; n < o.length; n++) {
                const a = o[n].getBoundingClientRect();
                if (e >= a.left && t <= a.right && a.width > 20 && a.height > 10 && a.top < 180) {
                  r = Math.max(r, a.bottom);
                }
              }
              tabStripBottomCache = {
                ts: n,
                val: r ? Math.ceil(r + 3) : 3,
              };
              return tabStripBottomCache.val;
            })(s, s + e);
        s = Math.max(8, Math.min(s, o - e - 8));
        l = Math.max(p, Math.min(l, r - n - 8));
        d = Math.max(8, Math.min(d, o - e - 8));
        u = Math.max(p, Math.min(u, r - n - 8));
        panelPos.tx = s - i;
        panelPos.ty = l - c;
        panelPos.x = d - i;
        panelPos.y = u - c;
      };
    // v1.72.0: the bar's home moved into the header. A spot saved before that is cleared once, so it can go
    // there; a spot dragged to from now on is kept, as it always was.
    if (prefGet("__tradeCalc_pos_home") !== "header") {
      prefRemove("tc_pos");
      prefSet("__tradeCalc_pos_home", "header");
    }
    try {
      const t = JSON.parse(prefGet("tc_pos"));
      if (t) {
        if (void 0 !== t.tx && void 0 !== t.ty) {
          panelPos.tx = t.tx;
          panelPos.ty = t.ty;
        } else if (void 0 !== t.x && void 0 !== t.y) {
          panelPos.tx = t.x;
          panelPos.ty = t.y;
          panelPos.isAbsolute = true;
        }
        panelPos.x = panelPos.tx;
        panelPos.y = panelPos.ty;
      } else {
        panelPos.tx = 0;
        panelPos.ty = 0;
        panelPos.x = 0;
        panelPos.y = 0;
      }
    } catch (t) {}
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Top panel element, drag handling, lock overlay
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const panel = document.createElement("div");
    panel.id = "__tradeCalc";
    panel.innerHTML =
      ' <span class="tcGrip tcGripLeft" aria-hidden="true"><svg viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="2" r="1.3"/><circle cx="7.5" cy="2" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="14" r="1.3"/><circle cx="7.5" cy="14" r="1.3"/></svg></span> <div id="__tcLoader" role="status" aria-live="polite" style="color:var(--tc-text-mut); font-size:0.72em; display:flex; align-items:center; justify-content:center; gap:var(--s-3); padding:var(--s-5) var(--s-6); width:22em; min-height:4.46em; font-weight:800; letter-spacing:0.14em;"> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tc-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:tcSpin 1s linear infinite; opacity:0.8;" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> <span id="__tcLoaderText"></span> </div> <div id="__tcContent" style="display:none;"> \x3c!-- Section 1: TARGETS (drag zone) --\x3e <div id="__tcSecTargets" class="tcSec"> <div class="tcSecFields" style="cursor:default; gap:0.615em;"> \x3c!-- TP --\x3e <div class="tcFld tcTPFld"> <span class="tcLbl" data-tc-tip="Day\'s take-profit target — hover the value to edit, Enter to save"><span class="tcDot"></span>TP</span> <div class="tcControlGroup tcTPGroup"> <span class="tcTPCur">₹</span> <input id="__tcTBInput" class="tcInput tcTPInput" type="text" placeholder="0" aria-label="Take profit balance target" autocomplete="off" readonly /> </div> </div> \x3c!-- SL (always shown; stays until changed) --\x3e <div class="tcFld" id="__tcSLFld"> <span class="tcLbl" data-tc-tip="Your stop loss — type a number and press Enter. It stays until you change it">SL</span> <div class="tcControlGroup" id="__tcSLInputWrap"> <input id="__tcSLInput" class="tcInput" type="text" placeholder="—" aria-label="Stop loss" autocomplete="off" /> </div> </div> </div> </div> \x3c!-- Section 2: LIMITS — centred via margin:auto in CSS --\x3e <div id="__tcSecProtections" class="tcSec"> <div class="tcSecHdr"><span class="tcDot"></span></div> <div class="tcSecFields" style="gap:0.75em;"> \x3c!-- LOCK + TIME removed 2026-07-06: browser locking is GONE (user runs a system-level lock). Do NOT re-add #__tcArmLimits / #__tcBlockMinInput. --\x3e \x3c!-- FLOOR % --\x3e <div class="tcFld"> <span class="tcLbl" data-tc-tip="Block trades and close tabs below this payout %">PAYOUT</span> <div class="tcControlGroup"> <input id="__tcMinRpInput" class="tcInput" type="text" aria-label="Minimum payout floor %" autocomplete="off" style="width:calc(3ch + 0.55em);" /> </div> </div> \x3c!-- MAX (v1.69.0, was Max Concurrent Trades in the popup) --\x3e <div class="tcFld"> <span class="tcLbl" data-tc-tip="Most trades open at once, 1 to 4 - Enter to save">MAX</span> <div class="tcControlGroup"> <input id="__tcMaxTradesInput" class="tcInput" type="text" inputmode="numeric" aria-label="Most trades open at once" autocomplete="off" style="width:calc(1ch + 0.55em);" /> </div> </div> \x3c!-- FAST (v1.69.0, was MULT: it lets a quick second trade click through; it never scaled anything) --\x3e <div class="tcFld"> <span class="tcLbl" data-tc-tip="On: a quick second click on Up/Down goes through. Off: it is ignored for 1.5 s">FAST</span> <button id="__tcMultiStatus" class="tcPill" aria-pressed="false" aria-label="Allow a quick second trade click" data-tc-tip="On: a quick second click on Up/Down goes through. Off: it is ignored for 1.5 s"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v6"/><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/></svg> </button> </div> </div> </div> \x3c!-- Section 3: PROJECTION --\x3e <div id="__tcSecProjections" class="tcSec"> <div class="tcSecFields" style="gap:0.75em; flex-wrap:nowrap; align-items:stretch;"> <div class="tcFld"> <span class="tcLbl" data-tc-tip="Trades needed to reach your TP from current balance"><span class="tcDot"></span>REQ</span> <div class="tcValBox"> <span class="tcReqWrap"><span id="__tcResultFrom" class="tcReqFrom"></span><span id="__tcResult" class="tcValLg">—</span></span> <div class="tcProjMarks" aria-hidden="true"> <span class="tcProjMark tcProjMarkFill"></span> <span class="tcProjMark tcProjMarkFill"></span> <span class="tcProjMark tcProjMarkFill"></span> <span class="tcProjMark"></span> <span class="tcProjMark"></span> </div> </div> </div> <div class="tcFld"> <span class="tcLbl" data-tc-tip="Amount at risk per trade">RISK</span> <div class="tcValBox"><span id="__tcRisk" class="tcVal">—</span></div> </div> <button id="__tcMtfToggle" class="tcLogBtn tcImToggleOff" style="align-self:center;" aria-label="Toggle multi-timeframe chart panel" data-tc-tip="Show/hide the multi-timeframe charts (C)"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="4" x2="6" y2="20"/><rect x="3.5" y="8" width="5" height="7" rx="1"/><line x1="18" y1="4" x2="18" y2="20"/><rect x="15.5" y="6" width="5" height="9" rx="1"/></svg> </button> <button id="__tcMenuBtn" class="tcLogBtn" style="align-self:center;" aria-label="Settings" aria-haspopup="true" aria-expanded="false"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> </button> </div> </div> <span id="__tcVer" class="tcVer">—</span> </div> <span class="tcGrip tcGripRight" aria-hidden="true"><svg viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="2" r="1.3"/><circle cx="7.5" cy="2" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="14" r="1.3"/><circle cx="7.5" cy="14" r="1.3"/></svg></span> <button id="__tcClose" class="tcCloseBtn" aria-label="Close panel"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" style="width:0.62em; height:0.62em;" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> </button> <span id="__tcWarn" role="alert" aria-live="assertive" style="display:none; position:absolute; bottom:-2.3em; left:0; width:100%; text-align:center; font-size:0.92em; font-weight:900; color:var(--tc-red); text-transform:uppercase; letter-spacing:0.14em; filter:drop-shadow(0 2px 6px oklch(64% 0.18 25 / 0.4));"></span> <div id="__tcMenu" class="tcMenu" role="dialog" aria-label="Settings" hidden></div>';
    if (!isMobileWidth()) {
      panel.style.fontSize = panelFontSize + "px";
    }
    if (isLightTheme) {
      panel.classList.add("tcLightMode");
    }
    const KEY_FIRST_RUN = "__tradeCalc_first_run";
    if (!prefGet(KEY_FIRST_RUN)) {
      try {
        prefSet(KEY_FIRST_RUN, "1");
      } catch (t) {}
      panel.style.animation = "__tcEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards";
      panel.style.boxShadow = "0 0 0 1px var(--tc-grn), 0 12px 40px oklch(from var(--tc-grn) l c h / 0.15)";
      setTimeout(() => {
        panel.style.transition = "box-shadow 1.5s ease-out";
        panel.style.boxShadow = "0 8px 32px oklch(0% 0 0 / 0.6)";
        setTimeout(() => {
          panel.style.transition = "";
        }, 1500);
      }, 2000);
    }
    shadow.appendChild(panel);
    if (!panelPos.isAbsolute) {
      panel.style.transform = `translate3d(${panelPos.x}px, ${panelPos.y}px, 0)`;
    }
    requestAnimationFrame(() => {
      const t = byId("__tcLoaderText");
      if (t) {
        t.textContent = "";
      }
      clampPanelPos();
      panel.style.transform = `translate3d(${panelPos.x}px, ${panelPos.y}px, 0)`;
      placeBarInHeader();
    });
    let dragOffsetX,
      dragOffsetY,
      isDragging = false;
    // v1.72.0: the bar's home is Quotex's header, centred in the gap between "WEB TRADING PLATFORM" and
    // "Alerts", 5 px from the top (1 px above where it used to sit). Both are found by their words, not by a
    // class, and kept until they leave the page; the look is repeated twice a second so the bar follows a
    // window resize or its own width changing. A spot the user drags to wins, as before. Either word not
    // found - Quotex renamed it, or hid it in a closed component - leaves the bar where it was, and the
    // diagnostics line says which.
    // v1.72.1: seen live on 1.72.0 - "WEB TRADING PLATFORM" is text on the page, "Alerts" is not. So a word is
    // looked for in four ways, in order, and the one that worked is reported: as text; as text that starts
    // with it ("Alerts 3"); as a hover label on an icon (aria-label, title, alt, data-tooltip); and as one of
    // Quotex's closed components named after it (`<qx-...alert...>` - the host is on the page and has a box
    // even though nothing inside it can be read).
    const UPPER = "translate(normalize-space(.),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ')";
    const HEADER_WORDS = {
      logo: { name: "WEB TRADING PLATFORM", text: "//text()[contains(" + UPPER + ",'WEB TRADING PLATFORM')]", label: /web trading platform/i, tag: null },
      alerts: {
        name: "Alerts",
        text: "//text()[" + UPPER + "='ALERTS']",
        textStart: "//text()[starts-with(" + UPPER + ",'ALERTS')]",
        // v1.72.2: "Alerts" is the bell icon, whose hover label on the live page is "Notifications".
        label: /^\s*(alerts?|notifications?)\b/i,
        tag: "alert",
      },
    };
    const headerFound = {},
      headerVia = {};
    let headerLookAt = 0;
    // The header: on screen, near the top. The same words lower down (a menu, a settings page) are not it.
    const inHeader = (el) => {
      if (!el || isOurElement(el)) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top >= 0 && r.top < 150;
    };
    const topmost = (els) => {
      let best = null,
        bestTop = Infinity;
      for (const el of els) {
        if (inHeader(el)) {
          const top = el.getBoundingClientRect().top;
          if (top < bestTop) {
            best = el;
            bestTop = top;
          }
        }
      }
      return best;
    };
    const textParents = (xpath) => {
      const out = [];
      try {
        const x = document.evaluate(xpath, document.body, null, 7, null);
        for (let i = 0; i < x.snapshotLength; i++) {
          out.push(x.snapshotItem(i).parentElement);
        }
      } catch (e) {}
      return out;
    };
    const LABEL_ATTRS = ["aria-label", "title", "alt", "data-tooltip", "data-title"];
    function labelled(re) {
      const out = [];
      for (const el of document.querySelectorAll("[aria-label],[title],[alt],[data-tooltip],[data-title]")) {
        if (LABEL_ATTRS.some((a) => re.test(el.getAttribute(a) || ""))) {
          out.push(el);
        }
      }
      return out;
    }
    function customTags(stem) {
      const out = [];
      for (const el of document.querySelectorAll("*")) {
        const tag = el.tagName.toLowerCase();
        if (tag.includes("-") && (!stem || tag.includes(stem))) {
          out.push(el);
        }
      }
      return out;
    }
    function findHeaderWord(key) {
      const kept = headerFound[key];
      if (kept && kept.isConnected) {
        return kept;
      }
      const w = HEADER_WORDS[key],
        ways = [
          ["text", () => textParents(w.text)],
          ["text", () => (w.textStart ? textParents(w.textStart) : [])],
          ["hover label", () => labelled(w.label)],
          ["component", () => (w.tag ? customTags(w.tag) : [])],
        ];
      let found = null;
      for (const [via, look] of ways) {
        found = topmost(look());
        if (found) {
          headerVia[key] = via === "component" ? "component <" + found.tagName.toLowerCase() + ">" : via;
          break;
        }
      }
      headerFound[key] = found;
      return found;
    }
    // What the header does have, for the diagnostics line when a word is not found: its closed components
    // and its hover labels. One read then says what the missing word has turned into.
    function headerInventory() {
      const tags = new Set(),
        labels = new Set();
      for (const el of customTags(null)) {
        if (inHeader(el)) {
          tags.add("<" + el.tagName.toLowerCase() + ">");
        }
      }
      for (const el of document.querySelectorAll("[aria-label],[title]")) {
        if (inHeader(el)) {
          const t = (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
          if (t && t.length <= 30) {
            labels.add(t);
          }
        }
      }
      const list = (set) => Array.from(set).slice(0, 8).join(", ") || "none";
      return "header components: " + list(tags) + " \u00b7 hover labels: " + list(labels);
    }
    function placeBarInHeader() {
      if (prefGet("tc_pos")) {
        barInHeader = false;
        barAnchor = "your own spot (dragged there)";
        return;
      }
      if (document.hidden || isDragging || isMobileWidth() || panel.style.display === "none") {
        return;
      }
      const now = Date.now(),
        kept = headerFound.logo && headerFound.logo.isConnected && headerFound.alerts && headerFound.alerts.isConnected;
      // A fresh search walks the page, so while either word is missing it is only repeated every 2 s.
      if (!kept && now - headerLookAt < 2000) {
        return;
      }
      if (!kept) {
        headerLookAt = now;
      }
      const logo = findHeaderWord("logo"),
        alerts = findHeaderWord("alerts");
      if (!logo || !alerts) {
        barInHeader = false;
        barAnchor = (!logo ? "WEB TRADING PLATFORM" : "Alerts") + " not found \u00b7 " + headerInventory();
        return;
      }
      const a = logo.getBoundingClientRect(),
        b = alerts.getBoundingClientRect(),
        w = panel.getBoundingClientRect().width;
      if (!(b.left > a.right)) {
        barInHeader = false;
        barAnchor = "no gap between WEB TRADING PLATFORM and Alerts";
        return;
      }
      let left = Math.round((a.right + b.left) / 2 - w / 2);
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      const x = left - getPanelOrigin().left,
        y = 0; // the stylesheet's own 5 px from the top
      barInHeader = true;
      barAnchor =
        "in the header \u00b7 gap " + Math.round(a.right) + "-" + Math.round(b.left) + " \u00b7 bar " + Math.round(w) +
        (w > b.left - a.right ? " (wider than the gap)" : "") +
        " \u00b7 Alerts found as " + headerVia.alerts;
      if (panelPos.x !== x || panelPos.y !== y) {
        panelPos.x = panelPos.tx = x;
        panelPos.y = panelPos.ty = y;
        panel.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    }
    every(500, placeBarInHeader);
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.74.0: "Show Live as Demo", step 2 - our own "Demo Account" block over Quotex's account block
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Their block (<qx-usermenu-trigger>) is a closed component: its words cannot be changed from outside,
    // so on the live page this draws a copy of how it looks on demo, in the same place, with the live balance.
    // Everything about the look was measured, not guessed: the colour behind it (#1c1f2d, from the layer that
    // really paints there - v1.72.7), the block's own #2b3040, 4 px corners, the cap icon, the orange
    // DEMO ACCOUNT at 10 px bold, the balance at 14 px bold, the arrow - all from a screenshot of their demo
    // block. Clicks go straight through to theirs, so the account menu still opens. It is not drawn when the
    // balance cannot be read (their block would be the only place showing it), and not while their block is
    // taller than a button - a menu drawn inside it must never be covered.
    const demoCover = document.createElement("div");
    demoCover.id = "__tcDemoCover";
    demoCover.hidden = true;
    demoCover.setAttribute("aria-hidden", "true");
    demoCover.innerHTML =
      '<div class="dcBox"></div>' +
      '<svg class="dcCap" viewBox="1 3 22 18" preserveAspectRatio="none"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>' +
      '<span class="dcLbl">DEMO ACCOUNT</span><span class="dcBal"></span>' +
      '<svg class="dcChev" viewBox="0 0 9 5"><path d="M0.75 0.75l3.75 3.5l3.75-3.5"/></svg>';
    // v1.74.1, from a screenshot of this cover beside theirs (both on the live page, measured pixel by pixel):
    // - Theirs is drawn with ClearType, ours was not: Chrome keeps subpixel text only on a fully opaque layer,
    //   and the rounded corners made ours see-through at the edges. The cover is now an opaque rectangle in
    //   the colour behind their block, with the rounded block drawn inside it.
    // - Their block grows to fit its text and keeps its right edge (150 px on demo, 143 on live, where
    //   "LIVE ACCOUNT" is shorter): the arrow sits 10 px after the text and 12 px from the edge. Ours is laid
    //   out by the same rules for "DEMO ACCOUNT", so it is as wide as their demo block, right edge on theirs.
    // - Label and balance start 1 px further left, the balance 1 px lower, the arrow 9 px wide - as theirs.
    const COVER_TEXT_LEFT = 42,
      COVER_ARROW_GAP = 10,
      COVER_ARROW_W = 9,
      COVER_RIGHT_PAD = 12;
    let coverBehind = { at: 0, colour: "#1c1f2d" };
    // The colour that really paints behind their block (v1.72.7: a layer beside it, not a parent), for the
    // cover's corners. Read every few seconds; kept if the read finds nothing.
    function colourBehind(x, y) {
      const now = Date.now();
      if (now - coverBehind.at < 5000 || typeof document.elementsFromPoint !== "function") {
        return coverBehind.colour;
      }
      coverBehind.at = now;
      for (const el of document.elementsFromPoint(x, y)) {
        if (isOurElement(el)) {
          continue;
        }
        const cs = getComputedStyle(el);
        const solid = /rgba?\([^)]+\)/.exec(cs.backgroundColor || "");
        if (solid && isSolid(cs) && !/rgba\([^)]*,\s*0(\.\d+)?\)/.test(solid[0])) {
          coverBehind.colour = solid[0];
          break;
        }
        const inImage = /rgba?\([^)]+\)/.exec(cs.backgroundImage || "");
        if (inImage) {
          coverBehind.colour = inImage[0];
          break;
        }
      }
      return coverBehind.colour;
    }
    shadow.appendChild(demoCover);
    let demoCoverState = "not looked yet";
    function updateDemoCover() {
      const hide = (why) => {
        demoCover.hidden = true;
        demoCoverState = "hidden: " + why;
      };
      if (document.hidden) {
        return;
      }
      if (isDemoPage()) {
        return hide("the demo page already says Demo");
      }
      const host = document.querySelector("qx-usermenu-trigger");
      if (!host) {
        return hide("no account block on the page");
      }
      const r = host.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) {
        return hide("the account block has no box");
      }
      if (r.height > 60) {
        return hide("the account block is open (" + Math.round(r.height) + " px tall)");
      }
      const bal = storeBalance();
      if (isNaN(bal)) {
        return hide("the live balance cannot be read");
      }
      const text = detectCurrency() + fmtMoney(bal),
        balEl = demoCover.querySelector(".dcBal");
      if (balEl.textContent !== text) {
        balEl.textContent = text;
      }
      demoCover.hidden = false; // laid out before it is measured
      const textW = Math.max(demoCover.querySelector(".dcLbl").offsetWidth, balEl.offsetWidth),
        arrowLeft = COVER_TEXT_LEFT + textW + COVER_ARROW_GAP,
        w = arrowLeft + COVER_ARROW_W + COVER_RIGHT_PAD,
        left = Math.round(r.right - w),
        box = [left, Math.round(r.top), w, Math.round(r.height)].map((v) => v + "px");
      if (demoCover.style.left !== box[0] || demoCover.style.top !== box[1] || demoCover.style.width !== box[2] || demoCover.style.height !== box[3]) {
        demoCover.style.left = box[0];
        demoCover.style.top = box[1];
        demoCover.style.width = box[2];
        demoCover.style.height = box[3];
      }
      const chev = demoCover.querySelector(".dcChev");
      if (chev.style.left !== arrowLeft + "px") {
        chev.style.left = arrowLeft + "px";
      }
      const behind = colourBehind(r.right + 4, r.top + r.height / 2);
      if (demoCover.style.backgroundColor !== behind) {
        demoCover.style.backgroundColor = behind;
      }
      demoCoverState = "shown at " + left + "," + Math.round(r.top) + " " + w + "x" + Math.round(r.height) + " (theirs " + Math.round(r.left) + "," + Math.round(r.top) + " " + Math.round(r.width) + "x" + Math.round(r.height) + ")";
    }
    every(500, updateDemoCover);
    panel.onpointerdown = (t) => {
      if (t.target.closest("#__tcSecTargets") && !t.target.closest("input, button, select, textarea")) {
        isDragging = true;
        dragOffsetX = t.clientX - panelPos.x;
        dragOffsetY = t.clientY - panelPos.y;
        panel.classList.add("dragging");
        panel.setPointerCapture(t.pointerId);
      }
    };
    panel.onpointermove = (t) => {
      if (isDragging) {
        panelPos.x = t.clientX - dragOffsetX;
        panelPos.y = t.clientY - dragOffsetY;
        panel.style.transform = `translate3d(${panelPos.x}px, ${panelPos.y}px, 0)`;
      }
    };
    panel.onpointerup = (t) => {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      panel.releasePointerCapture(t.pointerId);
      panelPos.tx = panelPos.x;
      panelPos.ty = panelPos.y;
      clampPanelPos(true);
      panelPos.x = panelPos.tx;
      panelPos.y = panelPos.ty;
      panelPos.vx = 0;
      panelPos.vy = 0;
      panel.style.transform = `translate3d(${panelPos.x}px, ${panelPos.y}px, 0)`;
      panel.classList.remove("dragging");
      const e = getPanelOrigin();
      prefSet(
        "tc_pos",
        JSON.stringify({
          tx: panelPos.tx,
          ty: panelPos.ty,
          x: e.left + panelPos.tx,
          y: e.top + panelPos.ty,
        }),
      );
    };
    window.__tcMiddleClickClose = (t) => {
      if (t.button === 1) {
        const e = getPairTabs().find((tab) => tab.contains(t.target)); // v1.77.0: the tab finder that heals
        if (e) {
          const n = getTabCloseBtn(e);
          if (n) {
            t.preventDefault();
            n.click();
          }
        }
      }
    };
    document.addEventListener("auxclick", window.__tcMiddleClickClose, {
      capture: true,
    });
    const dangerOverlay = document.createElement("div");
    dangerOverlay.id = "__tcDangerOverlay";
    dangerOverlay.setAttribute("aria-live", "assertive");
    dangerOverlay.innerHTML =
      ' <div class="tcLockCard"> <div class="tcLockContent" role="alertdialog" aria-labelledby="__tcLockLabel" aria-describedby="__tcLockMeta"> <span id="__tcLockLabel" class="tcLockLabel">Payout Too Low</span> <span id="__tcLockTimerText" class="tcLockTimer">—%</span> <span id="__tcLockMeta" class="tcLockMeta">Trading blocked until payout recovers</span> </div> </div>';
    shadow.appendChild(dangerOverlay);
    if (!isMobileWidth()) {
      dangerOverlay.style.fontSize = MODAL_FONT_PX + "px";
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Panel element references, section visibility, take-profit input
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const tpInput = byId("__tcTBInput"),
      reqEl = byId("__tcResult"),
      reqFromEl = byId("__tcResultFrom"),
      riskEl = byId("__tcRisk"),
      warnEl = byId("__tcWarn"),
      panelCloseBtn = byId("__tcClose"),
      slInput = byId("__tcSLInput"),
      lockLabelEl = byId("__tcLockLabel"),
      lockTimerEl = byId("__tcLockTimerText"),
      lockMetaEl = byId("__tcLockMeta"),
      minPayoutInput = byId("__tcMinRpInput"),
      multiBtn = byId("__tcMultiStatus"),
      contentEl = byId("__tcContent"),
      loaderEl = byId("__tcLoader"),
      loaderTextEl = byId("__tcLoaderText"),
      projectionsDot = qs("#__tcSecProjections .tcDot"),
      targetsDot = qs("#__tcSecTargets .tcDot"),
      tpCurrencyEl = panel.querySelector(".tcTPCur");
    // v1.54.0: which build this tab is running, in the panel itself. It was only in the popup's health
    // check, which is the wrong place for the question it answers - reloading the extension does not
    // update an open tab, and that mismatch looks exactly like "the fix did nothing".
    (function () {
      const el = byId("__tcVer");
      if (!el) {
        return;
      }
      const shown = /^[0-9]/.test(BUILD_VERSION) ? "v" + BUILD_VERSION : "dev";
      el.textContent = shown;
      el.setAttribute(
        "data-tc-tip",
        "Panel build " + shown + " \u2014 after updating, reload the extension AND refresh this tab",
      );
    })();
    if (reqEl) {
      reqEl._tcNoFlash = true;
    }
    if (reqFromEl) {
      reqFromEl._tcNoFlash = true;
    }
    if (riskEl) {
      riskEl._tcNoFlash = true;
    }
    function updateScrollAffordance() {
      if (!contentEl) {
        return;
      }
      const t = contentEl.scrollWidth - contentEl.clientWidth > 2;
      contentEl.classList.toggle("tcScrollable", t);
      const e = t && contentEl.scrollLeft + contentEl.clientWidth >= contentEl.scrollWidth - 2;
      contentEl.classList.toggle("tcScrollEnd", e);
    }
    if (contentEl) {
      window.__tcScrollAffordance = updateScrollAffordance;
      contentEl.addEventListener("scroll", updateScrollAffordance, {
        passive: true,
      });
      window.addEventListener("resize", updateScrollAffordance);
      requestAnimationFrame(() => requestAnimationFrame(updateScrollAffordance));
    }
    let multiMode = (() => {
      try {
        return prefGet("__tradeCalc_multi") === "1";
      } catch (t) {
        return false;
      }
    })();
    function renderMultiBtn() {
      var t, e;
      e = multiMode;
      (t = multiBtn).classList.toggle("on", e);
      t.setAttribute("aria-pressed", e ? "true" : "false");
    }
    renderMultiBtn();
    const autosizeInput = (t) => {
        if (t.id !== "__tcTBInput" && t.id !== "__tcSLInput") {
          return;
        }
        const e = Math.max(t.value.length, t.placeholder ? t.placeholder.length : 1);
        t.style.width = `calc(${e}ch + 0.55em)`;
      },
      reformatMoneyInput = (t) => {
        t.value = fmtInputMoney(parsePlainNumber(t.value));
        autosizeInput(t);
      };
    function saveTp() {
      if (!tpInput) {
        return;
      }
      const t = tpInput.value.replace(/[^0-9.-]/g, "");
      setTpStored(t);
      reformatMoneyInput(tpInput);
      const e = getDayKey();
      setTpManualDate(e);
      if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({
          [KEY_TP]: t,
          [KEY_TP_MANUAL_DATE]: e,
        });
      }
      scheduleRecalc();
    }
    if (tpInput) {
      tpInput.value = fmtInputMoney(getTpStored());
      autosizeInput(tpInput);
      tpInput.addEventListener("input", () => autosizeInput(tpInput));
      tpInput.addEventListener("keydown", (t) => {
        if (t.key === "Enter") {
          saveTp();
          tpInput.blur();
        }
      });
      tpInput.addEventListener("blur", () => {
        tpInput.readOnly = true;
        reformatMoneyInput(tpInput);
      });
      tpInput.addEventListener("mouseenter", () => {
        tpInput.readOnly = false;
      });
      tpInput.addEventListener("mouseleave", () => {
        if (activeEl() !== tpInput) {
          tpInput.readOnly = true;
        }
      });
      tpInput.addEventListener("focus", () => {
        tpInput.readOnly = false;
      });
      if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get([KEY_TP, KEY_TP_MANUAL_DATE], (t) => {
          if (!t) {
            return;
          }
          const e = t[KEY_TP_MANUAL_DATE];
          if (e === getDayKey() && t[KEY_TP] && getTpManualDate() !== e) {
            setTpStored(String(t[KEY_TP]));
            setTpManualDate(e);
            tpInput.value = fmtInputMoney(getTpStored());
            autosizeInput(tpInput);
            scheduleRecalc();
          }
        });
      }
    }
    // v1.67.0: the SL is a number you set, and it stays until you change it. The daily setup screen and the
    // trailing are gone: both existed to manage the SL for you, and the SL itself does nothing when the
    // balance reaches it - the lock it once triggered went in v1.21.0, and the signal left in its place had
    // no listener. So it is a reference you keep yourself, and the only thing that changes it is you.
    // Enter or leaving the field commits; Escape puts back what was there; an empty field clears it, which
    // replaces the popup switch that used to turn the SL off.
    function commitSlEdit() {
      if (!slInput) {
        return;
      }
      const stored = parseFloat(prefGet(KEY_SL)),
        raw = slInput.value.trim();
      const revert = (why) => {
        slInput.value = isFinite(stored) && stored > 0 ? fmtInputMoney(stored) : "";
        autosizeInput(slInput);
        if (why && warnEl) {
          setText(warnEl, why);
          setDisplay(warnEl, "block");
          warnEl.classList.add("tcWarnVisible");
        }
      };
      if (raw === "") {
        prefRemove(KEY_SL);
        autosizeInput(slInput);
        scheduleRecalc();
        return;
      }
      const typed = parsePlainNumber(raw),
        balance = readAccountBalance();
      if (isNaN(typed) || typed <= 0) {
        return revert("SL must be a number above zero");
      }
      // Nothing locks at the SL any more, so this is not a safety stop - but a number at or above the
      // balance is almost always a slipped digit, and catching it costs nothing.
      if (isFinite(balance) && balance > 0 && typed >= balance) {
        return revert("SL must be below your balance");
      }
      applySl(Math.floor(typed));
    }
    if (slInput) {
      const saved = parseFloat(prefGet(KEY_SL));
      slInput.value = isFinite(saved) && saved > 0 ? fmtInputMoney(saved) : "";
      autosizeInput(slInput);
      slInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commitSlEdit();
          slInput.blur();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          const stored = parseFloat(prefGet(KEY_SL));
          slInput.value = isFinite(stored) && stored > 0 ? fmtInputMoney(stored) : "";
          autosizeInput(slInput);
          slInput.blur();
        }
      });
      slInput.addEventListener("blur", commitSlEdit);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Stop loss: the trading day, and the SL you set
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Trading-day key "YYYY-MM-DD" in the account timezone (v1.24.0; was fixed at IST). Resets SL, TP
    // lock and the loss streak at local midnight.
    function getDayKey() {
      return new Date(Date.now() + accountTzOffsetMs()).toISOString().slice(0, 10);
    }
    function applySl(t) {
      const e = parseFloat(t);
      if (isNaN(e) || e <= 0) {
        return;
      }
      setSlStored(String(e));
      if (slInput) {
        slInput.value = fmtInputMoney(e);
        autosizeInput(slInput);
      }
      scheduleRecalc();
    }
    // Daily stop-loss setup (v1.24.0: editable). Suggests 85% of the balance; the amount can be typed or
    // picked with the % buttons. Confirming stores today's SL and the trail distance it implies, so a
    // lower SL isn't immediately pulled back up by the trailing SL (see slPreTpTrail).
    const SL_SETUP_PRESETS = [70, 75, 80, 85, 90];
    const SL_SETUP_DEFAULT_PCT = 85;
    const setPanelFontSize = (t) => {
        if (isMobileWidth()) {
          return;
        }
        const e = panel.getBoundingClientRect().right;
        panelFontSize = Math.min(Math.max(t, 8), 48);
        panel.style.fontSize = panelFontSize + "px";
        const n = panel.offsetWidth,
          o = getPanelOrigin();
        panelPos.x = e - n - o.left;
        panelPos.tx = panelPos.x;
        panelPos.ty = panelPos.y;
        ((t) => {
          try {
            prefSet(KEY_FONT_SIZE, t);
          } catch (t) {}
        })(panelFontSize);
        panel.style.transform = `translate3d(${panelPos.x}px, ${panelPos.y}px, 0)`;
        clampPanelPos();
        panel.style.transform = `translate3d(${panelPos.x}px, ${panelPos.y}px, 0)`;
        const r = byId(ids.tcTradeTimer);
        if (r) {
          r.style.fontSize = panelFontSize + "px";
        }
        const a = byId(ids.tcProjChip);
        if (a) {
          a.style.fontSize = panelFontSize + "px";
        }
      },
      fmtPercentInput = (t) => t + "%";
    if (minPayoutInput) {
      minPayoutInput.value = fmtPercentInput(getMinPayoutStored());
      const t = () => {
        const t = minPayoutInput.value.replace(/[^0-9]/g, "");
        let e = parseInt(t, 10);
        if (isNaN(e)) {
          e = parseInt(getMinPayoutStored(), 10) || 89;
        }
        if (e < 1) {
          e = 1;
        }
        if (e > 100) {
          e = 100;
        }
        setMinPayoutStored(String(e));
        minPayoutInput.value = fmtPercentInput(e);
      };
      minPayoutInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          t();
          minPayoutInput.blur();
          scheduleRecalc();
        }
      });
      minPayoutInput.addEventListener("blur", t);
    }
    function flashCommit(t) {
      const e = t.closest(".tcControlGroup");
      if (e) {
        e.classList.remove("tcCommit");
        e.offsetWidth;
        e.classList.add("tcCommit");
        e.addEventListener("animationend", () => e.classList.remove("tcCommit"), {
          once: true,
        });
      }
    }
    if (panel) {
      const t = panel.querySelectorAll(".tcInput");
      for (let e = 0; e < t.length; e++) {
        t[e].addEventListener("input", (t) => t.target.classList.add("tcUnsaved"));
        t[e].addEventListener("blur", (t) => t.target.classList.remove("tcUnsaved"));
        t[e].addEventListener("keydown", (t) => {
          if (t.key === "Enter") {
            t.target.classList.remove("tcUnsaved");
            flashCommit(t.target);
          }
        });
        t[e].title = "Press Enter to save changes";
      }
    }
    if (multiBtn) {
      multiBtn.addEventListener("click", () => {
        var t;
        multiMode = !multiMode;
        ((t) => {
          try {
            prefSet("__tradeCalc_multi", t ? "1" : "0");
          } catch (t) {}
        })(multiMode);
        renderMultiBtn();
        (t = multiBtn).classList.remove("tcPillSnap");
        t.offsetWidth;
        t.classList.add("tcPillSnap");
        t.addEventListener("animationend", () => t.classList.remove("tcPillSnap"), {
          once: true,
        });
      });
    }
    window.__tcInputDelegator = (t) => {
      if (t.target.closest && t.target.closest(".deal-amount-input")) {
        scheduleRecalc();
      }
    };
    document.addEventListener("input", window.__tcInputDelegator, {
      passive: true,
      capture: true,
    });
    window.__tcClickDelegator = (t) => {
      if (
        t.target.closest &&
        t.target.closest(".VK9Nw, .YqVwL, ._hHHo, .tab-item, .asset-item, .payout-item")
      ) {
        setTimeout(scheduleRecalc, 50);
      }
    };
    const restoreBtn = document.createElement("button");
    restoreBtn.id = "__tcRestoreBtn";
    restoreBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 8 12 12 16 14"></polyline></svg> QXTradeLens';
    restoreBtn.style.display = "none";
    restoreBtn.onclick = () => {
      panel.style.display = "flex";
      restoreBtn.style.display = "none";
    };
    if (isLightTheme) {
      restoreBtn.classList.add("tcLightMode");
    }
    shadow.appendChild(restoreBtn);
    if (panelCloseBtn) {
      panelCloseBtn.addEventListener("click", () => {
        panel.style.display = "none";
        restoreBtn.style.display = "flex";
      });
    }
    // Settings the popup used to write go to chrome.storage.sync as well as the page's storage: the loader
    // further down copies sync over the local value on every start, so a local-only write would be undone.
    function syncSet(obj) {
      try {
        if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
          const r = chrome.storage.sync.set(obj);
          if (r && typeof r.catch === "function") {
            r.catch(() => {});
          }
        }
      } catch (e) {}
    }
    // v1.69.0: MAX - the most trades open at once, typed on the bar (it was a select in the popup). Saved on
    // Enter or when the box is left, like PAYOUT.
    const maxTradesInput = byId("__tcMaxTradesInput");
    function renderMaxTradesField() {
      if (maxTradesInput && activeEl() !== maxTradesInput) {
        maxTradesInput.value = String(maxTrades);
      }
    }
    if (maxTradesInput) {
      renderMaxTradesField();
      const commit = () => {
        const n = parseInt(maxTradesInput.value.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(n) && clampMaxTrades(n) !== maxTrades) {
          maxTrades = clampMaxTrades(n);
          setMaxTradesStored(maxTrades);
          syncSet({ [KEY_MAX_TRADES]: maxTrades });
          scheduleRecalc();
        }
        maxTradesInput.value = String(maxTrades);
      };
      maxTradesInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          commit();
          maxTradesInput.blur();
        }
      });
      maxTradesInput.addEventListener("blur", commit);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // ⚙ menu (v1.69.0): everything the popup held apart from the chart settings - theme, size, the ↑↓
    // hotkey and Focus Mode, the compatibility check, and the deposit scan.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const menuBtn = byId("__tcMenuBtn"),
      menuEl = byId("__tcMenu"),
      MENU_SIZE_MIN = 10,
      MENU_SIZE_MAX = 32,
      DEPOSIT_RESULT_KEY = "__qxDepositScan",
      DEPOSIT_SHOW_KEY = "__qxDepositShow";
    // After an extension reload the old script keeps running in the tab, but its link to the extension is
    // cut and chrome.runtime.id goes away - the "reloaded but not refreshed" case the popup's health check
    // used to find by comparing versions.
    const extensionGone = () => !(typeof chrome != "undefined" && chrome.runtime && chrome.runtime.id);
    const menuPart = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) {
        el.className = cls;
      }
      if (text != null) {
        el.textContent = text;
      }
      return el;
    };
    function applyTheme(theme) {
      const light = theme === "light";
      setThemeStored(light ? "light" : "dark");
      panel.classList.toggle("tcLightMode", light);
      restoreBtn.classList.toggle("tcLightMode", light);
    }
    if (menuEl) {
      menuEl.innerHTML =
        '<div class="tcMenuHd">Settings</div>' +
        '<div class="tcMenuRow"><span class="tcMenuLbl">Theme</span><span class="tcSeg"><button type="button" class="tcMenuBtn" data-mn="dark">Dark</button><button type="button" class="tcMenuBtn" data-mn="light">Light</button></span></div>' +
        '<div class="tcMenuRow"><span class="tcMenuLbl">Size</span><span class="tcSeg"><button type="button" class="tcMenuBtn" data-mn="smaller" aria-label="Smaller">\u2212</button><span class="tcMenuVal" id="__tcMnSize"></span><button type="button" class="tcMenuBtn" data-mn="bigger" aria-label="Bigger">+</button></span></div>' +
        '<div class="tcMenuRow"><span><span class="tcMenuLbl">\u2191\u2193 places trades</span><span class="tcMenuSub">\u2191 is Up, \u2193 is Down. \u2190 \u2192 always halve / double the amount</span></span><button type="button" class="tcSwitch" role="switch" data-mn="updown" aria-label="Arrow keys place trades"></button></div>' +
        '<div class="tcMenuRow"><span><span class="tcMenuLbl">Focus Mode</span><span class="tcMenuSub">\u2191\u2193 only select Up / Down - your Enter presses it</span></span><button type="button" class="tcSwitch" role="switch" data-mn="focus" aria-label="Focus mode"></button></div>' +
        '<div class="tcMenuSep"></div>' +
        '<div class="tcMenuHd">Charts</div>' +
        '<div class="tcMenuRow"><span><span class="tcMenuLbl">Timeframes</span><span class="tcMenuSub">Up to 4, e.g. 1m, 5m, 15m - Enter to save. C shows / hides the charts</span></span><input type="text" class="tcMenuInput tcMenuInputWide" id="__tcMnTfs" aria-label="Chart timeframes" autocomplete="off" spellcheck="false" /></div>' +
        '<div class="tcMenuRow"><span><span class="tcMenuLbl">Fill charts when a pair opens</span><span class="tcMenuSub">Visits each timeframe once to collect its candles</span></span><button type="button" class="tcSwitch" role="switch" data-mn="mtfFill" aria-label="Fill charts when a pair opens"></button></div>' +
        '<div class="tcMenuRow"><span><span class="tcMenuLbl">Mark when a chart turns</span><span class="tcMenuSub">An arrow for two minutes when its direction reverses</span></span><button type="button" class="tcSwitch" role="switch" data-mn="mtfFlip" aria-label="Mark when a chart turns"></button></div>' +
        '<div class="tcMenuRow"><span><span class="tcMenuLbl">Bars to confirm a turn</span><span class="tcMenuSub">Fewer reacts sooner, more is steadier (2 to 10)</span></span><span class="tcSeg"><button type="button" class="tcMenuBtn" data-mn="barsDown" aria-label="Fewer bars">\u2212</button><span class="tcMenuVal" id="__tcMnBars"></span><button type="button" class="tcMenuBtn" data-mn="barsUp" aria-label="More bars">+</button></span></div>' +
        '<div class="tcMenuRow"><span><span class="tcMenuLbl">Wait before filling</span><span class="tcMenuSub">Seconds a pair stays open first - 0 fills at once (up to 120). Enter to save</span></span><span class="tcSeg"><input type="text" inputmode="numeric" class="tcMenuInput" id="__tcMnWait" aria-label="Seconds to wait before filling" autocomplete="off" /><span class="tcMenuNote">s</span></span></div>' +
        '<div class="tcMenuSep"></div>' +
        '<div class="tcMenuRow"><span class="tcMenuLbl">Quotex compatibility</span><button type="button" class="tcMenuBtn" data-mn="health">Check</button></div>' +
        '<div class="tcMenuOut" id="__tcMnHealth"></div>' +
        '<div class="tcMenuSep"></div>' +
        '<div class="tcMenuRow"><span><span class="tcMenuLbl">Deposits</span><span class="tcMenuSub">Opens your Balance page, reads every page, then brings you back here</span></span><button type="button" class="tcMenuBtn" data-mn="deposits">Scan</button></div>' +
        '<div class="tcMenuOut" id="__tcMnDeposits"></div>';
    }
    function renderHealth() {
      const out = byId("__tcMnHealth");
      if (!out) {
        return;
      }
      out.textContent = "";
      if (extensionGone()) {
        out.appendChild(menuPart("div", "tcMenuWarn", "The extension was updated - refresh this tab to use the new version."));
      }
      const report = safeHealthReport();
      if (report.error) {
        out.appendChild(menuPart("div", "tcMenuWarn", "Check failed: " + report.error));
        return;
      }
      const missing = report.rows.filter((r) => r.status === "missing").length,
        fallback = report.rows.filter((r) => r.status === "fallback").length;
      out.appendChild(
        menuPart(
          "div",
          missing ? "tcMenuWarn" : "",
          missing ? missing + " missing" + (fallback ? " \u00b7 " + fallback + " fallback" : "") : fallback ? "Working \u00b7 " + fallback + " through a fallback" : "All OK",
        ),
      );
      const icon = { ok: "\u2705", fallback: "\ud83d\udd01", missing: "\u274c", idle: "\u2013" },
        list = menuPart("div", "tcMenuList");
      for (const r of report.rows) {
        const line = menuPart("div", "tcMenuLine"),
          name = menuPart("span", "", (icon[r.status] || "\u2022") + " " + r.name),
          val = menuPart("span", "tcMenuNote", r.value);
        name.title = r.via;
        val.title = r.value;
        line.append(name, val);
        list.appendChild(line);
      }
      out.appendChild(list);
      out.appendChild(menuPart("div", "tcMenuNote", "Panel " + (/^[0-9]/.test(BUILD_VERSION) ? "v" + BUILD_VERSION : "dev")));
    }
    const fmtDeposit = (n, symbol) =>
      (symbol || "") +
      Number(n || 0).toLocaleString(symbol === "\u20b9" ? "en-IN" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    let depositNote = "";
    // The scan itself runs in the service worker (deposit_scan.js): it has to walk the Balance page, where
    // the panel does not run. Its result waits in chrome.storage.local and is drawn here, once.
    function drawDeposits(res) {
      const out = byId("__tcMnDeposits");
      if (!out) {
        return;
      }
      out.textContent = "";
      if (depositNote) {
        out.appendChild(menuPart("div", "tcMenuWarn", depositNote));
      }
      if (!res) {
        return;
      }
      if (res.error) {
        out.appendChild(menuPart("div", "tcMenuWarn", "Scan failed: " + res.error + ". Make sure you are logged in and try again."));
        return;
      }
      const count = res.count || 0;
      out.appendChild(
        menuPart(
          "div",
          "tcMenuBig",
          res.totals && res.totals.length ? res.totals.map((g) => fmtDeposit(g.total, g.symbol)).join(" + ") : fmtDeposit(0, ""),
        ),
      );
      const when = new Date(res.at || Date.now()).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      out.appendChild(
        menuPart(
          "div",
          "tcMenuNote",
          count + " successful deposit" + (count === 1 ? "" : "s") + " \u00b7 " + res.pages + " page" + (res.pages === 1 ? "" : "s") +
            " \u00b7 " + when + (res.cancelled ? " \u00b7 stopped early" : ""),
        ),
      );
      if (!count) {
        out.appendChild(menuPart("div", "tcMenuNote", "No successful deposits found."));
        return;
      }
      const methods = menuPart("div", "tcMenuList");
      for (const g of res.methods || []) {
        const line = menuPart("div", "tcMenuLine");
        line.append(menuPart("span", "", g.method + " \u00d7 " + g.count), menuPart("span", "", fmtDeposit(g.total, g.symbol)));
        methods.appendChild(line);
      }
      out.appendChild(methods);
      const recent = menuPart("div", "tcMenuList");
      for (const tx of res.recent || []) {
        const line = menuPart("div", "tcMenuLine");
        line.append(menuPart("span", "tcMenuNote", tx.id + " " + (tx.payment || "")), menuPart("span", "", fmtDeposit(tx.amount, tx.symbol)));
        recent.appendChild(line);
      }
      if (count > (res.recent || []).length) {
        recent.appendChild(menuPart("div", "tcMenuNote", "\u2026and " + (count - (res.recent || []).length) + " more"));
      }
      out.appendChild(recent);
    }
    function startDepositScan() {
      if (extensionGone()) {
        depositNote = "The extension was updated - refresh this tab first.";
        return;
      }
      try {
        const r = chrome.runtime.sendMessage({ type: "DEPOSIT_SCAN_START" });
        if (r && typeof r.catch === "function") {
          r.catch(() => {});
        }
        depositNote = "Opening your Balance page\u2026";
      } catch (e) {
        depositNote = "Could not start - refresh this tab and try again.";
      }
    }
    // v1.70.0: the chart settings, moved from the popup (now deleted). Each is written to the page's storage,
    // to sync (the loader copies sync over the local value on every start), and the chart box is rebuilt so
    // it shows the change at once - what the popup's SET_MTF message did.
    function saveChartSetting(key, value) {
      syncSet({ [key]: value });
      rebuildMtf();
    }
    function saveChartTfs() {
      const box = byId("__tcMnTfs");
      if (!box) {
        return;
      }
      const tfs = parseTfList(box.value);
      box.value = tfs.join(", ");
      if (tfs.join(",") !== getMtfTfs().join(",")) {
        setMtfTfs(tfs);
        saveChartSetting(KEY_MTF_TFS, tfs);
      }
    }
    function saveChartWait() {
      const box = byId("__tcMnWait");
      if (!box) {
        return;
      }
      const n = clampMtfSettle(String(box.value).replace(/[^0-9-]/g, "") || getMtfSettle());
      box.value = String(n);
      if (n !== getMtfSettle()) {
        setMtfSettle(n);
        saveChartSetting(KEY_MTF_SETTLE, n);
      }
    }
    function renderMenu() {
      if (!menuEl) {
        return;
      }
      const light = getTheme() === "light",
        mark = (what, on) => {
          const el = menuEl.querySelector('[data-mn="' + what + '"]');
          if (el) {
            el.setAttribute("aria-checked", on ? "true" : "false");
          }
        };
      menuEl.querySelector('[data-mn="dark"]').classList.toggle("tcOn", !light);
      menuEl.querySelector('[data-mn="light"]').classList.toggle("tcOn", light);
      const size = byId("__tcMnSize");
      if (size) {
        size.textContent = panelFontSize + "px";
      }
      mark("updown", hkUpDown);
      mark("focus", hkFocusMode);
      mark("mtfFill", mtfAutofill);
      mark("mtfFlip", mtfFlipOn);
      const tfsBox = byId("__tcMnTfs"),
        waitBox = byId("__tcMnWait"),
        bars = byId("__tcMnBars");
      if (tfsBox && activeEl() !== tfsBox) {
        tfsBox.value = getMtfTfs().join(", ");
      }
      if (waitBox && activeEl() !== waitBox) {
        waitBox.value = String(getMtfSettle());
      }
      if (bars) {
        bars.textContent = String(getMtfFlipBars());
      }
    }
    function setMenuOpen(open) {
      if (!menuEl || !menuBtn) {
        return;
      }
      menuEl.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        renderMenu();
      } else {
        // v1.71.0: the check and the deposit result are shown once. Closing the menu clears them, so the
        // next time it opens they are gone until Check or Scan is pressed again.
        depositNote = "";
        for (const id of ["__tcMnHealth", "__tcMnDeposits"]) {
          const out = byId(id);
          if (out) {
            out.textContent = "";
          }
        }
      }
    }
    if (menuEl && menuBtn) {
      menuBtn.addEventListener("click", () => setMenuOpen(menuEl.hidden));
      menuEl.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          setMenuOpen(false);
          menuBtn.focus();
        } else if (e.key === "Enter" && e.target && (e.target.id === "__tcMnTfs" || e.target.id === "__tcMnWait")) {
          e.target.blur();
        }
      });
      // A typed box is saved when it is left - Enter leaves it - like the bar's own fields.
      const tfsBox = byId("__tcMnTfs"),
        waitBox = byId("__tcMnWait");
      if (tfsBox) {
        tfsBox.addEventListener("blur", saveChartTfs);
      }
      if (waitBox) {
        waitBox.addEventListener("blur", saveChartWait);
      }
      menuEl.addEventListener("click", (e) => {
        const b = e.target.closest("[data-mn]");
        if (!b) {
          return;
        }
        const what = b.getAttribute("data-mn");
        if (what === "dark" || what === "light") {
          applyTheme(what);
        } else if (what === "smaller" || what === "bigger") {
          setPanelFontSize(Math.min(MENU_SIZE_MAX, Math.max(MENU_SIZE_MIN, panelFontSize + (what === "bigger" ? 1 : -1))));
        } else if (what === "updown") {
          hkUpDown = !hkUpDown;
          setHkUpDownStored(hkUpDown);
          syncSet({ [KEY_HK_UPDOWN]: hkUpDown });
        } else if (what === "focus") {
          hkFocusMode = !hkFocusMode;
          prefSet(KEY_HK_FOCUS_MODE, hkFocusMode ? "1" : "0");
        } else if (what === "mtfFill") {
          setMtfAutofill(!mtfAutofill);
          saveChartSetting(KEY_MTF_AUTOFILL, mtfAutofill);
        } else if (what === "mtfFlip") {
          setMtfFlip(!mtfFlipOn);
          saveChartSetting(KEY_MTF_FLIP, mtfFlipOn);
        } else if (what === "barsDown" || what === "barsUp") {
          const n = clampFlipBars(getMtfFlipBars() + (what === "barsUp" ? 1 : -1));
          if (n !== getMtfFlipBars()) {
            setMtfFlipBars(n);
            saveChartSetting(KEY_MTF_FLIP_BARS, n);
          }
        } else if (what === "health") {
          renderHealth();
        } else if (what === "deposits") {
          startDepositScan();
          drawDeposits(null);
        }
        renderMenu();
      });
      // A press anywhere outside our own elements closes it. Our elements all sit under one host, which is
      // what a listener on the page's document sees of them.
      window.__tcMenuOutside = (e) => {
        if (!menuEl.hidden && !e.composedPath().includes(shadowHost)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener("pointerdown", window.__tcMenuOutside, true);
      // Coming back from a deposit scan: open the menu on the result. It is shown this once - it is taken
      // out of storage as it is drawn (v1.71.0).
      try {
        if (!extensionGone() && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([DEPOSIT_SHOW_KEY, DEPOSIT_RESULT_KEY], (d) => {
            if (d && d[DEPOSIT_SHOW_KEY]) {
              chrome.storage.local.remove([DEPOSIT_SHOW_KEY, DEPOSIT_RESULT_KEY]);
              setMenuOpen(true);
              drawDeposits(d[DEPOSIT_RESULT_KEY]);
            }
          });
        }
      } catch (e) {}
    }
    const mtfToggleBtn = byId("__tcMtfToggle");
    if (mtfToggleBtn) {
      mtfToggleBtn.addEventListener("click", () => {
        toggleMtf();
      });
    }
    let flashQueue = [],
      flashRaf = 0;
    function flushFlashQueue() {
      flashRaf = 0;
      for (let t = 0; t < flashQueue.length; t++) {
        flashQueue[t].classList.add("tcFlashData");
      }
      flashQueue = [];
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // DOM write helpers + reading balance / open trades from the page
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const setText = (t, e) => {
        if (!t) {
          return;
        }
        const n = String(e);
        if (t._t !== n) {
          t.textContent = t._t = n;
          if (!t._tcNoFlash) {
            ((t) => {
              t.classList.remove("tcFlashData");
              flashQueue.push(t);
              if (!flashRaf) {
                flashRaf = requestAnimationFrame(flushFlashQueue);
              }
            })(t);
          }
        }
      },
      setColor = (t, e) => {
        if (t._c !== e) {
          t.style.color = t._c = e;
        }
      },
      setDisplay = (t, e) => {
        if (t && t._d !== e) {
          t.style.display = t._d = e;
        }
      },
      setTpStep = (t) => {
        const e = String(t);
        if (tpInput._step !== e) {
          tpInput.step = tpInput._step = e;
        }
      };
    const pnlElsLive = document.getElementsByClassName("lCITV"),
      tabPnlElsLive = document.getElementsByClassName("Pdqth"),
      openTradeRowsLive = document.getElementsByClassName("A7vDd"),
      openTradePnlElsLive = document.getElementsByClassName("Os2ep");
    function isSettledRow(t) {
      return !(!t || !t.querySelector(".Fqtla"));
    }
    // v1.34.0: the longest expiry the platform offers is four hours, so a block counting 11:39:34 is the
    // session clock, not a trade. Live on 2026-09-20 the semantic finder matched exactly that and drew a
    // countdown chip reading 696:10 with no trade running.
    const MAX_TRADE_SECS = 14400;
    function hasRunningClock(row) {
      const el = row && findClockEl(row);
      if (!el) {
        return false;
      }
      const secs = parseClock((el.textContent || "").trim());
      return secs > 0 && secs <= MAX_TRADE_SECS;
    }
    function getOpenTradeRows() {
      if (openTradeRowsLive.length) {
        listVia.openTradeRows = "class";
        // Belt and braces: this list is the platform's own open-deal rows, but a settled row keeps its
        // markup, so anything carrying a settled marker or an implausible clock is dropped here too.
        // An empty result is an ANSWER - do not fall through to the guesswork below, which is what
        // matched the session clock on the live page.
        return confirmedByStore(Array.from(openTradeRowsLive).filter((row) => !isSettledRow(row) && hasRunningClock(row)));
      }
      // v1.25.0: a running trade's row holds both a pair name and a mm:ss countdown, and no settled marker.
      const rows = resolveList("openTradeRows", document, [".ib6yR", ".RLj1p"], (root) => {
        const clocks = leafMatches(root, CLOCK_ONLY_RE);
        const chart = getChartBox();
        const seen = new Set();
        const out = [];
        for (const clock of clocks) {
          for (let el = clock.parentElement, hops = 0; el && hops < 4; el = el.parentElement, hops++) {
            // Stop before anything page-sized: a deal row is a small block holding one pair and one clock.
            if (el.closest("#__tradeCalc") || el.querySelector("#graph, #trade-button, #tab-active") || (chart && el.contains(chart))) {
              break;
            }
            const text = textIn(el);
            if (text.length > 120 || !PAIR_TEXT_RE.test(text)) {
              continue;
            }
            if (!seen.has(el)) {
              seen.add(el);
              out.push(el);
            }
            break;
          }
        }
        // v1.84.1: checked against Quotex's data before it can be remembered - otherwise a block the data had
        // just ruled out was found and learnt again at once.
        return confirmedByStore(out.filter((row) => !isSettledRow(row) && hasRunningClock(row)));
      });
      const running = rows.filter((row) => !isSettledRow(row) && hasRunningClock(row)),
        confirmed = confirmedByStore(running);
      // A remembered name whose rows Quotex's data says are not open trades is forgotten, so the rows are looked
      // for afresh - the same re-check the pair list and "+" have (v1.80.0).
      if (listVia.openTradeRows === "learned" && confirmed.length < running.length) {
        forgetLearned("list:openTradeRows");
      }
      return confirmed;
    }
    // v1.84.0: when Quotex's data answers, a row on the page is an open trade only if its pair is one Quotex
    // says is open. Read live on 1.83.0: "no open trades · 1 on the page" - a block remembered in 2026-09 as a
    // trade row still passed as one. Without the data, the page is all there is and is kept as found.
    function confirmedByStore(rows) {
      const state = readQuotexState();
      if (!rows.length || !state || !Array.isArray(state.openedDeals)) {
        return rows;
      }
      const assets = readQuotexAssets() || {};
      const pairs = dealsForThisAccount(state.openedDeals)
        .map((d) => normKey((assets[d.asset] && assets[d.asset].label) || d.asset || ""))
        .filter(Boolean);
      return rows.filter((row) => {
        const text = normKey(textIn(row));
        return pairs.some((p) => text.includes(p));
      });
    }
    function getOpenTradePnlEls() {
      if (openTradePnlElsLive.length) {
        return Array.from(openTradePnlElsLive);
      }
      const t = [];
      for (let e = 0; e < pnlElsLive.length; e++) {
        const n = pnlElsLive[e];
        if (n.closest(".ib6yR") && !n.closest(".Fqtla")) {
          t.push(n);
        }
      }
      return t.length ? t : Array.from(tabPnlElsLive);
    }
    let openPnlEls = getOpenTradePnlEls(),
      accountBalanceEl = null;
    // v1.57.0: the balance as Quotex itself holds it. Their account block is now
    // <qx-usermenu-trigger>, a custom element with a CLOSED shadow root - the same trick this panel uses
    // to hide itself - so the number is not in the document at all. No selector reaches it, no text scan
    // finds it, and no semantic finder can be written that would: `querySelectorAll` stops at a shadow
    // boundary and a closed root hands out no reference. The store is the only source left, and by this
    // project's first working rule it should have been the first source all along.
    //
    // Which figure: the route decides, because that is what the user is looking at. `balance` (the
    // active account's) covers a build that does not carry the split.
    function storeBalance() {
      const state = readQuotexState();
      if (!state) {
        return NaN;
      }
      const demo = isDemoPage(),
        ofRoute = demo ? state.demoBalance : state.liveBalance,
        num = (v) => (typeof v == "number" && isFinite(v) ? v : NaN);
      let pick = num(ofRoute);
      if (isNaN(pick)) {
        pick = num(state.balance);
      }
      // A zero that comes from the account the page is NOT on is the other account's emptiness, not this
      // one's: keep waiting rather than announcing "no balance to protect".
      if (
        pick === 0 &&
        state.activeAccount &&
        (demo ? state.activeAccount !== "demo" : state.activeAccount === "demo")
      ) {
        return NaN;
      }
      return pick;
    }
    function readAccountBalance() {
      const fromStore = storeBalance();
      if (!isNaN(fromStore)) {
        return fromStore;
      }
      let t = accountBalanceEl && accountBalanceEl.isConnected ? accountBalanceEl : null;
      if (!t) {
        t = document.evaluate(
          "//div[text()='Live Account' or text()='Demo Account']/following-sibling::div",
          document,
          null,
          9,
          null,
        ).singleNodeValue;
        accountBalanceEl = t;
      }
      if (t) {
        const e = parseMoney(t.textContent);
        if (!isNaN(e)) {
          return e;
        }
      }
      return readBalance();
    }
    function sumOpenPnl() {
      const t = getOpenTradePnlEls();
      if (!t.length) {
        // v1.25.0: same figure the deal rows show — full return on a winning trade, 0 on a losing one.
        const fromStore = storeOpenTrades();
        if (fromStore && fromStore.length) {
          return fromStore.reduce((sum, trade) => sum + (trade.liveReturn || 0), 0);
        }
      }
      let e = 0;
      for (let n = 0, o = t.length; n < o; n++) {
        const o = parseMoney(t[n].textContent);
        if (!isNaN(o)) {
          e += o;
        }
      }
      return e;
    }
    let projBalRow = null,
      projBalWinEl = null,
      projBalLossEl = null;
    function renderProjectedBalances(t, e) {
      const n = tradeButtonsBlock();
      if (!n || !n.parentElement) {
        projBalRow = projBalWinEl = projBalLossEl = null;
        return;
      }
      if (!projBalRow || !projBalRow.isConnected) {
        projBalRow = byId(ids.tcProjBalRow);
        if (projBalRow) {
          projBalWinEl = projBalRow.querySelector(".__tcProjBalWin");
          projBalLossEl = projBalRow.querySelector(".__tcProjBalLoss");
        } else {
          projBalRow = document.createElement("div");
          projBalRow.id = ids.tcProjBalRow;
          const t = n.previousElementSibling;
          if (t && typeof t.className == "string" && t.id !== ids.tcProjBalRow) {
            projBalRow.className = t.className;
          }
          const e = document.createElement("span");
          e.style.cssText =
            "display:inline-flex; gap:0.5em; align-items:baseline; font-weight:700; width:100%; justify-content:flex-end;";
          projBalWinEl = document.createElement("span");
          projBalWinEl.className = "__tcProjBalWin";
          projBalWinEl.style.cssText = "color:var(--color-green, oklch(76% 0.16 145));";
          projBalLossEl = document.createElement("span");
          projBalLossEl.className = "__tcProjBalLoss";
          projBalLossEl.style.cssText = "color:var(--color-red, oklch(64% 0.18 25)); opacity:0.92;";
          e.appendChild(projBalWinEl);
          e.appendChild(projBalLossEl);
          projBalRow.appendChild(e);
        }
        n.parentElement.insertBefore(projBalRow, n);
      }
      if (!projBalWinEl || !projBalLossEl) {
        return;
      }
      const o = detectCurrency(),
        r = isNaN(t) || t <= 0 ? "—" : "↑ " + fmtMoney(t) + " " + o,
        a = isNaN(e) || e <= 0 ? "—" : "↓ " + fmtMoney(e) + " " + o;
      if (projBalWinEl._tcVal !== r) {
        projBalWinEl._tcVal = r;
        projBalWinEl.textContent = r;
      }
      if (projBalLossEl._tcVal !== a) {
        projBalLossEl._tcVal = a;
        projBalLossEl.textContent = a;
      }
    }
    function tabHasOpenTrade(t) {
      if (!t) {
        return false;
      }
      if (t.querySelector(".Pdqth")) {
        return true;
      }
      const e = normKey(getTabName(t));
      return (
        !!e &&
        (function () {
          const t = new Set(),
            e = getOpenTradeRows();
          for (let n = 0; n < e.length; n++) {
            const o =
                e[n].querySelector(".DBihS") || e[n].querySelector(".RxOUE") || e[n].querySelector(".JJ_i9"),
              r = o ? normKey(o.textContent) : "";
            if (r) {
              t.add(r);
            }
          }
          return t;
        })().has(e)
      );
    }
    let lastOutcomeState = null,
      audioReady = false,
      eqCurveEl = null,
      eqAreaEl = null,
      lastEquity = NaN,
      equityHistory = [];
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Sounds, auto-close of low-payout tabs, trade-button lock
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    function playTone(t, e, n, o = "sine", r = 0.05) {
      const a = window.__tcAudioCtx;
      if (!a || a.state !== "running" || !audioReady) {
        return;
      }
      const i = a.createOscillator(),
        c = a.createGain(),
        s = a.currentTime + e;
      i.type = o;
      i.frequency.setValueAtTime(t, s);
      c.gain.setValueAtTime(1e-4, s);
      c.gain.exponentialRampToValueAtTime(r, s + 0.015);
      c.gain.exponentialRampToValueAtTime(1e-4, s + n);
      i.connect(c);
      c.connect(a.destination);
      i.start(s);
      i.stop(s + n + 0.02);
    }
    window.__tcAudioUnlock = () => {
      if (AudioCtor) {
        try {
          if (!window.__tcAudioCtx) {
            const t = new AudioCtor();
            window.__tcAudioCtx = t;
            t.addEventListener("statechange", () => {
              if (t.state === "running") {
                audioReady = true;
              }
            });
          }
          const t = window.__tcAudioCtx;
          if (t.state === "suspended") {
            t.resume().catch(() => {});
          }
          if (t.state === "running") {
            audioReady = true;
          }
        } catch (t) {}
      }
    };
    let lastAutoCloseAt = 0,
      autoCloseRunning = false,
      // v1.61.0: when auto-close last actually removed a tab. A tab that has gone is a real change to the
      // board, unlike a payout dipping for one pass, so the replacement does not sit out the settle window.
      autoCloseClosedAt = 0,
      // v1.62.0: auto-close has removed something and the board has not been refilled yet. A close is the
      // only trigger - how many pairs are open, and how many of them clear the floor, are not consulted.
      autoOpenFill = false,
      // v1.85.0: what the last run that closed something removed - the first pair, and how many more - for
      // the log. Read live on 2026-10-03: a refill had run, and which close started it could not be told.
      autoClosedFirst = "",
      autoClosedMore = 0;
    const autoClosedNote = () => (autoClosedFirst || "a pair") + (autoClosedMore ? " and " + autoClosedMore + " more" : "");
    function autoCloseStep(t, e) {
      // `e` counts the tabs this run has closed. A run that closed something hands straight over to the
      // replacement instead of leaving it to the next five-second pass - that plus the settle window is
      // nine seconds of staring at a board that has just lost a pair.
      const finish = () => {
        autoCloseRunning = false;
        // Only a run that actually closed a tab starts a fill. This pass runs every five seconds and
        // usually closes nothing; triggering on the run rather than on a close would open pairs for ever.
        if (e > 0) {
          autoCloseClosedAt = Date.now();
          autoOpenFill = true;
          maybeAutoOpenPair(t);
        }
      };
      // v1.85.0: the tab went to the background while this was running - no further tab is closed there.
      // maybeAutoOpenPair ends the refill for the same reason.
      if (e >= 20 || document.hidden) {
        return finish();
      }
      const n = getPairTabs().find((e) => {
        const n = tabPayout(e);
        // Only tabs that actually have a close control (v1.24.4).
        return !isNaN(n) && n < t && !tabHasOpenTrade(e) && !!getTabCloseBtn(e);
      });
      if (!n) {
        return finish();
      }
      const tabsBefore = getPairTabs().length,
        closing = (getTabName(n) || "a pair") + " at " + tabPayout(n) + "%";
      synthClick(getTabCloseBtn(n));
      window.__tcAutoCloseStepTimer = setTimeout(() => {
        // Stop if the click didn't close anything, instead of clicking again every 300 ms (v1.24.4).
        if (getPairTabs().length >= tabsBefore) {
          return finish();
        }
        // v1.85.0: every close is in the log, and the refill it starts names it.
        if (e) {
          autoClosedMore = e;
        } else {
          autoClosedFirst = closing;
          autoClosedMore = 0;
        }
        noteAsset("auto-close closed " + closing);
        autoCloseStep(t, e + 1);
      }, 300);
    }
    function autoCloseLowPayoutTabs(t, e) {
      // v1.85.0: the board is left alone while the tab is in the background - see maybeAutoOpenPair. Back in
      // front, the next pass closes what is below the floor, on screen, and the refill follows that close.
      if (document.hidden) {
        return;
      }
      const n = Date.now();
      if (!((!e && n - lastAutoCloseAt < 5000) || autoCloseRunning)) {
        lastAutoCloseAt = n;
        if (getPairTabs().length) {
          autoCloseRunning = true;
          autoCloseStep(t, 0);
        }
      }
    }
    every(5000, () => {
      if (void 0 === minPayoutInput || !minPayoutInput) {
        return;
      }
      // v1.61.1: the COMMITTED floor, not whatever is currently in the box. The diagnostics line has
      // always reported the stored value, so a number typed but not yet entered had the board closing tabs
      // against one figure while the line stated another - and this is the number every decision here turns
      // on. Enter or leaving the field commits it; half-typed digits no longer close anything either, which
      // "95" passing through "9" used to risk. getMinPayoutStored already falls back to 89, so the old
      // `|| 89` is carried by it.
      const t = parseInt(getMinPayoutStored(), 10);
      if (!isNaN(t)) {
        autoCloseLowPayoutTabs(t);
        maybeAutoOpenPair(t);
      }
    });
    // v1.76.0 (self-healing, step 1): Quotex's Up and Down buttons, found the self-repairing way - the known
    // names, then by what they are (their arrow icons, then their "Up" / "Down" words), and the name that
    // worked is remembered. The trade guard (PAYOUT floor, MAX, FAST), the ↑/↓ keys, the greying and the
    // win/loss preview all use it. Until now the guard knew the buttons by three fixed names only, so a
    // rename by Quotex would have stopped every block without a word.
    const TRADE_BTN_NAMES = ["#trade-button button", ".hkjXJ button", ".bSenO button"];
    let tradeBtnsCache = { at: 0, btns: [] };
    function findTradeButtonsByWhatTheyAre() {
      const ours = (el) => !el || isOurElement(el) || !!el.closest("#__tradeCalc");
      const byIcon = (dir) => {
        const icon = document.querySelector(
          'svg[class*="arrow-' + dir + '"], use[href*="arrow-' + dir + '"], use[xlink\\:href*="arrow-' + dir + '"]',
        );
        const btn = icon && icon.closest("button");
        return btn && !ours(btn) ? btn : null;
      };
      const up = byIcon("up"),
        down = byIcon("down");
      if (up && down && up !== down) {
        return [up, down];
      }
      const buttons = Array.from(document.querySelectorAll("button")).filter((b) => !ours(b));
      const byWord = (re) => buttons.find((b) => re.test(textOf(b)));
      // v1.84.0: "Buy" / "Sell" as well - read live on 1.83.0, Check showed the Up button as "Buy".
      const upW = byWord(/^\s*(up|buy)\b/i),
        downW = byWord(/^\s*(down|sell)\b/i);
      return upW && downW && upW !== downW ? [upW, downW] : [];
    }
    // [up, down], or [] when they are not on the page. Kept for half a second - the click guard asks on every
    // click on the page.
    function getTradeButtons() {
      const now = Date.now();
      if (now - tradeBtnsCache.at < 500 && tradeBtnsCache.btns.length && tradeBtnsCache.btns.every((b) => b.isConnected)) {
        return tradeBtnsCache.btns;
      }
      const found = resolveList("tradeButtons", document, TRADE_BTN_NAMES, findTradeButtonsByWhatTheyAre);
      tradeBtnsCache = { at: now, btns: found.length >= 2 ? [found[0], found[1]] : [] };
      return tradeBtnsCache.btns;
    }
    // The block holding both buttons - where the win/loss preview goes above.
    function tradeButtonsBlock() {
      const byId = document.getElementById("trade-button");
      if (byId) {
        return byId;
      }
      const [up, down] = getTradeButtons();
      for (let el = up && up.parentElement; el && el !== document.body; el = el.parentElement) {
        if (down && el.contains(down)) {
          return el;
        }
      }
      return null;
    }
    const isTradeButton = (el) => !!el && getTradeButtons().some((b) => b === el || b.contains(el));
    let lastTradeBtnLock = null,
      lastTradeBtnEl = null;
    function setTradeButtonsDisabled(t) {
      const e = getTradeButtons()[0] || null;
      if (lastTradeBtnLock === t && e === lastTradeBtnEl) {
        return;
      }
      lastTradeBtnLock = t;
      lastTradeBtnEl = e;
      // v1.27.0: their buttons keep their own state. A blocked trade is stopped in the capture phase by
      // __tcTradeBlocker (which also reads tradingBlocked); the greying is only so you can see it.
      const n = e ? getTradeButtons() : [];
      for (let e = 0; e < n.length; e++) {
        const o = n[e];
        o.style.filter = t ? "grayscale(1)" : "";
        o.style.opacity = t ? "0.55" : "";
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Edge flash
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    let edgeFlashEl = null;
    function triggerEdgeFlash(t) {
      if (!edgeFlashEl) {
        edgeFlashEl = document.createElement("div");
        edgeFlashEl.id = "__tcEdgeFlash";
        edgeFlashEl.style.cssText =
          "position:fixed; inset:0; pointer-events:none; z-index:2147483600; opacity:0;";
        shadow.appendChild(edgeFlashEl);
      }
      const e = t === "up" ? "oklch(76% 0.16 145 / 0.55)" : "oklch(64% 0.18 25 / 0.55)";
      edgeFlashEl.style.boxShadow = "inset 0 0 70px 16px " + e;
      edgeFlashEl.style.animation = "none";
      edgeFlashEl.offsetWidth;
      edgeFlashEl.style.animation = "__tcEdgeFlash 0.25s ease-out";
    }
    // v1.21.0: the SL-breach lock on Quotex's "Set limit" button was removed (it ran every 200 ms).
    // Clear the lock date an earlier version may have stored.
    try {
      prefRemove(KEY_NATIVE_LIMIT_LOCK_DATE);
    } catch (t) {}
    window.__tcTriggerEdgeFlash = triggerEdgeFlash;
    let lastPayoutPct = NaN,
      balanceMissingSince = 0;
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Blocking reasons, REQ (trades to target), tab title countdown
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    function getBlockReason(t) {
      return t.tradeCapReached
        ? t.maxTrades <= 1
          ? "Single-trade mode — wait for the trade to settle"
          : `Max ${t.maxTrades} active trades — wait for one to settle`
        : isNaN(t.projSb)
          ? "Balance unreadable"
          : isNaN(t.tp)
            ? "Trade amount not set"
            : isNaN(t.rp)
              ? "Payout % unreadable"
              : !isNaN(t.rp) && t.rp < t.minRp
                ? `Payout ${t.rp}% below minimum ${t.minRp}%`
                  : !t.tbValue || isNaN(t.tb)
                    ? "Set a target balance"
                    : t.tb <= t.projSb
                      ? "Target must exceed current balance"
                      : "";
    }
    function stakePercentOfBalance(t, e, n) {
      return isNaN(t) ? NaN : e ? t : !isNaN(n) && n > 0 ? (t / n) * 100 : NaN;
    }
    let lastReqInputs = null;
    function computeReqWithOpenTrades(t) {
      if (!t || !getOpenTradePnlEls().length) {
        return;
      }
      const e = readAccountBalance();
      if (isNaN(e)) {
        return;
      }
      const n = e + sumOpenPnl();
      return tradesToTarget(n, t.tb, stakePercentOfBalance(t.tdVal, t.isPercent, n), t.rp);
    }
    function renderReq(t, e, n, o) {
      if (t) {
        setText(reqFromEl, "");
        setText(reqEl, "—");
        reqEl.classList.remove("tcTradeCritical");
        return;
      }
      const r = (function (t, e) {
        const n = (t) => (t == null ? "∞" : String(t));
        return void 0 === e
          ? {
              from: "",
              main: n(t),
            }
          : t === e
            ? {
                from: "",
                main: n(e),
              }
            : {
                from: n(t) + "→",
                main: n(e),
              };
      })(e, n);
      setText(reqFromEl, r.from);
      setText(reqEl, r.main);
      const a = void 0 === n ? e : n;
      if (a !== null) {
        reqEl._tcN = a;
        if (o) {
          reqEl.style.color = "var(--tc-red)";
          reqEl.classList.remove("tcTradeCritical");
        } else if (a > 0 && a <= 3) {
          reqEl.style.color = "";
          reqEl.classList.add("tcTradeCritical");
        } else {
          reqEl.style.color = "";
          reqEl.classList.remove("tcTradeCritical");
        }
      } else {
        reqEl.classList.remove("tcTradeCritical");
      }
    }
    // "⏱1:23 (2)" for the browser tab title: soonest expiry, and how many trades are open.
    function fmtTitleCountdown(t, e) {
      if (!(t >= 0) || t >= 1000000000) {
        return "";
      }
      const n = Math.floor(t / 3600),
        o = Math.floor((t % 3600) / 60),
        r = t % 60,
        a = (t) => (t < 10 ? "0" + t : "" + t);
      return "⏱" + (n ? n + ":" + a(o) + ":" + a(r) : o + ":" + a(r)) + (e > 1 ? " (" + e + ")" : "") + " ";
    }
    let timersVia = "page";
    function buildTitleCountdown() {
      if (!TIMERS_ENABLED) {
        return "";
      }
      // v1.50.0: Quotex's data decides, and the markup is read only when the bridge cannot answer -
      // the same order the chips have used since v1.34.0. Reading the rows first left the tab counting
      // with nothing open: a block holding the platform's session clock ("00:06:17") parses as a
      // perfectly plausible 6m17s and is not caught by the four-hour sanity bound.
      const fromStore = storeOpenTrades();
      if (fromStore) {
        if (!fromStore.length) {
          return "";
        }
        let soonest = Infinity;
        for (const trade of fromStore) {
          if (!isNaN(trade.secondsLeft) && trade.secondsLeft < soonest) {
            soonest = trade.secondsLeft;
          }
        }
        return fmtTitleCountdown(soonest, fromStore.length);
      }
      const t = getOpenTradeRows();
      if (!t.length) {
        return "";
      }
      let e = 1 / 0;
      for (let n = 0, o = t.length; n < o; n++) {
        const o = t[n],
          r =
            o.querySelector(".PiYD4") ||
            o.querySelector(".xEiET") ||
            o.querySelector(".wcb43") ||
            findClockEl(o);
        if (!r) {
          continue;
        }
        const a = parseClock(r.textContent.trim());
        if (a < e) {
          e = a;
        }
      }
      return fmtTitleCountdown(e, t.length);
    }
    function updateTabTitle(t, e) {
      const n = t && e ? "🟢🔴 " : t ? "🟢 " : e ? "🔴 " : "",
        o = t && e ? "both" : t ? "win" : e ? "loss" : "";
      var r;
      if (lastOutcomeState === null) {
        lastOutcomeState = o;
      } else if (o !== lastOutcomeState) {
        lastOutcomeState = o;
        if ((r = o)) {
          if (r === "win") {
            playTone(660, 0, 0.12, "triangle");
            playTone(880, 0.1, 0.16, "triangle");
          } else if (r === "loss") {
            playTone(220, 0, 0.18, "sawtooth", 0.035);
            playTone(165, 0.15, 0.22, "sawtooth", 0.03);
          } else {
            playTone(660, 0, 0.1, "triangle");
            playTone(220, 0.12, 0.18, "sawtooth", 0.03);
          }
        }
      }
      const i = n + buildTitleCountdown(),
        c = document.title
          .replace(TITLE_PREFIX_RE, "")
          .replace("Live trading | Quotex", "Demo trading | Quotex");
      if (document.title !== i + c) {
        document.title = i + c;
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // recalc(): the main update. Reads the page, applies guards, renders the panel.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    function recalc() {
      openPnlEls = getOpenTradePnlEls();
      const balance = readAccountBalance(),
        hasBalance = !isNaN(balance);
      if (contentEl && loaderEl) {
        if (!hasBalance) {
          setDisplay(contentEl, "none");
          setDisplay(loaderEl, "flex");
          if (balanceMissingSince) {
            if (Date.now() - balanceMissingSince > 10000 && loaderTextEl && !loaderTextEl._tcStale) {
              loaderTextEl._tcStale = true;
              loaderTextEl.textContent =
                "Balance not detected — Quotex may have updated. Try reloading the page.";
            }
          } else {
            balanceMissingSince = Date.now();
          }
          return;
        }
        if (balanceMissingSince) {
          balanceMissingSince = 0;
          if (loaderTextEl && loaderTextEl._tcStale) {
            loaderTextEl._tcStale = false;
            loaderTextEl.textContent = "";
          }
        }
        setDisplay(contentEl, "flex");
        setDisplay(loaderEl, "none");
      }
      let anyWinning = false,
        anyTied = false,
        openPnlSum = 0;
      if (!openPnlEls.length) {
        // v1.25.0: read open trades from Quotex's data when the deal rows can't be read.
        const flags = storeOutcomeFlags();
        if (flags) {
          anyWinning = flags[0];
          anyTied = flags[1];
          openPnlSum = sumOpenPnl();
        }
      }
      for (let t = 0, a = openPnlEls.length; t < a; t++) {
        const a = openPnlEls[t].textContent.trim();
        if (a.startsWith("+")) {
          anyWinning = true;
        } else if (a.startsWith("0")) {
          anyTied = true;
        }
        if (hasBalance) {
          const t = parseMoney(a);
          if (!isNaN(t)) {
            openPnlSum += t;
          }
        } else if (anyWinning && anyTied) {
          break;
        }
      }
      const balanceNow = hasBalance ? balance : NaN,
        equity = hasBalance ? balance + openPnlSum : NaN,
        stake = readStake(),
        payoutPct = readPayoutPct(),
        payoutInfo = readPayoutAndInvestment();
      if (!isNaN(payoutPct)) {
        if (!(isNaN(lastPayoutPct) || payoutPct === lastPayoutPct)) {
          triggerEdgeFlash(payoutPct > lastPayoutPct ? "up" : "down");
        }
        lastPayoutPct = payoutPct;
      }
      const tpRaw = tpInput.value,
        tpValue = parsePlainNumber(tpRaw);
      const minPayout = parseInt(getMinPayoutStored(), 10) || 89;
      if (!isNaN(minPayout)) {
        autoCloseLowPayoutTabs(minPayout);
        maybeAutoOpenPair(minPayout);
      }
      markMonitoredTabs();
      const riskPct = stakePercentOfBalance(stake.val, stake.isPercent, balanceNow);
      if (equity !== lastEquity) {
        lastEquity = equity;
        (function (t) {
          if (isNaN(t)) {
            return;
          }
          const e = equityHistory.length;
          if (!(e !== 0 && equityHistory[e - 1] === t)) {
            equityHistory.push(t);
            if (equityHistory.length > 30) {
              equityHistory.shift();
            }
            requestAnimationFrame(() => {
              if (!(eqCurveEl && eqCurveEl.isConnected)) {
                eqCurveEl = byId("__tcEqCurve");
              }
              if (!(eqAreaEl && eqAreaEl.isConnected)) {
                eqAreaEl = byId("__tcEqArea");
              }
              if (eqCurveEl && eqAreaEl && equityHistory.length > 1) {
                const t = eqCurveEl,
                  e = eqAreaEl,
                  n = equityHistory;
                let o = n[0],
                  r = n[0];
                for (let t = 1; t < n.length; t++) {
                  if (n[t] < o) {
                    o = n[t];
                  }
                  if (n[t] > r) {
                    r = n[t];
                  }
                }
                const a = r - o || 1,
                  i = n[n.length - 1] >= n[0],
                  c = n.map((t, e) => ({
                    x: (e / (n.length - 1)) * 100,
                    y: 100 - ((t - o) / a) * 80 - 10,
                  }));
                let s = `M ${c[0].x},${c[0].y}`;
                for (let t = 0; t < c.length - 1; t++) {
                  const e = c[t],
                    n = c[t + 1],
                    o = e.x + (n.x - e.x) / 2;
                  s += ` C ${o},${e.y} ${o},${n.y} ${n.x},${n.y}`;
                }
                const l = `${s} L 100,100 L 0,100 Z`;
                t.setAttribute("d", s);
                e.setAttribute("d", l);
                if (i) {
                  t.setAttribute("stroke", "var(--tc-grn)");
                  t.removeAttribute("stroke-dasharray");
                  e.setAttribute("fill", "url(#__tcEqGradPos)");
                } else {
                  t.setAttribute("stroke", "var(--tc-red)");
                  t.setAttribute("stroke-dasharray", "3 3");
                  e.setAttribute("fill", "url(#__tcEqGradNeg)");
                }
              }
            });
          }
        })(equity);
      }
      if (isNaN(equity)) {
        setTpStep(1000);
      } else {
        setTpStep(equity > 20000 ? 10000 : 1000);
      }
      // v1.71.0: a whole percent. The colour below still uses the exact figure.
      setText(riskEl, isNaN(riskPct) ? "—" : Math.round(riskPct) + "%");
      const riskColor = (function (t) {
        return isNaN(t) ? "" : t > 5 ? "var(--tc-red)" : t > 2 ? "var(--tc-amb)" : "var(--tc-grn)";
      })(riskPct);
      if (riskColor) {
        setColor(riskEl, riskColor);
      }
      if (payoutTotalEl) {
        const t = (function (t, e) {
          return t && !e ? "oklch(76% 0.16 145)" : t && e ? "oklch(80% 0.15 75)" : "";
        })(anyWinning, anyTied);
        if (payoutTotalEl._tcClr !== t) {
          payoutTotalEl.style.color = payoutTotalEl._tcClr = t;
          payoutTotalEl.style.textShadow = t ? `0 0 12px ${t.replace(")", " / 0.45)")}` : "";
        }
      }
      if (balanceEl) {
        const t = openPnlEls.length > 0,
          e = isNaN(payoutInfo.investment) ? openPnlSum : openPnlSum - payoutInfo.investment,
          o = t && anyWinning && e > 0 ? "oklch(76% 0.16 145)" : "";
        if (balanceEl._tcClr !== o) {
          balanceEl.style.color = balanceEl._tcClr = o;
          balanceEl.style.textShadow = o ? `0 0 14px ${o.replace(")", " / 0.3)")}` : "";
        }
        let a = balanceEl._tcLiveTag;
        if (!a) {
          a = document.createElement("span");
          a.style.cssText =
            "position:fixed; left:0; top:0; white-space:nowrap; font-size:1.2em; font-weight:700; line-height:1.5; font-family:inherit; margin:0; opacity:0; pointer-events:none; transition:opacity 0.3s; z-index:2147483647;";
          document.body.appendChild(a);
          balanceEl._tcLiveTag = a;
        }
        if (a._tcWasActive && a.style.opacity !== "0") {
          a._tcWasActive = false;
          a.classList.add("tcLiveResolving");
          a.addEventListener(
            "animationend",
            () => {
              a.classList.remove("tcLiveResolving");
              a.style.opacity = "0";
              a._tcVal = null;
            },
            {
              once: true,
            },
          );
        } else if (!(a._tcWasActive || a.style.opacity === "0")) {
          a.style.opacity = "0";
          a._tcVal = null;
        }
      }
      if (payoutPctEl) {
        const t = (function (t, e) {
          return !isNaN(t) && t < e ? "oklch(64% 0.18 25)" : "oklch(76% 0.16 145)";
        })(payoutPct, minPayout);
        emphasize(payoutPctEl, { "font-size": "1.1em", "font-weight": "800" });
        if (payoutPctEl._tcClr !== t) {
          payoutPctEl.style.color = payoutPctEl._tcClr = t;
          payoutPctEl.style.textShadow = `0 0 10px ${t.replace(")", " / 0.35)")}`;
        }
      }
      const payoutTooLow = !isNaN(payoutPct) && payoutPct < minPayout,
        payoutLockVisible = payoutTooLow;
      if (payoutLockVisible) {
        setText(lockLabelEl, "Payout Too Low");
        setText(lockTimerEl, payoutPct + "%");
        setText(lockMetaEl, `Payout ${payoutPct}% is below minimum ${minPayout}%. Trading blocked.`);
      }
      dangerOverlay.classList.toggle("tcPercentVisible", payoutLockVisible);
      dangerOverlay.classList.toggle("tcActive", payoutLockVisible);
      const isAlert = payoutLockVisible;
      if (panel._isLowRp !== isAlert) {
        panel.classList.toggle("tcDangerMode", isAlert);
        panel.classList.toggle("tcActive", isAlert);
        panel._isLowRp = isAlert;
      }
      const projectionBase = balanceNow;
      if (hasBalance && !isNaN(payoutInfo.investment) && payoutInfo.investment > 0) {
        renderProjectedBalances(
          balance - payoutInfo.investment + (isNaN(payoutInfo.payout) ? 0 : payoutInfo.payout),
          balance - payoutInfo.investment,
        );
      } else {
        renderProjectedBalances(NaN, NaN);
      }
      // v1.21.0: the stop loss never blocks trading. The "trade would breach stop loss" block was
      // removed: after a breach it disabled Up/Down permanently, and the trailing SL pushed any new
      // SL back above the balance. Only payout-too-low and the max-open-trades cap block now.
      const tradeCapReached = effectiveOpenTrades() >= maxTrades,
        shouldBlock = payoutTooLow || tradeCapReached;
      tradingBlocked = shouldBlock;
      setTradeButtonsDisabled(shouldBlock);
      const blockContext = {
          tradeCapReached: tradeCapReached,
          maxTrades: maxTrades,
          projSb: projectionBase,
          tp: riskPct,
          rp: payoutPct,
          minRp: minPayout,
          tbValue: tpRaw,
          tb: tpValue,
        },
        blockMessage = getBlockReason(blockContext),
        reqBlockMessage = tradeCapReached
          ? getBlockReason({
              ...blockContext,
              tradeCapReached: false,
            })
          : blockMessage;
      if (warnEl) {
        if (shouldBlock && !payoutLockVisible && !!blockMessage) {
          setText(warnEl, blockMessage);
          setDisplay(warnEl, "block");
          if (!warnEl.classList.contains("tcWarnVisible")) {
            warnEl.classList.add("tcWarnVisible");
          }
        } else if (warnEl._d !== "none") {
          setDisplay(warnEl, "none");
          warnEl.classList.remove("tcWarnVisible");
        }
      }
      if (reqBlockMessage) {
        lastReqInputs = null;
        renderReq(true);
      } else {
        const t = tradesToTarget(projectionBase, tpValue, riskPct, payoutPct);
        lastReqInputs = {
          tb: tpValue,
          tdVal: stake.val,
          isPercent: stake.isPercent,
          rp: payoutPct,
          isAlert: isAlert,
          nSettled: t,
        };
        renderReq(false, t, computeReqWithOpenTrades(lastReqInputs), isAlert);
      }
      if (projectionsDot) {
        projectionsDot.classList.toggle("tcDotLive", !blockMessage && !isAlert);
      }
      if (targetsDot) {
        targetsDot.classList.toggle("tcDotLive", !isNaN(tpValue) && tpValue > 0);
      }
      if (tpCurrencyEl) {
        setText(tpCurrencyEl, detectCurrency());
      }
      updateTabTitle(anyWinning, anyTied);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Timeframe / expiry helpers and the DOM MutationObserver that schedules recalc()
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const WATCHED_SELECTORS =
        ".Zt1hG,.UI2Kh,.omlQ2,.GmATb,.ib6yR,.lCITV,.dJ15T,.ElyTP,.pVBHU,.deal-amount-input,.bvdd_,.UloGw,.pPomf,.PY5Eb,.Pdqth,#trade-button,.bSenO,.MYMK0,.hkjXJ",
      HOTKEY_TIMEFRAMES = ["15s", "1m", "2m", "3m", "5m", "10m", "15m"],
      TF_LABEL_RE = /^\d+\s*[smhd]$/i,
      normLabel = (t) => (t || "").trim().toLowerCase();
    function getTimeframeButton() {
      if (!window._tcTimeBtnCache || !window._tcTimeBtnCache.isConnected) {
        const t = Array.from(document.querySelectorAll(".HgaSf"));
        // v1.77.0: then a remembered name, then the lone timeframe label on the page (SEMANTIC_FINDERS).
        window._tcTimeBtnCache =
          t.find((t) => TF_LABEL_RE.test((t.textContent || "").trim())) || t[0] || findEl("timeframeCTA", { cache: false });
      }
      return window._tcTimeBtnCache;
    }
    const TF_MENU_MIN_ITEMS = 3;
    function getTimeframeItems() {
      // The open menu: a known class, or any container holding several timeframe labels ("1m", "5m", …).
      // v1.25.1: a single match is the chart's own timeframe label, not a menu — don't report that as one.
      let t = document.querySelector(".kCc27") || document.querySelector(".PY5Eb");
      if (!t) {
        const labels = leafMatches(document, TF_TEXT_RE, isVisible);
        const counts = new Map();
        for (const el of labels) {
          const parent = el.parentElement;
          if (parent) {
            counts.set(parent, (counts.get(parent) || 0) + 1);
          }
        }
        for (const [parent, n] of counts) {
          if (n >= TF_MENU_MIN_ITEMS) {
            t = parent;
            break;
          }
        }
      }
      if (!t) {
        listVia.timeframeItems = "missing";
        return [];
      }
      const items = resolveList("timeframeItems", t, [".Dy2a9", ".blYud"], (root) => leafMatches(root, TF_TEXT_RE));
      if (items.length < TF_MENU_MIN_ITEMS && !document.querySelector(".kCc27, .PY5Eb")) {
        listVia.timeframeItems = "missing";
        return [];
      }
      return items;
    }
    function getActiveTimeframe() {
      const t = getTimeframeItems().find(
        (t) => t.classList.length > 1 || t.getAttribute("aria-selected") === "true",
      );
      if (t) {
        return normLabel(t.textContent);
      }
      const e = document.querySelector(".NDbAT");
      if (e) {
        return normLabel(e.textContent);
      }
      const b = getTimeframeButton();
      return b && TF_LABEL_RE.test(textOf(b)) ? normLabel(textOf(b)) : "";
    }
    function selectTimeframe(t, e) {
      const n = getTimeframeButton();
      if (n) {
        // v1.32.0: the timeframe menu is driven with the same realistic click the trade buttons get.
        // A bare .click() sends one lone MouseEvent with no coordinates and no pointer sequence, which
        // is the easiest kind of scripted click for a page to pick out - and the auto-fill made this
        // walk happen without anyone pressing anything.
        synthClick(n);
        setTimeout(() => {
          const n = getTimeframeItems().find((e) => normLabel(e.textContent) === normLabel(t));
          if (n) {
            synthClick(n);
          }
          setTimeout(() => {
            document.body.click();
            if (e) {
              e();
            }
          }, 60);
        }, 140);
      } else if (e) {
        e();
      }
    }
    // Expiry time choices in the open time menu (v1.25.0: class first, then any "HH:MM" leaf in that menu).
    function getExpiryTimeItems(scope) {
      return resolveList("expiryTimes", scope || document, [".VPv5q"], (root) => leafMatches(root, TIME_TEXT_RE));
    }
    // v1.78.0: known name, then a remembered one, then the block around the time box (SEMANTIC_FINDERS).
    function getExpiryBox() {
      return findEl("expiryBox", { cache: false });
    }
    function getExpiryInput() {
      const t = getExpiryBox();
      return t && t.querySelector("input");
    }
    function isExpiryTimerMode() {
      const t = getExpiryInput();
      return !!t && (t.value.match(/:/g) || []).length === 2;
    }
    function toggleExpiryMode() {
      const t = getExpiryBox();
      if (!t) {
        return;
      }
      const e = t.querySelector(".EWNJc") || findEl("expiryToggle", { cache: false });
      if (e) {
        if (isExpiryTimerMode()) {
          synthClick(e);
          setTimeout(() => {
            const t = getExpiryInput();
            if (t && !isExpiryTimerMode()) {
              t.click();
              setTimeout(() => {
                const t = (function () {
                  const t = getExpiryTimeItems(document);
                  return (
                    t.find(
                      (t) =>
                        !t.hasAttribute("disabled") &&
                        t.getAttribute("aria-disabled") !== "true" &&
                        parseFloat(getComputedStyle(t).opacity || "1") > 0.5,
                    ) ||
                    t[0] ||
                    null
                  );
                })();
                if (t) {
                  synthClick(t);
                }
                setTimeout(() => document.body.click(), 60);
              }, 270);
            } else {
              document.body.click();
            }
          }, 270);
          return;
        }
        synthClick(e);
        setTimeout(() => {
          const e = getExpiryInput();
          if (e) {
            e.click();
            setTimeout(() => {
              const e = getExpiryTimeItems(document).find(
                (t) => (t.textContent || "").trim() === "00:05",
              );
              if (e) {
                synthClick(e);
              }
              setTimeout(() => {
                const e = t.querySelectorAll(".VK9Nw")[1];
                if (e) {
                  synthClick(e);
                  setTimeout(() => {
                    synthClick(e);
                    setTimeout(() => document.body.click(), 60);
                  }, 170);
                } else {
                  document.body.click();
                }
              }, 270);
            }, 270);
          }
        }, 270);
      }
    }
    const isWatchedNode = (t) =>
      t.nodeType === 1 &&
      (t.matches(WATCHED_SELECTORS) || (t.children.length > 0 && t.querySelector(WATCHED_SELECTORS)));
    function isRelevantMutation(t) {
      const e = t.target.nodeType === 1 ? t.target : t.target.parentElement;
      if (e) {
        if (e.closest("#__tradeCalc")) {
          return false;
        }
        if (e.closest(WATCHED_SELECTORS)) {
          return true;
        }
      }
      for (let e = 0; e < t.addedNodes.length; e++) {
        if (isWatchedNode(t.addedNodes[e])) {
          return true;
        }
      }
      for (let e = 0; e < t.removedNodes.length; e++) {
        if (isWatchedNode(t.removedNodes[e])) {
          return true;
        }
      }
      return false;
    }
    function onPageMutationsForRecalc(t) {
      for (let e = 0; e < t.length; e++) {
        if (isRelevantMutation(t[e])) {
          scheduleRecalc();
          return;
        }
      }
    }
    let lastTradeClickAt = 0,
      stakeInputEl = null;
    // v1.72.5: reported live - with MAX 2 and FAST on, quick clicks on Up/Down placed more than 2 trades. The
    // open-trade count comes from Quotex's data, which lists a trade only once their server has taken it, a
    // moment after the click; every click inside that moment still saw the old count and went through. So a
    // trade the panel lets through counts at once, until Quotex's data shows it. One that never shows (the
    // platform refused it) stops counting after PENDING_TRADE_MS.
    function effectiveOpenTrades() {
      const now = Date.now(),
        current = openTradeCount();
      pendingTrades = pendingTrades.filter((p) => now - p.at < PENDING_TRADE_MS);
      // Each pending click was made when `base` trades were open, so from it on at least base + (clicks since)
      // should be open. When the data has caught up with all of them, they are no longer pending.
      let expected = 0;
      pendingTrades.forEach((p, i) => {
        expected = Math.max(expected, p.base + (pendingTrades.length - i));
      });
      if (current >= expected) {
        pendingTrades = [];
        return current;
      }
      return expected;
    }
    function notePlacedTrade() {
      pendingTrades.push({ at: Date.now(), base: openTradeCount() });
      // The block this may have set is lifted by a recalculation; make sure one runs when this one expires,
      // rather than waiting for the page to change.
      setTimeout(scheduleRecalc, PENDING_TRADE_MS + 50);
    }
    // v1.80.0: without "#tab-active" on the page, the active tab is the one showing the chart's pair -
    // by its data-symbol, else by its name - from Quotex's data.
    function isActiveTab(t) {
      if (t.id === "tab-active" || t.classList.contains("tab-active")) {
        return true;
      }
      // A page that marks its active tab is believed: only with no mark at all does Quotex's data decide.
      if (document.getElementById("tab-active") || document.querySelector(".tab-active")) {
        return false;
      }
      const state = readQuotexState(),
        sym = state && state.symbol;
      if (!sym) {
        return false;
      }
      const ds = t.getAttribute("data-symbol");
      return ds ? ds === sym : showsPair(t, currentPairLabel());
    }
    function activateTab(t) {
      // v1.88.0 (self-healing): with those names gone, the name the tab prints - what a hand would click.
      const e =
        t.querySelector(".WRocw") ||
        t.querySelector(".l5ftG") ||
        t.querySelector(".pC7xL") ||
        Array.from(t.querySelectorAll("*")).find((c) => c.children.length === 0 && PAIR_TEXT_RE.test(textOf(c)) && !/%/.test(textOf(c)));
      synthClick(e || t);
    }
    function cycleTabs(t, e) {
      if (t.length < 2) {
        return;
      }
      const n = t.findIndex(isActiveTab);
      activateTab(t[-1 === n ? 0 : (n + e + t.length) % t.length]);
    }
    function cycleAllTabs(t) {
      cycleTabs(getPairTabs(), t);
    }
    function markMonitoredTabs() {
      getPairTabs().forEach((t) => {
        const e = normKey(getTabName(t));
        const on = !!e && monitoredPairs.includes(e);
        t.classList.toggle(ids.tcMonitored, on);
        // v1.27.0: the outline used to come from a stylesheet naming their tab class.
        const outline = on ? "inset 0 0 0 1px #d0bcff" : "";
        if (t._tcMonitorShadow !== outline) {
          t._tcMonitorShadow = outline;
          t.style.boxShadow = outline;
        }
      });
    }
    function readRowPayout(t) {
      const e = t.querySelectorAll(".mQX6T, .bQodW, .dkV9n");
      for (let t = 0; t < e.length; t++) {
        const n = (e[t].textContent || "").match(/(\d{2,3})\s*%/);
        if (!n) {
          continue;
        }
        const o = parseInt(n[1], 10);
        if (!isNaN(o) && o > 0) {
          return o;
        }
      }
      // v1.80.3 (self-healing): with those names gone, the highest percent the row itself shows. Until now R found
      // no payout on a renamed list, and so nothing to open.
      const pcts = (textOf(t).match(/\d{2,3}(?=\s*%)/g) || []).map(Number).filter((p) => p > 0 && p <= 100);
      return pcts.length ? Math.max(...pcts) : NaN;
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Trade click guard (double-click, max trades, min payout)
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    window.__tcTradeBlocker = (t) => {
      if (!t._tcFired && isTradeButton(t.target)) {
        const e = Date.now();
        if (!multiMode && e - lastTradeClickAt < 1500) {
          t.stopPropagation();
          t.preventDefault();
          return;
        }
        if (effectiveOpenTrades() >= maxTrades) {
          t.stopPropagation();
          t.preventDefault();
          scheduleRecalc();
          return;
        }
        const n = readPayoutPct(),
          o = parseInt(getMinPayoutStored(), 10) || 89;
        if (!isNaN(n) && n < o) {
          t.stopPropagation();
          t.preventDefault();
          return;
        }
        // Any other reason recalc found (v1.27.0: enforcement no longer relies on their disabled attribute).
        if (tradingBlocked) {
          t.stopPropagation();
          t.preventDefault();
          scheduleRecalc();
          return;
        }
        lastTradeClickAt = e;
        notePlacedTrade();
        recordPlacement();
        scheduleRecalc();
      }
    };
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Keyboard shortcuts
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    window.__tcKeyDelegator = (t) => {
      // Take-profit step: Cmd+↑/↓ on macOS, Ctrl+↑/↓ on Windows/Linux (hotfix v1.20.1: was metaKey
      // only, which on Windows is the Win key). The TP field shows a formatted value like "12,500.00",
      // so it's parsed with parsePlainNumber; plain parseFloat stopped at the comma and read 12.
      if ((t.metaKey || t.ctrlKey) && !t.altKey && !t.shiftKey && (t.code === "ArrowUp" || t.code === "ArrowDown")) {
        t.preventDefault();
        const e = parseFloat(tpInput.step) || 1000;
        let n = parsePlainNumber(tpInput.value) || 0;
        n += t.code === "ArrowUp" ? e : -e;
        if (n < 0) {
          n = 0;
        }
        tpInput.value = n;
        tpInput.dispatchEvent(
          new Event("input", {
            bubbles: true,
          }),
        );
        return;
      }
      if (t.metaKey || t.ctrlKey) {
        return;
      }
      const e = activeEl();
      if (e && (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(e.tagName))) {
        return;
      }
      if (t.key === "Enter" || t.code === "Space") {
        // A focused Up/Down button belongs to the platform: let the browser activate it (v1.28.0).
        const focused = document.activeElement;
        if (focused && focused.closest && (focused.closest("#trade-button, .bSenO, .hkjXJ, .deal-amount-input") || isTradeButton(focused))) {
          return;
        }
      }
      const n = t.key ? t.key.toLowerCase() : "",
        o = t.code || "",
        r = n === "d" || o === "KeyD";
      if (n === "s" || o === "KeyS" || r) {
        const e = getTimeframeButton();
        if (e) {
          t.preventDefault();
          e.click();
          setTimeout(() => {
            const t = getTimeframeItems();
            if (t.length) {
              const e = getActiveTimeframe(),
                n = r ? 1 : -1,
                o = HOTKEY_TIMEFRAMES.indexOf(e),
                a = HOTKEY_TIMEFRAMES.length,
                i =
                  -1 !== o
                    ? HOTKEY_TIMEFRAMES[(o + n + a) % a]
                    : r
                      ? HOTKEY_TIMEFRAMES[0]
                      : HOTKEY_TIMEFRAMES[a - 1],
                c = t.find((t) => normLabel(t.textContent) === i);
              if (c) {
                c.click();
              }
            }
            setTimeout(() => document.body.click(), 50);
          }, 120);
        }
        return;
      }
      if (t.code === "ArrowLeft" || t.code === "ArrowRight") {
        // v1.69.0: always on, with no switch - → doubles the amount and ← halves it. It only changes the
        // amount, never places a trade, and a key pressed while typing in a box never reaches here.
        if (multiplyStake(t.code === "ArrowRight" ? STEP_FACTOR : 1 / STEP_FACTOR)) {
          t.preventDefault();
        }
      } else if (t.code === "ArrowUp" || t.code === "ArrowDown") {
        if (!hkUpDown) {
          return;
        }
        const e = Date.now();
        if (!multiMode && e - lastTradeClickAt < 1500) {
          t.preventDefault();
          return;
        }
        if (effectiveOpenTrades() >= maxTrades) {
          t.preventDefault();
          scheduleRecalc();
          return;
        }
        const n = readPayoutPct(),
          o = parseInt(getMinPayoutStored(), 10) || 89;
        if (!isNaN(n) && n < o) {
          return;
        }
        const r = getTradeButtons();
        if (r.length >= 2 && hkFocusMode) {
          // Focus mode (v1.28.0): select the button and let your next Enter/Space fire it, so the click
          // is generated by the browser itself. Focus stays put, so repeats are one key each.
          t.preventDefault();
          const target = t.code === "ArrowUp" ? r[0] : r[1];
          try {
            target.focus({ preventScroll: true });
          } catch (n) {}
          if (warnEl) {
            setText(warnEl, (t.code === "ArrowUp" ? "Up" : "Down") + " selected — press Enter to place");
            setDisplay(warnEl, "block");
            warnEl.classList.add("tcWarnVisible");
          }
          return;
        }
        if (r.length >= 2) {
          t.preventDefault();
          lastTradeClickAt = e;
          notePlacedTrade();
          recordPlacement();
          if (t.code === "ArrowUp") {
            synthClick(r[0]);
          } else {
            synthClick(r[1]);
          }
        } else {
          ((...t) => {
            if (window.__tcDebug) {
              try {
                console.log("[QXTradeLens]", ...t);
              } catch (t) {}
            }
          })("findTradeBtns() found", r.length, "trade buttons (expected 2) — selectors may have rotated");
        }
      } else if (o === "KeyF") {
        if (otcRebuildBusy) {
          return;
        }
        t.preventDefault();
        cycleAllTabs(t.shiftKey ? -1 : 1);
      } else if (o === "KeyG") {
        if (otcRebuildBusy) {
          return;
        }
        t.preventDefault();
        cycleAllTabs(-1);
      } else if (o === "KeyR") {
        t.preventDefault();
        if (t.repeat) {
          return;
        }
        !(function () {
          const t = parseInt(getMinPayoutStored(), 10) || 89;
          !(function (t, e) {
            if (otcRebuildBusy) {
              return true;
            }
            otcRebuildBusy = true;
            if (window.__tcAssetCloseTimer) {
              clearTimeout(window.__tcAssetCloseTimer);
              window.__tcAssetCloseTimer = null;
            }
            (function (t, e, n) {
              ensureAssetDropdown(t, () =>
                (function (t, e) {
                  const n = (function () {
                    const t = getAssetDropdown();
                    if (!t) {
                      return [];
                    }
                    const e = [];
                    getAssetRows(t).forEach((t) => {
                      const n = getAssetRowName(t);
                      if (!n || !n.toLowerCase().includes("otc")) {
                        return;
                      }
                      const o = (function (t) {
                          let e = NaN;
                          const n = t.querySelectorAll(".mQX6T span, .bQodW span, .dkV9n span");
                          for (let t = 0; t < n.length; t++) {
                            const o = (n[t].textContent || "").match(/(\d{2,3})\s*%/);
                            if (!o) {
                              continue;
                            }
                            const r = parseInt(o[1], 10);
                            if (!isNaN(r) && r > 0 && (isNaN(e) || r > e)) {
                              e = r;
                            }
                          }
                          if (!isNaN(e)) {
                            return e;
                          }
                          const o =
                            t.querySelector('[class*="percent"]') || t.querySelector('[class*="payout"]');
                          if (o) {
                            const t = parsePct(o.textContent);
                            if (!isNaN(t) && t > 0) {
                              return t;
                            }
                          }
                          const r = t.textContent.match(/(\d{2,3})%/);
                          return r ? parseInt(r[1], 10) : NaN;
                        })(t),
                        r = normKey(n);
                      if (!r || isNaN(o)) {
                        return;
                      }
                      const a = t.querySelector(".teoXG") || t.querySelector(".e4qZ6") || t;
                      e.push({
                        row: t,
                        click: a,
                        name: n,
                        norm: r,
                        payout: o,
                      });
                    });
                    e.sort((t, e) => e.payout - t.payout || t.name.localeCompare(e.name));
                    return e;
                  })();
                  if (n.length) {
                    (function (t) {
                      if (!minPayoutInput || t.length < 6) {
                        return;
                      }
                      const e = Math.floor(t[5].payout);
                      if (isNaN(e) || e <= 0) {
                        return;
                      }
                      window.__tcMinRpCap = e;
                      const n = parseInt(getMinPayoutStored(), 10);
                      if (isNaN(n) || n > e) {
                        setMinPayoutStored(String(e));
                        minPayoutInput.value = e + "%";
                        scheduleRecalc();
                      }
                    })(n);
                  }
                  const o = t(),
                    r = new Set(o);
                  let a = 0;
                  const i = () => {
                    if (a >= o.length) {
                      closeTabsExcept(r, 0, () =>
                        (function (t, e) {
                          const n = t && getPairTabs().find((e) => normKey(getTabName(e)) === t);
                          if (!n || isActiveTab(n)) {
                            e();
                            return;
                          }
                          activateTab(n);
                          waitUntil(
                            () => {
                              const e = getPairTabs().find((e) => normKey(getTabName(e)) === t);
                              return !!e && isActiveTab(e);
                            },
                            80,
                            400,
                            e,
                          );
                        })(o[0], closeAssetDropdown),
                      );
                      return;
                    }
                    const t = o[a++];
                    if (isPairTabOpen(t)) {
                      i();
                    } else {
                      ensureAssetDropdown(0, () => {
                        const e = getOtcAssetRows().find((e) => e.norm === t),
                          n = e && (e.click || e.row);
                        if (n && n.isConnected) {
                          noteAsset("R picked " + e.name);
                          synthClick(n);
                        }
                        waitUntil(() => isPairTabOpen(t), 80, 500, i);
                      });
                    }
                  };
                  if (!e || !o.length) {
                    i();
                    return;
                  }
                  const c = o[0];
                  ((t) => {
                    const e = getPairTabs().find((t) => normKey(getTabName(t)) === c);
                    if (e) {
                      if (isActiveTab(e)) {
                        t();
                        return;
                      } else {
                        activateTab(e);
                        waitUntil(
                          () => {
                            const t = getPairTabs().find((t) => normKey(getTabName(t)) === c);
                            return !!t && isActiveTab(t);
                          },
                          80,
                          400,
                          t,
                        );
                        return;
                      }
                    }
                    ensureAssetDropdown(0, () => {
                      const e = getOtcAssetRows().find((t) => t.norm === c),
                        n = e && (e.click || e.row);
                      if (n && n.isConnected) {
                        noteAsset("R picked " + e.name);
                        synthClick(n);
                      }
                      waitUntil(() => isPairTabOpen(c), 80, 500, t);
                    });
                  })(() => {
                    a = 1;
                    closeTabsExcept(new Set([c]), 0, i);
                  });
                })(e, n),
              );
            })(0, t, e);
          })(
            () =>
              getOtcAssetRows()
                .map((t) => ({
                  o: t,
                  p: readRowPayout(t.row),
                }))
                .filter((e) => !isNaN(e.p) && e.p >= t)
                .sort((t, e) => e.p - t.p || t.o.name.localeCompare(e.o.name))
                .map((t) => t.o.norm),
            true,
          );
        })();
      } else if (o === "KeyQ") {
        if (otcRebuildBusy) {
          return;
        }
        t.preventDefault();
        autoCloseLowPayoutTabs(parseInt(getMinPayoutStored(), 10) || 89, true);
      } else if (o === "KeyT") {
        t.preventDefault();
        toggleExpiryMode();
      } else if (o === "KeyX") {
        t.preventDefault();
        (function () {
          const t = getPairTabs().find(isActiveTab);
          if (!t) {
            return;
          }
          const e = normKey(getTabName(t));
          if (!e) {
            return;
          }
          const n = monitoredPairs.indexOf(e),
            o = -1 !== n;
          if (o) {
            monitoredPairs.splice(n, 1);
          } else {
            monitoredPairs.unshift(e);
          }
          (function () {
            monitoredPairs = monitoredPairs.slice(0, 20);
            writeJson(KEY_MONITOR_PAIRS, monitoredPairs);
          })();
          markMonitoredTabs();
          if (o) {
            const t = getPairTabs().filter((t) => monitoredPairs.includes(normKey(getTabName(t))));
            if (t.length) {
              activateTab(t[0]);
              return;
            }
            const e = getPairTabs()[0];
            if (e && !isActiveTab(e)) {
              activateTab(e);
            }
          }
        })();
      } else if (o === "KeyV") {
        if (otcRebuildBusy) {
          return;
        }
        t.preventDefault();
        (function (t) {
          const e = getPairTabs().filter((t) => monitoredPairs.includes(normKey(getTabName(t))));
          if (!e.length) {
            return;
          }
          if (e.length === 1) {
            if (!isActiveTab(e[0])) {
              activateTab(e[0]);
            }
            return;
          }
          cycleTabs(e, t);
        })(t.shiftKey ? -1 : 1);
      } else if (o === "KeyC") {
        t.preventDefault();
        toggleMtf();
      }
    };
    window.__tcKeydownDispatch = (t) => {
      window.__tcAudioUnlock(t);
      window.__tcKeyDelegator(t);
    };
    document.addEventListener("keydown", window.__tcKeydownDispatch, {
      capture: true,
    });
    window.__tcClickDispatch = (t) => {
      window.__tcClickDelegator(t);
      window.__tcTradeBlocker(t);
    };
    document.addEventListener("click", window.__tcClickDispatch, {
      capture: true,
    });
    window.__tcPointerdownDispatch = (t) => {
      window.__tcAudioUnlock(t);
    };
    document.addEventListener("pointerdown", window.__tcPointerdownDispatch, {
      capture: true,
    });
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Trade placement log + "Entry balance" tags in trade history
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const KEY_TRADE_LOG = "__tradeCalc_trade_log",
      TRADE_LOG_MAX = 10;
    let tradeLog = [];
    const readTradeLogLocal = () => readJson(KEY_TRADE_LOG, []);
    function saveTradeLog() {
      tradeLog = tradeLog.slice(0, TRADE_LOG_MAX);
      writeJson(KEY_TRADE_LOG, tradeLog);
      if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
        try {
          chrome.storage.sync.set({
            [KEY_TRADE_LOG]: tradeLog,
          });
        } catch (t) {}
      }
    }
    if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
      try {
        chrome.storage.sync.get([KEY_TRADE_LOG], (t) => {
          const e = t && Array.isArray(t[KEY_TRADE_LOG]) ? t[KEY_TRADE_LOG] : readTradeLogLocal();
          tradeLog = e.slice(0, TRADE_LOG_MAX);
          if (tradeLog.length) {
            tagHistoryEntryBalances();
          }
        });
      } catch (t) {
        tradeLog = readTradeLogLocal();
      }
    } else {
      tradeLog = readTradeLogLocal();
    }
    function recordPlacement() {
      const t = readAccountBalance();
      if (isNaN(t)) {
        return;
      }
      const e = readPayoutAndInvestment(),
        n = readStake(),
        o = e && !isNaN(e.investment) ? e.investment : !n || isNaN(n.val) || n.isPercent ? null : n.val,
        r = activePairTab() || document.querySelector(".dJ15T") || document.querySelector(".pPomf");
      tradeLog.unshift({
        uuid: null,
        ts: Date.now(),
        pair: getTabName(r) || "",
        amount: o,
        bal: t,
      });
      saveTradeLog();
    }
    // v1.82.0: a detail line's label and value by name, else its first and last pieces of text.
    function readDetailField(t, e) {
      if (!t) {
        return "";
      }
      const n = t.querySelectorAll("li");
      for (let t = 0; t < n.length; t++) {
        const leaves = Array.from(n[t].querySelectorAll("*")).filter((c) => c.children.length === 0 && textOf(c));
        const o = n[t].querySelector(".AUfBG") || n[t].querySelector(".qWutN") || leaves[0];
        if (o && o.textContent.trim().toLowerCase().indexOf(e) === 0) {
          const e = n[t].querySelector(".w3o70") || n[t].querySelector(".UFtUT") || (leaves.length > 1 ? leaves[leaves.length - 1] : null);
          return e ? e.textContent.trim() : "";
        }
      }
      return "";
    }
    // v1.82.0 (self-healing): the trade-history rows - by name, else a remembered name, else by what a row shows
    // (read live on 1.80.4: a pair "USD/BDT (OTC)", a time "00:00:47" and a result "+572.83 ₹"): a small block
    // holding a pair name, a time and an amount with pennies, outside the pair tabs, the chart and the trade panel.
    const MONEY_TEXT_RE = /\d[\d,]*\.\d{2}/;
    let historyLook = { at: 0, rows: [] };
    function getHistoryRows() {
      return resolveList("historyRows", document, [".ib6yR", ".SDEZP"], (root) => {
        // A walk of the page, and the page changes all the time: at most once a second.
        if (Date.now() - historyLook.at < 1000) {
          // ...and a row that turned up meanwhile is looked for again once the second is up.
          if (!historyLook.again) {
            historyLook.again = setTimeout(() => {
              historyLook.again = 0;
              onPageMutationsForHistory();
            }, 1050);
          }
          return historyLook.rows.filter((r) => r.isConnected);
        }
        historyLook.at = Date.now();
        const avoid = [...getPairTabs(), getChartBox(), tradeButtonsBlock()].filter(Boolean);
        const rows = [];
        for (const clock of leafMatches(root, CLOCK_ONLY_RE)) {
          for (let el = clock.parentElement, hop = 0; el && hop < 4; el = el.parentElement, hop++) {
            const text = textOf(el);
            if (text.length > 120 || isOurElement(el) || avoid.some((a) => el.contains(a) || a.contains(el))) {
              break;
            }
            if (PAIR_TEXT_RE.test(text) && MONEY_TEXT_RE.test(text)) {
              if (!rows.includes(el)) {
                rows.push(el);
              }
              break;
            }
          }
        }
        historyLook.rows = rows;
        return rows;
      });
    }
    function tagHistoryEntryBalances() {
      // v1.68.0: always on. v1.66.0 removed this along with its popup switch; it was the switch that was
      // meant to go. The balance at entry is read from the trade log, which was never removed.
      const t = getHistoryRows();
      const byShape = listVia.historyRows !== "class";
      let e = false;
      for (let n = 0; n < t.length; n++) {
        const o = t[n],
          r = o.querySelector(".Fqtla"),
          a = o.querySelector(".O5xJP");
        if (!r && !a && !byShape) {
          continue;
        }
        const i = a || o;
        if (i.querySelector("." + ids.tcPlacedBal)) {
          continue;
        }
        const s =
            o.querySelector(".RxOUE") ||
            o.querySelector(".glItV") ||
            Array.from(o.querySelectorAll("*")).find((c) => c.children.length === 0 && PAIR_TEXT_RE.test(textOf(c)) && textOf(c).length <= 30),
          l = s ? s.textContent.trim() : "";
        let d = NaN;
        if (r) {
          let t = r.textContent || "";
          const e = r.querySelector(".lCITV");
          if (e) {
            t = t.replace(e.textContent, "");
          }
          d = parseNum(t);
        } else if (a) {
          const t = a.querySelector(".h6J0L");
          let e = t ? t.textContent : "";
          const n = t && t.querySelector(".B7WYW");
          if (n) {
            e = e.replace(n.textContent, "");
          }
          d = parseNum(e);
        }
        const u = o.querySelector(".ow8Ej") || o.querySelector(".b98_V") || (byShape ? o : null),
          p = readDetailField(u, "id"),
          h = readDetailField(u, "open time"),
          f = h ? new Date(h.replace(" ", "T")).getTime() : NaN;
        let g = p ? tradeLog.find((t) => t.uuid === p) : null;
        if (!g) {
          const t = normKey(l);
          for (let n = 0; n < tradeLog.length; n++) {
            const o = tradeLog[n];
            if (
              !o.uuid &&
              (!t || normKey(o.pair) === t) &&
              (o.amount == null || isNaN(d) || !(Math.abs(o.amount - d) > 0.5)) &&
              (isNaN(f) || !(Math.abs(o.ts - f) > 90000))
            ) {
              g = o;
              if (p) {
                o.uuid = p;
                e = true;
              }
              break;
            }
          }
        }
        if (!g) {
          continue;
        }
        const _ = document.createElement("span");
        _.className = ids.tcPlacedBal;
        _.style.cssText =
          "flex:0 0 100%;width:100%;margin-top:1px;text-align:right;font-weight:700;font-size:11px;line-height:1.3;color:rgb(255 185 0);white-space:nowrap;opacity:0.92;";
        _.textContent = "Entry " + fmtMoney(g.bal) + " " + detectCurrency();
        i.appendChild(_);
      }
      if (e) {
        saveTradeLog();
      }
    }
    // v1.80.4: the shape of the first trade-history row, for the diagnostics line - which of the names the Entry
    // tags use are there, and an outline (tag.class "text") of the row, so a fallback can be built from real
    // markup rather than a guess.
    const HISTORY_NAMES = ["ib6yR", "SDEZP", "Fqtla", "O5xJP", "RxOUE", "glItV", "lCITV", "h6J0L", "B7WYW", "ow8Ej", "b98_V", "AUfBG", "qWutN", "w3o70", "UFtUT"];
    function historyRowDiag() {
      const rows = getHistoryRows();
      const present = HISTORY_NAMES.filter((n) => document.querySelector("." + n));
      const row = rows[0];
      if (!row) {
        return "no row found · names present: " + (present.join(" ") || "none");
      }
      const parts = [];
      const walk = (el, depth) => {
        if (parts.length >= 40 || depth > 5) {
          return;
        }
        const cls = (el.getAttribute("class") || "").split(" ")[0];
        const own = el.children.length ? "" : textOf(el).slice(0, 20);
        parts.push("-".repeat(depth) + el.tagName.toLowerCase() + (cls ? "." + cls : "") + (own ? ' "' + own + '"' : ""));
        for (const c of el.children) {
          if (!c.classList.contains(ids.tcPlacedBal)) {
            walk(c, depth + 1); // our own tag left out
          }
        }
      };
      walk(row, 0);
      return rows.length + " rows by " + (listVia.historyRows || "?") + " · names present: " + present.join(" ") + " · tagged: " + document.querySelectorAll("." + ids.tcPlacedBal).length + " · " + parts.join(" ");
    }
    window.__tcRecordPlacement = recordPlacement;
    let historyTagQueued = false;
    function onPageMutationsForHistory() {
      if (!historyTagQueued) {
        historyTagQueued = true;
        setTimeout(() => {
          historyTagQueued = false;
          tagHistoryEntryBalances();
        }, 300);
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Asset dropdown automation (OTC rebuild `R`, close tabs)
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.77.0: known names, then a remembered one, then the block of asset rows (SEMANTIC_FINDERS).
    function getAssetDropdown() {
      return findEl("assetDropdown", { cache: false });
    }
    // v1.77.0: known names, then a remembered one, then its plus icon or a "+" beside the pair tabs.
    function getAssetAddButton() {
      return findEl("assetAddButton", { cache: false });
    }
    // v1.72.4: reported live - after auto-open picked a pair, the pair list stayed open. The list was found
    // for opening by any of its names (getAssetDropdown), but "is it open?" and the close button were looked
    // for under the id alone. With the id gone the list read as closed the moment a pair was picked, so the
    // close never ran. Both now use the same finder; a list found by anything but its id counts as open only
    // while it is showing pair rows, so a container that stays on the page is never taken for an open list.
    const visibleBox = (el) => {
      const b = el.getBoundingClientRect();
      return b.width > 1 && b.height > 1;
    };
    function isAssetDropdownOpen() {
      const t = getAssetDropdown();
      if (!t) {
        return false;
      }
      const e = getComputedStyle(t);
      if (e.display === "none" || e.visibility === "hidden" || parseFloat(e.opacity || "1") === 0) {
        return false;
      }
      if (!visibleBox(t)) {
        return false;
      }
      return t.id === "asset-select-dropdown" || getAssetRows(t).some(visibleBox);
    }
    // For the diagnostics line: how the list is found, whether it is open, and how the last close went.
    let lastAssetClose = null;
    // v1.72.6: where Quotex's own candle timer is, before the chips are placed around it (requested: the
    // amount above it, the trade countdown below). Either it is an element over the chart - then it can be
    // found and followed - or it is painted on the chart canvas, where its position cannot be read (the chart
    // is one WebGL canvas, see CLAUDE.md). This only reports which, for the diagnostics line; nothing moves.
    const probeTimerTexts = new WeakMap();
    function candleTimerProbe() {
      const canvas = findEl("chartCanvas");
      if (!canvas) {
        return "no chart on the page";
      }
      const c = canvas.getBoundingClientRect();
      // The chart's own neighbourhood: a few levels up from the canvas, not the whole page.
      let scope = canvas.parentElement;
      for (let i = 0; i < 3 && scope && scope.parentElement && scope.parentElement !== document.body; i++) {
        scope = scope.parentElement;
      }
      const clock = /^\s*\d{1,2}:\d{2}(:\d{2})?\s*$/,
        found = [];
      for (const el of (scope || document.body).querySelectorAll("*")) {
        if (found.length >= 4) {
          break;
        }
        if (isOurElement(el)) {
          continue;
        }
        let own = "";
        for (const n of el.childNodes) {
          if (n.nodeType === 3) {
            own += n.textContent;
          }
        }
        if (!clock.test(own)) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.right < c.left || r.left > c.right || r.bottom < c.top || r.top > c.bottom) {
          continue;
        }
        own = own.trim();
        const before = probeTimerTexts.get(el);
        probeTimerTexts.set(el, own);
        const cls = typeof el.className === "string" && el.className ? "." + el.className.split(" ")[0] : "";
        found.push(
          el.tagName.toLowerCase() + cls + ' "' + own + '" at ' + Math.round(r.left - c.left) + "," + Math.round(r.top - c.top) +
            (before && before !== own ? " (ticking)" : ""),
        );
      }
      return found.length ? found.join(" | ") : "nothing over the chart reads like a timer - it is painted on the chart";
    }
    // v1.72.7: step 1 of drawing our own "Demo Account" block over Quotex's account block, which sits in a
    // closed component (<qx-usermenu-trigger>) whose words cannot be changed. The two tries in v1.58 failed on
    // the background: every PARENT of the block is transparent up to <body>, which computes to white on a page
    // that renders dark. elementsFromPoint returns everything stacked at a point on screen - not only
    // parents - so the layer that really paints behind the block can be found. This only reports it, with the
    // block's box and font, for the diagnostics line; nothing is drawn yet.
    const isSolid = (cs) => {
      const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || "");
      const alpha = m ? (m[1].split(",")[3] !== undefined ? parseFloat(m[1].split(",")[3]) : 1) : 0;
      return alpha > 0.5 || (cs.backgroundImage && cs.backgroundImage !== "none");
    };
    function accountBlockProbe() {
      const host = document.querySelector("qx-usermenu-trigger");
      if (!host) {
        return "no <qx-usermenu-trigger> on the page";
      }
      const r = host.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) {
        return "<qx-usermenu-trigger> has no box";
      }
      // What paints behind the block: just outside its left and right edges, at mid-height, and at its centre
      // below the block itself.
      const behind = (x, y) => {
        const stack = document.elementsFromPoint(x, y);
        const from = stack.indexOf(host) + 1;
        for (const el of stack.slice(from > 0 ? from : 0)) {
          if (el === host || isOurElement(el)) {
            continue;
          }
          const cs = getComputedStyle(el);
          if (isSolid(cs)) {
            const cls = typeof el.className === "string" && el.className ? "." + el.className.split(" ")[0] : "";
            return el.tagName.toLowerCase() + cls + " " + (cs.backgroundImage && cs.backgroundImage !== "none" ? "image " + cs.backgroundImage.slice(0, 60) : cs.backgroundColor);
          }
        }
        return "nothing solid";
      };
      const mid = r.top + r.height / 2,
        cs = getComputedStyle(host);
      return (
        "box " + Math.round(r.left) + "," + Math.round(r.top) + " " + Math.round(r.width) + "x" + Math.round(r.height) +
        " \u00b7 behind centre: " + behind(r.left + r.width / 2, mid) +
        " \u00b7 left of it: " + behind(r.left - 4, mid) +
        " \u00b7 right of it: " + behind(r.right + 4, mid) +
        " \u00b7 font " + cs.fontFamily.slice(0, 40) + " " + cs.fontSize + " " + cs.fontWeight + " " + cs.color
      );
    }
    // v1.74.4: reported live - the trade countdown chip and Quotex's countdown for the same trade in their
    // trade history do not match. Two causes are possible and this says which: the chip counts against this
    // computer's clock while Quotex counts against its server's (a steady gap), and the chip rounds to the
    // nearest second where Quotex may drop the fraction (one second out half the time). For the diagnostics
    // line only - nothing on screen changes.
    function tradeClockProbe() {
      const state = readQuotexState();
      const server = state && typeof state.serverTime === "number" ? state.serverTime : NaN,
        readAt = state && typeof state.readAt === "number" ? state.readAt / 1000 : NaN,
        ahead = isNaN(server) || isNaN(readAt) ? NaN : server - readAt;
      let out = "Quotex clock " + (isNaN(ahead) ? "unknown" : (ahead >= 0 ? "+" : "") + ahead.toFixed(2) + " s against this computer");
      const deals = state && Array.isArray(state.openedDeals) ? dealsForThisAccount(state.openedDeals) : [];
      const deal = deals.find((d) => d && d.closeTimestamp);
      if (!deal) {
        return out + " \u00b7 no trade open";
      }
      const localNow = Date.now() / 1000,
        byThisClock = deal.closeTimestamp - localNow,
        byQuotexClock = isNaN(ahead) ? NaN : deal.closeTimestamp - (localNow + ahead);
      // Quotex's own countdown for an open trade, from their trade history, as the chips' page fallback reads it.
      let theirs = "not on the page";
      const rows = getOpenTradeRows();
      for (const row of rows) {
        const clock = row.querySelector(".PiYD4") || row.querySelector(".xEiET") || row.querySelector(".wcb43") || findClockEl(row);
        if (clock) {
          theirs = '"' + clock.textContent.trim() + '"';
          break;
        }
      }
      const chip = byId(ids.tcTradeTimer),
        ours = chip && chip.style.display !== "none" ? (chip.textContent.match(/\d{2}:\d{2}(\.\d{2})?/) || [""])[0] : "hidden";
      return (
        tradeClockNote + " \u00b7 now: Quotex shows " + theirs + ", the chip shows " + ours +
        " \u00b7 left by this computer's clock " + byThisClock.toFixed(2) + " s, by Quotex's " + (isNaN(byQuotexClock) ? "-" : byQuotexClock.toFixed(2) + " s")
      );
    }
    function assetListDiag() {
      const t = getAssetDropdown();
      const via = !t ? "not on the page" : t.id === "asset-select-dropdown" ? "by id" : "by class " + (t.className || "").toString().split(" ")[0];
      const closeNote = lastAssetClose
        ? " \u00b7 last close: " + lastAssetClose.what + " " + fmtAgo(Math.round((Date.now() - lastAssetClose.at) / 1000))
        : "";
      // v1.80.0: and which "+" would be pressed, so a wrong one shows up in one read.
      const plus = getAssetAddButton();
      const plusNote = plus
        ? " \u00b7 + is " + plus.tagName.toLowerCase() + (plus.getAttribute("class") ? "." + plus.getAttribute("class").split(" ")[0] : "") +
          " via " + (selectorVia.assetAddButton || "?") + (textOf(plus) ? ' "' + textOf(plus).slice(0, 12) + '"' : "")
        : " \u00b7 no +";
      return via + (t ? (isAssetDropdownOpen() ? " \u00b7 open" : " \u00b7 closed") : "") + closeNote + plusNote;
    }
    // v1.75.3: "+" opens the list as well as closing it, so it is pressed only once the list has settled -
    // open for 1.5 s without a break. Before, a try could press it while the list was already on its way out,
    // and the press opened it again.
    const PLUS_ONLY_AFTER_MS = 1500;
    function closeAssetDropdownStep(t) {
      if (!isAssetDropdownOpen()) {
        return true;
      }
      const e = getAssetDropdown(),
        n = e && e.querySelector('[aria-label="Close"]'),
        o = getAssetAddButton(),
        r =
          o && !o.closest(".deal-amount-input") && !o.closest("#__tradeCalc") &&
          assetListWasOpen && Date.now() - assetListOpenSince >= PLUS_ONLY_AFTER_MS &&
          !(e && parseFloat(getComputedStyle(e).opacity || "1") < 1); // not while it is fading out
      noteAsset("close try " + t);
      if (t === 0 && n && !n.closest("#__tradeCalc")) {
        synthClick(n);
      } else if (t === 1 || t >= 4) {
        if (
          !(function () {
            const t =
              findEl("chartCanvas") ||
              document.querySelector(".trading-chart__wrapper");
            return !(
              !t ||
              t.closest("#asset-select-dropdown") ||
              t.closest("#__tradeCalc") ||
              t.closest("#trade-button") ||
              (["pointerdown", "mousedown", "mouseup", "click"].forEach((e) =>
                t.dispatchEvent(
                  new MouseEvent(e, {
                    bubbles: true,
                    cancelable: true,
                  }),
                ),
              ),
              0)
            );
          })() &&
          r
        ) {
          synthClick(o);
        }
      } else if (t === 2) {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
          }),
        );
      } else if (t === 3 && r) {
        synthClick(o);
      } else if (n && !n.closest("#__tradeCalc")) {
        synthClick(n);
      }
      return false;
    }
    function getAssetRows(t) {
      if (!t) {
        return [];
      }
      let e = resolveList("assetRows", t, [".R2Rgm", ".vPvlJ", ".fZEV1"], () => []);
      if (!e.length) {
        // v1.77.0: a row is the smallest block holding an asset name and a payout. The name is a pair
        // (ABC/XYZ) or anything marked OTC - so crypto and stock rows ("Toncoin (OTC)") count - and the payout
        // may have a space before its % sign.
        const isRow = (el) => {
          const text = el.textContent || "";
          return PAIR_TEXT_RE.test(text) && /\d{2,3}\s*%/.test(text);
        };
        e = Array.from(t.querySelectorAll("*")).filter((el) => isRow(el) && !Array.from(el.children).some(isRow));
      }
      return e;
    }
    function getAssetRowName(t) {
      const e =
        t.querySelector(".teoXG .Z2fyK") ||
        t.querySelector(".teoXG") ||
        t.querySelector(".e4qZ6 span") ||
        t.querySelector(".Z2fyK") ||
        t.querySelector(".pC7xL") ||
        t.querySelector('[class*="name"]') ||
        t.querySelector("span");
      if (e && e.textContent.trim()) {
        return e.textContent.trim();
      }
      const n = t.textContent.match(/[A-Z]{3}\/[A-Z]{3}/);
      return n ? n[0] + (t.textContent.toLowerCase().includes("otc") ? " (OTC)" : "") : t.textContent.trim();
    }
    function getOtcAssetRows() {
      const t = getAssetDropdown();
      if (!t) {
        return [];
      }
      const e = [];
      getAssetRows(t).forEach((t) => {
        const n = getAssetRowName(t);
        if (!n || !n.toLowerCase().includes("otc")) {
          return;
        }
        const o = normKey(n);
        if (!o) {
          return;
        }
        const r = t.querySelector(".teoXG") || t.querySelector(".e4qZ6") || t;
        e.push({
          row: t,
          click: r,
          name: n,
          norm: o,
        });
      });
      return e;
    }
    // v1.87.0: `fresh` asks the page again. Tabs found by walking the page (no known name, no pair code) are
    // kept for a second - longer than a pick takes to open its tab, so the tab just opened read as not there.
    function isPairTabOpen(t, fresh) {
      if (fresh) {
        tabsByText.at = 0;
      }
      return getPairTabs().some((e) => normKey(getTabName(e)) === t);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Page observer (v1.23.0): one MutationObserver on document.body feeds the three consumers that used
    // to each observe the whole body subtree: the account-label spoof, recalc scheduling and
    // the trade-history "Entry balance" tags. Cleanup disconnects it through window.__tradeCalcObs.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const pageObserver = new MutationObserver((records) => {
      onPageMutationsForSpoof(records);
      onPageMutationsForRecalc(records);
      onPageMutationsForHistory();
    });
    pageObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.__tradeCalcObs = pageObserver;
    let otcRebuildBusy = false;
    // v1.75.3: reported live - the "select trade pair" list opened again 2-3 s after it closed, when auto-open
    // ran. Two causes fit and need opposite fixes (the refill opening the next pair, or a closing step
    // re-opening a list that was already shutting), so every step is written down here, with the time, and
    // the diagnostics line carries the last twelve. One read after it happens says which.
    // (Eight until v1.85.0: one refill step is eight entries by itself, so the close that started it - now
    // logged too - would have been pushed out before the line was next written.)
    const assetEvents = [];
    function noteAsset(what) {
      assetEvents.push({ at: Date.now(), what });
      if (assetEvents.length > 12) {
        assetEvents.shift();
      }
    }
    function assetLogDiag() {
      const now = Date.now();
      return assetEvents.length
        ? assetEvents.map((e) => ((now - e.at) / 1000).toFixed(1) + "s ago: " + e.what).join(" | ")
        : "nothing yet";
    }
    // The list appearing and going, whoever does it - the platform, the user, or this panel. `assetListOpenSince`
    // is when it last appeared, so a closing step can tell a list that has settled open from one in motion.
    let assetListWasOpen = false,
      assetListOpenSince = 0,
      lastPlusAt = 0,
      // v1.85.0: the tab went to the background with a list of the panel's still to close.
      closeListOnReturn = false;
    every(250, () => {
      // v1.85.0: in front again. The list finishes appearing with the first frames drawn, so the close waits
      // for it (up to 2 s); until it has ended nothing else drives the list.
      if (closeListOnReturn && !document.hidden) {
        closeListOnReturn = false;
        otcRebuildBusy = true;
        noteAsset("tab is in front again - closing the list");
        closeAssetDropdown(2000);
      }
      // v1.88.0: and the chart goes back to the pair it was on, when a refill was cut short by the background
      // with the chart on a pair it had just opened.
      if (homeOnReturn && !document.hidden) {
        const home = homeOnReturn;
        homeOnReturn = "";
        const tab = getPairTabs().find((t) => normKey(getTabName(t)) === home);
        if (tab && !isActiveTab(tab)) {
          noteAsset("tab is in front again - back on " + getTabName(tab));
          activateTab(tab);
        }
      }
      const open = isAssetDropdownOpen();
      if (open !== assetListWasOpen) {
        assetListWasOpen = open;
        if (open) {
          assetListOpenSince = Date.now();
        }
        noteAsset(open ? "list appeared" : "list went");
      }
    });
    function waitUntil(t, e, n, o) {
      const r = Date.now(),
        a = () => {
          if (t() || Date.now() - r >= n) {
            o();
          } else {
            window.__tcOtcRebuildTimer = setTimeout(a, e);
          }
        };
      a();
    }
    // v1.85.0: `inBackground`, when given, is called instead once the tab is in the background - the list
    // cannot be read there, so nothing is pressed or picked. Auto-open passes it; R and the scan rows are
    // started by hand with the tab in front and are left as they were.
    function ensureAssetDropdown(t, e, inBackground) {
      if (inBackground && document.hidden) {
        inBackground();
      } else if (getOtcAssetRows().length) {
        e();
      } else if (t >= 32) {
        otcRebuildBusy = false;
      } else {
        if (!isAssetDropdownOpen()) {
          const t = getAssetAddButton();
          if (!(!t || t.closest(".deal-amount-input") || t.closest("#__tradeCalc"))) {
            noteAsset("pressed + to open the list");
            lastPlusAt = Date.now();
            synthClick(t);
          }
        }
        window.__tcOtcRebuildTimer = setTimeout(() => ensureAssetDropdown(t + 1, e, inBackground), 150);
      }
    }
    function getClosableTabs(t) {
      return getPairTabs().filter((e) => {
        const n = normKey(getTabName(e));
        return n && !t.has(n) && !tabHasOpenTrade(e) && getTabCloseBtn(e);
      });
    }
    function closeTabsExcept(t, e, n) {
      const o = getClosableTabs(t);
      if (o.length && e < 40) {
        const r = o.length;
        synthClick(getTabCloseBtn(o[0]));
        waitUntil(
          () => getClosableTabs(t).length < r,
          80,
          400,
          // v1.24.4: continue only if that click closed a tab; otherwise finish instead of retrying up to 40×.
          () => (getClosableTabs(t).length < r ? closeTabsExcept(t, e + 1, n) : closeTabsExcept(t, 40, n)),
        );
        return;
      }
      if (n) {
        n();
      } else {
        closeAssetDropdown();
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.54.0: the other half of the payout floor. Auto-close takes low-payout pairs away one by one, but
    // Quotex gives the last remaining tab no close control - so when the final pair drops below the floor
    // it stays, trading is blocked, and there is nothing left to switch to. This opens one pair that does
    // clear the floor; the close pass then takes the stale one away on its next turn.
    //
    // Which pair is the platform's decision, not the markup's: its own asset list gives payout, whether
    // the market is active and the label, for every instrument it offers - so this works on the whole
    // board, not a list of pairs written down here. The dropdown's rows are only the click target, and
    // only the fallback for choosing when the bridge cannot answer.
    const AUTO_OPEN_AGAIN_MS = 30000,
      // A payout that dips for a single pass is not a reason to open a pair; it has to stay down.
      AUTO_OPEN_SETTLE_MS = 4000;
    let lastAutoOpenAt = 0,
      autoOpenBusy = false,
      tooFewGoodSince = 0,
      // v1.54.1: why this did or did not act, for the diagnostics line. Whether a pair SHOULD have been
      // opened cannot be judged from outside the tab without the payouts it was looking at.
      autoOpenReason = "starting up",
      // v1.88.0: the pair to put the chart back on once the tab is in front again - a refill was cut short by
      // the background while the chart stood on a pair it had just opened.
      homeOnReturn = "",
      // v1.88.0: until when a change of the chart's pair is the refill's own doing - there and back - and not
      // the user opening a pair, so the chart auto-fill does not queue a walk for it.
      refillAwayUntil = 0;
    // How a tab's payout was last read, for Check: "class", "store", "printed", "store by name" or "missing".
    let tabPayoutVia = "missing";
    function tabPayout(tab) {
      const el =
        tab.querySelector(".ElyTP") ||
        tab.querySelector(".UloGw") ||
        tab.querySelector(".bvdd_") ||
        tab.querySelector(".dkV9n span") ||
        tab.querySelector("[class*='percent']") ||
        tab.querySelector("[class*='payout']");
      const shown = el ? parsePct(el.textContent) : NaN;
      if (!isNaN(shown)) {
        tabPayoutVia = "class";
        return shown;
      }
      const asset = storeAssetFor(tab);
      if (asset && asset.payout != null) {
        tabPayoutVia = "store";
        return asset.payout;
      }
      // v1.87.0 (self-healing): with the known names and the pair code (`data-symbol`) both gone, nothing was
      // left to read a tab's payout by - probed on such a page, every tab read as unknown, so auto-close
      // closed nothing and auto-open stood at "a pair's payout cannot be read". Now the percent the tab itself
      // prints (the one piece of text in it that is just "91 %"), then Quotex's own figure for the pair the
      // tab names.
      const leaf = Array.from(tab.querySelectorAll("*")).find((c) => c.children.length === 0 && /^\d{1,3}\s*%$/.test(textOf(c)));
      const printed = leaf ? parsePct(textOf(leaf)) : NaN;
      if (!isNaN(printed)) {
        tabPayoutVia = "printed";
        return printed;
      }
      const norm = normKey(getTabName(tab)),
        assets = norm ? readQuotexAssets() : null;
      for (const symbol in assets || {}) {
        const a = assets[symbol];
        if (a && a.payout != null && normKey(a.label || symbol) === norm) {
          tabPayoutVia = "store by name";
          return a.payout;
        }
      }
      tabPayoutVia = "missing";
      return NaN;
    }
    // Every open pair's payout, or null when one of them cannot be read - an unknown payout must never be
    // the reason a pair gets opened.
    function openPairPayouts() {
      const out = [];
      for (const tab of getPairTabs()) {
        const p = tabPayout(tab);
        if (isNaN(p)) {
          return null;
        }
        out.push(p);
      }
      return out;
    }
    // The best instrument the platform says is worth opening: active, at or above the floor, not already
    // open. Ties go to the first name alphabetically so the choice is the same on every tab.
    // v1.75.1: auto-open opens OTC pairs only (requested) - with none clearing the floor it opens nothing.
    // OTC is read three ways, so no one of them going missing lets a regular pair through: the platform's own
    // flag, the "(OTC)" in the name, and the "_otc" ending of the symbol.
    const isOtcAsset = (a, symbol) => !!(a && (a.isOtc === 1 || a.isOtc === true || /\botc\b/i.test(a.label || ""))) || /_otc$/i.test(symbol || "");
    // v1.75.4: read live - the refill wanted Toncoin (OTC), a crypto pair, while Quotex's list was showing
    // another category, so there was nothing to click; it opened the list for it again on the next close. A
    // pair that was not in the list when it was open is left out for 10 minutes (the list may show its
    // category by then), and the best OTC pair that IS in the list is opened instead.
    const UNREACHABLE_MS = 600000;
    const unreachablePairs = new Map();
    const isUnreachable = (norm) => {
      const at = unreachablePairs.get(norm);
      if (at && Date.now() - at < UNREACHABLE_MS) {
        return true;
      }
      unreachablePairs.delete(norm);
      return false;
    };
    function bestAssetAboveFloor(min) {
      const assets = readQuotexAssets();
      if (!assets) {
        return null;
      }
      const open = new Set(getPairTabs().map((t) => normKey(getTabName(t))));
      let best = null;
      for (const symbol in assets) {
        const a = assets[symbol];
        if (!a || !a.active || a.payout == null || !(a.payout >= min) || !isOtcAsset(a, symbol)) {
          continue;
        }
        const norm = normKey(a.label || symbol);
        if (!norm || open.has(norm) || isUnreachable(norm)) {
          continue;
        }
        if (!best || a.payout > best.payout || (a.payout === best.payout && norm < best.norm)) {
          best = { norm, payout: a.payout, label: a.label || symbol };
        }
      }
      return best;
    }
    // Every row the asset list is showing, with the payout it prints. Name and payout come through the
    // same self-repairing readers the rest of the file uses, so a class rename does not stop this either.
    function getAssetChoices() {
      const dropdown = getAssetDropdown();
      if (!dropdown) {
        return [];
      }
      const out = [];
      getAssetRows(dropdown).forEach((row) => {
        const name = getAssetRowName(row);
        const norm = normKey(name);
        if (!norm) {
          return;
        }
        let payout = readRowPayout(row);
        if (isNaN(payout)) {
          const m = (row.textContent || "").match(/(\d{2,3})\s*%/);
          payout = m ? parseInt(m[1], 10) : NaN;
        }
        out.push({
          row,
          click: row.querySelector(".teoXG") || row.querySelector(".e4qZ6") || row,
          name,
          norm,
          payout,
        });
      });
      return out;
    }
    function autoOpenFinish() {
      if (window.__tcAutoOpenTimer) {
        clearTimeout(window.__tcAutoOpenTimer);
        delete window.__tcAutoOpenTimer;
      }
      autoOpenBusy = false;
      otcRebuildBusy = false;
      closeAssetDropdown();
    }
    // v1.86.0: what may be picked from the list as it is showing - the pairs in it that the platform rates at
    // or above the floor, OTC and active, and that are not open; best first, ties by name. The platform's asset
    // table decides, as it always has (v1.54.0) - but a row that itself prints a figure below the floor is not
    // picked either: its tab would print the same figure and be closed on the next pass. The printed figures
    // alone are the fallback, for when the bridge cannot answer or knows none of the rows by name.
    function autoOpenChoices(min) {
      tabsByText.at = 0; // the tabs as they are now - see isPairTabOpen
      const rows = getAssetChoices(),
        open = new Set(getPairTabs().map((t) => normKey(getTabName(t)))),
        assets = readQuotexAssets(),
        rated = new Map();
      for (const symbol in assets || {}) {
        if (assets[symbol]) {
          rated.set(normKey(assets[symbol].label || symbol), { a: assets[symbol], symbol });
        }
      }
      // v1.87.0: "the platform rates the rows" means it has a payout figure for at least one of them. With the
      // payout field renamed it knows every row by name and rates none; the printed figures decide then too.
      const byPlatform = rows.some((r) => rated.has(r.norm) && rated.get(r.norm).a.payout != null),
        seen = new Set(),
        out = [];
      for (const r of rows) {
        if (open.has(r.norm) || seen.has(r.norm)) {
          continue;
        }
        seen.add(r.norm);
        const hit = rated.get(r.norm);
        let payout = r.payout;
        if (byPlatform) {
          if (!hit || !hit.a.active || hit.a.payout == null || !isOtcAsset(hit.a, hit.symbol) || r.payout < min) {
            continue;
          }
          payout = hit.a.payout;
        } else if (!/\botc\b/i.test(r.name) || (hit && !hit.a.active)) {
          continue;
        }
        if (payout >= min) {
          out.push({ row: r.row, click: r.click, name: r.name, norm: r.norm, payout });
        }
      }
      return out.sort((x, y) => y.payout - x.payout || (x.norm < y.norm ? -1 : x.norm > y.norm ? 1 : 0));
    }
    // v1.75.4 left one pair out per visit - the one it had come for. v1.86.0: every pair the platform rates at
    // or above the floor that the list is not showing (another category - Litecoin, Silver) is left out in the
    // same visit, so the list is not brought up again for each of them in turn. Read live on 1.85.0: every
    // refill ended with one more opening of the list that found nothing. Nothing is left out when the platform
    // knows none of the rows by name - then the two are not speaking of the same pairs.
    function leaveOutUnlisted(min) {
      const assets = readQuotexAssets();
      if (!assets) {
        return;
      }
      const shown = new Set(getAssetChoices().map((r) => r.norm)),
        open = new Set(getPairTabs().map((t) => normKey(getTabName(t)))),
        unlisted = [];
      let known = false;
      for (const symbol in assets) {
        const a = assets[symbol],
          norm = a ? normKey(a.label || symbol) : "";
        if (!norm) {
          continue;
        }
        if (shown.has(norm)) {
          known = true;
        } else if (a.active && a.payout >= min && isOtcAsset(a, symbol) && !open.has(norm) && !isUnreachable(norm)) {
          unlisted.push({ norm, label: a.label || symbol });
        }
      }
      if (!known || !unlisted.length) {
        return;
      }
      unlisted.forEach((u) => unreachablePairs.set(u.norm, Date.now()));
      const names = unlisted.map((u) => u.label);
      noteAsset(
        names.slice(0, 3).join(", ") + (names.length > 3 ? " and " + (names.length - 3) + " more" : "") +
          (names.length > 1 ? " are" : " is") + " not in the list shown - left out for 10 min",
      );
    }
    // v1.86.0 (asked on 2026-10-03, after watching a refill on 1.85.0: "the way R is doing its job, picking
    // every pair in a ms"): a refill is ONE visit to the list. It is opened once, every pair in it that clears
    // the floor is picked one after the other - each as soon as the tab of the one before is there, the way R
    // does it - and it is closed. Until now a refill picked one pair, closed the list and waited for the next
    // five-second pass: read live, four pairs took 17 s and brought the list up five times. The refill is over
    // when the visit is; the next one needs the next close. The path with no close behind it (every open pair
    // below the floor, v1.54.0) still opens one pair - the best.
    function autoOpenBetterPair(min) {
      autoOpenBusy = true;
      otcRebuildBusy = true; // the rebuild hotkeys and this must never drive the list at the same time
      lastAutoOpenAt = Date.now();
      const refill = autoOpenFill,
        opened = [],
        tried = new Set();
      let leftOut = false,
        over = false;
      // v1.88.0 (reported 2026-10-04: "the auto open switched the asset I am on - not good"): Quotex puts the
      // chart on a pair the moment it is picked from its list, so a refill left the chart on the last pair it
      // had opened. The pair the chart is on is noted before the list is touched, and the chart is put back on
      // it when the visit ends - after the picks and before the list is closed, the way R ends on its best
      // pair. Only for a refill: with every open pair below the floor (v1.54.0), the one pair that is opened
      // is where the chart is meant to go.
      // Asked afresh each time: with no "tab-active" mark on the page, the pair the chart is on comes from
      // Quotex's data, which is kept for 250 ms - longer than a pick takes. Caught by the full suite: on the
      // renamed pages the chart read as still on its pair right after the picks, and was not put back.
      const onChart = (t) => {
        quotexStateAt = 0;
        return isActiveTab(t);
      };
      const homeTab = refill ? getPairTabs().find(onChart) : null;
      let homeName = homeTab ? getTabName(homeTab) : "",
        home = normKey(homeName);
      const findHome = () => getPairTabs().find((t) => normKey(getTabName(t)) === home);
      const away = (ms) => {
        if (home) {
          refillAwayUntil = Date.now() + ms;
        }
      };
      // The chart is on a pair this visit did not pick, and not the one it started on: the user clicked a tab
      // while the pairs were being picked. That pair is theirs, and it is where the chart goes back to.
      const followUser = () => {
        const on = home && tried.size ? getPairTabs().find(onChart) : null,
          name = on ? getTabName(on) : "",
          norm = normKey(name);
        if (norm && norm !== home && !tried.has(norm)) {
          home = norm;
          homeName = name;
        }
      };
      const goHome = (then) => {
        followUser();
        const tab = home && tried.size ? findHome() : null;
        if (!tab || onChart(tab)) {
          away(tab ? 1500 : 0);
          return then();
        }
        if (document.hidden) {
          homeOnReturn = home; // not in a background tab - the 250 ms watcher does it on the way back
          return then();
        }
        activateTab(tab);
        waitUntil(
          () => {
            const t = findHome();
            return !t || onChart(t);
          },
          80,
          600,
          () => {
            const t = findHome();
            noteAsset(t && onChart(t) ? "auto-open: back on " + homeName : "auto-open: could not go back to " + homeName);
            away(1500); // long enough for the charts to see the pair is the one it was
            then();
          },
        );
      };
      // `why` is set when the visit was cut short; it goes in the log, and autoOpenReason is left as the
      // caller set it.
      const end = (why) => {
        if (over) {
          return;
        }
        over = true;
        if (opened.length) {
          noteAsset("auto-open picked " + opened.join(", "));
        }
        if (why) {
          noteAsset("auto-open " + why);
        } else if (refill && opened.length) {
          autoOpenReason = "refill done - opened " + opened.length;
        }
        if (refill) {
          autoOpenFill = false;
        }
        goHome(autoOpenFinish);
      };
      // ensureAssetDropdown gives up silently after 32 tries; without this the flag would stay set. Set again
      // at each pick, so a long visit is not cut short.
      const guard = () => {
        away(15000);
        if (window.__tcAutoOpenTimer) {
          clearTimeout(window.__tcAutoOpenTimer);
        }
        window.__tcAutoOpenTimer = setTimeout(() => {
          if (autoOpenBusy) {
            autoOpenReason = "the pair list did not answer";
            end("gave up - the list did not answer");
          }
        }, 12000);
      };
      const wanted = bestAssetAboveFloor(min);
      autoOpenReason = wanted ? "opening " + wanted.label + " at " + wanted.payout + "%" : "looking for an OTC pair above " + min + "%";
      noteAsset("auto-open" + (refill ? " (refill after closing " + autoClosedNote() + ")" : "") + ": " + autoOpenReason);
      // v1.85.0: the tab went to the background with the list on its way. Nothing is picked there, the refill
      // ends, and the list is closed when the tab is in front again (closeAssetDropdown).
      const stopInBackground = () => {
        autoOpenReason = "the tab is in the background";
        end("stopped - the tab is in the background");
      };
      const step = () => {
        if (over) {
          return;
        }
        guard();
        // Asked for before every pick, as R does: rows still there are used at once, and a list that a pick
        // closed (Quotex's did, until late September) is opened again.
        ensureAssetDropdown(0, () => {
          if (over) {
            return;
          }
          if (!leftOut) {
            leftOut = true;
            leaveOutUnlisted(min);
          }
          followUser(); // before the next pick takes the chart away again
          const pick = autoOpenChoices(min).find((c) => !tried.has(c.norm)),
            target = pick && (pick.click || pick.row);
          if (!target || !target.isConnected) {
            if (!opened.length) {
              autoOpenReason = "no OTC pair in the asset list clears " + min + "%";
            }
            return end();
          }
          tried.add(pick.norm);
          synthClick(target);
          waitUntil(() => isPairTabOpen(pick.norm, true), 80, 800, () => {
            if (over) {
              return;
            }
            if (isPairTabOpen(pick.norm, true)) {
              opened.push(pick.name);
            } else {
              noteAsset("auto-open: " + pick.name + " did not open");
            }
            if (refill) {
              step();
            } else {
              end();
            }
          });
        }, stopInBackground);
      };
      step();
    }
    function maybeAutoOpenPair(min) {
      const stop = (why) => {
        autoOpenReason = why;
      };
      // v1.85.0: the board is left alone while the tab is in the background. Reported, and read live on
      // 2026-10-03 (assetLog, 1.84.1): Chrome wakes a background tab's timers once a minute and draws nothing,
      // and Quotex's pair list never finishes appearing there - its rows are in the page, but it reads as
      // closed. So the refill used the list without pressing "+", logged "close: closed by itself" and left
      // it open; it came on screen when the tab was shown, and held the rest of the refill until it was closed
      // - pairs then opened with no close in sight. The chart auto-fill and the sweep already stop here.
      // A refill in progress ends too: carried over, it would open pairs on the way back for a close that was
      // never seen. Back in front the close pass runs first, and a refill follows a close made on screen.
      if (document.hidden) {
        autoOpenFill = false;
        tooFewGoodSince = 0;
        return stop("the tab is in the background");
      }
      if (autoOpenBusy) {
        return stop("opening a pair now");
      }
      if (otcRebuildBusy || autoCloseRunning) {
        return stop("the tab list is busy");
      }
      if (isNaN(min)) {
        return stop("no payout floor set");
      }
      const now = Date.now();
      // The 30 s throttle exists for the path with no close behind it, where nothing limits how often this
      // could fire. A fill stops on its own once every qualifying pair is open, so holding each one back by
      // half a minute would only make refilling a board take a quarter of an hour.
      if (!autoOpenFill && now - lastAutoOpenAt < AUTO_OPEN_AGAIN_MS) {
        return stop("opened one " + fmtAgo(Math.round((now - lastAutoOpenAt) / 1000)));
      }
      // The list is the trader's while they have it open, and nothing moves the board under a running trade.
      if (isAssetDropdownOpen()) {
        return stop("the asset list is open");
      }
      if (openTradeCount() > 0) {
        return stop("a trade is running");
      }
      const payouts = openPairPayouts();
      if (!payouts) {
        return stop("a pair's payout cannot be read");
      }
      if (!payouts.length) {
        return stop("no pair tabs");
      }
      // v1.62.0: auto-close removed something, so the board is refilled - every pair the platform rates at
      // or above the floor that is not already open, best first. No count of open pairs and no count of pairs
      // clearing the floor comes into it: the close is the trigger, and the asset table decides when there is
      // nothing to do. v1.86.0: in one visit to the list (autoOpenBetterPair), not one pair per pass.
      if (autoOpenFill) {
        tooFewGoodSince = 0;
        // v1.86.0: read afresh. The close was decided on what the tab prints; the asset table kept for up to
        // 5 s could still rate that same pair above the floor, and the refill would open it straight back.
        const assets = readQuotexAssets(true);
        // From the store, not the dropdown, so running out costs nothing and touches no part of their UI.
        const next = bestAssetAboveFloor(min);
        // v1.87.0 (self-healing): "none left" is an answer only when the platform's table carries payout
        // figures. With Quotex's data out of reach, or its payout field renamed, there was no `next` either,
        // and the refill ended here without a word - probed, a close was never followed by a refill. Now the
        // refill goes to the list and picks by what its rows print (autoOpenChoices).
        const rates = Object.keys(assets || {}).some((symbol) => assets[symbol] && assets[symbol].payout != null);
        if (!next && rates) {
          autoOpenFill = false;
          return stop("every OTC pair at or above " + min + "% is already open");
        }
        autoOpenReason = next ? "refilling the board - " + next.label + " at " + next.payout + "%" : "refilling the board by what the list prints";
        return autoOpenBetterPair(min);
      }
      // The case with no close to trigger on: Quotex gives the last remaining tab no close control, so when
      // the final pair falls below the floor nothing is removed and a fill would never start. v1.54.0's
      // rule, unchanged, and the only path that runs without a close behind it.
      if (payouts.some((p) => p >= min)) {
        tooFewGoodSince = 0;
        return stop("a pair is at or above " + min + "%");
      }
      if (!tooFewGoodSince) {
        tooFewGoodSince = now;
        return stop("every pair below " + min + "% - waiting to see if it holds");
      }
      if (now - tooFewGoodSince < AUTO_OPEN_SETTLE_MS) {
        return stop("every pair below " + min + "% - waiting to see if it holds");
      }
      tooFewGoodSince = 0;
      autoOpenReason = "every pair below " + min + "% - opening one";
      autoOpenBetterPair(min);
    }
    // v1.85.0: `waitMs` is how long to wait for the list to be there before closing it - the return from the
    // background passes it, because the list only finishes appearing once the tab is drawn again.
    function closeAssetDropdown(waitMs) {
      if (window.__tcAssetCloseTimer) {
        clearTimeout(window.__tcAssetCloseTimer);
        window.__tcAssetCloseTimer = null;
      }
      // v1.85.0: not in a background tab. Whether the list is open cannot be read there - read live, it was
      // "closed by itself" twice with the list still in the page - and nothing is pressed there either. It is
      // closed when the tab is in front again (the 250 ms watcher above).
      const leftForReturn = () => {
        if (!document.hidden) {
          return false;
        }
        if (!closeListOnReturn) {
          noteAsset("close: left until the tab is in front again");
        }
        closeListOnReturn = true;
        otcRebuildBusy = false;
        return true;
      };
      if (leftForReturn()) {
        return;
      }
      let t = 0;
      const e = () => {
        try {
          if (leftForReturn()) {
            return;
          }
          if (!isAssetDropdownOpen() || t >= 8) {
            lastAssetClose = {
              at: Date.now(),
              what: isAssetDropdownOpen() ? "still open after " + t + " tries" : t ? "closed at try " + t : "closed by itself",
            };
            noteAsset("close: " + lastAssetClose.what);
            otcRebuildBusy = false;
            return;
          }
          closeAssetDropdownStep(t++);
        } catch (t) {
          otcRebuildBusy = false;
          return;
        }
        waitUntil(() => !isAssetDropdownOpen(), 100, 400, e);
      };
      const start = () => waitUntil(() => !isAssetDropdownOpen(), 100, 600, e);
      // v1.75.4: read live - auto-open pressed "+", found nothing to pick and closed within half a second,
      // before the list had finished opening: the close saw nothing open and stopped, the list then arrived
      // and stayed open (and, while open, kept auto-open away). A list "+" was pressed for in the last 2 s is
      // now waited for, and closed once it is there.
      const wait = Math.max(waitMs || 0, 2000 - (Date.now() - lastPlusAt));
      if (wait > 0 && !isAssetDropdownOpen()) {
        noteAsset("close waits for the list it opened");
        waitUntil(() => isAssetDropdownOpen(), 100, wait, start);
      } else {
        start();
      }
    }
    if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        [
          KEY_OTC_AUTO,
          KEY_MAX_TRADES,
          KEY_MAX_TWO,
          KEY_TIMER_X,
          KEY_TIMER_Y,
          KEY_HK_UPDOWN,
          KEY_MTF_TFS,
          KEY_MTF_AUTOFILL,
          KEY_MTF_SETTLE,
          KEY_MTF_FLIP,
          KEY_MTF_FLIP_BARS,
        ],
        (t) => {
          if (!t) {
            return;
          }
          if (KEY_MAX_TRADES in t && t[KEY_MAX_TRADES] != null) {
            maxTrades = clampMaxTrades(t[KEY_MAX_TRADES]);
            setMaxTradesStored(maxTrades);
          } else if (KEY_MAX_TWO in t && typeof t[KEY_MAX_TWO] == "boolean") {
            maxTrades = t[KEY_MAX_TWO] ? 2 : 4;
            setMaxTradesStored(maxTrades);
          }
          renderMaxTradesField();
          if (KEY_OTC_AUTO in t) {
            otcAuto = t[KEY_OTC_AUTO] === true;
            setOtcAutoStored(otcAuto);
          }
          if (KEY_TIMER_X in t) {
            timerX = clampPercent(t[KEY_TIMER_X], 50);
            setTimerXStored(timerX);
          }
          if (KEY_TIMER_Y in t) {
            timerY = clampPercent(t[KEY_TIMER_Y], 90);
            setTimerYStored(timerY);
          }
          if (KEY_HK_UPDOWN in t) {
            hkUpDown = t[KEY_HK_UPDOWN] === true;
            setHkUpDownStored(hkUpDown);
          }
          const e = getMtfTfs().join(",") + "|" + getMtfCount();
          if (KEY_MTF_TFS in t && t[KEY_MTF_TFS]) {
            setMtfTfs(t[KEY_MTF_TFS]);
          }
          if (KEY_MTF_AUTOFILL in t && typeof t[KEY_MTF_AUTOFILL] == "boolean") {
            setMtfAutofill(t[KEY_MTF_AUTOFILL]);
          }
          if (KEY_MTF_SETTLE in t && t[KEY_MTF_SETTLE] != null) {
            setMtfSettle(t[KEY_MTF_SETTLE]);
          }
          if (KEY_MTF_FLIP in t && typeof t[KEY_MTF_FLIP] == "boolean") {
            setMtfFlip(t[KEY_MTF_FLIP]);
          }
          if (KEY_MTF_FLIP_BARS in t && t[KEY_MTF_FLIP_BARS] != null) {
            setMtfFlipBars(t[KEY_MTF_FLIP_BARS]);
          }
          if (getMtfTfs().join(",") + "|" + getMtfCount() !== e) {
            rebuildMtf();
          }
        },
      );
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Settlement monitor (feeds the loss streak) + chart trade-timer chips
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    function getDealKey(t) {
      if (void 0 !== t._tcUuid) {
        return t._tcUuid;
      }
      const e = t.querySelectorAll("[id]");
      for (let n = 0; n < e.length; n++) {
        if (UUID_RE.test(e[n].id)) {
          return (t._tcUuid = e[n].id);
        }
      }
      const n = t.querySelector(".esVdy"),
        o = n ? readDetailField(n, "open time") : "",
        r = (t.querySelector(".DBihS") || {}).textContent || "";
      return r && o ? (t._tcUuid = r.trim() + "|" + o) : "";
    }
    const TIMERS_ENABLED = true;
    function parseClock(t) {
      const e = t.split(":").map(Number);
      return e.length === 3 ? 3600 * e[0] + 60 * e[1] + e[2] : e.length === 2 ? 60 * e[0] + e[1] : 1000000000;
    }
    function findClockEl(t) {
      const e = /^\d{1,2}:\d{2}(:\d{2})?$/,
        n = t.querySelectorAll("*");
      for (let t = 0; t < n.length; t++) {
        if (n[t].children.length === 0 && e.test((n[t].textContent || "").trim())) {
          return n[t];
        }
      }
      return null;
    }
    const countdownAnchors = new WeakMap();
    // v1.75.0: whole seconds, the way Quotex's trade history shows them (hours only when there are some).
    function fmtClockText(t) {
      const n = Math.max(0, Math.round(t)),
        a = (v) => (v < 10 ? "0" + v : "" + v),
        h = Math.floor(n / 3600),
        m = Math.floor((n % 3600) / 60);
      return (h ? a(h) + ":" : "") + a(m) + ":" + a(n % 60);
    }
    let cursorPos = null,
      cursorInGraph = false,
      chipRaf = 0,
      liveTagRaf = 0;
    // Where the chip stack stands across the chart: its centre line, as a percentage of the chart's width.
    const CHIP_STACK_X = 88;
    function positionChip(t, e) {
      if (!t) {
        return;
      }
      const n = t.id === ids.tcProjChip;
      // v1.73.0: the chips stand at the chart's right side, where Quotex's candle countdown usually is -
      // the amount just above the middle, the trade countdown just below it. Their countdown itself cannot
      // be followed: it is painted on the chart canvas, at a height set by the price (read live, v1.72.6).
      // Percentages of the chart, so the spot scales with it. They used to follow the cursor.
      const x = CHIP_STACK_X,
        y = 50;
      if (t._tcPosX !== x) {
        t._tcPosX = x;
        t.style.left = x + "%";
      }
      if (t._tcPosY !== y) {
        t._tcPosY = y;
        t.style.top = y + "%";
      }
      t.style.transform = n ? "translate(-50%, calc(-100% - 4px))" : "translate(-50%, 4px)";
      t._tcPxX = t._tcPxY = null;
    }
    window.__tcLiveMouseMove = (t) => {
      window.__tcLiveMX = t.clientX;
      window.__tcLiveMY = t.clientY;
      const e = balanceEl && balanceEl._tcLiveTag;
      if (e && e.style.opacity !== "0") {
        if (!liveTagRaf) {
          liveTagRaf = requestAnimationFrame(() => {
            liveTagRaf = 0;
            const t = balanceEl && balanceEl._tcLiveTag;
            if (!t || t.style.opacity === "0") {
              return;
            }
            const e = Math.min(window.__tcLiveMX + 16, window.innerWidth - (t.offsetWidth || 96) - 8),
              n = Math.max(window.__tcLiveMY - (t.offsetHeight || 24) - 10, 4);
            t.style.left = e + "px";
            t.style.top = n + "px";
          });
        }
      }
    };
    document.addEventListener("mousemove", window.__tcLiveMouseMove, {
      passive: true,
    });
    window.__tcTimerMouseMove = (t) => {
      if (
        !(function () {
          const t = byId(ids.tcTradeTimer),
            e = byId(ids.tcProjChip),
            n = !t || t.style.display !== "block",
            o = !e || e.style.display !== "block";
          return n && o;
        })()
      ) {
        cursorPos = {
          x: t.clientX,
          y: t.clientY,
        };
        cursorInGraph = true;
        if (!chipRaf) {
          chipRaf = requestAnimationFrame(() => {
            chipRaf = 0;
            const t = getChartBox();
            positionChip(byId(ids.tcTradeTimer), t);
            positionChip(byId(ids.tcProjChip), t);
          });
        }
      }
    };
    window.__tcTimerMouseLeave = () => {
      cursorInGraph = false;
      const t = getChartBox();
      positionChip(byId(ids.tcTradeTimer), t);
      positionChip(byId(ids.tcProjChip), t);
    };
    const payoutCache = new Map(),
      payoutMissAt = new Map();
    function projectedPayout(n, o, r) {
      if (o && payoutCache.has(o)) {
        return payoutCache.get(o);
      }
      if (o && r - (payoutMissAt.get(o) || 0) < 1000) {
        return NaN;
      }
      const a = () => {
          if (o) {
            payoutMissAt.set(o, r);
          }
          return NaN;
        },
        i = n.querySelector(".Os2ep") || n.querySelector(".lCITV") || n.querySelector(".saoxT"),
        c = i ? parseMoney(i.textContent) : NaN;
      if (!isNaN(c) && c > 0) {
        if (o) {
          payoutCache.set(o, c);
          payoutMissAt.delete(o);
        }
        return c;
      }
      const s = queryFirstWithin(n, SELECTORS.livePayoutPct),
        l = s ? parseFloat(s.textContent) : NaN;
      if (isNaN(l) || l <= 0) {
        return a();
      }
      const d = readDetailField(queryFirstWithin(n, SELECTORS.liveDetail), "open time"),
        u = d ? new Date(d.replace(" ", "T")).getTime() : NaN,
        p = n.querySelector(".DBihS") || n.querySelector(".RxOUE") || n.querySelector(".JJ_i9"),
        m = normKey(p ? p.textContent : "");
      if (!m || isNaN(u)) {
        return a();
      }
      const h = (function (t, e, n, o, r) {
          if (!t || !t.length || !e || isNaN(n)) {
            return null;
          }
          let a = null,
            i = 1 / 0;
          for (let c = 0; c < t.length; c++) {
            const s = t[c];
            if (!s || s.amount == null || isNaN(s.amount)) {
              continue;
            }
            if (r(s.pair) !== e) {
              continue;
            }
            const l = Math.abs(s.ts - n);
            if (!(l > o || l >= i)) {
              i = l;
              a = s;
            }
          }
          return a;
        })(tradeLog, m, u, 90000, normKey),
        f = h
          ? (function (t, e, n) {
              return !isNaN(t) && t > 0
                ? t
                : isNaN(e) || e == null || isNaN(n) || n <= 0
                  ? NaN
                  : e * (1 + n / 100);
            })(c, h.amount, l)
          : NaN;
      if (isNaN(f)) {
        return a();
      } else {
        if (o) {
          payoutCache.set(o, f);
          payoutMissAt.delete(o);
        }
        return f;
      }
    }
    function renderTradeTimers() {
      if (!TIMERS_ENABLED) {
        return;
      }
      // v1.34.0: ask Quotex first. Reading the deal rows first meant stale markup outvoted the platform's
      // own answer — the store said nothing was open while the page still held four settled rows, and the
      // chips believed the page. The rows are now only used when the bridge cannot answer at all.
      const fromStore = storeOpenTrades();
      const t = fromStore ? [] : getOpenTradeRows();
      if (!t.length && fromStore && fromStore.length) {
        timersVia = "store";
      } else if (t.length) {
        timersVia = "page";
      }
      let e = byId(ids.tcTradeTimer);
      if (!t.length && !(fromStore && fromStore.length)) {
        if (e) {
          e.style.display = "none";
          e.style.animation = "";
        }
        const t = byId(ids.tcProjChip);
        if (t) {
          t.style.display = "none";
          t.style.animation = "";
        }
        stopTimerLoop();
        return;
      }
      const n = getChartBox(); // v1.79.0: survives a rename of "#graph"
      if (!n) {
        if (e) {
          e.style.display = "none";
          e.style.animation = "";
        }
        stopTimerLoop();
        return;
      }
      if (!e) {
        e = document.createElement("div");
        e.id = ids.tcTradeTimer;
        const t = byId("__tradeCalc"),
          o = 1.5 * ((t && parseFloat(t.style.fontSize)) || 16);
        e.style.cssText =
          "position:absolute; transform:translate(-50%, -50%); z-index:30; pointer-events:none; font-family:inherit; display:none; font-size:" +
          o +
          "px;";
        applyTokenVars(e); // outside the shadow root, so it needs the --tc-* tokens inline
        if (getComputedStyle(n).position === "static") {
          n.style.position = "relative";
          n._tcWasStatic = true;
        }
        n.appendChild(e);
        n.addEventListener("mousemove", window.__tcTimerMouseMove, {
          passive: true,
        });
        n.addEventListener("mouseleave", window.__tcTimerMouseLeave, {
          passive: true,
        });
        window.__tcTimerGraph = n;
      }
      positionChip(e, n);
      let o = null;
      const r = [],
        a = Date.now();
      if (fromStore) {
        for (const trade of fromStore) {
          r.push({
            pair: trade.pair,
            time: fmtClockText(isNaN(trade.secondsLeft) ? 0 : trade.secondsLeft),
            secs: isNaN(trade.secondsLeft) ? 0 : trade.secondsLeft,
            win: trade.winning === true,
          });
        }
      }
      for (let e = 0; e < t.length; e++) {
        const n = t[e],
          i =
            n.querySelector(".PiYD4") ||
            n.querySelector(".xEiET") ||
            n.querySelector(".wcb43") ||
            findClockEl(n);
        if (!i) {
          continue;
        }
        const c = i.textContent.trim(),
          s = n.querySelector(".DBihS") || n.querySelector(".RxOUE") || n.querySelector(".JJ_i9"),
          l = s ? s.textContent.trim() : "",
          d = n.querySelector(".Os2ep") || n.querySelector(".lCITV") || n.querySelector(".saoxT"),
          u = d ? parseMoney(d.textContent) : NaN;
        if (isNaN(u) && o === null) {
          o = {};
          const t = getPairTabs();
          for (let e = 0; e < t.length; e++) {
            const n = t[e].querySelector(".Pdqth");
            if (!n) {
              continue;
            }
            const r = parseMoney(n.textContent);
            if (!isNaN(r)) {
              o[getTabName(t[e])] = r;
            }
          }
        }
        const p = isNaN(u) ? ((o && o[l]) || 0) > 0 : u > 0,
          m = parseClock(c);
        let h = countdownAnchors.get(n);
        if (!(h && h.lastSecs === m)) {
          h = {
            lastSecs: m,
            at: a,
          };
          countdownAnchors.set(n, h);
        }
        const f = a - h.at,
          g = Math.max(0, m - Math.floor(f / 1000)),
          _ = g === 0 ? 0 : (1000 - (f % 1000)) % 1000;
        r.push({
          pair: l,
          time: fmtClockText(g),
          secs: m,
          win: p,
        });
      }
      if (!r.length) {
        e.style.display = "none";
        e.style.animation = "";
        const t = byId(ids.tcProjChip);
        if (t) {
          t.style.display = "none";
          t.style.animation = "";
        }
        stopTimerLoop();
        return;
      }
      r.sort((t, e) => t.secs - e.secs);
      const i = r
        .map(
          (t) =>
            `<div class="tcTimerRow" style="display:flex; align-items:center; gap:0.55em; background:var(--tc-bg); border:1px solid var(--tc-sec-border); border-radius:16px; padding:0.34em 0.9em; margin-bottom:0.3em; box-shadow:0 4px 16px -3px oklch(0% 0 0 / 0.55); font-size:0.81em;"><span style="font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:0.01em; color:${t.win ? "var(--tc-grn)" : "var(--tc-text-pri)"};">⏱ ${t.time}</span><span style="color:var(--tc-text-dim); font-size:0.85em; font-weight:600;">${t.pair}</span></div>`,
        )
        .join("");
      if (e._tcHtml !== i) {
        e._tcHtml = i;
        e.innerHTML = i;
      }
      if (e.style.display !== "block") {
        e.style.animation = "__tcTimerIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
        e.style.display = "block";
      }
      let s = byId(ids.tcProjChip);
      if (!s) {
        s = document.createElement("div");
        s.id = ids.tcProjChip;
        const t = byId("__tradeCalc"),
          e = 1.5 * ((t && parseFloat(t.style.fontSize)) || 16);
        s.style.cssText =
          "position:absolute; transform:translate(-50%, -50%); z-index:30; pointer-events:none; font-family:inherit; display:none; font-size:" +
          e +
          "px;";
        applyTokenVars(s); // outside the shadow root, so it needs the --tc-* tokens inline
        n.appendChild(s);
      }
      positionChip(s, n);
      const l = readAccountBalance(),
        d = sumOpenPnl(),
        u = (isNaN(l) ? 0 : l) + (isNaN(d) ? 0 : d),
        p = d > 0 ? "↗" : d < 0 ? "↘" : "→",
        h = d > 0 ? "var(--tc-grn)" : d < 0 ? "var(--tc-red)" : "var(--tc-text-pri)",
        f = (function (t) {
          // The store path has the numbers already; the row-reading version below is for when it cannot answer.
          if (fromStore) {
            let sum = 0,
              missing = false;
            for (const trade of fromStore) {
              if (isNaN(trade.winReturn)) {
                missing = true;
              } else {
                sum += trade.winReturn;
              }
            }
            return fromStore.length ? { total: sum, partial: missing } : NaN;
          }
          if (!t || !t.length) {
            return NaN;
          }
          const e = Date.now();
          let n = 0,
            o = false;
          const r = new Set();
          for (let a = 0; a < t.length; a++) {
            const i = getDealKey(t[a]);
            if (i) {
              r.add(i);
            }
            const c = projectedPayout(t[a], i, e);
            if (isNaN(c)) {
              o = true;
            } else {
              n += c;
            }
          }
          if (payoutCache.size > r.size) {
            payoutCache.forEach((t, e) => {
              if (!r.has(e)) {
                payoutCache.delete(e);
              }
            });
          }
          if (payoutMissAt.size > r.size) {
            payoutMissAt.forEach((t, e) => {
              if (!r.has(e)) {
                payoutMissAt.delete(e);
              }
            });
          }
          // v1.34.0: one unreadable trade used to blank the whole total — with several trades open that is
          // exactly when you want it. Show the trades that could be added up, marked "≈".
          return n > 0 || !o ? { total: n, partial: o } : NaN;
        })(t),
        F = f && typeof f == "object" ? f : { total: NaN, partial: false },
        g = (isNaN(l) ? 0 : l) + F.total,
        _ = `<div style="margin-top:0.16em; font-weight:700; font-size:0.76em; font-variant-numeric:tabular-nums; color:var(--tc-grn); opacity:0.92;">⤒ win ${isNaN(g) ? "—" : (F.partial ? "≈ " : "") + detectCurrency() + fmtMoney(g)}</div>`,
        y = `<div style="background:var(--tc-bg); border:1px solid var(--tc-sec-border); border-radius:16px; padding:0.34em 0.9em; box-shadow:0 4px 16px -3px oklch(0% 0 0 / 0.55); font-weight:800; font-variant-numeric:tabular-nums; color:${h}; font-size:0.92em;">${p} ${detectCurrency()}${fmtMoney(u)}${_}</div>`;
      if (s._tcHtml !== y) {
        s._tcHtml = y;
        s.innerHTML = y;
      }
      if (s.style.display !== "block") {
        s.style.animation = "__tcTimerIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
        s.style.display = "block";
      }
      (function () {
        if (timerRaf) {
          return;
        }
        const t = () => {
          timerRaf = 0;
          renderTradeTimers();
        };
        // v1.23.0: ~20 fps instead of every animation frame (60+ fps). Each frame re-queries the open
        // trade rows and rebuilds the chip HTML; 50 ms still moves the centisecond countdown smoothly.
        timerRaf = setTimeout(t, TIMER_FRAME_MS);
      })();
    }
    const TIMER_FRAME_MS = 50;
    let timerRaf = 0;
    function stopTimerLoop() {
      if (timerRaf) {
        clearTimeout(timerRaf);
        timerRaf = 0;
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Investment step: → doubles the amount, ← halves it
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.69.0: the step is 2, always. The floating x/÷ box and its 2 / 1.5 / 1.3 cycle are gone, and so is
    // the stored "1" that made the arrows press Quotex's own -/+ buttons instead.
    const STEP_FACTOR = 2;
    // True when the amount field was found, so the caller knows the key was used.
    function multiplyStake(t) {
      if (!(stakeInputEl && stakeInputEl.isConnected)) {
        stakeInputEl = findEl("amountInput", { cache: false });
      }
      const e = stakeInputEl;
      if (!e) {
        return false;
      }
      const n = e.value.includes("%");
      let o = parseMoney(e.value);
      if (isNaN(o) || o <= 0) {
        o = 1;
      }
      let r = o * t;
      r = n ? Math.round(r) : Math.round(100 * r) / 100;
      if (r < 1) {
        r = 1;
      }
      if (n && r > 100) {
        r = 100;
      }
      typeInto(e, String(r));
      return true;
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Multi-timeframe (MTF) mini charts: candle resampling and windowing
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.30.0: folds candles up to a bigger timeframe (1m bars -> 5m bars). Lifted out of
    // resolveMtfRows unchanged, because the rolling 1m base (rollMtfBase) needs the same fold.
    // Each bucket carries `n` (how many source bars went in) and `partial` (fewer than a full bucket).
    function aggregateCandles(src, srcSec, dstSec) {
      if (!Array.isArray(src) || !src.length) {
        return [];
      }
      if (!(srcSec > 0) || !(dstSec > 0) || dstSec < srcSec) {
        return [];
      }
      if (dstSec % srcSec !== 0) {
        return [];
      }
      const per = dstSec / srcSec,
        out = [];
      let cur = null;
      for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (!(c && c.t >= 0)) {
          continue;
        }
        const bucket = Math.floor(c.t / dstSec) * dstSec;
        // v1.37.0: `part` travels with the data. A 1m bar folded from two of the four 15s bars in that
        // minute is incomplete, and so is any 5m or 15m bar built on top of it — before this, folding a
        // second time reset the count and the hole vanished from view.
        const short = !!(c.partial || c.part);
        if (cur && cur.t === bucket) {
          if (c.h > cur.h) {
            cur.h = c.h;
          }
          if (c.l < cur.l) {
            cur.l = c.l;
          }
          cur.c = c.c;
          cur.n++;
          if (short) {
            cur.short = true;
          }
        } else {
          if (cur) {
            out.push(cur);
          }
          cur = { t: bucket, o: c.o, h: c.h, l: c.l, c: c.c, n: 1, short };
        }
      }
      if (cur) {
        out.push(cur);
      }
      for (let i = 0; i < out.length; i++) {
        out[i].partial = out[i].n < per || !!out[i].short;
      }
      return out;
    }
    // The first bucket is usually cut off mid-way by where the source data starts; drop it.
    function dropLeadingPartial(rows) {
      if (!Array.isArray(rows)) {
        return [];
      }
      return rows.length < 2 ? rows.slice() : rows[0].partial ? rows.slice(1) : rows.slice();
    }
    // Picks what a cell draws: the platform's own bars for this timeframe, bars folded up from a finer
    // one, or — since v1.30.1 — the native history with a live tail folded onto the end.
    //
    // A native pull is a SNAPSHOT: it stops the moment you leave that timeframe. Before v1.30.1 a stale
    // native entry still won, and the coarsest source was preferred over the freshest, so a 15m cell sat
    // reading "4m ago" with a 1m history updating three times a second right beside it.
    function resolveMtfRows(entries, symbol, sec, nowSec, staleSec) {
      if (!(entries && symbol && sec > 0)) {
        return null;
      }
      const window = staleSec > 0 ? staleSec : 3;
      const natEntry = entries[symbol + "@" + sec];
      const nat =
        natEntry && natEntry.candles && natEntry.candles.length
          ? {
              entry: natEntry,
              srcSec: sec,
              // A 1m entry folded up from 15s bars sits under the same key as a real 1m pull, but it is
              // still derived data — say so, so the cell shows "≈".
              native: !natEntry.derived,
            }
          : null;
      let der = null;
      for (const key in entries) {
        const at = key.lastIndexOf("@");
        if (at < 0 || key.slice(0, at) !== symbol) {
          continue;
        }
        const srcSec = parseInt(key.slice(at + 1), 10);
        if (!(srcSec > 0) || srcSec >= sec || sec % srcSec !== 0) {
          continue;
        }
        const e = entries[key];
        if (!(e && e.candles && e.candles.length)) {
          continue;
        }
        if (!der) {
          der = { entry: e, srcSec, native: false };
          continue;
        }
        // Freshest source wins; a coarser one only wins between sources of the same age (less folding,
        // and fewer buckets built from part of a minute).
        const gap = (e.capturedAt || 0) - (der.entry.capturedAt || 0);
        if (gap > window || (Math.abs(gap) <= window && srcSec > der.srcSec)) {
          der = { entry: e, srcSec, native: false };
        }
      }
      const derRows = der ? dropLeadingPartial(aggregateCandles(der.entry.candles, der.srcSec, sec)) : [];
      const derAt = der ? der.entry.capturedAt || 0 : 0;
      if (!nat) {
        return derRows.length
          ? { rows: derRows, srcSec: der.srcSec, native: false, capturedAt: derAt }
          : null;
      }
      const natRows = nat.entry.candles.slice();
      const natAt = nat.entry.capturedAt || 0;
      if (derRows.length && derAt > natAt && natRows.length) {
        // The native entry's last bar was still forming when the snapshot was taken, so it is re-drawn
        // from the live source along with everything after it. Only when the live source reaches back
        // that far — otherwise the cell would show a hole as if it were continuous.
        const cut = natRows[natRows.length - 1].t;
        if (derRows[0].t <= cut) {
          const rows = natRows.filter((c) => c.t < cut).concat(derRows.filter((c) => c.t >= cut));
          if (rows.length) {
            return { rows, srcSec: nat.srcSec, native: nat.native, capturedAt: derAt };
          }
        }
        if (!nat.native) {
          return { rows: derRows, srcSec: der.srcSec, native: false, capturedAt: derAt };
        }
      }
      return natRows.length
        ? { rows: natRows, srcSec: nat.srcSec, native: nat.native, capturedAt: natAt }
        : null;
    }
    const defaultFutureSlots = (t) => Math.max(2, Math.round(0.28 * t)),
      maxFutureSlots = (t) => Math.max(4, t);
    function sliceMtfWindow(t, e, n, o, r) {
      if (!Array.isArray(t) || !t.length) {
        return {
          candles: [],
          endIdx: -1,
          future: 0,
          atLive: true,
        };
      }
      const a = t.length - 1,
        i = !n;
      let c = a;
      if (!i) {
        let e = a;
        for (; e > 0 && t[e].t > n; ) {
          e--;
        }
        c = e;
      }
      const s = e > 0 ? e : t.length,
        l = Math.max(0, c - s + 1);
      return {
        candles: t.slice(l, c + 1),
        endIdx: c,
        future: i ? r : Math.max(0, 0 | o),
        atLive: i && c >= a,
      };
    }
    function mergeCandles(t, e, n) {
      if (!Array.isArray(t) || !t.length) {
        return Array.isArray(e) ? e.slice() : [];
      }
      if (!Array.isArray(e) || !e.length) {
        return t.slice();
      }
      const o = new Map();
      for (let e = 0; e < t.length; e++) {
        o.set(t[e].t, t[e]);
      }
      for (let t = 0; t < e.length; t++) {
        o.set(e[t].t, e[t]);
      }
      const r = Array.from(o.values()).sort((t, e) => t.t - e.t),
        a = n > 0 ? n : 0;
      return a && r.length > a ? r.slice(r.length - a) : r;
    }
    function pctChange(t) {
      if (!Array.isArray(t) || !t.length) {
        return NaN;
      }
      const e = t[0].o,
        n = t[t.length - 1].c;
      return e > 0 ? ((n - e) / e) * 100 : NaN;
    }
    function isStale(t, e, n) {
      return !t || e - t > (n > 0 ? n : 10);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // MTF: chart data via the MAIN-world bridge (chart_reader.js), drawing, widget
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const CHART_REQ_EVENT = "__tcChartReq",
      CHART_RES_EVENT = "__tcChartRes";
    let chartReqSeq = 0;
    const MTF_MAX_CANDLES = 1500,
      MTF_STALE_SEC = 3;
    const MTF_MAX_SYMBOLS = 6;
    // Roughly a third of a megabyte: room for several pairs at full depth, and far from the origin's limit.
    const MTF_CACHE_MAX_CHARS = 300 * 1024;
    // Candles per pair (v1.26.0). Switching pairs used to wipe every timeframe, so each pair needed a
    // fresh sync; now the last few pairs are kept and restored when you come back.
    let mtfArchive = {};
    let mtfChartSec = 0;
    let mtfEntries = {},
      mtfSymbol = null,
      mtfColors = {
        up: null,
        down: null,
      },
      mtfLastPull = 0,
      mtfLastSave = 0,
      mtfSymbolSince = 0,
      mtfDirty = false;
    // v1.30.0: rolling 1-minute base per pair. Quotex only sends candles for the timeframe the chart is
    // actually on, so the 5m and 15m cells stayed empty until you visited them — and went stale again
    // the moment you left. Whenever the chart sits on a period that divides a minute (5s/10s/15s/30s),
    // those bars are folded into a 1m entry for the pair, and every higher timeframe derives from that.
    // The panel now fills itself while you trade normally, instead of only when you press ↻.
    const MTF_BASE_SEC = 60,
      MTF_BASE_EVERY_MS = 1500,
      // Four hours of minutes is more than any cell can show; folding the whole 1500-bar buffer on every
      // 300 ms pull would be work for nothing, and older buckets are already merged in.
      MTF_BASE_WINDOW = 240;
    let mtfBaseRolledAt = 0;
    function rollMtfBase(symbol, srcSec) {
      if (!symbol || !(srcSec > 0) || srcSec >= MTF_BASE_SEC || MTF_BASE_SEC % srcSec !== 0) {
        return;
      }
      const now = Date.now();
      if (now - mtfBaseRolledAt < MTF_BASE_EVERY_MS) {
        return;
      }
      mtfBaseRolledAt = now;
      const src = mtfEntries[symbol + "@" + srcSec];
      if (!(src && src.candles && src.candles.length)) {
        return;
      }
      const tail = src.candles.slice(-(MTF_BASE_WINDOW * (MTF_BASE_SEC / srcSec)));
      const rolled = dropLeadingPartial(aggregateCandles(tail, srcSec, MTF_BASE_SEC)).map((c) => {
        const bar = { t: c.t, o: c.o, h: c.h, l: c.l, c: c.c };
        // Only when true, so the cache does not grow a field per bar for nothing.
        if (c.partial) {
          bar.part = true;
        }
        return bar;
      });
      if (!rolled.length) {
        return;
      }
      const key = symbol + "@" + MTF_BASE_SEC,
        prev = mtfEntries[key];
      mtfEntries[key] = {
        // The last bucket is still forming; mergeCandles keys on the timestamp, so each pull replaces
        // it rather than appending a duplicate.
        candles: prev ? mergeCandles(prev.candles, rolled, MTF_MAX_CANDLES) : rolled,
        capturedAt: Math.floor(Date.now() / 1000),
        periodSeconds: MTF_BASE_SEC,
        // A real 1m pull wins for good: once the entry holds native bars it is never demoted.
        derived: prev ? prev.derived !== false : true,
      };
      mtfDirty = true;
    }
    // Newest pairs first; keep MTF_MAX_SYMBOLS of them.
    function trimMtfArchive() {
      const symbols = Object.keys(mtfArchive);
      if (symbols.length <= MTF_MAX_SYMBOLS) {
        return;
      }
      const newest = (entries) =>
        Object.values(entries || {}).reduce((max, e) => Math.max(max, (e && e.capturedAt) || 0), 0);
      symbols
        .sort((a, b) => newest(mtfArchive[b]) - newest(mtfArchive[a]))
        .slice(MTF_MAX_SYMBOLS)
        .forEach((sym) => delete mtfArchive[sym]);
    }
    // Only what the charts can show is stored, so the cache stays small (v1.26.0).
    function trimEntriesForStorage(entries) {
      const count = Math.max(getMtfCount(), widestZoom());
      // v1.30.0: a 1m entry has to hold COUNT x 15 bars for a 15m cell to have anything to fold. Keeping
      // a flat 200 everywhere is what made a restored cache draw three 15m bars and then say "visit once".
      const widest = getMtfTfs().reduce((max, tf) => Math.max(max, tfSeconds(tf) || 0), MTF_BASE_SEC);
      const out = {};
      for (const key in entries) {
        const e = entries[key];
        if (!(e && e.candles && e.candles.length)) {
          continue;
        }
        const sec = e.periodSeconds || parseInt(key.slice(key.lastIndexOf("@") + 1), 10) || 0;
        // Anything finer than the 1m base only has to fill its own cell — the base carries the history
        // for everything above it, so there is no reason to keep hours of 15s bars as well.
        const ratio = sec > 0 && sec >= MTF_BASE_SEC ? Math.max(1, Math.round(widest / sec)) : 4;
        const keep = Math.min(1000, Math.max(200, count * ratio + 10));
        out[key] = { ...e, candles: e.candles.slice(-keep) };
      }
      return out;
    }
    function saveMtfCache(t) {
      if (!mtfDirty || !mtfSymbol) {
        return;
      }
      const e = Date.now();
      if (!(!t && e - mtfLastSave < 30000)) {
        mtfLastSave = e;
        mtfDirty = false;
        const symbols = { [mtfSymbol]: trimEntriesForStorage(mtfEntries) };
        for (const sym in mtfArchive) {
          symbols[sym] = trimEntriesForStorage(mtfArchive[sym]);
        }
        // v1.53.0: a ceiling on what this is allowed to occupy. Deeper history per timeframe (v1.52.0)
        // and a wider zoom both widen what is kept, and the cache had reached 552 KB for five pairs -
        // shared with the platform's own storage in a budget of about five megabytes. Writes here are
        // wrapped, so passing quota would not throw: SETTINGS would quietly stop saving instead, which
        // is a bad way to find out. The newest pairs are kept whole, then older ones go, then history is
        // thinned - the current pair is never dropped.
        const newestOf = (entries) =>
          Object.values(entries || {}).reduce((max, e) => Math.max(max, (e && e.capturedAt) || 0), 0);
        let text = JSON.stringify({ v: 2, symbols });
        if (text.length > MTF_CACHE_MAX_CHARS) {
          const oldestFirst = Object.keys(symbols)
            .filter((sym) => sym !== mtfSymbol)
            .sort((a, b) => newestOf(symbols[a]) - newestOf(symbols[b]));
          while (text.length > MTF_CACHE_MAX_CHARS && oldestFirst.length) {
            delete symbols[oldestFirst.shift()];
            text = JSON.stringify({ v: 2, symbols });
          }
          for (let pass = 0; pass < 6 && text.length > MTF_CACHE_MAX_CHARS; pass++) {
            for (const sym in symbols) {
              for (const key in symbols[sym]) {
                const entry = symbols[sym][key];
                if (entry && entry.candles && entry.candles.length > 60) {
                  entry.candles = entry.candles.slice(-Math.max(60, Math.floor(entry.candles.length / 2)));
                }
              }
            }
            text = JSON.stringify({ v: 2, symbols });
          }
        }
        writeJson(KEY_MTF_CACHE, { v: 2, symbols });
      }
    }
    function pullChartSnapshot() {
      !(function (t) {
        // v1.23.0: candles always come through the chart_reader.js bridge. A direct fiber read was tried
        // first, but React's expando properties are invisible from this isolated world, so it never worked (B5).
        const n = ++chartReqSeq;
        let o = false;
        const r = (e) => {
          if (!o && e && e.detail && e.detail.id === n) {
            o = true;
            document.removeEventListener(CHART_RES_EVENT, r);
            t(e.detail.data || null);
          }
        };
        document.addEventListener(CHART_RES_EVENT, r);
        try {
          document.dispatchEvent(
            new CustomEvent(CHART_REQ_EVENT, {
              detail: {
                id: n,
                limit: 0,
              },
            }),
          );
        } catch (t) {}
        if (!o) {
          setTimeout(() => {
            if (!o) {
              o = true;
              document.removeEventListener(CHART_RES_EVENT, r);
              t(null);
            }
          }, 400);
        }
      })((t) => {
        if (!(t && t.symbol && t.periodSeconds && t.candles && t.candles.length)) {
          return;
        }
        mtfChartSec = t.periodSeconds;
        if (t.symbol !== mtfSymbol) {
          if (mtfSymbol && Object.keys(mtfEntries).length) {
            mtfArchive[mtfSymbol] = mtfEntries;
          }
          mtfEntries = mtfArchive[t.symbol] || {};
          delete mtfArchive[t.symbol];
          trimMtfArchive();
          mtfSymbol = t.symbol;
          mtfSymbolSince = Date.now();
          // Opening a pair queues its fill (v1.35.0). v1.88.0: not while a refill has the chart away from the
          // pair it was on - that is the panel's doing, there and back, and would have set the timeframes of
          // the pair you are on walking a few seconds after every refill.
          if (Date.now() >= refillAwayUntil) {
            mtfFillPendingFor = t.symbol;
          }
          mtfDirty = true;
          saveMtfCache(true); // persist immediately; the throttle could otherwise drop the old pair
          const e = byId("__tcMTF");
          if (e) {
            e.querySelectorAll(".tcMtfCell").forEach((t) => {
              t._tcPanEndT = null;
              t._tcFuture = 0;
              t._tcSig = "";
            });
          }
        }
        if (t.upColor) {
          mtfColors.up = t.upColor;
        }
        if (t.downColor) {
          mtfColors.down = t.downColor;
        }
        const e = t.symbol + "@" + t.periodSeconds,
          n = mtfEntries[e];
        mtfEntries[e] = {
          candles: n ? mergeCandles(n.candles, t.candles, MTF_MAX_CANDLES) : t.candles,
          capturedAt: Math.floor(Date.now() / 1000),
          periodSeconds: t.periodSeconds,
          derived: false,
        };
        rollMtfBase(t.symbol, t.periodSeconds);
        mtfDirty = true;
        saveMtfCache(false);
      });
    }
    // Support and resistance, exactly as fixed in Qx_Claude_Strategy (h013, frozen 2026-09-18):
    //   * swing high = a candle whose high is above the 3 before it and at or above the 3 after it;
    //     swing low is the mirror. Strength 3 each side.
    //   * COMPLETED candles only - the bar still forming cannot set a level.
    //   * a level counts only once its third confirming candle has closed.
    //   * keep the last 3 highs and the last 3 lows; broken levels stay, and a level counts from
    //     either side.
    // Copied rather than imported: that project is a research harness with its own release cycle, and
    // this panel must not depend on a file outside its own repository.
    const SR_STRENGTH = 3,
      SR_KEEP = 3;
    function srLevels(rows, periodSec) {
      const highs = [],
        lows = [];
      if (!Array.isArray(rows) || rows.length < 2 * SR_STRENGTH + 2) {
        return { highs, lows };
      }
      const done = rows.slice(0, -1); // the newest bar is still running
      // v1.47.1: every swing in the history, newest first. Stopping at the newest three a side is what
      // the strategy rule does, and for a signal that is right - but for a CHART it means a market making
      // new lows shows six levels, all of them overhead, and nothing under the price. Which three to draw
      // is decided below, from this full list.
      for (let i = done.length - 1 - SR_STRENGTH; i >= SR_STRENGTH && (highs.length < 60 || lows.length < 60); i--) {
        const c = done[i];
        let isHigh = true,
          isLow = true;
        for (let k = 1; k <= SR_STRENGTH; k++) {
          if (!(c.h > done[i - k].h && c.h >= done[i + k].h)) {
            isHigh = false;
          }
          if (!(c.l < done[i - k].l && c.l <= done[i + k].l)) {
            isLow = false;
          }
        }
        const conf = done[i + SR_STRENGTH].t + (periodSec > 0 ? periodSec : 0);
        if (isHigh && highs.length < 60) {
          highs.push({ price: c.h, at: c.t, conf });
        }
        if (isLow && lows.length < 60) {
          lows.push({ price: c.l, at: c.t, conf });
        }
      }
      return { highs, lows };
    }
    // What a chart shows: the SR_KEEP nearest levels above the price and the SR_KEEP nearest below it,
    // whichever kind of swing produced each one - a broken swing low overhead is resistance, and a broken
    // swing high underfoot is support. A side with nothing on it simply shows nothing.
    // v1.49.0: how far apart two prices have to be to be different levels. Taken from the chart's own
    // candles - half a typical bar's range - so it scales with the instrument and with how much it is
    // moving, rather than from a percentage that would be wrong for something quiet or something wild.
    function srTolerance(rows) {
      if (!Array.isArray(rows) || !rows.length) {
        return 0;
      }
      const spans = [];
      for (let i = Math.max(0, rows.length - 60); i < rows.length; i++) {
        const r = rows[i];
        if (r && isFinite(r.h) && isFinite(r.l) && r.h >= r.l) {
          spans.push(r.h - r.l);
        }
      }
      if (!spans.length) {
        return 0;
      }
      spans.sort((a, b) => a - b);
      const median = spans[Math.floor(spans.length / 2)];
      return median > 0 ? median * 0.5 : 0;
    }
    // Swings within a tolerance of each other describe ONE level, not several. Drawn as three lines they
    // crowd out anything genuinely elsewhere and print their labels on top of each other - seen live with
    // 289.175 / 289.096 / 289.058, which is one zone by any reading. The survivor is the newest, since
    // that is the touch a chart is about.
    function srMerge(levels, tol) {
      if (!(tol > 0)) {
        return levels.slice();
      }
      const sorted = levels.slice().sort((a, b) => a.price - b.price);
      const out = [];
      for (const level of sorted) {
        const last = out[out.length - 1];
        if (last && Math.abs(level.price - last.price) <= tol) {
          if ((level.at || 0) > (last.at || 0)) {
            out[out.length - 1] = level;
          }
          continue;
        }
        out.push(level);
      }
      return out;
    }
    function srNearest(levels, price, tol) {
      const all = srMerge(levels.highs.concat(levels.lows), tol);
      if (!isFinite(price)) {
        return all.slice(0, 2 * SR_KEEP);
      }
      const byDistance = (a, b) => Math.abs(a.price - price) - Math.abs(b.price - price);
      const above = all.filter((l) => l.price >= price).sort(byDistance).slice(0, SR_KEEP);
      const below = all.filter((l) => l.price < price).sort(byDistance).slice(0, SR_KEEP);
      return above.concat(below);
    }
    function priceDecimals(candles) {
      // The string form of a JS number carries exactly the digits it needs: 0.57192 -> 5, 190.8 -> 1.
      // Taking the MOST decimals seen was wrong on live data: Quotex's own feed occasionally carries a
      // value like 1.6146266 for a pair it quotes to five places, and one such close dragged the whole
      // label out to six. A length has to turn up in a fifth of the sample before it is believed (v1.38.1).
      const counts = new Map();
      let seen = 0;
      for (let i = Math.max(0, candles.length - 20); i < candles.length; i++) {
        const c = candles[i];
        if (!c || !isFinite(c.c)) {
          continue;
        }
        // v1.40.0: strip float noise before counting. 100.57 + 0.01 lands on 100.57000000000001 in
        // binary floating point, and counting THAT gives six decimals for a two-decimal instrument.
        // Twelve significant digits is far more than any quote carries and well inside double precision.
        const clean = String(Number(c.c.toPrecision(12)));
        const dot = clean.indexOf(".");
        const digits = dot < 0 ? 0 : clean.length - dot - 1;
        counts.set(digits, (counts.get(digits) || 0) + 1);
        seen++;
      }
      if (!seen) {
        return 2;
      }
      const enough = Math.max(2, Math.ceil(0.2 * seen));
      let best = 0;
      counts.forEach((n, digits) => {
        if (n >= enough && digits > best) {
          best = digits;
        }
      });
      if (!best) {
        // Nothing repeats often enough (a very short or very noisy series): fall back to the commonest.
        let top = 0;
        counts.forEach((n, digits) => {
          if (n > top || (n === top && digits > best)) {
            top = n;
            best = digits;
          }
        });
      }
      return Math.min(6, Math.max(2, best));
    }
    function drawCandles(t, e, n, o, r, hoverIdx, barLeft, srLines) {
      const a = t.clientWidth,
        i = t.clientHeight;
      if (!(a && i && e && e.length)) {
        try {
          const e = t.getContext("2d");
          e.setTransform(1, 0, 0, 1, 0, 0);
          e.clearRect(0, 0, t.width, t.height);
        } catch (t) {}
        return;
      }
      const c = Math.min(2, window.devicePixelRatio || 1),
        s = Math.round(a * c),
        l = Math.round(i * c);
      if (!(t.width === s && t.height === l)) {
        t.width = s;
        t.height = l;
      }
      const d = t.getContext("2d");
      d.setTransform(c, 0, 0, c, 0, 0);
      d.clearRect(0, 0, a, i);
      let u = 1 / 0,
        p = -1 / 0;
      for (let t = 0; t < e.length; t++) {
        const n = e[t];
        if (n.l < u) {
          u = n.l;
        }
        if (n.h > p) {
          p = n.h;
        }
      }
      if (!isFinite(u) || !isFinite(p)) {
        return;
      }
      if (!(p > u)) {
        p = u + 1e-5 * (Math.abs(u) || 1);
      }
      const m = 0.08 * (p - u);
      u -= m;
      p += m;
      const h = Math.max(1, a - 12),
        f = Math.max(1, i - 12),
        labelSize = Math.max(8, Math.min(11, Math.round(0.13 * i))),
        LABEL_GAP = 6;
      let future = Math.max(0, 0 | r);
      // v1.42.1: the price label sits against the right edge and the countdown goes between it and the
      // candles, both on the last-price line. On a 260 px cell the space the chart already leaves for the
      // future is not enough for both, so widen it here - a few percent narrower candles beats a pill
      // sitting on top of them.
      if (barLeft != null && e.length && typeof d.measureText == "function") {
        try {
          d.font = "700 " + labelSize + "px " + "'DM Sans', system-ui, sans-serif";
          const needed =
            d.measureText(e[e.length - 1].c.toFixed(priceDecimals(e))).width +
            8 +
            d.measureText(fmtBarClock(barLeft, true)).width +
            10 +
            3 * LABEL_GAP;
          const slot = h / (e.length + future);
          if (needed > slot * future) {
            future += Math.ceil((needed - slot * future) / slot);
          }
        } catch (t) {}
      }
      const g = h / (e.length + future);
      t._tcSlot = g;
      const _ = Math.max(1, g - Math.max(1, 0.22 * g)),
        y = (t) => 6 + (t + 0.5) * g,
        v = (t) => 6 + f - ((t - u) / (p - u)) * f;
      d.lineWidth = 1;
      for (let t = 0; t < e.length; t++) {
        const r = e[t],
          a = r.c >= r.o ? n : o;
        d.strokeStyle = a;
        d.fillStyle = a;
        d.globalAlpha = r.partial && t !== e.length - 1 ? 0.5 : 1;
        const i = Math.round(y(t)) + 0.5;
        d.beginPath();
        d.moveTo(i, v(r.h));
        d.lineTo(i, v(r.l));
        d.stroke();
        const c = v(r.o),
          s = v(r.c);
        d.fillRect(y(t) - _ / 2, Math.min(c, s), _, Math.max(1, Math.abs(s - c)));
      }
      d.globalAlpha = 1;
      // ── Support and resistance (v1.45.0) ──────────────────────────────────────────────────────────
      // Drawn under everything else: a level is context, not the thing you are reading.
      if (srLines && srLines.length) {
        try {
          // v1.46.1: a level's SIDE is where price stands now, not how the level formed. The rule this
          // comes from says broken levels stay and count from either side - a swing low price has fallen
          // through is resistance from underneath, and the research's own example is a broken high that
          // later held as support. Labelling by origin put "S" above price, which reads as a mistake.
          const ref = e[e.length - 1] && isFinite(e[e.length - 1].c) ? e[e.length - 1].c : NaN;
          // v1.49.0: where labels have already been printed, so a second one never lands on the first.
          // v1.51.0: seeded with the last-price row, because the price pill and the bar countdown both
          // sit on it - seen live with 03:47 printed straight through a level's label.
          const usedRows = [];
          if (isFinite(ref)) {
            usedRows.push(Math.round(v(ref)) - 2);
          }
          for (const line of srLines) {
            if (!isFinite(line.price)) {
              continue;
            }
            // A level is taken from the candles on screen, so its price is always inside their range;
            // this guard only catches a level left over from a window that has since moved (v1.49.0).
            if (line.price > p || line.price < u) {
              continue;
            }
            const role = !isFinite(ref) ? line.kind : line.price >= ref ? "R" : "S";
            const ly = Math.round(v(line.price)) + 0.5;
            d.globalAlpha = 0.75;
            d.strokeStyle = line.colour;
            if (typeof d.setLineDash == "function") {
              d.setLineDash(role === "R" ? [] : [4, 3]);
            }
            // v1.48.0: a level runs from the candle that made it to the newest one, growing as candles
            // arrive. Drawing it across the whole chart put it over candles from before it existed, and
            // the rule it comes from is explicit that a level only counts once its swing has formed.
            let x0 = 6;
            if (isFinite(line.at)) {
              for (let bi = 0; bi < e.length; bi++) {
                if (e[bi].t >= line.at) {
                  x0 = bi === 0 ? 6 : y(bi);
                  break;
                }
              }
            }
            const x1 = y(e.length - 1) + _ / 2;
            d.beginPath();
            d.moveTo(Math.min(x0, x1), ly);
            d.lineTo(x1, ly);
            d.stroke();
            if (typeof d.setLineDash == "function") {
              d.setLineDash([]);
            }
            if (typeof d.fillText == "function") {
              // v1.46.0: the chart already says which timeframe it is, so the label is just the side and
              // the price - "R - 0.56330" - sat at the right, where you read prices on this panel.
              const tag = role + " - " + line.price.toFixed(priceDecimals(e)),
                size = Math.max(7, Math.min(10, Math.round(0.11 * i)));
              d.font = "700 " + size + "px " + "'DM Sans', system-ui, sans-serif";
              const tw = typeof d.measureText == "function" ? d.measureText(tag).width : 5.5 * tag.length;
              d.fillStyle = line.colour;
              d.globalAlpha = 0.95;
              if (typeof d.textBaseline == "string") {
                d.textBaseline = "bottom";
              }
              let labelY = ly - 2;
              for (let guard = 0; guard < 8; guard++) {
                if (!usedRows.some((used) => Math.abs(used - labelY) < size + 1)) {
                  break;
                }
                labelY += size + 2;
              }
              usedRows.push(labelY);
              d.fillText(tag, Math.max(6, Math.min(a - tw - 3, x1 + 4)), Math.max(size, Math.min(i - 1, labelY)));
              if (typeof d.textBaseline == "string") {
                d.textBaseline = "middle";
              }
            }
            d.globalAlpha = 1;
          }
        } catch (t) {}
      }
      // ── Crosshair (v1.40.0) ───────────────────────────────────────────────────────────────────────
      // Drawn under the price label so the label stays readable when the two meet.
      if (hoverIdx != null && hoverIdx >= 0 && hoverIdx < e.length) {
        const bar = e[hoverIdx];
        if (bar && isFinite(bar.c)) {
          const x = Math.round(y(hoverIdx)) + 0.5,
            lineY = Math.round(v(bar.c)) + 0.5;
          // v1.43.1: the crosshair and the bar-end upright were the same colour, weight and dash, so
          // hovering near the newest candle showed two lines nobody could tell apart. The crosshair is
          // the bright, finely dotted one, with a marker where its lines cross; the bar-end upright is
          // dimmer below.
          d.globalAlpha = 0.9;
          d.strokeStyle = "#e8eefc";
          if (typeof d.setLineDash == "function") {
            d.setLineDash([1, 3]);
          }
          d.beginPath();
          d.moveTo(x, 6);
          d.lineTo(x, 6 + f);
          d.moveTo(6, lineY);
          d.lineTo(6 + h, lineY);
          d.stroke();
          if (typeof d.setLineDash == "function") {
            d.setLineDash([]);
          }
          d.fillStyle = "#e8eefc";
          d.fillRect(x - 1.5, lineY - 1.5, 3, 3);
          d.globalAlpha = 1;
        }
      }
      // ── Last price: a dashed line across the chart and a label at the right edge ──────────────────
      // Everything here is feature-checked and wrapped: a canvas without text metrics (the jsdom
      // harness, or a browser refusing the call) must not take the candles down with it.
      try {
        const last = e[e.length - 1];
        if (last && isFinite(last.c) && typeof d.fillText == "function") {
          const price = last.c,
            lineY = Math.round(v(price)) + 0.5,
            colour = last.c >= last.o ? n : o;
          d.globalAlpha = 0.5;
          d.strokeStyle = colour;
          if (typeof d.setLineDash == "function") {
            d.setLineDash([3, 3]);
          }
          d.beginPath();
          d.moveTo(6, lineY);
          d.lineTo(6 + h, lineY);
          d.stroke();
          if (typeof d.setLineDash == "function") {
            d.setLineDash([]);
          }
          d.globalAlpha = 1;
          const text = price.toFixed(priceDecimals(e)),
            size = labelSize;
          d.font = "700 " + size + "px " + "'DM Sans', system-ui, sans-serif";
          const measure = (str) => (typeof d.measureText == "function" ? d.measureText(str).width : 6 * str.length);
          const height = size + 5,
            boxY = Math.max(0, Math.min(i - height, lineY - height / 2));
          if (typeof d.textBaseline == "string") {
            d.textBaseline = "middle";
          }
          // v1.42.1: the price label belongs on the RIGHT, where a price axis sits. The countdown goes
          // between the candles and that label, with a gap either side so the pill never looks stuck to
          // the last candle or to the price.
          const GAP = LABEL_GAP;
          const priceW = measure(text) + 8,
            priceX = Math.max(0, a - priceW - 1);
          if (barLeft != null && barLeft >= 0) {
            // The bar now forming ends here: a dashed upright, clear of the last candle.
            const edge = Math.round(y(e.length - 1) + _ / 2 + GAP) + 0.5;
            d.globalAlpha = 0.3;
            d.strokeStyle = "#9fb3d9";
            if (typeof d.setLineDash == "function") {
              d.setLineDash([3, 3]);
            }
            d.beginPath();
            d.moveTo(edge, 4);
            d.lineTo(edge, i - 4);
            d.stroke();
            if (typeof d.setLineDash == "function") {
              d.setLineDash([]);
            }
            d.globalAlpha = 1;
            const clock = fmtBarClock(barLeft, true),
              clockW = measure(clock) + 10;
            // Just right of the upright. The reservation above means it fits; the clamp is only a guard
            // for a cell too narrow to hold both, where the price label wins.
            let clockX = edge + 4;
            if (clockX + clockW > priceX - GAP) {
              clockX = priceX - GAP - clockW;
            }
            if (clockX > y(e.length - 1)) {
              d.fillStyle = "oklch(18% 0.02 257 / 0.95)";
              d.fillRect(clockX, boxY, clockW, height);
              d.fillStyle = "#e8eefc";
              d.fillText(clock, clockX + 5, boxY + height / 2 + 0.5);
            }
          }
          d.fillStyle = colour;
          d.fillRect(priceX, boxY, priceW, height);
          d.fillStyle = "#0b1020";
          d.fillText(text, priceX + 4, boxY + height / 2 + 0.5);
        }
      } catch (t) {}
      d.globalAlpha = 1;
    }
    const fmtAgo = (t) =>
        t < 60 ? t + "s ago" : t < 3600 ? Math.floor(t / 60) + "m ago" : Math.floor(t / 3600) + "h ago",
      fmtHHMM = (t) => {
        const e = new Date(1000 * t);
        return ("0" + e.getHours()).slice(-2) + ":" + ("0" + e.getMinutes()).slice(-2);
      };
    // v1.40.0: which bar the pointer is over. The panel redraws on a 200 ms tick, which is visibly late
    // for a crosshair, so a move redraws the one cell it is over straight away.
    // The bar in this cell whose period contains `at`, or null when it is not on screen.
    function matchingBarIndex(cell, at) {
      const drawn = cell._tcDrawn;
      if (!drawn || !drawn.length) {
        return null;
      }
      const period = tfSeconds(cell.getAttribute("data-tf")) || 0;
      let found = null;
      for (let i = drawn.length - 1; i >= 0; i--) {
        if (drawn[i].t <= at) {
          found = i;
          break;
        }
      }
      if (found == null) {
        return null;
      }
      // Guard against a hole: without this, a moment that this chart never recorded would light up the
      // last bar before the gap as though it covered it.
      return period > 0 && at >= drawn[found].t + period ? null : found;
    }
    function attachMtfHover(panel) {
      const clear = () => {
        let changed = false;
        panel.querySelectorAll(".tcMtfCell").forEach((cell) => {
          if (cell._tcHoverIdx != null) {
            cell._tcHoverIdx = null;
            changed = true;
          }
        });
        if (changed) {
          renderMtf(panel);
        }
      };
      panel.addEventListener(
        "pointermove",
        (ev) => {
          if (panel._tcPanning) {
            return; // a drag is under way; the crosshair would fight it for the same pointer
          }
          const canvas = ev.target.closest && ev.target.closest(".tcMtfCv");
          const cell = canvas && canvas.closest(".tcMtfCell");
          if (!cell || !cell._tcDrawn || !cell._tcDrawn.length) {
            clear();
            return;
          }
          const rect = canvas.getBoundingClientRect(),
            slot = cell._tcSlotDrawn || 6,
            idx = Math.floor((ev.clientX - rect.left - 6) / slot);
          const next = idx >= 0 && idx < cell._tcDrawn.length ? idx : null;
          if (cell._tcHoverIdx === next) {
            return;
          }
          cell._tcHoverIdx = next;
          // v1.43.0: the same moment on every chart. Candles are bucketed by time, so the bar under the
          // pointer belongs to exactly one bar on each of the other timeframes - the one whose own period
          // contains its start. That rule reads both ways: a 1m bar picks the 5m bar holding it, and a 15m
          // bar picks the first 1m bar inside it. A chart not showing that moment gets no crosshair, which
          // is the honest answer rather than the nearest bar to it.
          const at = next == null ? null : cell._tcDrawn[next].t;
          panel.querySelectorAll(".tcMtfCell").forEach((other) => {
            if (other === cell) {
              return;
            }
            other._tcHoverIdx = at == null ? null : matchingBarIndex(other, at);
          });
          renderMtf(panel);
        },
        { passive: true },
      );
      panel.addEventListener("pointerleave", clear, { passive: true });
      // v1.44.0: the wheel changes how many candles this chart shows, the way the platform's own chart
      // behaves. Not passive: the page must not scroll out from under the pointer while zooming.
      panel.addEventListener(
        "wheel",
        (ev) => {
          const canvas = ev.target.closest && ev.target.closest(".tcMtfCv");
          const cell = canvas && canvas.closest(".tcMtfCell");
          if (!cell) {
            return;
          }
          ev.preventDefault();
          // v1.44.1: one turn of a wheel arrives as a burst of events, and a trackpad as a long stream of
          // small ones. Applying a step to each ran a chart from 40 candles to the 240 cap in a single
          // gesture. Delta is accumulated instead, one step per notch's worth, with a gentler factor.
          const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 100 : 1;
          cell._tcWheelAcc = (cell._tcWheelAcc || 0) + ev.deltaY * unit;
          if (Math.abs(cell._tcWheelAcc) < 40) {
            return;
          }
          const out = cell._tcWheelAcc > 0;
          cell._tcWheelAcc = 0;
          const now = cellCount(cell),
            next = clampZoom(out ? Math.max(now + 1, now * 1.12) : Math.min(now - 1, now * 0.89));
          if (next === now) {
            return;
          }
          setCellZoom(cell.getAttribute("data-tf"), next);
          cell._tcSig = "";
          renderMtf(panel);
        },
        { passive: false },
      );
    }
    function attachMtfPan(t) {
      let e = null,
        n = 0,
        o = 0,
        r = 0,
        a = false;
      t.addEventListener("pointerdown", (t) => {
        const i = t.target.closest(".tcMtfCv");
        if (!i) {
          return;
        }
        const c = i.closest(".tcMtfCell");
        if (c && c._tcRows && c._tcRows.length) {
          e = c;
          n = t.clientX;
          o = c._tcEndIdx;
          r = c._tcFuture || 0;
          a = false;
          try {
            i.setPointerCapture(t.pointerId);
          } catch (t) {}
          t.preventDefault();
        }
      });
      t.addEventListener("pointermove", (i) => {
        if (!e) {
          return;
        }
        const c = e.querySelector(".tcMtfCv"),
          s = (c && c._tcSlot) || 6,
          l = i.clientX - n;
        if (!a && Math.abs(l) < 3) {
          return;
        }
        a = true;
        t._tcPanning = true;
        const d = e._tcCount,
          u = (function (t, e, n, o, r, a, i) {
            if (!Array.isArray(t) || !t.length) {
              return null;
            }
            const c = t.length - 1,
              s = e > 0 ? e : t.length,
              l = Math.min(c, s - 1),
              d = c + Math.max(0, i),
              u = Math.max(l, Math.min(d, n + o - r)),
              p = Math.max(0, u - c),
              m = Math.max(0, Math.min(c, u - p));
            return m >= c && p === a
              ? null
              : {
                  endT: t[m].t,
                  future: p,
                };
          })(e._tcRows, d, o, r, Math.round(l / s), defaultFutureSlots(d), maxFutureSlots(d));
        e._tcPanEndT = u ? u.endT : null;
        e._tcFuture = u ? u.future : defaultFutureSlots(d);
        e._tcSig = "";
        renderMtf(t);
        i.preventDefault();
      });
      const i = () => {
        e = null;
        t._tcPanning = false; // the crosshair can take the pointer back (v1.44.0)
      };
      t.addEventListener("pointerup", i);
      t.addEventListener("pointercancel", i);
      t.addEventListener("dblclick", (e) => {
        const n = e.target.closest(".tcMtfCv");
        if (!n) {
          return;
        }
        const o = n.closest(".tcMtfCell");
        if (o) {
          o._tcPanEndT = null;
          o._tcFuture = defaultFutureSlots(o._tcCount || 40);
          o._tcSig = "";
          renderMtf(t);
        }
      });
    }
    // v1.27.1: on load the cached candles sat in the archive until the next chart pull promoted them, so
    // every cell read "visit once" even though the data was there. Take the pair from Quotex's own state
    // and use its cache straight away.
    function ensureMtfSymbol() {
      if (mtfSymbol) {
        return;
      }
      const state = readQuotexState();
      const symbol = state && state.symbol;
      if (!symbol) {
        return;
      }
      mtfSymbol = symbol;
      mtfSymbolSince = Date.now();
      mtfFillPendingFor = symbol; // the pair you land on after a reload counts as opening it (v1.35.0)
      if (mtfArchive[symbol]) {
        mtfEntries = mtfArchive[symbol];
        delete mtfArchive[symbol];
      }
    }
    // A short message in place of the pair name. renderMtf leaves the name alone until it expires —
    // before v1.30.0 the next 200 ms render wiped the message about as fast as it appeared.
    let mtfFlashUntil = 0;
    function mtfFlash(msg, ms) {
      const el = qs("#__tcMTF .tcMtfPair");
      if (!el) {
        return;
      }
      mtfFlashUntil = Date.now() + (ms > 0 ? ms : 1800);
      el.textContent = msg;
    }
    // Visits each configured timeframe once, collecting candles, then puts the chart back where it was.
    // Extracted from the ↻ button in v1.30.0 so the auto-fill can use the very same walk.
    function runMtfSync(done) {
      const bail = (why) => {
        if (why) {
          mtfFlash(why);
        }
        if (done) {
          try {
            done();
          } catch (e) {}
        }
      };
      if (mtfSyncBusy || otcRebuildBusy) {
        return bail("");
      }
      // v1.36.0: a trade being open used to block this. It never needed to — the walk changes which
      // timeframe the chart is showing, which is a view, not the trade. The cost is that the chart looks
      // away from a running trade for the few seconds the walk takes.
      const panel = byId("__tcMTF");
      if (!panel) {
        return bail("");
      }
      const tfs = (panel._tcTfs || getMtfTfs()).slice(),
        back = getActiveTimeframe();
      mtfSyncBusy = true;
      panel.classList.add("tcMtfBusy");
      // v1.26.0: give each timeframe up to 2.5 s to deliver candles, instead of assuming 260 ms is
      // enough — that was why a sync often left the higher timeframes nearly empty.
      // v1.52.0: wait until the candles STOP arriving, rather than leaving as soon as fifty have.
      // Quotex delivers a timeframe's history progressively, so the old test took whatever happened to
      // be loaded the moment the count crossed fifty - which is why a 15m chart came back with 68 bars
      // while the 5m, which delivered its whole window at once, came back with 201.
      const collect = (tfSec, deadline, done) => {
        let most = -1,
          quiet = 0;
        const step = () => {
          pullChartSnapshot();
          // v1.74.3: nothing counts until the chart is really on this timeframe. Seen live: after a fill, 5M
          // held 3 of 39 bars - the 3 it already had, folded from the 1m collected as you watch. Those counted
          // as arrived, so three quiet polls (under half a second) ended the wait before Quotex had switched
          // the chart and sent the timeframe's history.
          const onIt = mtfChartSec === tfSec;
          const entry = mtfSymbol && mtfEntries[mtfSymbol + "@" + tfSec];
          const have = entry && entry.candles ? entry.candles.length : 0;
          if (!onIt) {
            quiet = 0;
          } else if (have > most) {
            most = have;
            quiet = 0;
          } else {
            quiet++;
          }
          // Three quiet polls on the timeframe is the platform saying it has finished with it.
          if ((onIt && have > 0 && quiet >= 3) || Date.now() > deadline) {
            done();
            return;
          }
          setTimeout(step, 150);
        };
        step();
      };
      const finish = () => {
        mtfSyncBusy = false;
        panel.classList.remove("tcMtfBusy");
        mtfLastPull = 0;
        saveMtfCache(true);
        if (done) {
          try {
            done();
          } catch (e) {}
        }
      };
      const step = (i) => {
        if (i >= tfs.length) {
          if (back && back !== tfs[tfs.length - 1]) {
            selectTimeframe(back, finish);
          } else {
            finish();
          }
          return;
        }
        selectTimeframe(tfs[i], () => {
          collect(tfSeconds(tfs[i]), Date.now() + 3000, () => step(i + 1));
        });
      };
      step(0);
    }
    // v1.30.0: click a cell's timeframe label to put the platform chart on that timeframe.
    function switchChartTf(cell) {
      if (!cell || mtfSyncBusy || otcRebuildBusy) {
        return;
      }
      const tf = cell.getAttribute("data-tf");
      if (!tf) {
        return;
      }
      if (tfSeconds(tf) === mtfChartSec) {
        mtfFlash("chart is on " + tf);
        return;
      }
      mtfFlash("chart → " + tf);
      selectTimeframe(tf, () => {
        mtfLastPull = 0;
      });
    }
    // v1.30.0, rewritten in v1.35.0: opening a pair runs the ↻ walk for you — only when the tab is in
    // front, no trade is open and nothing else is driving the menus. From then on the rolling 1m base
    // keeps the charts current, so this runs once per pair you open and gets out of the way.
    // Only a guard against a walk repeating while you flick between two pairs (v1.35.0).
    const MTF_AUTOFILL_AGAIN_MS = 60000;
    // v1.53.0: when the last fill actually RAN, for what the panel reports. Kept apart from when the
    // next one is allowed, below - the retry used to be scheduled by back-dating this one, so a walk that
    // came back empty immediately claimed to have filled the pair minutes ago.
    const mtfAutofilledAt = {};
    const mtfNextFillAt = {};
    function setMtfAutofill(on) {
      mtfAutofill = !!on;
      try {
        prefSet(KEY_MTF_AUTOFILL, mtfAutofill ? "1" : "0");
      } catch (t) {}
    }
    // v1.31.0: every gate below writes down why it stopped, and the health check reports it. "It just
    // isn't working" is otherwise impossible to tell apart from "a trade was open the whole time".
    let mtfAutofillReason = "starting up";
    // v1.35.0: opening a pair IS the trigger — the same walk the ↻ button does, run for you. Until now it
    // measured how full each chart was and filled only what looked thin, which behaved differently
    // depending on what the fold happened to have collected: sometimes a walk, sometimes nothing, with no
    // way to tell which from the outside. A pair you open gets a walk; that is the whole rule.
    let mtfFillPendingFor = null;
    function maybeAutofillMtf() {
      const stop = (why) => {
        mtfAutofillReason = why;
      };
      if (!mtfAutofill) {
        return stop("switched off in the \u2699 menu");
      }
      if (document.hidden) {
        return stop("tab is in the background");
      }
      if (mtfSyncBusy) {
        return stop("filling now");
      }
      if (otcRebuildBusy) {
        return stop("busy with the pair list");
      }
      const sym = mtfSymbol,
        now = Date.now();
      if (!sym || !mtfSymbolSince) {
        return stop("no pair read yet");
      }
      if (mtfFillPendingFor !== sym) {
        return stop(
          mtfAutofilledAt[sym]
            ? "filled this pair " + fmtAgo(Math.round((now - mtfAutofilledAt[sym]) / 1000))
            : "ready — fills when you open a pair",
        );
      }
      const settleMs = getMtfSettle() * 1000;
      if (now - mtfSymbolSince < settleMs) {
        return stop("settling (" + Math.ceil((settleMs - (now - mtfSymbolSince)) / 1000) + "s)");
      }
      // Only to stop a walk repeating while you flick back and forth between two pairs.
      if (mtfNextFillAt[sym] && now < mtfNextFillAt[sym]) {
        return stop(
          mtfAutofilledAt[sym]
            ? "filled this pair " + fmtAgo(Math.round((now - mtfAutofilledAt[sym]) / 1000))
            : "waiting before another try",
        );
      }

      const panel = byId("__tcMTF");
      if (!panel) {
        return stop("charts are hidden (press C)");
      }
      const tfs = panel._tcTfs || getMtfTfs();
      mtfFillPendingFor = null;
      mtfAutofilledAt[sym] = now;
      mtfNextFillAt[sym] = now + MTF_AUTOFILL_AGAIN_MS;
      stop("filling " + tfs.join(", "));
      mtfFlash("filling …", 2500);
      runMtfSync(() => {
        // A walk that came back with nothing (the menu could not be driven, say) is not a fill: put the
        // pair back in the queue rather than leaving the charts empty until you switch away and back.
        const gotSomething = tfs.some((tf) => {
          const e = mtfEntries[sym + "@" + tfSeconds(tf)];
          return !!(e && e.candles && e.candles.length);
        });
        if (!gotSomething) {
          // Nothing came back: allow another go shortly, and do not claim this counted as a fill.
          mtfFillPendingFor = sym;
          delete mtfAutofilledAt[sym];
          mtfNextFillAt[sym] = now + 30000;
          mtfAutofillReason = "walk came back empty, retrying";
        }
      });
    }
    // v1.31.1: "visit once" on its own is a dead end — it does not say whether something is coming.
    // The caption carries the short version of why the auto-fill is holding off, so the answer is on the
    // chart instead of behind a popup. Long reasons are shortened; the popup's health check has them in full.
    function autofillHint() {
      const r = mtfAutofillReason || "";
      if (/^filling/.test(r)) {
        return " · filling…";
      }

      if (/switched off/.test(r)) {
        return "";
      }
      if (/came back empty/.test(r)) {
        return " · retrying";
      }
      if (/filled this pair/.test(r)) {
        // v1.51.0: the walk has already been and fetched what the platform holds. Telling you to press
        // it again sends you after history that does not exist - the count alone is the honest answer.
        return "";
      }
      if (/background/.test(r) || /hidden/.test(r)) {
        return "";
      }
      return "";
    }
    // v1.39.0: which way a chart is pointing, from its CLOSED bars — the newest bar is still moving and
    // would flip back and forth on its own. A turn is recorded per pair and timeframe, so coming back to a
    // pair does not announce a turn that happened while you were away.
    const MTF_FLIP_SHOW_MS = 120000;
    const mtfFlipState = new Map();
    function flipDirection(rows, bars) {
      const closed = rows.length - 1; // drop the bar still forming
      if (closed < bars + 1) {
        return 0;
      }
      const now = rows[closed - 1].c,
        then = rows[closed - 1 - bars].c;
      return now > then ? 1 : now < then ? -1 : 0;
    }
    function trackMtfFlip(key, rows, bars, nowMs) {
      const dir = flipDirection(rows, bars);
      const prev = mtfFlipState.get(key);
      if (!dir) {
        return prev || null;
      }
      if (!prev) {
        // First look at this chart: record which way it points, announce nothing.
        const first = { dir, at: 0 };
        mtfFlipState.set(key, first);
        return first;
      }
      if (prev.dir !== dir) {
        const turned = { dir, at: nowMs };
        mtfFlipState.set(key, turned);
        return turned;
      }
      return prev;
    }
    function barTimeLeft(periodSec, nowMs) {
      if (!(periodSec > 0)) {
        return NaN;
      }
      const secs = Math.floor((nowMs == null ? Date.now() : nowMs) / 1000);
      return periodSec - (secs % periodSec);
    }
    function fmtBarClock(secs, pad) {
      if (!(secs >= 0)) {
        return "";
      }
      const m = Math.floor(secs / 60),
        r = secs % 60,
        two = (v) => (v < 10 ? "0" + v : "" + v);
      return (pad ? two(m) : m) + ":" + two(r);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.55.0: the scan view. The charts answer "what is this pair doing"; this answers "which pair is
    // worth looking at", across the whole board, without moving the chart anywhere.
    //
    // Nothing here visits a pair. Payout, whether the market is active and the label come from Quotex's
    // own asset table, which covers every instrument they offer and costs nothing; the trend and the
    // levels come from candles already collected - the pair you are on, plus the ones held in the cache.
    // A pair with no candles still earns a row if it clears your payout floor, because its payout is
    // knowable and that alone is worth ranking; it simply cannot be placed against a level yet.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const getMtfView = () => (prefGet(KEY_MTF_VIEW) === "scan" ? "scan" : "charts"),
      setMtfView = (v) => {
        try {
          prefSet(KEY_MTF_VIEW, v === "scan" ? "scan" : "charts");
        } catch (t) {}
      },
      // The candles a scan judges: the same order of window a chart shows zoomed out, so a level the
      // board reports is a level you will see when you open the pair.
      SCAN_WINDOW = 120,
      // Closed bars a direction is read over - the same span the turn mark uses.
      SCAN_TREND_BARS = 3,
      SCAN_EVERY_MS = 2000,
      // Within a bar and a half of the 1m base, a row is as current as the chart would be.
      SCAN_LIVE_SEC = 90;
    let mtfScanAt = 0;
    const scanEsc = (t) =>
      String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    function scanTrend(rows) {
      if (!Array.isArray(rows) || rows.length < SCAN_TREND_BARS + 2) {
        return null;
      }
      const done = rows.slice(0, -1), // the newest bar is still forming
        last = done[done.length - 1],
        back = done[done.length - 1 - SCAN_TREND_BARS];
      if (!last || !back || !isFinite(last.c) || !isFinite(back.c)) {
        return null;
      }
      return last.c > back.c ? 1 : last.c < back.c ? -1 : 0;
    }
    // How far the price is from the nearest level on one timeframe, as a percentage of price, which side
    // it is on, and whether it is inside the zone - using the same detector, window and tolerance the
    // charts draw with, so the board and the chart can never disagree.
    function scanNearest(rows, sec) {
      if (!Array.isArray(rows) || rows.length < 2 * SR_STRENGTH + 2) {
        return null;
      }
      const win = rows.slice(-SCAN_WINDOW),
        at = win[win.length - 1].c;
      if (!isFinite(at) || at <= 0) {
        return null;
      }
      const tol = srTolerance(win),
        levels = srNearest(srLevels(win, sec), at, tol);
      let best = null;
      for (const l of levels) {
        const gap = Math.abs(l.price - at);
        if (!best || gap < best.gap) {
          best = { gap, kind: l.price >= at ? "R" : "S" };
        }
      }
      return best ? { pct: (best.gap / at) * 100, kind: best.kind, on: best.gap <= tol } : null;
    }
    function scanPair(symbol, entries, asset, nowSec, tfs) {
      const row = {
        symbol,
        label: (asset && asset.label) || symbol,
        payout: asset && asset.payout != null ? asset.payout : NaN,
        trends: {},
        near: null,
        have: false,
        // v1.55.1: how old the newest candle behind this row is. Only the pair in front of you is live;
        // every other row is judged from what was collected the last time it was open, and a level from
        // forty minutes ago is not the same claim as one from thirty seconds ago.
        age: Infinity,
        ageSec: Infinity, // the period of the series that age came from
      };
      for (const tf of tfs) {
        const sec = tfSeconds(tf),
          m = entries ? resolveMtfRows(entries, symbol, sec, nowSec, MTF_STALE_SEC) : null,
          rows = m && m.rows;
        if (!rows || !rows.length) {
          row.trends[tf] = null;
          continue;
        }
        row.have = true;
        const last = rows[rows.length - 1];
        // Judged on the FINEST series this pair has, not the kindest. Taking the smallest age across
        // timeframes let a coarse one speak for the pair: a 15m series folded up from 5m data starts its
        // newest bar up to fifteen minutes back, and crediting it a whole period made a pair that had
        // stopped twenty minutes ago report six. The 1m base, when there is one, is the honest witness.
        if (last && isFinite(last.t) && sec < row.ageSec) {
          row.ageSec = sec;
          row.age = barsBehind(last.t, sec, nowSec);
        }
        row.trends[tf] = scanTrend(rows);
        const near = scanNearest(rows, sec);
        if (near && (!row.near || near.pct < row.near.pct)) {
          row.near = { pct: near.pct, kind: near.kind, on: near.on, tf };
        }
      }
      return row;
    }
    function scanBoard() {
      const tfs = getMtfTfs(),
        nowSec = Math.floor(Date.now() / 1000),
        assets = readQuotexAssets() || {},
        floor = parseInt(getMinPayoutStored(), 10) || 0,
        open = new Set(
          getPairTabs()
            .map((t) => t.getAttribute && t.getAttribute("data-symbol"))
            .filter(Boolean),
        ),
        entriesFor = (sym) => (sym === mtfSymbol ? mtfEntries : mtfArchive[sym] || null),
        seen = new Set(),
        rows = [],
        consider = (sym) => {
          if (!sym || seen.has(sym)) {
            return;
          }
          const asset = assets[sym],
            entries = entriesFor(sym);
          // A pair whose candles we hold, or that is open in front of you, always earns a row. One that is
          // neither has to clear the payout floor, or the board is ninety lines of noise.
          if (!entries && !open.has(sym) && !(asset && asset.active && asset.payout >= floor)) {
            return;
          }
          seen.add(sym);
          rows.push(scanPair(sym, entries, asset, nowSec, tfs));
        };
      if (mtfSymbol) {
        consider(mtfSymbol);
      }
      for (const sym in mtfArchive) {
        consider(sym);
      }
      open.forEach(consider);
      for (const sym in assets) {
        consider(sym);
      }
      // Nearest to a level first: those are the rows about to make a decision. Pairs that cannot be placed
      // against a level yet fall in behind them, best payout first.
      rows.sort((a, b) => {
        if (a.near && b.near) {
          return a.near.pct - b.near.pct;
        }
        if (a.near) {
          return -1;
        }
        if (b.near) {
          return 1;
        }
        return (
          (isNaN(b.payout) ? -1 : b.payout) - (isNaN(a.payout) ? -1 : a.payout) ||
          String(a.label).localeCompare(String(b.label))
        );
      });
      return { rows, floor, tfs, open };
    }
    function renderMtfScan(panel) {
      const host = panel.querySelector(".tcMtfScanList"),
        hdr = panel.querySelector(".tcMtfScanHdr");
      if (!host) {
        return;
      }
      const board = scanBoard(),
        judged = board.rows.filter((r) => r.near).length,
        live = board.rows.filter((r) => r.have && r.age <= SCAN_LIVE_SEC).length,
        head =
          board.rows.length + " pairs \u00b7 " + judged + " judged \u00b7 " + live + " live \u00b7 \u2265 " + board.floor + "%";
      if (hdr && hdr.textContent !== head) {
        hdr.textContent = head;
      }
      const arrow = (v) => (v == null ? "\u00b7" : v > 0 ? "\u25b2" : v < 0 ? "\u25bc" : "\u00b7");
      const html = board.rows
        .map((r) => {
          const trends = board.tfs
            .map(
              (tf) =>
                '<span class="tcScanTf" style="color:' +
                srColour(tf) +
                '" title="' +
                scanEsc(tf) +
                '">' +
                arrow(r.trends[tf]) +
                "</span>",
            )
            .join("");
          // Live is the normal case for the pair you are on and needs no label; anything else says how
          // far behind it is, so a row is never read as fresher than it is.
          const age =
            r.have && r.age > SCAN_LIVE_SEC
              ? '<span class="tcScanAge">' + fmtAgo(r.age).replace(" ago", "") + "</span>"
              : "";
          const near = r.near
            ? '<span class="tcScanNear" style="color:' +
              srColour(r.near.tf) +
              '">' +
              r.near.kind +
              " " +
              r.near.pct.toFixed(2) +
              "%</span>"
            : '<span class="tcScanNear tcScanNone">\u2014</span>';
          return (
            '<div class="tcMtfScanRow' +
            (r.near && r.near.on ? " tcScanHot" : "") +
            (board.open.has(r.symbol) ? " tcScanOpen" : "") +
            '" data-mtf="scanrow" data-sym="' +
            scanEsc(r.symbol) +
            '" title="' +
            scanEsc(r.label) +
            (r.have
              ? r.age > SCAN_LIVE_SEC
                ? " \u2014 judged from candles " + fmtAgo(r.age) + "; open it to bring them up to date"
                : " \u2014 live"
              : " \u2014 no candles yet, so it cannot be placed against a level") +
            '"><span class="tcScanPair">' +
            scanEsc(String(r.label).replace(" (OTC)", "")) +
            "</span>" +
            age +
            '<span class="tcScanPay">' +
            (isNaN(r.payout) ? "\u2014" : r.payout + "%") +
            '</span><span class="tcScanTr">' +
            trends +
            "</span>" +
            near +
            "</div>"
          );
        })
        .join("");
      if (host._tcHtml !== html) {
        host._tcHtml = html;
        host.innerHTML = html || '<div class="tcScanEmpty">No pair clears the payout floor yet.</div>';
      }
      renderSweep(panel);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.56.0: the sweep. Everything else on the board is free, which is why it can only judge pairs you
    // have already been on - four tabs open and two of them reading "—" is the normal case. This is the
    // one part that moves the chart: it visits each open pair that has fallen behind, runs the same walk
    // the refresh button runs, and puts you back on the pair you started from.
    //
    // Because it moves the chart it never starts on its own. It needs the button, the tab in front and no
    // trade running, it stops the moment any of that changes, and it can be stopped by hand mid-way.
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const SWEEP_SETTLE_MS = 2500; // how long a pair is given to actually become the chart's pair
    // A series is behind by how long ago its newest bar should have CLOSED, not by the age of that bar's
    // opening timestamp: the bar now forming is always up to one period old and is not stale for it.
    const barsBehind = (lastT, periodSec, nowSec) =>
      Math.max(0, nowSec - lastT - (periodSec > 0 ? periodSec : 0));
    let sweepState = null,
      sweepNote = "",
      sweepNoteAt = 0;
    const setSweepNote = (t) => {
      sweepNote = t || "";
      sweepNoteAt = sweepNote ? Date.now() : 0;
    };
    const symbolOfTab = (tab) => (tab && tab.getAttribute ? tab.getAttribute("data-symbol") : null);
    // Every open pair whose candles have fallen behind, stalest first. A pair already current is left
    // alone - the point is to spend chart time only where it buys something.
    // How far behind one pair's candles are: the smallest gap across every series held for it. Extracted
    // in v1.60.0 so the sweep's target list and the diagnostics line are answering with the same
    // arithmetic - two copies of it is how "the board says stale, the sweep says nothing to do" happens.
    // Infinity means no candles are held for the pair at all.
    function pairBehindSec(sym, nowSec) {
      const entries = sym === mtfSymbol ? mtfEntries : mtfArchive[sym];
      let age = Infinity;
      for (const key in entries || {}) {
        const entry = entries[key],
          c = entry && entry.candles,
          at = key.lastIndexOf("@"),
          sec = (at >= 0 && parseInt(key.slice(at + 1), 10)) || entry.periodSeconds || 0;
        if (c && c.length && isFinite(c[c.length - 1].t)) {
          age = Math.min(age, barsBehind(c[c.length - 1].t, sec, nowSec));
        }
      }
      return age;
    }
    function sweepTargets() {
      const now = Math.floor(Date.now() / 1000),
        assets = readQuotexAssets() || {},
        out = [];
      getPairTabs().forEach((tab) => {
        const sym = symbolOfTab(tab);
        if (!sym) {
          return;
        }
        const age = pairBehindSec(sym, now);
        if (age > SCAN_LIVE_SEC) {
          out.push({ sym, age, label: (assets[sym] && assets[sym].label) || sym });
        }
      });
      return out.sort((a, b) => b.age - a.age);
    }
    function renderSweep(panel) {
      if (!panel) {
        return;
      }
      const btn = panel.querySelector('[data-mtf="sync"]'),
        msg = panel.querySelector(".tcScanFootMsg"),
        running = !!sweepState,
        onBoard = panel.classList.contains("tcMtfScanOn");
      if (btn) {
        // The same button, saying which of its two jobs this press will do - and offering the way out
        // while it is doing the longer one.
        const title = running
          ? "Stop \u2014 " + sweepState.done + " of " + sweepState.list.length + " done"
          : onBoard
            ? "Bring every open pair that has fallen behind up to date, and come back here (blocked while a trade is open)"
            : "Visit each timeframe once and come back (blocked while a trade is open)";
        if (btn.getAttribute("title") !== title) {
          btn.setAttribute("title", title);
        }
      }
      panel.classList.toggle("tcMtfSweeping", running);
      const text = running
        ? sweepState.done + " of " + sweepState.list.length + (sweepState.at ? " \u00b7 " + sweepState.at : "")
        : sweepNote;
      if (msg && msg.textContent !== text) {
        msg.textContent = text;
      }
    }
    function sweepFinish(note) {
      const back = sweepState && sweepState.back;
      sweepState = null;
      setSweepNote(note);
      if (window.__tcSweepTimer) {
        clearTimeout(window.__tcSweepTimer);
        delete window.__tcSweepTimer;
      }
      if (back) {
        const tab = getPairTabs().find((t) => symbolOfTab(t) === back);
        if (tab && !isActiveTab(tab)) {
          activateTab(tab);
        }
      }
      mtfScanAt = 0; // the board has new candles to show
      const panel = byId("__tcMTF");
      if (panel) {
        renderSweep(panel);
        if (panel.classList.contains("tcMtfScanOn")) {
          renderMtfScan(panel);
        }
      }
    }
    function sweepStep() {
      if (!sweepState) {
        return;
      }
      if (sweepState.stop) {
        return sweepFinish("stopped \u00b7 " + sweepState.done + " done");
      }
      // The two things that make moving the chart the wrong thing to be doing.
      if (openTradeCount() > 0) {
        return sweepFinish("stopped \u2014 a trade opened");
      }
      if (document.hidden) {
        return sweepFinish("stopped \u2014 the tab went to the back");
      }
      const next = sweepState.list[sweepState.idx];
      if (!next) {
        return sweepFinish(sweepState.done + " of " + sweepState.list.length + " brought up to date");
      }
      sweepState.idx++;
      const tab = getPairTabs().find((t) => symbolOfTab(t) === next.sym);
      if (!tab) {
        // The tab went away while we were working; that is not a failure, just one less to do.
        sweepStep();
        return;
      }
      sweepState.at = next.label;
      renderSweep(byId("__tcMTF"));
      if (!isActiveTab(tab)) {
        activateTab(tab);
      }
      waitUntil(
        () => mtfSymbol === next.sym,
        120,
        SWEEP_SETTLE_MS,
        () => {
          if (!sweepState) {
            return;
          }
          if (mtfSymbol !== next.sym) {
            // It never became the chart's pair. Move on rather than walking the wrong one.
            sweepStep();
            return;
          }
          runMtfSync(() => {
            if (!sweepState) {
              return;
            }
            sweepState.done++;
            renderSweep(byId("__tcMTF"));
            window.__tcSweepTimer = setTimeout(sweepStep, 200);
          });
        },
      );
    }
    function startSweep() {
      const panel = byId("__tcMTF");
      if (!panel || sweepState) {
        return;
      }
      const stop = (why) => {
        setSweepNote(why);
        renderSweep(panel);
      };
      if (document.hidden) {
        return stop("bring this tab to the front first");
      }
      if (openTradeCount() > 0) {
        return stop("not while a trade is running");
      }
      if (mtfSyncBusy || otcRebuildBusy || autoOpenBusy) {
        return stop("the chart is busy");
      }
      const list = sweepTargets();
      if (!list.length) {
        return stop("every open pair is already current");
      }
      sweepState = { list, idx: 0, done: 0, back: mtfSymbol, at: "", stop: false };
      setSweepNote("");
      renderSweep(panel);
      sweepStep();
    }
    function applyMtfView(panel) {
      const scan = getMtfView() === "scan";
      panel.classList.toggle("tcMtfScanOn", scan);
      panel.querySelectorAll('[data-mtf="view"]').forEach((b) => {
        b.classList.toggle("tcOn", (b.getAttribute("data-view") === "scan") === scan);
      });
      if (scan) {
        mtfScanAt = 0;
        renderMtfScan(panel);
      } else {
        panel.querySelectorAll(".tcMtfCell").forEach((c) => {
          c._tcSig = "";
        });
        renderMtf(panel);
      }
      // The two views are different heights, so whichever one is arriving has to be pulled back inside
      // the window. Measured after a frame, because the board has only just been filled.
      clampToViewport(panel);
      window.__tcMtfViewClamp = setTimeout(() => clampToViewport(panel), 60);
    }
    // A row is a way in: a pair already open switches to it, one that is not is opened from the asset
    // list the same way the payout floor opens one.
    function scanOpenPair(symbol) {
      const assets = readQuotexAssets() || {},
        label = (assets[symbol] && assets[symbol].label) || symbol,
        norm = normKey(label),
        tab = getPairTabs().find((t) => normKey(getTabName(t)) === norm);
      if (tab) {
        if (!isActiveTab(tab)) {
          activateTab(tab);
        }
        return;
      }
      if (otcRebuildBusy || autoOpenBusy || !norm) {
        return;
      }
      otcRebuildBusy = true;
      ensureAssetDropdown(0, () => {
        const pick = getAssetChoices().find((r) => r.norm === norm),
          target = pick && (pick.click || pick.row);
        if (target && target.isConnected) {
          synthClick(target);
        }
        waitUntil(() => isPairTabOpen(norm), 80, 800, closeAssetDropdown);
      });
    }
    function renderMtf(t) {
      ensureMtfSymbol();
      const e = t._tcTfs || getMtfTfs(),
        n = getMtfCount(),
        o = t.querySelector('[data-mtf="pair"]'),
        assets = readQuotexAssets(),
        r = (mtfSymbol && assets && assets[mtfSymbol] && assets[mtfSymbol].label) || mtfSymbol || "—";
      if (o && o.textContent !== r && Date.now() >= mtfFlashUntil) {
        o.textContent = r;
      }
      // The pair label above stays current either way; drawing hidden canvases does not.
      if (t.classList.contains("tcMtfScanOn")) {
        return;
      }
      mtfColors.up;
      mtfColors.down;
      const a = mtfColors.up || "#0FAF59",
        i = mtfColors.down || "#FF6251",
        c = Math.floor(Date.now() / 1000);
      for (let o = 0; o < e.length; o++) {
        const r = e[o],
          s = t.querySelector('.tcMtfCell[data-tf="' + r + '"]');
        if (!s) {
          continue;
        }
        const cd = s.querySelector(".tcMtfCd");
        const l = s.querySelector("canvas"),
          d = s.querySelector(".tcMtfCap"),
          u = s.querySelector(".tcMtfPct"),
          p = tfSeconds(r),
          m = mtfSymbol ? resolveMtfRows(mtfEntries, mtfSymbol, p, c, MTF_STALE_SEC) : null;
        if (cd) {
          // v1.42.0: the countdown rides the price line on the chart itself. This header copy is kept for
          // a cell with nothing drawn, where there is no line to ride.
          const left = s._tcPanEndT || m ? NaN : barTimeLeft(p);
          const text = isNaN(left) ? "" : fmtBarClock(left, true);
          if (cd.textContent !== text) {
            cd.textContent = text;
          }
          // The last tenth of a bar, or the last three seconds, whichever is longer.
          const soon = !isNaN(left) && left <= Math.max(3, Math.round(0.1 * p));
          if (cd._tcSoon !== soon) {
            cd._tcSoon = soon;
            cd.classList.toggle("tcMtfCdSoon", soon);
          }
        }
        if (!m) {
          if (s._tcSig !== "empty") {
            s._tcSig = "empty";
            drawCandles(l, null);
          }
          s.classList.add("tcMtfEmpty");
          s.classList.remove("tcMtfStale", "tcMtfPanned");
          s._tcRows = null;
          if (u) {
            u.textContent = "";
          }
          const blankCap = "visit once" + autofillHint();
          if (d && d.textContent !== blankCap) {
            d.textContent = blankCap;
          }
          continue;
        }
        s.classList.remove("tcMtfEmpty");
        // v1.26.0: show which cell matches the platform chart's own timeframe.
        const tfLabel = s.querySelector(".tcMtfTf");
        if (tfLabel) {
          const isChartTf = mtfChartSec > 0 && p === mtfChartSec,
            tfColour = srColour(r),
            wanted = (isChartTf ? "on:" : "off:") + tfColour;
          if (tfLabel._tcActive !== wanted) {
            tfLabel._tcActive = wanted;
            tfLabel.style.color = isChartTf ? "#0b1020" : tfColour;
            tfLabel.style.background = isChartTf ? tfColour : tfColour + "22";
            tfLabel.style.borderColor = isChartTf ? tfColour : tfColour + "55";
            tfLabel.title = isChartTf
              ? "The platform chart is on this timeframe"
              : "Put the chart on this timeframe";
          }
        }
        const count = cellCount(s), // v1.44.0: the wheel can set this per chart
          h = defaultFutureSlots(count),
          f = sliceMtfWindow(m.rows, count, s._tcPanEndT, s._tcFuture, h);
        s._tcRows = m.rows;
        s._tcDrawn = f.candles; // what is on screen right now, for the crosshair (v1.40.0)
        s._tcSlotDrawn = l._tcSlot;
        s._tcEndIdx = f.endIdx;
        s._tcCount = count;
        s._tcFuture = f.future;
        s._tcFutureDef = h;
        s._tcNoPan = m.rows.length <= count;
        s.classList.toggle("tcMtfNoPan", s._tcNoPan);
        if (f.atLive) {
          s._tcPanEndT = null;
        }
        s.classList.toggle("tcMtfPanned", !f.atLive);
        if (!f.candles.length) {
          continue;
        }
        const g = f.candles[f.candles.length - 1],
          barLeft = s._tcPanEndT ? null : barTimeLeft(p),
          // v1.45.0: this chart's own levels. Each timeframe shows what it can see.
          // v1.49.0: levels come from the candles THIS CHART IS SHOWING, not from all the history behind
          // it. Picking by nearest price across 800 bars kept choosing swings from hours ago, whose line
          // then had to start at the left edge - which is why the 1m and 5m looked like full-width lines
          // while the 15m, covering far more time, did not. From the visible window, every level begins
          // at a candle you can see, and zooming out brings older levels in by itself.
          srLines = srOn(r)
            ? (() => {
                const win = f.candles;
                const lv = srLevels(win, p);
                const at = win.length ? win[win.length - 1].c : NaN;
                return srNearest(lv, at, srTolerance(win)).map((x) => ({
                  price: x.price,
                  kind: x.price >= at ? "R" : "S",
                  tf: r,
                  colour: srColour(r),
                  at: x.at, // the swing that made it: where its line starts
                  conf: x.conf,
                }));
              })()
            : [],
          _ =
            f.candles.length +
            ":" +
            g.t +
            ":" +
            g.c +
            ":" +
            m.srcSec +
            ":" +
            f.future +
            ":" +
            a +
            i +
            ":" +
            (s._tcHoverIdx == null ? "" : s._tcHoverIdx) +
            ":" +
            (barLeft == null ? "" : barLeft) +
            ":" +
            srLines.length;
        if (s._tcSig !== _) {
          s._tcSig = _;
          drawCandles(l, f.candles, a, i, f.future, s._tcHoverIdx, barLeft, srLines);
        }
        const y = isStale(m.capturedAt, c, MTF_STALE_SEC) && f.atLive;
        s.classList.toggle("tcMtfStale", y);
        const v = pctChange(f.candles);
        if (u) {
          const t = isNaN(v) ? "" : (v >= 0 ? "▲ +" : "▼ ") + v.toFixed(2) + "%";
          if (u.textContent !== t) {
            u.textContent = t;
          }
          u.style.color = isNaN(v) ? "" : v >= 0 ? a : i;
        }
        // v1.37.0: faded bars cover minutes nobody was watching, so their high and low are built from
        // part of the period. Worth saying out loud - the shape looks the same either way.
        const gaps = f.candles.some((c, i) => c.partial && i !== f.candles.length - 1) ? " · gaps" : "";
        const srBtn = s.querySelector(".tcMtfSr");
        if (srBtn) {
          const on = srOn(r),
            want = on ? "on:" + srColour(r) : "off";
          if (srBtn._tcState !== want) {
            srBtn._tcState = want;
            // v1.54.4: the same treatment the timeframe pill beside it wears - tinted fill, matching edge,
            // text in the colour - rather than a solid block of it. Solid now means one thing only: that the
            // platform chart is on this timeframe.
            srBtn.style.background = on ? srColour(r) + "22" : "transparent";
            srBtn.style.color = on ? srColour(r) : "var(--tc-text-mut)";
            srBtn.style.borderColor = on ? srColour(r) + "55" : "var(--tc-sec-border)";
          }
        }
        // A turn is only worth showing on data we trust: not while panned back, not on a chart with
        // holes in it, and not on one too short to have a direction.
        const flipEl = s.querySelector(".tcMtfFlip");
        if (flipEl) {
          const key = mtfSymbol + "@" + p;
          const state = mtfFlipOn && f.atLive && !gaps ? trackMtfFlip(key, m.rows, getMtfFlipBars(), Date.now()) : null;
          const fresh = state && state.at > 0 && Date.now() - state.at < MTF_FLIP_SHOW_MS;
          const mark = fresh ? (state.dir > 0 ? "▲" : "▼") : "";
          if (flipEl._tcMark !== mark) {
            flipEl._tcMark = mark;
            flipEl.textContent = mark;
            flipEl.classList.toggle("tcFlipOn", !!mark);
            flipEl.style.background = mark ? (state.dir > 0 ? a : i) : "";
            flipEl.title = mark
              ? "This chart turned " + (state.dir > 0 ? "up" : "down") + " over its last " + getMtfFlipBars() + " closed bars"
              : "";
          }
        }
        if (s._tcGaps !== gaps) {
          s._tcGaps = gaps;
          s.title = gaps
            ? "Faded bars cover time the panel was not watching this pair, so their high and low are built from part of the period. Press ↻ to fetch the platform's own bars."
            : "";
        }
        // v1.40.0: hovering a bar puts its numbers in the caption - the cells are too small for a
        // floating readout, and the caption is already the line you look at for this chart's state.
        if (d && s._tcHoverIdx != null && f.candles[s._tcHoverIdx]) {
          const bar = f.candles[s._tcHoverIdx],
            dp = priceDecimals(f.candles),
            move = bar.o > 0 ? ((bar.c - bar.o) / bar.o) * 100 : NaN,
            text =
              fmtHHMM(bar.t) +
              " · " +
              bar.c.toFixed(dp) +
              " · H " +
              bar.h.toFixed(dp) +
              " L " +
              bar.l.toFixed(dp) +
              (isNaN(move) ? "" : " · " + (move >= 0 ? "+" : "") + move.toFixed(2) + "%");
          if (d.textContent !== text) {
            d.textContent = text;
          }
          continue;
        }
        if (d) {
          const t = Math.max(0, c - (m.capturedAt || 0)),
            // v1.26.0: a derived timeframe often has far fewer bars than asked for; say so and point at ↻.
            // v1.32.0: when the auto-fill is about to deal with this, say so instead of asking for a ↻.
            short =
              m.rows.length < count ? " · " + m.rows.length + "/" + count + " bars" + (autofillHint() || " · ↻") : "",
            e = f.atLive
              ? (m.native ? "" : "≈ ") + (y ? fmtAgo(t) : "live") + short + gaps
              : "◀ " + fmtHHMM(g.t) + " · dbl-click for live" + gaps;
          if (d.textContent !== e) {
            d.textContent = e;
          }
        }
      }
    }
    const KEY_MTF_POS = "__tradeCalc_mtf_pos_v2",
      KEY_MTF_ON = "__tradeCalc_mtf_on",
      MTF_ENABLED = true,
      SYNC_ICON_SVG =
        '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
      KEY_MTF_SIZE = "__tradeCalc_mtf_size_v1",
      clampMtfWidth = (t) => Math.max(180, Math.min(900, Math.round(t) || 268)),
      clampMtfCanvasHeight = (t) => Math.max(44, Math.min(420, Math.round(t) || 88));
    function applyMtfSize(t, e) {
      if (t && e) {
        t.style.width = e.w + "px";
        t.style.setProperty("--tc-mtf-cvh", e.cvh + "px");
        t.querySelectorAll(".tcMtfCell").forEach((t) => {
          t._tcSig = "";
        });
      }
    }
    function clampToViewport(t) {
      if (!t) {
        return;
      }
      let e = parseInt(t.style.left, 10),
        n = parseInt(t.style.top, 10);
      // v1.55.1: a panel still sitting where the stylesheet put it (top/right) has no inline left/top,
      // and this used to give up rather than clamp. So a view that made the panel taller - the scan
      // board - pushed its bottom off the screen, taking the resize handles with it and leaving nothing
      // to grab. Reading the box it actually occupies and pinning that gives the clamp something to work
      // with, without moving the panel a pixel.
      if (isNaN(e) || isNaN(n)) {
        const box = t.getBoundingClientRect();
        if (!box.width && !box.height) {
          return;
        }
        e = Math.round(box.left);
        n = Math.round(box.top);
        t.style.left = e + "px";
        t.style.top = n + "px";
        t.style.right = "auto";
        t.style.bottom = "auto";
      }
      const o = Math.max(2, Math.min(window.innerWidth - t.offsetWidth - 2, e)),
        r = Math.max(2, Math.min(window.innerHeight - t.offsetHeight - 2, n));
      if (o !== e) {
        t.style.left = o + "px";
      }
      if (r !== n) {
        t.style.top = r + "px";
      }
    }
    function createMtf() {
      if (!MTF_ENABLED) {
        return null;
      }
      let t = byId("__tcMTF");
      if (t) {
        return t;
      }
      const e = getMtfTfs();
      t = document.createElement("div");
      t.id = "__tcMTF";
      t._tcTfs = e;
      let n = "";
      for (let t = 0; t < e.length; t++) {
        n +=
          '<div class="tcMtfCell" data-tf="' +
          e[t] +
          '"><div class="tcMtfHd"><span class="tcMtfTf" style="color:' +
          srColour(e[t]) +
          "; background:" +
          srColour(e[t]) +
          "22; border-color:" +
          srColour(e[t]) +
          '55;" title="Put the chart on this timeframe">' +
          e[t] +
          '</span><span class="tcMtfSr" data-mtf="sr" title="Show or hide this timeframe\u2019s support and resistance">S/R</span><span class="tcMtfFlip"></span><span class="tcMtfCd" title="Time left on the bar now forming"></span><span class="tcMtfPct"></span></div><canvas class="tcMtfCv"></canvas><div class="tcMtfCap"></div></div>';
      }
      t.innerHTML =
        '<div class="tcMtfBar" data-mtf="drag"><span class="tcMtfPair" data-mtf="pair">—</span><span class="tcMtfViews"><button type="button" class="tcMtfViewBtn" data-mtf="view" data-view="charts" title="The charts for the pair you are on">Charts</button><button type="button" class="tcMtfViewBtn" data-mtf="view" data-view="scan" title="Every pair worth a look, nearest to a level first">Scan</button></span><button type="button" class="tcMtfSync" data-mtf="sync" aria-label="Refresh every timeframe" title="Visit each timeframe once and come back (blocked while a trade is open)">' +
        SYNC_ICON_SVG +
        '</button><span class="tcMtfGrip"></span></div>' +
        n +
        '<div class="tcMtfScan"><div class="tcMtfScanHdr"></div><div class="tcMtfScanList"></div><div class="tcMtfScanFoot"><span class="tcScanFootMsg"></span></div></div>' +
        ["e", "w", "n", "s", "ne", "nw", "se", "sw"]
          .map((t) => '<div class="tcMtfRz" data-rz="' + t + '"></div>')
          .join("");
      t.addEventListener("click", (ev) => {
        const hit = ev.target.closest("[data-mtf]");
        if (hit && hit.getAttribute("data-mtf") === "sync") {
          ev.preventDefault();
          // v1.56.1: one control, not two. The button has always meant "go and fetch candles"; what
          // changes between the views is the scope, and the view already states the scope. On the charts
          // it refreshes the pair in front of you; on the board, where you are explicitly looking across
          // pairs, it brings every open pair that has fallen behind up to date. Pressed again while that
          // is running, it stops.
          if (sweepState) {
            sweepState.stop = true;
            sweepFinish("stopped \u00b7 " + sweepState.done + " done");
          } else if (ev.currentTarget.classList.contains("tcMtfScanOn")) {
            startSweep();
          } else {
            runMtfSync();
          }
          return;
        }
        // v1.30.0: the timeframe label is the switch — click 5m and the platform chart goes to 5m, so
        // you can act on the cell you were just reading without going through their menu.
        const viewBtn = ev.target.closest('[data-mtf="view"]');
        if (viewBtn) {
          ev.preventDefault();
          setMtfView(viewBtn.getAttribute("data-view"));
          applyMtfView(ev.currentTarget);
          return;
        }
        const scanRow = ev.target.closest('[data-mtf="scanrow"]');
        if (scanRow) {
          ev.preventDefault();
          scanOpenPair(scanRow.getAttribute("data-sym"));
          return;
        }
        const srToggle = ev.target.closest('[data-mtf="sr"]');
        if (srToggle) {
          ev.preventDefault();
          const cell = srToggle.closest(".tcMtfCell");
          const tf = cell && cell.getAttribute("data-tf");
          if (tf) {
            setSrShown(tf, !srOn(tf));
            cell._tcSig = "";
            renderMtf(ev.currentTarget);
          }
          return;
        }
        const tfLabel = ev.target.closest(".tcMtfTf");
        if (tfLabel) {
          ev.preventDefault();
          switchChartTf(tfLabel.closest(".tcMtfCell"));
        }
      });
      (function (t) {
        let e = null,
          n = 0,
          o = 0,
          r = 0,
          a = 0,
          i = 0,
          c = 0;
        t.addEventListener("pointerdown", (s) => {
          const l = s.target.closest(".tcMtfRz");
          if (!l) {
            return;
          }
          e = l.getAttribute("data-rz");
          const d = t.getBoundingClientRect();
          n = s.clientX;
          o = s.clientY;
          r = d.width;
          i = d.left;
          c = d.top;
          a = parseFloat(getComputedStyle(t).getPropertyValue("--tc-mtf-cvh")) || 88;
          t.classList.add("tcMtfResizing");
          try {
            l.setPointerCapture(s.pointerId);
          } catch (t) {}
          s.preventDefault();
          s.stopPropagation();
        });
        t.addEventListener("pointermove", (s) => {
          if (!e) {
            return;
          }
          const l = s.clientX - n,
            d = s.clientY - o;
          let u = r,
            p = a;
          if (-1 !== e.indexOf("e")) {
            u = clampMtfWidth(r + l);
          }
          if (-1 !== e.indexOf("w")) {
            u = clampMtfWidth(r - l);
          }
          const m = t.querySelectorAll(".tcMtfCell").length || 1;
          if (-1 !== e.indexOf("s")) {
            p = clampMtfCanvasHeight(a + d / m);
          }
          if (-1 !== e.indexOf("n")) {
            p = clampMtfCanvasHeight(a - d / m);
          }
          applyMtfSize(t, {
            w: u,
            cvh: p,
          });
          if (-1 !== e.indexOf("w")) {
            t.style.left = i + (r - u) + "px";
            t.style.right = "auto";
          }
          if (-1 !== e.indexOf("n")) {
            t.style.top = c + "px";
            t.style.bottom = "auto";
          }
          renderMtf(t);
          s.preventDefault();
        });
        const s = () => {
          if (e) {
            e = null;
            t.classList.remove("tcMtfResizing");
            try {
              const e = parseFloat(getComputedStyle(t).getPropertyValue("--tc-mtf-cvh")) || 88;
              prefSet(
                KEY_MTF_SIZE,
                JSON.stringify({
                  w: clampMtfWidth(t.getBoundingClientRect().width),
                  cvh: clampMtfCanvasHeight(e),
                }),
              );
            } catch (t) {}
            clampToViewport(t);
          }
        };
        t.addEventListener("pointerup", s);
        t.addEventListener("pointercancel", s);
      })(t);
      attachMtfPan(t);
      attachMtfHover(t); // v1.40.0
      const o = t.querySelector('[data-mtf="drag"]');
      let r = false,
        a = 0,
        i = 0,
        c = 0,
        s = 0;
      const l = (e, n) => {
          r = true;
          const o = t.getBoundingClientRect();
          c = o.left;
          s = o.top;
          a = e;
          i = n;
        },
        d = (e, n) => {
          if (!r) {
            return;
          }
          let o = c + (e - a),
            l = s + (n - i);
          o = Math.max(2, Math.min(window.innerWidth - t.offsetWidth - 2, o));
          l = Math.max(2, Math.min(window.innerHeight - t.offsetHeight - 2, l));
          t.style.left = o + "px";
          t.style.top = l + "px";
          t.style.right = "auto";
          t.style.bottom = "auto";
        },
        u = () => {
          if (r) {
            r = false;
            try {
              prefSet(
                KEY_MTF_POS,
                JSON.stringify({
                  x: parseInt(t.style.left, 10),
                  y: parseInt(t.style.top, 10),
                }),
              );
            } catch (t) {}
          }
        },
        p = (t) => d(t.clientX, t.clientY),
        m = (t) => {
          if (r) {
            const e = t.touches[0];
            d(e.clientX, e.clientY);
            t.preventDefault();
          }
        };
      o.addEventListener("mousedown", (t) => {
        if (!t.target.closest("button")) {
          l(t.clientX, t.clientY);
          t.preventDefault();
        }
      });
      o.addEventListener(
        "touchstart",
        (t) => {
          if (t.target.closest("button")) {
            return;
          }
          const e = t.touches[0];
          l(e.clientX, e.clientY);
        },
        {
          passive: true,
        },
      );
      window.addEventListener("mousemove", p);
      window.addEventListener("touchmove", m, {
        passive: false,
      });
      window.addEventListener("mouseup", u);
      window.addEventListener("touchend", u);
      window.__tcMtfDrag = {
        onMouseMove: p,
        onTouchMove: m,
        end: u,
      };
      shadow.appendChild(t);
      if (panel && panel.classList && panel.classList.contains("tcLightMode")) {
        t.classList.add("tcLightMode");
      }
      applyMtfSize(
        t,
        (function () {
          try {
            const t = JSON.parse(prefGet(KEY_MTF_SIZE) || "null");
            if (t && typeof t.w == "number") {
              return {
                w: clampMtfWidth(t.w),
                cvh: clampMtfCanvasHeight(t.cvh),
              };
            }
          } catch (t) {}
          return null;
        })(),
      );
      try {
        const e = JSON.parse(prefGet(KEY_MTF_POS) || "null");
        if (e && typeof e.x == "number") {
          t.style.left = e.x + "px";
          t.style.top = e.y + "px";
          t.style.right = "auto";
          t.style.bottom = "auto";
          clampToViewport(t);
        }
      } catch (t) {}
      mtfLastPull = 0;
      applyMtfView(t);
      renderMtf(t);
      return t;
    }
    function destroyMtf() {
      const t = byId("__tcMTF");
      if (t) {
        t.remove();
      }
      if (window.__tcMtfDrag) {
        window.removeEventListener("mousemove", window.__tcMtfDrag.onMouseMove);
        window.removeEventListener("touchmove", window.__tcMtfDrag.onTouchMove);
        window.removeEventListener("mouseup", window.__tcMtfDrag.end);
        window.removeEventListener("touchend", window.__tcMtfDrag.end);
        delete window.__tcMtfDrag;
      }
    }
    function toggleMtf(t) {
      if (!MTF_ENABLED) {
        return;
      }
      const e = void 0 === t ? !byId("__tcMTF") : !!t;
      ((t, e) => {
        try {
          prefSet(t, e ? "1" : "0");
        } catch (t) {}
      })(KEY_MTF_ON, e);
      if (e) {
        createMtf();
      } else {
        destroyMtf();
        saveMtfCache(true);
      }
      const n = byId("__tcMtfToggle");
      if (n) {
        n.classList.toggle("tcImToggleOff", !e);
      }
    }
    function rebuildMtf() {
      if (byId("__tcMTF")) {
        destroyMtf();
        createMtf();
      }
    }
    let mtfSyncBusy = false;
    every(200, () => {
      // The tab-title countdown stays live in background tabs (that's where it's read). Everything
      // else here only paints the page, so it's skipped while the tab is hidden (v1.23.0).
      const hidden = document.hidden;
      !(function () {
        if (hidden) {
          return;
        }
        if (!balanceEl) {
          return;
        }
        const t = balanceEl._tcLiveTag;
        if (!t || !t._tcWasActive) {
          return;
        }
        const e = readAccountBalance();
        if (isNaN(e)) {
          return;
        }
        const n = fmtMoney(e + sumOpenPnl());
        if (t._tcVal !== n) {
          t._tcVal = n;
          t.textContent = n;
        }
      })();
      if (lastReqInputs && !hidden) {
        renderReq(
          false,
          lastReqInputs.nSettled,
          computeReqWithOpenTrades(lastReqInputs),
          lastReqInputs.isAlert,
        );
      }
      (function () {
        const t = getOpenTradePnlEls();
        let e = false,
          n = false;
        if (!t.length) {
          const flags = storeOutcomeFlags();
          if (flags) {
            e = flags[0];
            n = flags[1];
          }
        }
        for (let o = 0, r = t.length; o < r; o++) {
          const r = t[o].textContent.trim();
          if (r.startsWith("+")) {
            e = true;
          } else if (r.startsWith("0")) {
            n = true;
          }
          if (e && n) {
            break;
          }
        }
        updateTabTitle(e, n);
      })();
      if (hidden) {
        return;
      }
      renderTradeTimers();
      (function () {
        const t = byId("__tcMTF");
        if (!t) {
          // v1.70.2: the pair is only read, and the auto-fill only runs, while the charts are open. Closed
          // since the page loaded, the label used to stay on "starting up" for good; it says why instead.
          mtfAutofillReason = mtfAutofill ? "charts are hidden (press C)" : "switched off in the ⚙ menu";
          return;
        }
        const e = Date.now();
        if (e - mtfLastPull >= 300) {
          mtfLastPull = e;
          pullChartSnapshot();
        }
        renderMtf(t);
        if (t.classList.contains("tcMtfScanOn") && e - mtfScanAt >= SCAN_EVERY_MS) {
          mtfScanAt = e;
          renderMtfScan(t);
        }
        maybeAutofillMtf();
      })();
    });
    // v1.31.2: a diagnostics line in the site's own storage. The health check lives in the popup, which
    // can only be read by whoever is sitting at the browser — no help when the panel is misbehaving in a
    // tab someone else has to reason about. This writes the same facts where any tab on the same address
    // (quotex.com or qxbroker.com - each keeps its own storage) can read them back: which build is running, the pair, what the auto-fill is waiting for, and the chart's
    // timeframe. Only the foreground tab writes, so it always describes the tab actually being watched.
    every(2000, () => {
      if (document.hidden) {
        return;
      }
      try {
        prefSet(
          KEY_DIAG,
          JSON.stringify({
            build: BUILD_VERSION,
            at: Date.now(),
            pair: mtfSymbol || null,
            chartSec: mtfChartSec || 0,
            autofill: mtfAutofill ? mtfAutofillReason : "switched off in the \u2699 menu",
            openTrades: openTradeCount(),
            // v1.59.1: whether the account label was found and rewritten. Every conclusion about this so
            // far came from an automated tab whose page never finished loading, which is no evidence at
            // all about the tab actually in front of someone.
            bar: barAnchor,
            assetList: assetListDiag(),
            historyRow: historyRowDiag(),
            assetLog: assetLogDiag(),
            candleTimer: (() => {
              try {
                return candleTimerProbe();
              } catch (err) {
                return "probe failed: " + (err && err.message ? err.message : err);
              }
            })(),
            demoCover: demoCoverState,
            tradeClock: (() => {
              try {
                return tradeClockProbe();
              } catch (err) {
                return "probe failed: " + (err && err.message ? err.message : err);
              }
            })(),
            accountBlock: (() => {
              try {
                return typeof document.elementsFromPoint === "function" ? accountBlockProbe() : "no elementsFromPoint";
              } catch (err) {
                return "probe failed: " + (err && err.message ? err.message : err);
              }
            })(),
            relabel: (() => {
              const ours = document.querySelectorAll("[data-tc-relabel]").length;
              return ours ? "rewritten \u00b7 " + ours : "nothing matched";
            })(),
            // v1.54.1: the payout floor and what it is looking at. "Should a pair have been opened?" is
            // not answerable from another tab without the numbers the decision was made on.
            floor: parseInt(getMinPayoutStored(), 10),
            pairs: (() => {
              const out = {};
              getPairTabs().forEach((tab) => {
                const name = getTabName(tab) || tab.getAttribute("data-symbol") || "?";
                const pct = tabPayout(tab);
                out[name] = isNaN(pct) ? null : pct;
              });
              return out;
            })(),
            autoOpen: autoOpenReason,
            // v1.60.0: which view the panel is on, because the refresh button's scope depends on it.
            view: getMtfView(),
            sweep: sweepState
              ? "running · " +
                sweepState.done +
                " of " +
                sweepState.list.length +
                (sweepState.at ? " · at " + sweepState.at : "")
              : sweepNote
                ? sweepNote + " · " + fmtAgo(Math.round((Date.now() - sweepNoteAt) / 1000))
                : "idle",
            // Seconds behind per open pair, by the same measure the sweep picks its targets with. A number
            // over 90 is what the sweep exists to bring down; null means no candles are held at all.
            stale: (() => {
              const now = Math.floor(Date.now() / 1000),
                out = {};
              getPairTabs().forEach((tab) => {
                const sym = symbolOfTab(tab);
                if (!sym) {
                  return;
                }
                const age = pairBehindSec(sym, now);
                out[getTabName(tab) || sym] = isFinite(age) ? Math.round(age) : null;
              });
              return out;
            })(),
            // v1.54.0: the win projection has been covered by a test since v1.34.0 and never once seen on
            // a live page - it only draws while a trade is running, which an automated tab cannot produce
            // (document.hidden pauses the render loop). Reporting what the chip holds turns "has it ever
            // rendered?" into one read of this line, from any tab.
            projChip: (() => {
              const chip = byId(ids.tcProjChip);
              if (!chip || chip.style.display !== "block") {
                return "hidden";
              }
              return (chip.textContent || "").replace(/\s+/g, " ").trim();
            })(),
            charts: byId("__tcMTF") ? (byId("__tcMTF")._tcTfs || getMtfTfs()).join(",") : "hidden",
            // v1.50.1: what each chart is actually showing - the zoom it is on, how many candles it has
            // to draw from, where it has been dragged to, and whether it is at the live edge. Reported
            // because "zoom and pan are not working" cannot be told apart from "this pair has less
            // history" without it.
            cells: (() => {
              const panel = byId("__tcMTF");
              if (!panel) {
                return null;
              }
              const out = {};
              panel.querySelectorAll(".tcMtfCell").forEach((cell) => {
                const tf = cell.getAttribute("data-tf");
                out[tf] = {
                  zoom: cellCount(cell),
                  have: cell._tcRows ? cell._tcRows.length : 0,
                  drawn: cell._tcDrawn ? cell._tcDrawn.length : 0,
                  pannedTo: cell._tcPanEndT || null,
                  atLive: !cell._tcPanEndT,
                  canPan: !cell._tcNoPan,
                };
              });
              return out;
            })(),
          }),
        );
      } catch (t) {}
    });
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Layout mode switch, startup, popup message handling
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // v1.83.0: the mobile bar is gone - a narrow window keeps the main panel - so a resize only re-fits the charts.
    window.__tcLayoutResize = () => clampToViewport(byId("__tcMTF"));
    window.addEventListener("resize", window.__tcLayoutResize);
    (function () {
      const t = readJson(KEY_MTF_CACHE, null);
      if (!t) {
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const fresh = (entries) => {
        const out = {};
        for (const key in entries || {}) {
          const e = entries[key];
          if (e && e.candles && e.candles.length && now - (e.capturedAt || 0) <= 1800) {
            out[key] = e;
          }
        }
        return out;
      };
      // v2 keeps several pairs; v1 (one pair) is still read so nothing is lost on upgrade.
      const bySymbol = t.v === 2 && t.symbols ? t.symbols : t.symbol && t.entries ? { [t.symbol]: t.entries } : null;
      if (!bySymbol) {
        return;
      }
      for (const sym in bySymbol) {
        const entries = fresh(bySymbol[sym]);
        if (Object.keys(entries).length) {
          mtfArchive[sym] = entries;
        }
      }
      trimMtfArchive();
      // The first snapshot picks the live pair out of the archive.
      const first = t.v === 2 ? null : t.symbol;
      if (first && mtfArchive[first]) {
        mtfEntries = mtfArchive[first];
        delete mtfArchive[first];
        mtfSymbol = first;
      }
    })();
    if (readFlag(KEY_MTF_ON, false)) {
      createMtf();
      const t = byId("__tcMtfToggle");
      if (t) {
        t.classList.remove("tcImToggleOff");
      }
    }
    panelPos.x = panelPos.tx;
    panelPos.y = panelPos.ty;
    if (!panelPos.isAbsolute) {
      panel.style.transform = `translate3d(${panelPos.x}px, ${panelPos.y}px, 0)`;
    }
    recalc();
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Health report (v1.22.0): what the panel can read from the current Quotex build, and how.
    // status: "ok" (hashed class or store works) · "fallback" (learned / semantic / heuristic) · "missing"
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    function buildHealthReport() {
      const rows = [];
      const tidy = (v) => (typeof v == "number" && isFinite(v) ? String(Math.round(v * 100) / 100) : String(v));
      const add = (name, status, via, value) => rows.push({ name, status, via, value: value == null ? "" : tidy(value) });
      const state = requestQuotexState(false);
      add("Store bridge (chart_reader.js)", state ? "ok" : "missing", state ? "store" : "none", state ? state.symbol : "chart not found");
      // v1.81.0: Quotex's data fields - all where their names say, or which were found by shape, or which are
      // missing (read by name only, so a rename there shows here rather than as a wrong number).
      if (state && state.fields) {
        const notes = Object.entries(state.fields);
        const missing = notes.filter(([, how]) => how === "missing").map(([k]) => k),
          shaped = notes.filter(([, how]) => how !== "missing").map(([k, how]) => k + " " + how);
        add(
          "Quotex data fields",
          missing.length ? "missing" : shaped.length ? "fallback" : "ok",
          missing.length ? "renamed by Quotex?" : shaped.length ? "by shape" : "by name",
          [missing.length ? "missing: " + missing.join(", ") : "", shaped.join(" · ")].filter(Boolean).join(" · ") || "all found",
        );
      }
      const elementTargets = [
        ["balance", "Balance"],
        ["returnPct", "Payout % element"],
        ["payoutTotal", "Payout amount"],
        ["tradeButtons", "Up/Down buttons"],
        ["amountInput", "Investment field"],
        ["chartCanvas", "Chart canvas"],
      ];
      for (const [key, label] of elementTargets) {
        const el = findEl(key, { cache: false });
        const via = selectorVia[key] || "missing";
        // The balance element went into a closed component in Quotex's 2026-09-23 build. Its absence is
        // not a fault while the store answers, and reporting it as one sends the next reader hunting for
        // a class that no longer exists.
        if (key === "balance" && !el && !isNaN(storeBalance())) {
          add(label, "idle", "closed component \u2014 read from the store", "not in the page");
          continue;
        }
        const status = !el ? "missing" : via === "class" ? "ok" : "fallback";
        // v1.84.0: an input's value and a canvas's size, not "input" / "canvas".
        const shown = !el
          ? ""
          : el.tagName === "INPUT"
            ? el.value
            : el.tagName === "CANVAS"
              ? el.width + "\u00d7" + el.height
              : textOf(el).slice(0, 24) || el.tagName.toLowerCase();
        add(label, status, via === "learned" ? "learned " + learnedSelectors[key].sel : via, shown);
      }
      // v1.57.0: the element and the number are now separate questions. Quotex's account block is a
      // closed custom element, so "no balance element" is the expected state rather than a fault - what
      // matters is whether the figure itself arrived.
      const balanceFromStore = storeBalance(),
        balance = readAccountBalance(),
        balanceVia = !isNaN(balanceFromStore) ? "store" : isNaN(balance) ? "missing" : "page";
      add(
        "Balance value",
        isNaN(balance) ? "missing" : "ok",
        balanceVia,
        isNaN(balance) ? "" : balance,
      );
      const payoutEl = findEl("returnPct", { cache: false });
      const payoutShown = payoutEl ? parsePct(payoutEl.textContent) : NaN;
      const payoutStore = state && state.payout != null ? state.payout : NaN;
      add(
        "Payout % value",
        !isNaN(payoutShown) ? "ok" : !isNaN(payoutStore) ? "fallback" : "missing",
        !isNaN(payoutShown) ? "page" : "store",
        (isNaN(payoutShown) ? "—" : payoutShown + "%") + " page · " + (isNaN(payoutStore) ? "—" : payoutStore + "%") + " store",
      );
      const stake = readInvestmentFromStakeInput();
      add("Stake", isNaN(stake) ? "missing" : "ok", "page", isNaN(stake) ? "" : stake);
      const tabs = getPairTabs();
      add("Pair tabs", !tabs.length ? "missing" : pairTabsVia === "class" ? "ok" : "fallback", pairTabsVia, tabs.length + " open");
      const closeBtns = tabs.filter((tab) => getTabCloseBtn(tab)).length;
      add("Tab close buttons", tabs.length && closeBtns === tabs.length ? "ok" : closeBtns ? "fallback" : "missing", "page", closeBtns + " of " + tabs.length);
      // v1.87.0: each tab's payout - what auto-close and the refill decide on - and how it was read: by its
      // known name, from Quotex's data, or (with both gone) from the percent the tab itself prints.
      const payVia = tabs.map((tab) => (isNaN(tabPayout(tab)) ? "missing" : tabPayoutVia));
      const payRead = payVia.filter((v) => v !== "missing"),
        payHow = Array.from(new Set(payRead)).join(", ");
      add(
        "Tab payouts",
        !tabs.length || payRead.length < tabs.length ? "missing" : payRead.every((v) => v === "class") ? "ok" : "fallback",
        payHow || "none",
        payRead.length + " of " + tabs.length + " read",
      );
      const domOpen = getOpenTradePnlEls().length;
      const storeOpen = storeOpenTradeCount();
      // v1.84.1: one number - Quotex's own when it answers - and the page's beside it only when they differ.
      add(
        "Open trades",
        isNaN(storeOpen) && !domOpen ? "fallback" : "ok",
        isNaN(storeOpen) ? "page" : "store",
        (isNaN(storeOpen) ? domOpen : storeOpen) + " open" + (!isNaN(storeOpen) && domOpen !== storeOpen ? " · " + domOpen + " on the page" : ""),
      );
      // Lists (v1.25.0). A menu that isn't open right now can't be checked; that's "not open", not broken.
      // v1.83.0: Quotex's data decides when it answers, as it does for MAX and the chips. Read live on 1.81.0,
      // a settled row in the trade history made this say "1 open" with nothing running.
      const openRows = getOpenTradeRows();
      const storeTrades = storeOpenTrades();
      const openCount = storeTrades ? storeTrades.length : openRows.length;
      const pageNote = storeTrades && openRows.length !== storeTrades.length ? " · " + openRows.length + " on the page" : "";
      add(
        "Open trades list",
        !openCount ? "idle" : storeTrades ? "ok" : listVia.openTradeRows === "class" ? "ok" : "fallback",
        storeTrades ? "store" : openRows.length ? listVia.openTradeRows || "page" : "none",
        (openCount ? openCount + " open" : "no open trades") + pageNote,
      );
      add("Trade timers", !openCount ? "idle" : "ok", storeTrades ? timersVia : "page", openCount ? openCount + " tracked" : "no open trades");
      const dropdown = getAssetDropdown();
      const assetRows = dropdown ? getAssetRows(dropdown) : [];
      add(
        "Asset list rows",
        !dropdown ? "idle" : assetRows.length ? (listVia.assetRows === "class" ? "ok" : "fallback") : "missing",
        dropdown ? listVia.assetRows || "heuristic" : "not open",
        dropdown ? assetRows.length + " rows" : "not open",
      );
      // v1.84.0: the button that opens the timeframe menu (S/D, the chart auto-fill) - looked up afresh here,
      // by its known name, then a remembered one, then as the lone timeframe label on the page.
      const tfKnown = Array.from(document.querySelectorAll(".HgaSf"));
      const tfBtn = tfKnown.find((b) => TF_LABEL_RE.test(textOf(b))) || tfKnown[0] || findEl("timeframeCTA", { cache: false });
      const tfVia = tfKnown.length ? "class" : selectorVia.timeframeCTA || "missing";
      add(
        "Timeframe button",
        !tfBtn ? "missing" : tfVia === "class" ? "ok" : "fallback",
        tfVia === "learned" && learnedSelectors.timeframeCTA ? "learned " + learnedSelectors.timeframeCTA.sel : tfVia,
        tfBtn ? textOf(tfBtn).slice(0, 12) || tfBtn.tagName.toLowerCase() : "",
      );
      // v1.84.0: the expiry box and its Time / Timer switch - what T presses.
      const expBox = findEl("expiryBox", { cache: false }),
        expBoxVia = selectorVia.expiryBox || "missing";
      const expInput = expBox && expBox.querySelector("input");
      add(
        "Expiry box",
        !expBox ? "missing" : expBoxVia === "class" ? "ok" : "fallback",
        expBoxVia === "learned" && learnedSelectors.expiryBox ? "learned " + learnedSelectors.expiryBox.sel : expBoxVia,
        expInput ? expInput.value : expBox ? "no time shown" : "",
      );
      const expSwitchKnown = expBox && expBox.querySelector(".EWNJc");
      const expSwitch = expSwitchKnown || (expBox ? findEl("expiryToggle", { cache: false }) : null);
      const expSwitchVia = expSwitchKnown ? "class" : selectorVia.expiryToggle || "missing";
      add(
        "Expiry switch (T)",
        !expSwitch ? "missing" : expSwitchVia === "class" ? "ok" : "fallback",
        expSwitchVia,
        expSwitch ? (isExpiryTimerMode() ? "on Timer" : "on Time") : "",
      );
      const tfItems = getTimeframeItems();
      add(
        "Timeframe menu",
        tfItems.length ? (listVia.timeframeItems === "class" ? "ok" : "fallback") : "idle",
        tfItems.length ? listVia.timeframeItems : "not open",
        tfItems.length ? tfItems.length + " items" : "not open",
      );
      const expiryItems = getExpiryTimeItems(getExpiryBox() || document);
      add(
        "Expiry times",
        expiryItems.length ? (listVia.expiryTimes === "class" ? "ok" : "fallback") : "idle",
        expiryItems.length ? listVia.expiryTimes : "not open",
        expiryItems.length ? expiryItems.length + " items" : "not open",
      );
      add("Currency", state && state.currency ? "ok" : "fallback", state && state.currency ? "store" : "page", detectCurrency());
      add(
        "Charts auto-fill",
        // v1.70.3: closed charts are "nothing to check right now" (–), not a fallback (🔁) - 🔁 means Quotex
        // changed something.
        !mtfAutofill || !byId("__tcMTF") ? "idle" : /^(ready|filling|filled)/.test(mtfAutofillReason) ? "ok" : "fallback",
        byId("__tcMTF") ? "charts open" : "charts hidden",
        mtfAutofillReason,
      );
      const version =
        typeof chrome != "undefined" && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : "";
      return { version, build: BUILD_VERSION, url: location.pathname, rows };
    }
    function safeHealthReport() {
      try {
        return buildHealthReport();
      } catch (err) {
        return { error: String(err && err.message ? err.message : err), rows: [] };
      }
    }
    if (typeof chrome != "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      // Kept on window so cleanup can remove it (hotfix v1.20.1): otherwise a torn-down panel's
      // listener stays registered and answers the popup's GET_STATE with stale values after a relaunch.
      window.__tcMsgListener = (t, e, n) => {
        // v1.70.0: the popup is gone - its settings are in the ⚙ menu - so GET_STATE and SET_MTF went with it.
        if (t.type === "SET_OTC_AUTO") {
          otcAuto = !!t.enabled;
          setOtcAutoStored(otcAuto);
        } else if (t.type === "SET_TIMER_POS") {
          if (typeof t.x == "number") {
            timerX = clampPercent(t.x, 50);
            setTimerXStored(timerX);
          }
          if (typeof t.y == "number") {
            timerY = clampPercent(t.y, 90);
            setTimerYStored(timerY);
          }
        } else if (t.type === "GET_HEALTH") {
          n(safeHealthReport());
        }
        var o;
        return true;
      };
      chrome.runtime.onMessage.addListener(window.__tcMsgListener);
    }
  };
  // ────────────────────────────────────────────────────────────────────────────────────────────────
  // Launcher: first start, SPA URL changes, TOGGLE_PANEL from the toolbar icon
  // ────────────────────────────────────────────────────────────────────────────────────────────────
  //
  // Hotfix v1.20.1: "is the panel running?" used to be `document.getElementById("__tradeCalc")`, but
  // the panel lives in a CLOSED shadow root, so that was always null. Every in-app URL change then
  // called _tc() while the panel existed, and _tc() toggles an existing panel OFF, silently removing
  // the SL / payout / trade-cap guards (the next URL change toggled it back on). `window.__tcCleanup`
  // (isolated world, set only while the panel exists) is the reliable signal.
  function _tcIsTradePage() {
    return TRADE_PATH_RE.test(location.pathname);
  }
  function _tcIsRunning() {
    return typeof window.__tcCleanup === "function";
  }
  // Set when the user turns the panel off from the toolbar icon, so navigation doesn't bring it back.
  var _tcUserClosed = false;
  function _tcLaunch() {
    if (!document.body) {
      setTimeout(_tcLaunch, 400);
      return;
    }
    if (_tcIsTradePage() && !_tcIsRunning() && !_tcUserClosed) {
      _tc();
    }
  }
  // URL watcher (v1.23.0): a 250 ms poll plus popstate, instead of a MutationObserver on the whole
  // document that woke on every DOM change just to compare location.href. An isolated-world script can't
  // see the page's history.pushState calls, so polling is the cheap reliable option.
  var _tcLastUrl = location.href;
  function _tcCheckUrl() {
    var u = location.href;
    if (u === _tcLastUrl) {
      return;
    }
    _tcLastUrl = u;
    if (_tcIsTradePage()) {
      _tcLaunch();
    } else if (_tcIsRunning()) {
      window.__tcCleanup();
    }
  }
  setInterval(_tcCheckUrl, 250);
  window.addEventListener("popstate", _tcCheckUrl);
  // v1.69.0: a deposit scan is started from the ⚙ menu but walks the Balance page, where the panel does not
  // run. The service worker tells each page it lands on, and this pill says where it is and offers Stop.
  // Same cover as the panel: one plain host, a closed root, inline styles.
  var _tcScanPill = null;
  function _tcShowScanPill(page) {
    if (!document.body) {
      return;
    }
    if (!_tcScanPill || !_tcScanPill.host.isConnected) {
      var host = document.createElement("div"),
        root = host.attachShadow({ mode: "closed" }),
        box = document.createElement("div"),
        text = document.createElement("span"),
        stop = document.createElement("button");
      box.style.cssText =
        "position:fixed;right:24px;bottom:24px;z-index:2147483647;display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:999px;background:#262529;color:#e6e0e9;border:1px solid #48464c;box-shadow:0 4px 16px rgba(0,0,0,.4);font:600 13px system-ui,sans-serif;";
      stop.type = "button";
      stop.textContent = "Stop";
      stop.style.cssText =
        "all:unset;cursor:pointer;padding:4px 12px;border-radius:999px;background:#d0bcff;color:#381e72;font:700 12px system-ui,sans-serif;";
      stop.addEventListener("click", function () {
        stop.disabled = true;
        stop.textContent = "Stopping…";
        try {
          var r = chrome.runtime.sendMessage({ type: "DEPOSIT_SCAN_STOP" });
          if (r && typeof r.catch === "function") {
            r.catch(function () {});
          }
        } catch (e) {}
      });
      box.append(text, stop);
      root.appendChild(box);
      document.body.appendChild(host);
      _tcScanPill = { host: host, text: text };
    }
    _tcScanPill.text.textContent = "Scanning deposits · page " + page;
  }
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg.type === "DEPOSIT_SCAN_STATUS") {
        _tcShowScanPill(msg.page);
      } else if (msg.type === "TOGGLE_PANEL") {
        if (!_tcIsTradePage() && !_tcIsRunning()) {
          return;
        }
        _tcUserClosed = _tcIsRunning();
        _tc();
      }
    });
  }
  setTimeout(_tcLaunch, 800);
})();
