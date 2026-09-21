/*
 * QXTradeLens Controller: content script (panel on qxbroker.com trade pages)
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
      delete window.__tcJournalEsc;
      delete window.__tcKeyDelegator;
      delete window.__tcTradeBlocker;
      delete window.__tcAudioUnlock;
      if (window.__tcSLBlocker) {
        document.removeEventListener("click", window.__tcSLBlocker, {
          capture: true,
        });
        document.removeEventListener("keydown", window.__tcSLBlocker, {
          capture: true,
        });
        delete window.__tcSLBlocker;
      }
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
      delete window.__tcSLBreachNotified;
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
      const t = byId("__tcMarquee");
      if (t) {
        t.remove();
      }
      const e = byId("__tcDangerOverlay");
      if (e) {
        e.remove();
      }
      const n = byId("__tcJournalModal");
      if (n) {
        n.remove();
      }
      const o = byId("__tradeCalc");
      if (o) {
        o.remove();
      }
      const r = byId("__tcRestoreBtn");
      if (r) {
        r.remove();
      }
      const i = byId("__tcMobileBar");
      if (i) {
        i.remove();
      }
      if (window.__tcMobileResize) {
        window.removeEventListener("resize", window.__tcMobileResize);
        delete window.__tcMobileResize;
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
      const m = byId("__tcInvestMult");
      if (m) {
        m.remove();
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
        assetRow: [".vPvlJ", ".R2Rgm", ".fZEV1"],
        assetRowName: [".e4qZ6 span", ".Z2fyK", ".pC7xL"],
        assetRowPayout: [".mQX6T span", ".bQodW span", ".dkV9n span"],
        assetRowClick: [".e4qZ6", ".vPvlJ"],
        investmentBtns: [".deal-amount-input .VK9Nw", ".deal-amount-input .YqVwL"],
        amountInput: [".deal-amount-input input.input-control__input", "input.input-control__input"],
        tabClose: [".LtauB", ".rGA6o"],
        chartClose: ["#graph canvas", "canvas.layer.plot", "#graph"],
        chartCanvas: ["#graph canvas.layer.plot", "#graph canvas", "#graph"],
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
    const SEMANTIC_FINDERS = {
      // The balance sits next to the "Live Account" / "Demo Account" label.
      balance: () => {
        const label = Array.from(document.querySelectorAll("div")).find(
          (d) => d.children.length === 0 && /^(Live|Demo) Account$/.test(textOf(d)),
        );
        if (label && label.nextElementSibling) {
          return label.nextElementSibling;
        }
        // Any site language (v1.24.0): a money value ("₹15,228.00") right after a short text label
        // near the top of the page, which is the account block's shape.
        return (
          Array.from(document.querySelectorAll("div")).find((d) => {
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
        const tab = document.getElementById("tab-active");
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
        const trade = document.getElementById("trade-button");
        for (let el = trade && trade.previousElementSibling; el; el = el.previousElementSibling) {
          const b = el.querySelector(":scope > b");
          if (b && el.querySelector(":scope > p") && /\d/.test(textOf(b))) {
            return b;
          }
        }
        return null;
      },
      tradeButtons: () => document.querySelector("#trade-button button"),
      amountInput: () => {
        const legend = Array.from(document.querySelectorAll("legend")).find((el) => textOf(el).toLowerCase() === "investment");
        const field = legend && legend.closest("fieldset");
        return (field && field.querySelector("input")) || document.querySelector(".deal-amount-input input");
      },
      chartCanvas: () => document.querySelector("#graph canvas") || document.getElementById("graph"),
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
    // symbol -> { label, payout, isOtc, active }, refreshed every 5 s.
    function readQuotexAssets() {
      const now = Date.now();
      if (now - quotexAssetsAt >= ASSETS_TTL_MS) {
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
    function storeOpenTrades() {
      const state = readQuotexState();
      if (!state || !Array.isArray(state.openedDeals)) {
        return null;
      }
      const quotes = state.quotes || {};
      const assets = readQuotexAssets() || {};
      const nowSec = Date.now() / 1000;
      return dealsForThisAccount(state.openedDeals).map((d) => {
        const price = quotes[d.asset];
        const isUp = d.command === 0;
        const winning =
          price == null || d.openPrice == null ? null : isUp ? price > d.openPrice : price < d.openPrice;
        const pct = d.percentProfit;
        return {
          id: d.id,
          symbol: d.asset,
          pair: (assets[d.asset] && assets[d.asset].label) || d.asset || "",
          amount: d.amount,
          secondsLeft: d.closeTimestamp ? Math.max(0, Math.round(d.closeTimestamp - nowSec)) : NaN,
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
    function getPairTabsBySymbol() {
      const active = document.getElementById("tab-active");
      if (!active || !active.hasAttribute("data-symbol")) {
        return [];
      }
      let best = [active];
      let scope = active.parentElement;
      for (let i = 0; i < 3 && scope; i++, scope = scope.parentElement) {
        const found = Array.from(scope.querySelectorAll("[data-symbol]"));
        if (found.length > best.length) {
          best = found;
        }
      }
      return best;
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
      if (t.id && t.id !== "tab-active") {
        return t.id;
      }
      const n = (t.textContent || "").match(/[A-Z]{3}\/[A-Z]{3}/);
      return n ? n[0] + (t.textContent.includes("OTC") ? " (OTC)" : "") : "";
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
      e = ".deal-amount-input input.input-control__input";
      stakeInputCache = (t = stakeInputCache) && t.isConnected ? t : document.querySelector(e);
      if (!stakeInputCache) {
        stakeInputCache = document.querySelector("input.input-control__input");
      }
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
      let el = document.querySelector(".deal-amount-input input");
      if (!el) {
        const legend = Array.from(document.querySelectorAll("legend")).find(
          (node) => (node.textContent || "").trim().toLowerCase() === "investment",
        );
        const field = legend && legend.closest("fieldset");
        el = field && field.querySelector("input");
      }
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
      KEY_VISIBILITY = "__tradeCalc_visibility",
      KEY_SHEET_URL = "__tradeCalc_sheet_url",
      KEY_SL_VALUE = "__tradeCalc_sl_value",
      KEY_SL_DATE = "__tradeCalc_sl_date",
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
      getMtfCount = () => {
        try {
          return clampMtfCount(prefGet(KEY_MTF_COUNT));
        } catch (t) {
          return 40;
        }
      },
      setMtfCount = (t) => {
        try {
          prefSet(KEY_MTF_COUNT, String(clampMtfCount(t)));
        } catch (t) {}
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
      fmtInputMoney = (t) => {
        const e = parseFloat(t);
        return isNaN(e) ? "" : fmtMoney(e);
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
      KEY_JOURNAL_FONT_SIZE = "__tradeCalc_journal_fz",
      getJournalFontSizeStored = () => {
        try {
          return prefGet(KEY_JOURNAL_FONT_SIZE) || "20";
        } catch (t) {
          return "20";
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
      KEY_SL_INIT_BAL = "__tradeCalc_sl_init_bal",
      KEY_POST_TP_GAP = "__tradeCalc_sl_post_tp_gap",
      clampPostTpGap = (t) => {
        const e = parseFloat(t);
        return isNaN(e) ? 5 : Math.min(15, Math.max(1, e));
      },
      setPostTpGapStored = (t) => {
        try {
          prefSet(KEY_POST_TP_GAP, String(clampPostTpGap(t)));
        } catch (t) {}
      },
      KEY_SYS_LOCK_DISABLED = "__tradeCalc_sys_lock_disabled",
      setSysLockDisabledStored = (t) => {
        try {
          prefSet(KEY_SYS_LOCK_DISABLED, t ? "1" : "0");
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
    const KEY_CHIP_POS = "__tradeCalc_chip_pos",
      normChipPos = (t) => (t === "center" || t === "anchored" ? t : "cursor"),
      setChipPosStored = (t) => {
        try {
          prefSet(KEY_CHIP_POS, normChipPos(t));
        } catch (t) {}
      };
    let chipPos = (() => {
      try {
        return normChipPos(prefGet(KEY_CHIP_POS));
      } catch (t) {
        return "cursor";
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
      KEY_HK_LEFTRIGHT = "__tradeCalc_hk_leftright",
      setHkUpDownStored = (t) => {
        try {
          prefSet(KEY_HK_UPDOWN, t ? "true" : "false");
        } catch (t) {}
      },
      setHkLeftRightStored = (t) => {
        try {
          prefSet(KEY_HK_LEFTRIGHT, t ? "true" : "false");
        } catch (t) {}
      };
    let hkUpDown = (() => {
        try {
          return prefGet(KEY_HK_UPDOWN) === "true";
        } catch (t) {
          return false;
        }
      })(),
      hkLeftRight = (() => {
        try {
          return prefGet(KEY_HK_LEFTRIGHT) === "true";
        } catch (t) {
          return false;
        }
      })();
    const KEY_MARQUEE_MSG = "__tradeCalc_marquee_msg",
      setMarqueeMsgStored = (t) => {
        try {
          prefSet(KEY_MARQUEE_MSG, t || "");
        } catch (t) {}
      };
    let marqueeMsg = (() => {
      try {
        return prefGet(KEY_MARQUEE_MSG) || "";
      } catch (t) {
        return "";
      }
    })();
    const KEY_MARQUEE_SPEED = "__tradeCalc_marquee_speed",
      clampMarqueeSpeed = (t) => {
        const e = parseFloat(t);
        return isNaN(e) ? 5 : Math.max(1, Math.min(10, Math.round(e)));
      },
      setMarqueeSpeedStored = (t) => {
        try {
          prefSet(KEY_MARQUEE_SPEED, String(clampMarqueeSpeed(t)));
        } catch (t) {}
      };
    let marqueeSpeed = (() => {
      try {
        return clampMarqueeSpeed(prefGet(KEY_MARQUEE_SPEED));
      } catch (t) {
        return 5;
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
    const KEY_BAL_LOGGED_DATE = "__tradeCalc_bal_logged_date",
      KEY_NATIVE_LIMIT_LOCK_DATE = "__tradeCalc_native_limit_lock_date",
      KEY_STEP_MULT = "__tradeCalc_step_mult",
      getStepMult = () => {
        try {
          return parseFloat(prefGet(KEY_STEP_MULT) || "1") || 1;
        } catch (t) {
          return 1;
        }
      },
      setStepMult = (t) => {
        try {
          prefSet(KEY_STEP_MULT, String(t));
        } catch (t) {}
      },
      saveVisibilityStored = (t) => {
        try {
          prefSet(KEY_VISIBILITY, JSON.stringify(t.slice(0, 4).map((t) => (t ? 1 : 0))));
        } catch (t) {}
      },
      setSheetUrlStored = (t) => {
        try {
          if (t) {
            prefSet(KEY_SHEET_URL, t);
          } else {
            prefRemove(KEY_SHEET_URL);
          }
        } catch (t) {}
      },
      KEY_LOSS_STREAK = "__tradeCalc_loss_streak",
      KEY_SEEN_TRADES = "__tradeCalc_seen_trades",
      KEY_STREAK_DATE = "__tradeCalc_streak_date",
      KEY_LAST_LOSS_TS = "__tradeCalc_last_loss_ts",
      setLossStreakStored = (t) => {
        try {
          prefSet(KEY_LOSS_STREAK, String(0 | t));
        } catch (t) {}
      },
      setLastLossTsStored = (t) => {
        try {
          prefSet(KEY_LAST_LOSS_TS, String(Math.floor(t) || 0));
        } catch (t) {}
      };
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Account label spoof: rewrites "Live Account" as "Demo Account" everywhere
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const KEY_RELABEL_DEMO = "__tradeCalc_relabel_demo",
      KEY_ENTRY_TAGS = "__tradeCalc_entry_tags";
    const KEY_HK_FOCUS_MODE = "__tradeCalc_hk_focus_mode";
    // Off by default: ↑/↓ keep placing the trade directly.
    let hkFocusMode = readFlag(KEY_HK_FOCUS_MODE, false);
    // v1.30.0: fill a pair's empty charts once, by itself. On by default; one switch in the popup.
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
    let relabelDemo = readFlag(KEY_RELABEL_DEMO, true),
      entryTagsOn = readFlag(KEY_ENTRY_TAGS, true);
    // Restores the platform's own label when the switch is turned off.
    function undoRelabel() {
      document.querySelectorAll("[data-tc-relabel]").forEach((el) => {
        el.textContent = "Live Account";
        el.style.color = "";
        el.removeAttribute("data-tc-relabel");
      });
    }
    function spoofLiveAccountLabel() {
      if (!relabelDemo) {
        return;
      }
      const t = document.evaluate("//div[text()='Live Account']", document, null, 7, null);
      for (let e = 0; e < t.snapshotLength; e++) {
        const n = t.snapshotItem(e);
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
    let panelFontSize = parseInt(getFontSizeStored(), 10) || 16,
      journalFontSize = parseInt(getJournalFontSizeStored(), 10) || 20,
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
        " #__tradeCalc { position: fixed; top: 5px; right: 375px; width: max-content; min-height: 3.5em; max-width: 90em; border-radius: 999px; z-index: 2147483647; font-size: 13px; font-family: 'DM Sans', system-ui, sans-serif; background: var(--tc-bg); box-shadow: var(--tc-panel-shadow); display: flex; align-items: center; padding: 0.3em 1.5em; gap: 0; cursor: default; user-select: none; overflow: visible; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); } #__tradeCalc.dragging { transition: none; cursor: grabbing; } .tcGrip { display: flex; align-items: center; flex-shrink: 0; pointer-events: none; width: 0.7em; height: 1.1em; color: var(--m3-on-surface-var); opacity: 0.4; } .tcGrip svg { width: 100%; height: 100%; } .tcGripLeft { margin-right: 0.7em; } .tcVer { align-self: center; font-size: max(9px, 0.58em); font-weight: 800; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; color: var(--tc-text-mut); opacity: 0.65; cursor: default; } .tcGripRight { margin-left: 0.7em; } #__tcContent { display: flex; align-items: stretch; flex: 1; gap: 0.75em; scrollbar-width: none; } #__tcContent::-webkit-scrollbar { display: none; } .tcSec { display: flex; flex-direction: row; align-items: stretch; background: transparent; border: none; flex:1; padding: 0; gap: 0; position: relative; flex-shrink: 0; } #__tcSecTargets { cursor: grab; } #__tcSecProtections { margin-left: auto; margin-right: auto; } #__tcSecProjections { } #__tcSecLog { } .tcSec:has([data-tc-tip]:hover) { z-index: 100; } [data-tc-tip] { position: relative; } [data-tc-tip]::after { content: attr(data-tc-tip); position: absolute; top: calc(100% + 0.46em); left: 50%; white-space: nowrap; pointer-events: none; background: oklch(16% 0.02 257 / 0.98); color: oklch(96% 0.01 240); font-size: max(11px, 0.72em); font-weight: 600; letter-spacing: 0.04em; text-transform: none; padding: 0.4em 0.7em; border-radius: 0.42em; border: 1px solid oklch(100% 0 0 / 0.14); box-shadow: 0 4px 12px oklch(0% 0 0 / 0.45); opacity: 0; transition: opacity 0.18s, transform 0.18s; transform: translateX(-50%) translateY(-0.31em); z-index: 2147483647; } [data-tc-tip]::before { content: ''; position: absolute; top: calc(100% + 0.15em); left: 50%; transform: translateX(-50%); border: 0.31em solid transparent; border-bottom-color: oklch(16% 0.02 257 / 0.98); pointer-events: none; opacity: 0; transition: opacity 0.18s; z-index: 2147483647; } [data-tc-tip]:hover, [data-tc-tip]:focus-visible { z-index: 2147483646; } [data-tc-tip]:hover::after, [data-tc-tip]:focus-visible::after { opacity: 1; transform: translateX(-50%) translateY(0); } [data-tc-tip]:hover::before, [data-tc-tip]:focus-visible::before { opacity: 1; } #__tcSecTargets [data-tc-tip]::after { left: 0; transform: translateY(-0.31em); } #__tcSecTargets [data-tc-tip]:hover::after, #__tcSecTargets [data-tc-tip]:focus-visible::after { transform: translateY(0); } #__tcSecTargets [data-tc-tip]::before { left: 0.7em; transform: none; } .tcSecFields { display: flex; align-items: stretch; gap: 0.6em; flex: 1; position: relative; } .tcFld { display: flex; flex-direction: column; gap: 0.25em; position: relative; flex:1;} .tcFld > .tcLbl { min-height: 0; display: flex; align-items: center; padding-bottom: 0; font-weight: bold; flex: 0 0 auto; } .tcFld > *:not(.tcLbl) { margin-top: auto; margin-bottom: auto; } .tcLbl { font-size: var(--fz-label); text-transform: uppercase; color: var(--tc-text-mut); font-weight: 500; letter-spacing: 0.16em; line-height: 1; white-space: nowrap; display: flex; align-items: center; gap: 0.3em; } .tcLbl svg { opacity: 0.75; } .tcLbl .tcDot { display: none; } .tcVal { font-family: 'DM Mono', monospace; font-size: var(--fz-value); color: var(--tc-text-pri); font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums; transition: color 0.3s, text-shadow 0.3s; letter-spacing: 0.031em; white-space: nowrap; } .tcValLg { font-family: 'DM Mono', monospace; font-size: var(--fz-value-lg); font-weight: 400; color: var(--tc-text-pri); letter-spacing: 0.015em; line-height: 1; font-variant-numeric: tabular-nums; transition: text-shadow 0.3s; } .tcValLg .tcDec { color: var(--tc-text-mut); font-weight: 400; font-size: var(--fz-decimal); letter-spacing: 0.015em; margin-left: 0.05em; } .tcValLg[style*=\"--tc-grn\"] { text-shadow: 0 0 18px oklch(76% 0.16 145 / 0.4); } .tcValLg[style*=\"--tc-red\"] { text-shadow: 0 0 18px oklch(64% 0.18 25 / 0.4); } .tcProjMarks { display: none; } .tcProjMark { width: 1.077em; height: 0.154em; border-radius: 0.231em; background: oklch(76% 0.16 145 / 0.18); } .tcProjMark.tcProjMarkFill { background: var(--tc-grn); box-shadow: 0 0 6px oklch(76% 0.16 145 / 0.5); } .tcControlGroup { display: inline-flex; align-items: center; gap: 0.18em; background: var(--m3-surface-3); box-shadow: none; border: 1px solid var(--m3-outline-var); border-radius: var(--m3-shape-full); padding: 0.25em 0.8em; min-height: 1.3em; box-sizing: border-box; transition: border-color 0.2s, border-width 0.1s; overflow: visible; } .tcControlGroup:hover:not(:focus-within) { border-color: var(--m3-outline); } .tcControlGroup:focus-within { border: 1px solid var(--tc-accent); padding: calc(0.25em - 1px) calc(0.6em - 1px); } #__tcSLInputWrap, #__tcSLInputWrap:hover, #__tcSLInputWrap:focus-within { border-color: var(--m3-outline-var); padding: 0.25em 0.8em; } #__tcSLInput { cursor: default; } .tcInput { font-family: 'DM Mono', monospace; font-size: 1em; color: var(--m3-on-surface); background: transparent; border: none; outline: none; padding: 0; font-weight: 400; font-variant-numeric: tabular-nums; min-width: 0; letter-spacing: 0.031em; -moz-appearance: textfield; } .tcInput::-webkit-outer-spin-button, .tcInput::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .tcInput::placeholder { color: var(--m3-on-surface-var); opacity: 0.7; } .tcInput:-webkit-autofill, .tcInput:-webkit-autofill:hover, .tcInput:-webkit-autofill:focus, .tcInput:-webkit-autofill:active { -webkit-box-shadow: 0 0 0 100px transparent inset !important; box-shadow: 0 0 0 100px transparent inset !important; -webkit-text-fill-color: var(--m3-on-surface) !important; background-color: transparent !important; transition: background-color 99999s ease-in-out 0s; } .tcInput.tcUnsaved { border-bottom-color: var(--tc-ylw) !important; color: var(--tc-ylw) !important; } .tcControlGroup:has(.tcUnsaved)::after { content: \"↵ Enter\"; position: absolute; bottom: -1.35em; left: 0; font-size: max(8px, 0.5em); font-weight: 700; letter-spacing: 0.08em; color: var(--tc-ylw); white-space: nowrap; pointer-events: none; opacity: 0.9; } .tcPill { width: 2.308em; height: 2.308em; border-radius: 50%; background: transparent; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; min-width: 0; color: var(--m3-on-surface-var); transition: background 0.14s, color 0.15s, border-color 0.2s, box-shadow 0.2s; } .tcPill svg { width: 1.15em; height: 1.15em; } .tcPill:hover { background: oklch(from var(--tc-accent) l c h / 0.08); color: var(--m3-on-surface); } .tcPill:active { background: oklch(from var(--tc-accent) l c h / 0.12); transform: scale(0.94); } .tcPill:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; } .tcPill.on, #__tcMultiStatus.on { color: var(--tc-grn); border-color: oklch(from var(--tc-grn) l c h / 0.4); box-shadow: 0 0 10px oklch(from var(--tc-grn) l c h / 0.35); } .tcPill.tcPillSnap { animation: __tcPillSnap 0.22s cubic-bezier(0.16, 1, 0.3, 1); } .tcPillCircle::after { content: none !important; } .tcPillCircle, .tcLogBtn { border-radius: 50%; background: transparent; box-shadow: none; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--m3-on-surface-var); transition: background 0.14s, color 0.15s; } .tcPillCircle:hover, .tcLogBtn:hover { transform: none; background: oklch(from var(--tc-accent) l c h / 0.08); color: var(--m3-on-surface); } .tcPillCircle:active, .tcLogBtn:active { background: oklch(from var(--tc-accent) l c h / 0.12); box-shadow: none; } .tcPillCircle:focus-visible, .tcLogBtn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; } .tcPillCircle { width: 1.733em; height: 1.733em; min-width: 0; padding: 0; align-self: center; font-weight: 500; font-size: var(--fz-value); line-height: 1; font-family: 'DM Sans', system-ui, sans-serif; } .tcLogBtn { width: 2.308em; height: 2.308em; padding: 0; font-size: 1em; } .tcLogBtn svg { width: 1.077em; height: 1.077em; } .tcTPBtn { width: 1.6em; height: 1.6em; } .tcTPBtn svg { width: 0.85em; height: 0.85em; } #__tcTPSaveBtn { color: var(--tc-grn); } #__tcTPSaveBtn.tcTPLocked { color: var(--tc-accent); } .tcLogBtn.tcRefreshSpin svg { animation: tcSpin 0.6s cubic-bezier(0.16, 1, 0.3, 1); } .tcLogBtn.tcRefreshSpin { color: var(--tc-accent); } .tcCloseBtn { position: absolute; right: -0.4em; top: 50%; transform: translateY(-50%); width: 1.5em; height: 1.5em; border-radius: 50%; background: var(--m3-surface-3); border: 1px solid var(--m3-outline-var); color: var(--m3-on-surface-var); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; box-shadow: none; transition: color 0.2s, opacity 0.2s, background 0.2s; opacity: 0; } .tcCloseBtn::before { content: \"\"; position: absolute; inset: 50% 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); border-radius: 50%; } #__tradeCalc:hover .tcCloseBtn, .tcCloseBtn:focus-visible { opacity: 1; } .tcCloseBtn:hover { background: var(--tc-red); color: oklch(98% 0 0); border-color: transparent; box-shadow: 0 3px 10px oklch(64% 0.18 25 / 0.4); transform: translateY(-50%); } .tcCloseBtn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; opacity: 1; } .tcCloseBtn:focus-visible:hover { transform: translateY(-50%) rotate(90deg); transition: background 0.25s, color 0.25s, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); } .tcSparklineBg { position: absolute; inset: 0; opacity: 0.22; pointer-events: none; border-radius: inherit; overflow: hidden; z-index: 0; mask-image: linear-gradient(to bottom, black 20%, transparent); -webkit-mask-image: linear-gradient(to bottom, black 20%, transparent); } @keyframes __tcDataFlash { 0% { color: var(--tc-accent); transform: translateY(-1px); } 100% { color: inherit; transform: translateY(0); } } .tcFlashData { animation: __tcDataFlash 0.55s cubic-bezier(0.16, 1, 0.3, 1); display: inline-block; } @keyframes tcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes __tcEntrance { 0% { opacity: 0; transform: scale(0.92) translateY(16px); filter: blur(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } } #__tradeCalc.tcLightMode { --tc-grn: #146c2e; --tc-red: oklch(44% 0.18 25); --tc-amb: oklch(44% 0.16 60); --tc-ylw: oklch(52% 0.17 70); --tc-pur: oklch(42% 0.16 285); --tc-cyn: oklch(40% 0.13 210); --tc-accent: #6750a4; --m3-surface: #fef7ff; --m3-surface-2: #f4eefa; --m3-surface-3: #ece6f0; --m3-on-surface: #1d1b20; --m3-on-surface-var: #49454f; --m3-outline: #79747e; --m3-outline-var: #cac4d0; --m3-primary: #6750a4; --m3-on-primary: #ffffff; --tc-text-pri: var(--m3-on-surface); --tc-text-dim: var(--m3-on-surface-var); --tc-text-mut: oklch(from var(--m3-on-surface-var) l c h / 0.78); --tc-input-bg: var(--m3-surface-3); --tc-input-border: var(--m3-outline-var); --tc-bg: var(--m3-surface-2); --tc-panel-shadow: var(--m3-elev-2); background: var(--tc-bg); } #__tradeCalc.tcLightMode .tcControlGroup { background: var(--m3-surface-3); border-color: var(--m3-outline-var); } #__tradeCalc.tcLightMode .tcPillCircle, #__tradeCalc.tcLightMode .tcLogBtn, #__tradeCalc.tcLightMode .tcPill { background: transparent; border-color: transparent; } #__tcDangerOverlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; background: radial-gradient(circle at center, transparent 0%, oklch(0% 0 0 / 0.88) 100%); opacity: 0; transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1); } .tcLockContent { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; padding: var(--s-6); border-radius: 1.4em; background: var(--tc-bg); border: 1px solid var(--tc-sec-border); box-shadow: 0 48px 120px oklch(0% 0 0 / 0.8), inset 0 1px 1px oklch(100% 0 0 / 0.2); } .tcLockLabel { display: block; font-size: 0.78em; font-weight: 900; text-transform: uppercase; letter-spacing: 0.28em; color: var(--tc-text-mut); margin-bottom: var(--s-5); opacity: 1; } .tcLockTimer { display: block; font-family: 'DM Mono', monospace; font-size: 7.5em; font-weight: 800; color: var(--tc-text-pri); letter-spacing: -0.04em; line-height: 1; } .tcLockMeta { display: block; font-size: 0.85em; font-weight: 600; color: var(--tc-text-dim); margin-top: var(--s-5); letter-spacing: 0.05em; } #__tradeCalc.tcDangerMode { box-shadow: var(--tc-panel-shadow), 0 0 0 2px oklch(64% 0.18 25 / 0.55); } #__tradeCalc.tcDangerMode.tcActive { box-shadow: var(--tc-panel-shadow), 0 0 0 2px oklch(64% 0.18 25 / 0.5); } #__tcDangerOverlay.tcPercentVisible { opacity: 1; background: radial-gradient(circle at center, transparent 0%, oklch(64% 0.18 25 / 0.15) 100%); } #__tcDangerOverlay.tcPercentVisible .tcLockCard { display: block; } #__tcDangerOverlay.tcPercentVisible .tcLockContent { box-shadow: 0 0 0 1px oklch(64% 0.18 25 / 0.5), 0 32px 100px -16px oklch(0% 0 0 / 0.9); background: radial-gradient(circle at top, oklch(64% 0.18 25 / 0.15) 0%, transparent 100%), var(--tc-bg); } #__tcJournalModal { position: fixed; inset: 0; z-index: 2147483648; background: oklch(7% 0.018 257 / 0.78); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1); } #__tcJournalModal.tcJournalOpen { opacity: 1; pointer-events: auto; } #__tcJournalModal.tcJournalOpen .tcJournalInner { transform: scale(1); opacity: 1; filter: blur(0); } .tcJournalInner { background: oklch(15% 0.02 257 / 0.98); border-radius: 1.4em; border: 1px solid oklch(100% 0 0 / 0.15); box-shadow: 0 32px 80px -12px oklch(0% 0 0 / 0.9), 0 10px 28px -6px oklch(0% 0 0 / 0.6), inset 0 1px 0 oklch(100% 0 0 / 0.12); width: min(78.5em, 96vw); max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; transform: scale(0.97); opacity: 0; filter: blur(4px); transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), filter 0.22s cubic-bezier(0.16, 1, 0.3, 1); } .tcJournalHeader { display: flex; align-items: center; gap: 0.5em; padding: 0.85em 1.1em 0.85em 1.25em; border-bottom: 1px solid oklch(100% 0 0 / 0.08); flex-shrink: 0; background: oklch(100% 0 0 / 0.02); } .tcJournalHeader h2 { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; font-size: max(9px, 0.62em); font-weight: 800; text-transform: uppercase; letter-spacing: 0.18em; color: var(--tc-text-pri); flex: 1; opacity: 0.9; } .tcJournalLastFetched { font-family: 'DM Mono', monospace; font-size: 0.6em; color: var(--tc-text-mut); letter-spacing: 0.04em; opacity: 0.7; } .tcJournalIconBtn { background: none; border: none; cursor: pointer; color: var(--tc-text-mut); border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s cubic-bezier(0.16, 1, 0.3, 1); position: relative; width: 1.4em; height: 1.4em; } .tcJournalIconBtn::before { content: ''; position: absolute; inset: -0.4em; border-radius: 50%; } .tcJournalIconBtn:hover { color: var(--tc-text-pri); background: oklch(from var(--tc-accent) l c h / 0.08); } .tcJournalIconBtn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; } .tcJournalIconBtn.tcJournalSpinning svg { animation: __tcJournalSpin 0.65s linear infinite; } .tcJournalIconBtn.tcJournalSpinning { color: var(--tc-accent); } @keyframes __tcJournalSpin { to { transform: rotate(360deg); } } #__tcJournalClose:hover { transform: rotate(90deg); color: var(--tc-text-pri); } .tcJournalTableWrap { overflow: auto; flex: 1; } #__tcJournalTable { width: 100%; border-collapse: collapse; font-family: 'DM Mono', monospace; font-size: 0.76em; font-variant-numeric: tabular-nums; } #__tcJournalTable thead th { position: sticky; top: 0; z-index: 2; background: oklch(11% 0.015 257); color: oklch(62% 0.014 257); font-family: 'DM Sans', system-ui, sans-serif; font-size: max(7px, 0.75em); font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; padding: 0.6em 0.8em; border-bottom: 1px solid oklch(100% 0 0 / 0.14); white-space: nowrap; text-align: right; } #__tcJournalTable thead th:nth-child(1), #__tcJournalTable thead th:nth-child(2) { text-align: left; } @keyframes __tcRowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } } #__tcJournalTable tbody tr.tcJournalRowIn { animation: __tcRowIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both; } #__tcJournalTable tbody tr { transition: background 0.1s; } #__tcJournalTable tbody td { padding: 0.48em 0.8em; border-bottom: 1px solid oklch(100% 0 0 / 0.055); color: var(--tc-text-dim); text-align: right; white-space: nowrap; } #__tcJournalTable tbody td:nth-child(1) { color: var(--tc-text-mut); font-size: 0.85em; } #__tcJournalTable tbody td:nth-child(2) { color: var(--tc-text-pri); font-family: 'DM Sans', system-ui, sans-serif; font-size: 0.82em; } #__tcJournalTable tbody td:nth-child(1), #__tcJournalTable tbody td:nth-child(2) { text-align: left; } #__tcJournalTable tbody tr:hover td { background: oklch(100% 0 0 / 0.04); } #__tcJournalTable tbody tr.tcJournalProfit td { background: oklch(42% 0.12 145 / 0.1); } #__tcJournalTable tbody tr.tcJournalProfit:hover td { background: oklch(42% 0.12 145 / 0.16); } #__tcJournalTable tbody tr.tcJournalLoss td { background: oklch(38% 0.1 25 / 0.14); } #__tcJournalTable tbody tr.tcJournalLoss:hover td { background: oklch(38% 0.1 25 / 0.22); } #__tcJournalTable tbody tr.tcJournalToday td { background: oklch(72% 0.16 80 / 0.13); border-bottom-color: oklch(72% 0.16 80 / 0.2); } #__tcJournalTable tbody tr.tcJournalToday:hover td { background: oklch(72% 0.16 80 / 0.2); } #__tcJournalTable tbody tr.tcJournalToday td:first-child { box-shadow: inset 3px 0 0 oklch(72% 0.16 80 / 0.7); } .tcJournalPlus { color: oklch(74% 0.17 145); font-weight: 700; } .tcJournalMinus { color: oklch(66% 0.18 25); font-weight: 700; } .tcJournalEditable { cursor: text; } .tcJournalEditable span { position: relative; } .tcJournalEditable span::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 0; height: 1px; background: var(--tc-text-mut); border-radius: 1px; transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1); } .tcJournalEditable:hover span::after { width: 100%; } .tcJournalCellInput { background: oklch(0% 0 0 / 0.3); color: var(--tc-text-pri); border: 1px solid var(--tc-accent); border-radius: var(--m3-shape-lg); padding: 0.14em 0.35em; font-size: 1em; font-family: 'DM Mono', monospace; font-variant-numeric: tabular-nums; width: 100%; box-sizing: border-box; text-align: right; outline: none; box-shadow: 0 0 0 3px oklch(from var(--tc-accent) l c h / 0.15); } .tcJournalCellInput.tcJournalCellError { border-color: var(--tc-red); box-shadow: 0 0 0 3px oklch(from var(--tc-red) l c h / 0.15); } .tcJournalFooter { padding: 0.55em 1.25em; border-top: 1px solid oklch(100% 0 0 / 0.07); font-family: 'DM Sans', system-ui, sans-serif; font-size: max(7px, 0.6em); font-weight: 600; color: var(--tc-text-mut); flex-shrink: 0; letter-spacing: 0.06em; opacity: 0.6; } .tcJournalEmpty { padding: 3em 2em; text-align: center; color: var(--tc-text-mut); font-family: 'DM Sans', system-ui, sans-serif; font-size: 0.78em; letter-spacing: 0.08em; opacity: 0.6; } .tcJournalSkeleton { padding: 0.6em 0; } .tcJournalSkRow { display: flex; gap: 0.8em; padding: 0.52em 1.1em; border-bottom: 1px solid oklch(100% 0 0 / 0.04); align-items: center; } .tcJournalSkCell { height: 0.7em; border-radius: 3px; background: oklch(100% 0 0 / 0.06); position: relative; overflow: hidden; flex-shrink: 0; } @keyframes __tcSkShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } } .tcJournalSkCell::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, oklch(100% 0 0 / 0.09) 50%, transparent 100%); animation: __tcSkShimmer 1.4s ease-in-out infinite; } @keyframes __tcCellSaved { 0% { background: oklch(72% 0.16 145 / 0); } 30% { background: oklch(72% 0.16 145 / 0.22); } 100% { background: oklch(72% 0.16 145 / 0); } } .tcJournalCellSaved { animation: __tcCellSaved 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards; } @keyframes __tcTodayPulse { 0% { background: oklch(72% 0.16 80 / 0.13); } 45% { background: oklch(72% 0.16 80 / 0.32); } 100% { background: oklch(72% 0.16 80 / 0.13); } } #__tcJournalTable tbody tr.tcJournalTodayPulse td { animation: __tcTodayPulse 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards; } #__tcRestoreBtn { position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; background: oklch(from var(--tc-bg) l c h / 0.85); color: var(--tc-text-pri); border: 1px solid oklch(from var(--tc-accent) l c h / 0.3); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); padding: 0.6em 1.2em; border-radius: 99px; font-family: 'DM Sans', system-ui, sans-serif; font-weight: 600; font-size: 13px; cursor: pointer; box-shadow: 0 4px 16px oklch(0% 0 0 / 0.28); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s, border-color 0.2s; display: flex; align-items: center; gap: 8px; transform-origin: center; } #__tcRestoreBtn svg { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); color: var(--tc-accent); width: 14px; height: 14px; } #__tcRestoreBtn:hover { transform: translateY(-3px) scale(1.02); background: oklch(from var(--tc-bg) l c h / 0.95); box-shadow: 0 8px 24px oklch(from var(--tc-accent) l c h / 0.2); border-color: var(--tc-accent); } #__tcRestoreBtn:hover svg { transform: rotate(90deg) scale(1.1); } #__tcRestoreBtn:active { transform: translateY(1px) scale(0.97); box-shadow: 0 2px 8px oklch(0% 0 0 / 0.2); transition: transform 0.1s; } #__tcRestoreBtn.tcLightMode { background: oklch(96% 0.02 88 / 0.92); box-shadow: 0 8px 24px -14px oklch(37% 0.06 78 / 0.45); } #__tcRestoreBtn.tcLightMode:hover { background: oklch(99% 0.016 88 / 0.98); box-shadow: 0 8px 24px oklch(48% 0.18 245 / 0.15); } #__tcImToggle.tcImToggleOff { opacity: 0.5; color: var(--m3-on-surface-var); } @keyframes __tcPillSnap { 0% { transform: scale(1); } 40% { transform: scale(0.88); } 100% { transform: scale(1); } } .tcPill.tcPillSnap { animation: __tcPillSnap 0.22s cubic-bezier(0.16, 1, 0.3, 1); } @keyframes __tcInputCommit { 0% { border-color: oklch(76% 0.16 145 / 0.9); box-shadow: 0 0 0 2px oklch(76% 0.16 145 / 0.18), inset 0 1px 2px oklch(0% 0 0 / 0.18); } 100% { border-color: var(--tc-input-border); box-shadow: inset 0 1px 2px oklch(0% 0 0 / 0.18); } } .tcControlGroup.tcCommit { animation: __tcInputCommit 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; } .tcReqWrap { display: flex; align-items: baseline; gap: 0.12em; } .tcReqFrom { font-size: 0.78em; font-weight: 600; color: var(--tc-text-dim); font-variant-numeric: tabular-nums; letter-spacing: 0.01em; } .tcValLg.tcTradeCritical { color: var(--tc-ylw) !important; text-shadow: 0 0 24px oklch(90% 0.17 95 / 0.6), 0 0 48px oklch(90% 0.17 95 / 0.25); } .tcSecHdr .tcDot.tcDotLive { opacity: 1; box-shadow: 0 0 5px currentColor; } @keyframes __tcBtnReveal { 0% { transform: scale(0.96); box-shadow: 0 0 0 0 oklch(76% 0.16 145 / 0.5); } 55% { transform: scale(1.02); box-shadow: 0 0 0 8px oklch(76% 0.16 145 / 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 oklch(76% 0.16 145 / 0); } } .tcSLBtnReveal { animation: __tcBtnReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; } @keyframes __tcWarnIn { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } } #__tcWarn.tcWarnVisible { animation: __tcWarnIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; } @keyframes __tcLiveResolve { 0% { opacity: 0.72; transform: scale(1); } 45% { opacity: 1; transform: scale(1.06); } 100% { opacity: 0; transform: scale(0.96) translateY(2px); } } .tcLiveResolving { animation: __tcLiveResolve 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards !important; } @keyframes __tcValPop { 0% { transform: scale(1); } 45% { transform: scale(1.12) translateY(-1px); } 100% { transform: scale(1) translateY(0); } } .tcValLg.tcValPop { animation: __tcValPop 0.28s cubic-bezier(0.16, 1, 0.3, 1); } @media (prefers-reduced-motion: reduce) { #__tradeCalc, #__tradeCalc *, #__tcRestoreBtn, #__tcDangerOverlay { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; } #__tradeCalc.tcDangerMode.tcActive { animation: none !important; } .tcFlashData { animation: none !important; } .tcCloseBtn:focus-visible:hover { transform: none; } .tcLogBtn:hover { transform: none; } #__tcRestoreBtn:hover { transform: none; } #__tcRestoreBtn:hover svg { transform: none; } .tcPill.tcPillSnap { animation: none !important; } .tcControlGroup.tcCommit { animation: none !important; } .tcSecHdr .tcDot.tcDotLive { animation: none !important; } .tcSLBtnReveal { animation: none !important; } #__tcWarn.tcWarnVisible { animation: none !important; } .tcLiveResolving { animation: none !important; opacity: 0 !important; } .tcValLg.tcValPop { animation: none !important; } #__tcJournalTable tbody tr.tcJournalRowIn { animation: none !important; opacity: 1 !important; transform: none !important; } .tcJournalCellSaved { animation: none !important; } #__tcJournalTable tbody tr.tcJournalTodayPulse td { animation: none !important; } .tcJournalSkCell::after { animation: none !important; } .tcJournalInner { filter: none !important; } #__tcJournalClose { transition: none !important; } .tcPill { transition: none !important; } } .tcControlGroup.tcTPGroup { gap:0.05em; background:transparent; border-color:transparent; box-shadow:none; align-items:baseline; } .tcControlGroup.tcTPGroup:hover, .tcControlGroup.tcTPGroup:focus-within { background: var(--m3-surface-3); border-color: var(--m3-outline-var); box-shadow: none; } .tcTPCur { font-size:var(--fz-currency); font-weight:700; color:var(--tc-text-dim); font-family:'DM Mono',monospace; letter-spacing:0.015em; } .tcTPInput { font-size:var(--fz-hero) !important; font-weight:700 !important; letter-spacing:0.02em !important; } @keyframes __tcTimerIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } } @keyframes __tcEdgeFlash { 0% { opacity:0; } 25% { opacity:1; } 100% { opacity:0; } } @media (prefers-reduced-motion: reduce) { #__tcEdgeFlash { animation: none !important; opacity: 0 !important; } } #__tcMarquee { position: fixed; top: 0; left: 0; width: 100%; z-index: 2147483640; pointer-events: none; overflow: hidden; white-space: nowrap; box-sizing: border-box; background: transparent; color: var(--tc-text-pri); font: 500 13px/1.8 'DM Sans', system-ui, sans-serif; letter-spacing: 0.06em; text-shadow: 0 1px 3px oklch(0% 0 0 / 0.6); } #__tcMarquee .tcMarqueeTrack { display: inline-block; padding-left: 100%; will-change: transform; animation: __tcMarqueeScroll linear infinite var(--tc-marquee-dur, 18s); } @keyframes __tcMarqueeScroll { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-100%, 0, 0); } } @media (prefers-reduced-motion: reduce) { #__tcMarquee .tcMarqueeTrack { animation: none; padding-left: 0.8em; } } #__tcInvestMult { position: fixed; top: 220px; right: 220px; z-index: 2147483000; display: flex; flex-direction: column; gap: 5px; width: 64px; padding: 6px; border-radius: var(--m3-shape-lg); background: var(--tc-bg); box-shadow: var(--m3-elev-2); border: 1px solid var(--m3-outline-var); font-family: 'DM Mono', monospace; user-select: none; } #__tcInvestMult .tcImBtn { all: unset; box-sizing: border-box; display: flex; align-items: center; justify-content: center; height: 32px; border-radius: var(--m3-shape-sm); cursor: pointer; font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--tc-text-pri); background: transparent; transition: background 0.12s; } #__tcInvestMult .tcImBtn:hover { background: oklch(from var(--tc-accent) l c h / 0.12); } #__tcInvestMult .tcImBtn:active { background: oklch(from var(--tc-accent) l c h / 0.18); } #__tcInvestMult .tcImUp { color: var(--tc-grn); } #__tcInvestMult .tcImDown { color: var(--tc-red); } #__tcInvestMult .tcImFactor { height: 26px; font-size: 12px; letter-spacing: 0.02em; color: var(--tc-text-dim); background: var(--m3-surface-3); border-radius: var(--m3-shape-sm); } #__tcInvestMult .tcImFactor:hover { background: oklch(from var(--tc-accent) l c h / 0.1); color: var(--tc-accent); } #__tcMTF { position: fixed; top: 96px; right: 220px; z-index: 2147483000; display: flex; flex-direction: column; gap: 10px; width: 268px; padding: 10px; box-sizing: border-box; border-radius: var(--m3-shape-lg); background: var(--tc-bg); box-shadow: var(--m3-elev-2); border: 1px solid var(--m3-outline-var); font-family: 'DM Mono', monospace; user-select: none; -webkit-user-select: none; touch-action: none; } #__tcMTF .tcMtfBar { display: flex; align-items: center; gap: 6px; cursor: grab; padding-bottom: 2px; } #__tcMTF .tcMtfBar:active { cursor: grabbing; } #__tcMTF .tcMtfPair { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; color: var(--tc-text-pri); } #__tcMTF .tcMtfSync { all: unset; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: var(--m3-shape-full); cursor: pointer; color: var(--tc-text-dim); transition: background 0.12s, color 0.12s; } #__tcMTF .tcMtfSync:hover { background: oklch(from var(--tc-accent) l c h / 0.12); color: var(--tc-accent); } #__tcMTF .tcMtfSync:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 1px; } #__tcMTF .tcMtfGrip { width: 16px; height: 3px; border-radius: 2px; background: var(--m3-outline-var); } #__tcMTF .tcMtfCell { display: flex; flex-direction: column; gap: 1px; } #__tcMTF .tcMtfHd { display: flex; align-items: center; justify-content: space-between; } #__tcMTF .tcMtfTf { color: var(--tc-text-pri); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; padding: 0 5px; border-radius: 4px; margin-right: 5px; border: 1px solid transparent; line-height: 15px; } .tcMtfTf:hover { filter: brightness(1.3); } #__tcMTF .tcMtfPct { font-size: 10px; font-variant-numeric: tabular-nums; color: var(--tc-text-dim); } .tcMtfSr { font-size: 9px; font-weight: 800; letter-spacing: 0.04em; cursor: pointer; padding: 0 5px; border-radius: 4px; margin-right: 5px; border: 1px solid transparent; line-height: 15px; } .tcMtfCd { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--tc-text-mut); margin-left: auto; margin-right: 6px; } .tcMtfCd.tcMtfCdSoon { color: var(--tc-accent); } .tcMtfFlip { display: none; font-size: 9px; font-weight: 800; line-height: 15px; padding: 0 5px; border-radius: 4px; margin-right: 5px; border: 1px solid transparent; color: #0b1020; } .tcMtfFlip.tcFlipOn { display: inline-block; } #__tcMTF .tcMtfCv { display: block; width: 100%; height: var(--tc-mtf-cvh, 88px); cursor: grab; touch-action: none; border-radius: var(--m3-shape-xs); background: var(--m3-surface-3); } #__tcMTF .tcMtfRz { position: absolute; z-index: 2; background: transparent; touch-action: none; } #__tcMTF .tcMtfRz[data-rz=\"e\"] { top: 8px; bottom: 8px; right: -3px; width: 8px; cursor: ew-resize; } #__tcMTF .tcMtfRz[data-rz=\"w\"] { top: 8px; bottom: 8px; left: -3px; width: 8px; cursor: ew-resize; } #__tcMTF .tcMtfRz[data-rz=\"s\"] { left: 8px; right: 8px; bottom: -3px; height: 8px; cursor: ns-resize; } #__tcMTF .tcMtfRz[data-rz=\"n\"] { left: 8px; right: 8px; top: -3px; height: 8px; cursor: ns-resize; } #__tcMTF .tcMtfRz[data-rz=\"se\"] { right: -3px; bottom: -3px; width: 14px; height: 14px; cursor: nwse-resize; } #__tcMTF .tcMtfRz[data-rz=\"sw\"] { left: -3px; bottom: -3px; width: 14px; height: 14px; cursor: nesw-resize; } #__tcMTF .tcMtfRz[data-rz=\"ne\"] { right: -3px; top: -3px; width: 14px; height: 14px; cursor: nesw-resize; } #__tcMTF .tcMtfRz[data-rz=\"nw\"] { left: -3px; top: -3px; width: 14px; height: 14px; cursor: nwse-resize; } #__tcMTF .tcMtfRz[data-rz=\"se\"]::after { content: ''; position: absolute; right: 4px; bottom: 4px; width: 6px; height: 6px; border-right: 2px solid var(--m3-outline-var); border-bottom: 2px solid var(--m3-outline-var); } #__tcMTF.tcMtfResizing { user-select: none; } #__tcMTF .tcMtfCv:active { cursor: grabbing; } #__tcMTF .tcMtfPanned .tcMtfCv { box-shadow: inset 0 0 0 1px oklch(from var(--tc-accent) l c h / 0.55); } #__tcMTF .tcMtfPanned .tcMtfCap { color: var(--tc-accent); } #__tcMTF .tcMtfCap { font-size: 10px; letter-spacing: 0.03em; color: var(--tc-text-dim); text-align: right; } #__tcMTF .tcMtfStale .tcMtfCv { opacity: 0.45; } #__tcMTF .tcMtfStale .tcMtfCap { color: var(--tc-amb); } #__tcMTF .tcMtfEmpty .tcMtfCv { background: transparent; border: 1px dashed var(--m3-outline-var); } #__tcMTF .tcMtfEmpty .tcMtfCap { color: var(--tc-accent); } #__tcMTF.tcMtfBusy { opacity: 0.7; } #__tcMTF.tcMtfBusy .tcMtfSync { color: var(--tc-accent); } #__tcMobileBar { position: fixed; bottom: 210px; right: 3px; left: auto; top: auto; transform: none; z-index: 2147483600; display: flex; flex-direction: column; align-items: stretch; gap: 5px; padding: 6px 5px; width: 92px; max-height: calc(100vh - 16px); background: color-mix(in oklab, var(--tc-bg) 94%, transparent); border: 1px solid var(--m3-outline-var); border-radius: 14px; box-shadow: var(--m3-elev-2); font-family: 'DM Sans', system-ui, sans-serif; user-select: none; -webkit-user-select: none; touch-action: none; animation: __tcMbIn 0.22s cubic-bezier(0.16, 1, 0.3, 1); } @keyframes __tcMbIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } } #__tcMobileBar .tcMbHandle { display: flex; flex-direction: row; justify-content: center; align-items: center; padding: 0 0 2px; cursor: grab; width: 100%; } #__tcMobileBar .tcMbHandle:active { cursor: grabbing; } #__tcMobileBar .tcMbGrip { display: block; width: 17px; height: 3px; border-radius: 999px; background: var(--m3-on-surface-var); opacity: 0.4; } #__tcMobileBar .tcMbRow { display: flex; flex-direction: column; gap: 3px; width: 100%; } #__tcMobileBar .tcMbLbl { font-size: 8px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: oklch(from var(--tc-text-pri) l c h / 0.85); text-align: center; white-space: nowrap; } #__tcMobileBar .tcMbCtl { display: flex; align-items: stretch; gap: 3px; width: 100%; } #__tcMobileBar .tcMbBtn, #__tcMobileBar .tcMbVal { all: unset; box-sizing: border-box; display: flex; align-items: center; justify-content: center; height: 22px; cursor: pointer; color: #ffffff; background: var(--m3-surface-3); border-radius: 9px; transition: background 0.12s cubic-bezier(0.16, 1, 0.3, 1); } #__tcMobileBar .tcMbBtn { flex: 0 0 auto; min-width: 22px; padding: 0 3px; font-size: 11px; font-weight: 700; line-height: 1; } #__tcMobileBar .tcMbBtn svg { width: 10px; height: 10px; stroke: currentColor; fill: none; } #__tcMobileBar .tcMbVal { flex: 1; min-width: 0; padding: 0 4px; } #__tcMobileBar .tcMbVal b { font-size: 9px; font-weight: 800; color: #ffffff; font-variant-numeric: tabular-nums; white-space: nowrap; } #__tcMobileBar .tcMbValGrn b { color: var(--tc-grn); } #__tcMobileBar.tcMbRpLow .tcMbValGrn b { color: var(--tc-red); } #__tcMobileBar.tcMbRpLow .tcMbValGrn { background: oklch(from var(--tc-red) l c h / 0.16); } #__tcMobileBar.tcMbRpLow #__tcMbRpLbl { color: var(--tc-red); } #__tcMobileBar .tcMbQuick { display: flex; justify-content: space-between; gap: 3px; width: 100%; } #__tcMobileBar .tcMbQuickBtn { all: unset; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex: 0 0 16px; cursor: pointer; background: var(--m3-surface-3); border-radius: 6px; font-size: 8px; font-weight: 800; line-height: 1; color: #ffffff; font-variant-numeric: tabular-nums; transition: background 0.12s cubic-bezier(0.16, 1, 0.3, 1); } #__tcMobileBar .tcMbQuickBtn.tcMbQuickOn { background: var(--tc-accent); color: var(--tc-bg); } #__tcMobileBar .tcMbQuickBtn:active { background: oklch(from var(--tc-accent) l c h / 0.35); } #__tcMobileBar .tcMbQuickBtn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; } #__tcMobileBar .tcMbBtn:active, #__tcMobileBar .tcMbVal:active { background: oklch(from var(--tc-accent) l c h / 0.2); } #__tcMobileBar .tcMbBtn:focus-visible, #__tcMobileBar .tcMbVal:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; } @media (hover: hover) { #__tcMobileBar .tcMbBtn:hover, #__tcMobileBar .tcMbVal:hover { background: oklch(from var(--tc-accent) l c h / 0.1); } } @media (prefers-reduced-motion: reduce) { #__tcMobileBar { animation: none; } #__tcMobileBar .tcMbBtn, #__tcMobileBar .tcMbVal { transition: none; } } @media (max-width: 900px) { #__tradeCalc input, #__tcJournalModal input { font-size: 16px !important; } } ";
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
        } else {
          panelPos.tx = 0;
          panelPos.ty = 0;
          panelPos.x = 0;
          panelPos.y = 0;
        }
        let s = i + panelPos.tx,
          l = c + panelPos.ty,
          d = i + panelPos.x,
          u = c + panelPos.y;
        const p = t
          ? 3
          : ((t, e) => {
              if (isMobileWidth()) {
                return 3;
              }
              const n = Date.now();
              if (n - tabStripBottomCache.ts < 500) {
                return tabStripBottomCache.val;
              }
              const o = document.querySelectorAll(".dJ15T, .pPomf");
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
      ' <span class="tcGrip tcGripLeft" aria-hidden="true"><svg viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="2" r="1.3"/><circle cx="7.5" cy="2" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="14" r="1.3"/><circle cx="7.5" cy="14" r="1.3"/></svg></span> <div id="__tcLoader" role="status" aria-live="polite" style="color:var(--tc-text-mut); font-size:0.72em; display:flex; align-items:center; justify-content:center; gap:var(--s-3); padding:var(--s-5) var(--s-6); width:22em; min-height:4.46em; font-weight:800; letter-spacing:0.14em;"> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tc-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:tcSpin 1s linear infinite; opacity:0.8;" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> <span id="__tcLoaderText"></span> </div> <div id="__tcContent" style="display:none;"> \x3c!-- Section 1: TARGETS (drag zone) --\x3e <div id="__tcSecTargets" class="tcSec"> <div class="tcSecFields" style="cursor:default; gap:0.615em;"> \x3c!-- TP --\x3e <div class="tcFld tcTPFld"> <span class="tcLbl" data-tc-tip="Day\'s take-profit target (sheet column D) — hover the value to edit"><span class="tcDot"></span>TP</span> <div class="tcControlGroup tcTPGroup"> <span class="tcTPCur">₹</span> <input id="__tcTBInput" class="tcInput tcTPInput" type="text" placeholder="0" aria-label="Take profit balance target" autocomplete="off" readonly /> <button id="__tcTPFetchBtn" class="tcLogBtn tcTPBtn" aria-label="Fetch TP from sheet" data-tc-tip="Fetch TP from Google Sheet (overrides a saved manual TP)"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg> </button> <button id="__tcTPSaveBtn" class="tcLogBtn tcTPBtn" aria-label="Save and lock manual TP" data-tc-tip="Lock this TP — survives reload/relogin until you Fetch or the next trading day"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> </button> </div> </div> \x3c!-- SL (shown when active) --\x3e <div class="tcFld" id="__tcSLFld" style="display:none;"> <span class="tcLbl" data-tc-tip="Lock out at this balance floor">SL</span> <div class="tcControlGroup" id="__tcSLInputWrap"> <input id="__tcSLInput" class="tcInput" type="text" placeholder="—" aria-label="Stop loss balance floor" autocomplete="off" style="display:none;" /> </div> <span id="__tcSLDisplay" class="tcVal" style="font-weight:700; color:var(--tc-red); display:none;">—</span> </div> \x3c!-- P/L --\x3e <div class="tcFld"> <span class="tcLbl" data-tc-tip="Today\'s % P/L from your trading journal sheet">P/L</span> <span class="tcVal" id="__tcTodayPL" style="font-weight:400; font-size:var(--fz-pl);">—</span> </div> \x3c!-- GOAL — days remaining + trades needed to hit the first target (sheet M6/O7). Hidden until a sheet fetch returns valid numbers; motivational readout only, no gating logic. --\x3e <div class="tcFld" id="__tcGoalFld" style="display:none;"> <span class="tcLbl" data-tc-tip="Days left + trades needed to hit your first target (sheet M6/O7)">GOAL</span> <span class="tcVal" id="__tcGoalVal" style="font-weight:400; font-size:var(--fz-pl);">—</span> </div> </div> </div> \x3c!-- Section 2: LIMITS — centred via margin:auto in CSS --\x3e <div id="__tcSecProtections" class="tcSec"> <div class="tcSecHdr"><span class="tcDot"></span></div> <div class="tcSecFields" style="gap:0.75em;"> \x3c!-- LOCK + TIME removed 2026-07-06: browser locking is GONE (user runs a system-level lock). Do NOT re-add #__tcArmLimits / #__tcBlockMinInput. --\x3e \x3c!-- FLOOR % --\x3e <div class="tcFld"> <span class="tcLbl" data-tc-tip="Block trades and close tabs below this payout %">PAYOUT</span> <div class="tcControlGroup"> <input id="__tcMinRpInput" class="tcInput" type="text" aria-label="Minimum payout floor %" autocomplete="off" style="width:calc(3ch + 0.55em);" /> </div> </div> \x3c!-- STEP× moved OUT of the panel 2026-07-07 (user request): the investment multiplier now lives in the floating #__tcInvestMult panel (× N / N / ÷ N) beside the native trade controls. The factor still persists in __tradeCalc_step_mult and still drives ←/→ arrows. Do NOT re-add #__tcStepMultInput / #__tcStepMinus / #__tcStepPlus here. --\x3e \x3c!-- MULT --\x3e <div class="tcFld"> <span class="tcLbl" data-tc-tip="Scale each trade by STEP× across consecutive trades">MULT</span> <button id="__tcMultiStatus" class="tcPill" aria-pressed="false" aria-label="Toggle multiplier mode" data-tc-tip="Scale each trade by STEP× across consecutive trades"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v6"/><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/></svg> </button> </div> </div> </div> \x3c!-- Section 3: PROJECTION --\x3e <div id="__tcSecProjections" class="tcSec"> <div class="tcSecFields" style="gap:0.75em; flex-wrap:nowrap; align-items:stretch;"> <div class="tcFld"> <span class="tcLbl" data-tc-tip="Trades needed to reach your TP from current balance"><span class="tcDot"></span>REQ</span> <div style="display:flex; flex-direction:column; align-items:flex-start; gap:0.231em; margin-top:auto; margin-bottom:auto;"> <span class="tcReqWrap"><span id="__tcResultFrom" class="tcReqFrom"></span><span id="__tcResult" class="tcValLg">—</span></span> <div class="tcProjMarks" aria-hidden="true"> <span class="tcProjMark tcProjMarkFill"></span> <span class="tcProjMark tcProjMarkFill"></span> <span class="tcProjMark tcProjMarkFill"></span> <span class="tcProjMark"></span> <span class="tcProjMark"></span> </div> </div> </div> <div class="tcFld"> <span class="tcLbl" data-tc-tip="Amount at risk per trade">RISK</span> <span id="__tcRisk" class="tcVal" style="font-weight:400; font-size:var(--fz-value-lg);">—</span> </div> <button id="__tcImToggle" class="tcLogBtn" style="align-self:center;" aria-label="Toggle investment multiplier panel" data-tc-tip="Show/hide the Invest ×÷ panel"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg> </button> <button id="__tcMtfToggle" class="tcLogBtn tcImToggleOff" style="align-self:center;" aria-label="Toggle multi-timeframe chart panel" data-tc-tip="Show/hide the multi-timeframe charts (C)"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="4" x2="6" y2="20"/><rect x="3.5" y="8" width="5" height="7" rx="1"/><line x1="18" y1="4" x2="18" y2="20"/><rect x="15.5" y="6" width="5" height="9" rx="1"/></svg> </button> </div> </div> \x3c!-- Section 4: ACTIONS (LOG + JOURNAL; hidden when no sheet URL) --\x3e <div id="__tcSecLog" class="tcSec"> <div class="tcSecFields" style="flex-wrap:nowrap; align-items:stretch;"> \x3c!-- role=group + aria-label carries the "Actions" name to screen readers; the tcLbl span below is aria-hidden and opacity:0 (NOT the old position:absolute clip-technique) — it must stay IN FLOW so its row reserves the exact same height as every other section\'s visible label, or this column\'s buttons sit a label-row too high and break the shared label/value baseline the 2026-08-11 alignment pass establishes. --\x3e <div class="tcFld" role="group" aria-label="Actions"> <span class="tcLbl" aria-hidden="true" style="opacity:0;">ACTIONS</span> <div style="display:flex; align-items:center; gap:0.615em;"> <button id="__tcLogBtn" class="tcLogBtn" aria-label="Open activity log" data-tc-tip="Open activity log"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> </button> <button id="__tcJournalBtn" class="tcLogBtn" aria-label="Open trading journal" data-tc-tip="Open trading journal"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> </button> <button id="__tcThemeBtn" class="tcLogBtn" aria-label="Toggle panel theme" data-tc-tip="Toggle light/dark panel theme"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> </button> </div> </div> </div> </div> <span id="__tcVer" class="tcVer">—</span> </div> <span class="tcGrip tcGripRight" aria-hidden="true"><svg viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="2" r="1.3"/><circle cx="7.5" cy="2" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="14" r="1.3"/><circle cx="7.5" cy="14" r="1.3"/></svg></span> <button id="__tcClose" class="tcCloseBtn" aria-label="Close panel"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" style="width:0.62em; height:0.62em;" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> </button> <span id="__tcWarn" role="alert" aria-live="assertive" style="display:none; position:absolute; bottom:-2.3em; left:0; width:100%; text-align:center; font-size:0.92em; font-weight:900; color:var(--tc-red); text-transform:uppercase; letter-spacing:0.14em; filter:drop-shadow(0 2px 6px oklch(64% 0.18 25 / 0.4));"></span>';
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
    });
    let dragOffsetX,
      dragOffsetY,
      isDragging = false;
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
        const e = t.target.closest(".dJ15T") || t.target.closest(".pPomf");
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
      dangerOverlay.style.fontSize = journalFontSize + "px";
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Trading journal modal (Google Sheet via Apps Script)
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const journalModal = document.createElement("div");
    journalModal.id = "__tcJournalModal";
    journalModal.innerHTML =
      ' <div class="tcJournalInner" role="dialog" aria-modal="true" aria-labelledby="__tcJournalTitle"> <div class="tcJournalHeader"> <h2 id="__tcJournalTitle">Trading Journal</h2> <span class="tcJournalLastFetched" id="__tcJournalLastFetched"></span> <button class="tcJournalIconBtn" id="__tcJournalRefresh" title="Refresh" aria-label="Refresh journal"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> </button> <button class="tcJournalIconBtn" id="__tcJournalClose" title="Close" aria-label="Close journal"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:14px;height:14px;" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> </button> </div> <div class="tcJournalTableWrap" id="__tcJournalTableWrap"> <div class="tcJournalEmpty" id="__tcJournalPlaceholder">Loading…</div> </div> <div class="tcJournalFooter" id="__tcJournalFooter"></div> </div>';
    shadow.appendChild(journalModal);
    if (!isMobileWidth()) {
      journalModal.style.fontSize = journalFontSize + "px";
    }
    const KEY_JOURNAL_CACHE = "__tradeCalc_journal_cache",
      KEY_JOURNAL_GOAL_CACHE = "__tradeCalc_journal_goal_cache",
      journal = {
        rows: readJson(KEY_JOURNAL_CACHE, []),
        loading: false,
        lastFetched: null,
        goal: readJson(KEY_JOURNAL_GOAL_CACHE, null),
      },
      isSheetErrorValue = (t) => typeof t == "string" && t.startsWith("#");
    // Journal day label, e.g. "15 Sep, Tue". It rolls over when the UTC date changes (5:30 AM for an
    // IST account), as before; the wall-clock offset now follows the account timezone.
    const getDayLabel = () => {
        const t = Date.now(),
          e = new Date(t + accountTzOffsetMs()),
          n = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()),
          o = t >= n ? e : new Date(n - 1);
        return `${String(o.getUTCDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][o.getUTCMonth()]}, ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][o.getUTCDay()]}`;
      };
    function renderJournalCell(t, e, n, o) {
      const r = n === "WDL" || n === "Deposit" || n === "Notes",
        a = n === "Notes",
        i = e[n];
      let c;
      c =
        n === "% PL"
          ? ((t) => {
              const e = parseFloat(t);
              return isNaN(e) || isSheetErrorValue(t) ? "—" : (100 * e).toFixed(2) + "%";
            })(i)
          : a || n === "Day" || n === "Date"
            ? i === "" || i == null
              ? "—"
              : String(i)
            : ((t) => {
                const e = parseFloat(t);
                // v1.24.0: account currency and matching number format (was always ₹ / en-IN).
                return isNaN(e) || isSheetErrorValue(t) ? "—" : detectCurrency() + fmtMoney(e);
              })(i);
      const s = n === "PL" || n === "% PL",
        l = parseFloat(i);
      let d = "";
      if (s && !isNaN(l)) {
        d = l > 0 ? ' class="tcJournalPlus"' : l < 0 ? ' class="tcJournalMinus"' : "";
      }
      if (r) {
        t.classList.add("tcJournalEditable");
        t.innerHTML = `<span${d}>${c}</span>`;
        t.onclick = () => {
          if (t.querySelector("input")) {
            return;
          }
          const r = e[n],
            i = document.createElement("input");
          i.className = "tcJournalCellInput";
          i.type = a ? "text" : "number";
          i.value = a ? r || "" : parseFloat(r) || "";
          if (!a) {
            i.step = "any";
          }
          t.innerHTML = "";
          t.appendChild(i);
          i.focus();
          i.select();
          let c = false;
          const s = () => {
              if (c) {
                return;
              }
              const s = a ? i.value.trim() : parseFloat(i.value);
              if ((a || !isNaN(s)) && String(s) !== String(r)) {
                c = true;
                i.disabled = true;
                i.classList.remove("tcJournalCellError");
                fetch(o, {
                  method: "POST",
                  headers: {
                    "Content-Type": "text/plain",
                  },
                  body: JSON.stringify({
                    action: "update_row",
                    rowIndex: e.rowIndex,
                    field: n,
                    value: s,
                  }),
                })
                  .then((t) => t.json())
                  .then((r) => {
                    if (r.status === "success") {
                      e[n] = s;
                      renderJournalCell(t, e, n, o);
                      t.classList.add("tcJournalCellSaved");
                      setTimeout(() => t.classList.remove("tcJournalCellSaved"), 700);
                      fetchJournal();
                    } else {
                      i.disabled = false;
                      i.classList.add("tcJournalCellError");
                      i.title = "Save failed, try again";
                      c = false;
                    }
                  })
                  .catch(() => {
                    i.disabled = false;
                    i.classList.add("tcJournalCellError");
                    i.title = "Save failed — try again";
                    c = false;
                  });
              } else {
                l();
              }
            },
            l = () => {
              c = true;
              renderJournalCell(t, e, n, o);
            };
          i.addEventListener("keydown", (t) => {
            if (t.key === "Enter") {
              t.preventDefault();
              s();
            } else if (t.key === "Escape") {
              t.preventDefault();
              l();
            }
          });
          i.addEventListener("blur", s);
        };
      } else {
        t.innerHTML = `<span${d}>${c}</span>`;
      }
    }
    function renderJournalTable(t) {
      const e = byId("__tcJournalTableWrap"),
        n = byId("__tcJournalFooter"),
        o = getSheetUrl();
      if (!e) {
        return;
      }
      if (!t || t.length === 0) {
        e.innerHTML = '<div class="tcJournalEmpty">No data yet.</div>';
        if (n) {
          n.textContent = "";
        }
        return;
      }
      const r = t.length + "|" + (t[t.length - 1] ? JSON.stringify(t[t.length - 1]) : "");
      if (journal._fingerprint === r && e.querySelector("#__tcJournalTable")) {
        return;
      }
      journal._fingerprint = r;
      const a = [
          "Day",
          "Date",
          "Balance",
          (t[0] && Object.keys(t[0]).find((t) => /^TP\s/i.test(t))) || "TP 15.2%",
          "PL",
          "Balance after Trading",
          "% PL",
          "WDL",
          "Deposit",
          "Notes",
        ],
        i = getDayLabel(),
        c = document.createElement("table");
      c.id = "__tcJournalTable";
      const s = document.createElement("thead"),
        l = document.createElement("tr");
      a.forEach((t) => {
        const e = document.createElement("th");
        e.textContent = t;
        l.appendChild(e);
      });
      s.appendChild(l);
      c.appendChild(s);
      const d = document.createElement("tbody");
      let u = null;
      t.forEach((t, e) => {
        const n = document.createElement("tr");
        n.classList.add("tcJournalRowIn");
        n.style.animationDelay = `${Math.min(22 * e, 300)}ms`;
        const r = parseFloat(t.PL);
        if (String(t.Date || "").includes(i.split(",")[0])) {
          n.classList.add("tcJournalToday");
          u = n;
        } else if (!isNaN(r) && r > 0) {
          n.classList.add("tcJournalProfit");
        } else if (!isNaN(r) && r < 0) {
          n.classList.add("tcJournalLoss");
        }
        a.forEach((e) => {
          const r = document.createElement("td");
          renderJournalCell(r, t, e, o);
          n.appendChild(r);
        });
        d.appendChild(n);
      });
      c.appendChild(d);
      e.innerHTML = "";
      e.appendChild(c);
      if (n) {
        n.textContent = `${t.length} trading day${t.length !== 1 ? "s" : ""}`;
      }
      if (u) {
        setTimeout(
          () =>
            u.scrollIntoView({
              block: "center",
              behavior: "smooth",
            }),
          100,
        );
        u.classList.add("tcJournalTodayPulse");
        setTimeout(() => u.classList.remove("tcJournalTodayPulse"), 900);
      }
    }
    function fetchJournal() {
      if (journal.loading) {
        return;
      }
      const t = getSheetUrl();
      if (!t) {
        return;
      }
      journal.loading = true;
      const e = byId("__tcJournalRefresh"),
        n = byId("__tcJournalLastFetched");
      if (e) {
        e.classList.add("tcJournalSpinning");
      }
      fetch(t, {
        cache: "no-store",
      })
        .then((t) => t.json())
        .then((t) => {
          journal.rows = t.rows || [];
          journal._tpToday = void 0;
          journal.lastFetched = new Date();
          journal.loading = false;
          journal.goal = {
            days: t.daysToTarget,
            trades: t.tradesToTarget,
          };
          writeJson(KEY_JOURNAL_CACHE, journal.rows.slice(-400));
          writeJson(KEY_JOURNAL_GOAL_CACHE, journal.goal);
          if (e) {
            e.classList.remove("tcJournalSpinning");
          }
          if (n) {
            const t = journal.lastFetched;
            n.textContent = `Updated ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
          }
          renderJournalTable(journal.rows);
          applySheetTp();
          renderTodayPl();
          renderGoal();
          scheduleRecalc();
        })
        .catch(() => {
          journal.loading = false;
          if (e) {
            e.classList.remove("tcJournalSpinning");
          }
          const t = byId("__tcJournalTableWrap");
          if (t) {
            t.innerHTML = '<div class="tcJournalEmpty">Could not load journal. Check your sheet URL.</div>';
          }
        });
    }
    function getTodayTpFromSheet() {
      if (void 0 !== journal._tpToday) {
        return journal._tpToday;
      }
      const t = getDayLabel().split(",")[0],
        e = journal.rows.find((e) => String(e.Date || "").includes(t));
      let n = null;
      if (e) {
        const t = Object.keys(e).find((t) => /^TP\s/i.test(t)),
          o = t ? parseFloat(e[t]) : NaN;
        if (isFinite(o) && o > 0) {
          const t = parseFloat(e.Balance);
          n = {
            start: isFinite(t) ? t : NaN,
            target: o,
          };
        }
      }
      journal._tpToday = n;
      return n;
    }
    function applySheetTp() {
      if (getTpManualDate() === getDayKey()) {
        return;
      }
      const t = getTodayTpFromSheet();
      if (!t || !tpInput) {
        return;
      }
      const e = Math.round(t.target);
      if (parsePlainNumber(tpInput.value) === e) {
        return;
      }
      const n = String(e);
      tpInput.value = fmtInputMoney(n);
      setTpStored(n);
      autosizeInput(tpInput);
      scheduleRecalc();
    }
    function renderTodayPl() {
      if (!todayPlEl) {
        return;
      }
      const t = getDayLabel().split(",")[0],
        e = journal.rows.find((e) => String(e.Date || "").includes(t)),
        n = e ? e["% PL"] : null,
        o = parseFloat(n);
      if (n == null || n === "" || isNaN(o) || isSheetErrorValue(n)) {
        todayPlEl.textContent = "—";
        todayPlEl.style.color = "";
        return;
      }
      const r = 100 * o;
      todayPlEl.textContent = (r >= 0 ? "+" : "") + r.toFixed(2) + "%";
      todayPlEl.style.color = r >= 0 ? "var(--tc-grn)" : "var(--tc-red)";
    }
    function renderGoal() {
      if (!goalField || !goalValEl) {
        return;
      }
      const t = journal.goal,
        e = t ? parseFloat(t.days) : NaN,
        n = t ? parseFloat(t.trades) : NaN;
      if (!t || isNaN(e) || isNaN(n)) {
        goalField.style.display = "none";
      } else {
        goalValEl.textContent = `${Math.round(e)}d · ${Math.round(n)}tr`;
        goalField.style.display = "";
      }
    }
    let journalReturnFocus = null;
    function trapJournalFocus(t) {
      if (t.key !== "Tab") {
        return;
      }
      const e = journalModal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!e.length) {
        return;
      }
      const n = e[0],
        o = e[e.length - 1],
        r = activeEl();
      if (t.shiftKey ? r === n : r === o) {
        t.preventDefault();
        (t.shiftKey ? o : n).focus();
      } else if (![].includes.call(e, r)) {
        t.preventDefault();
        n.focus();
      }
    }
    function closeJournal() {
      journalModal.classList.remove("tcJournalOpen");
      journalModal.removeEventListener("keydown", trapJournalFocus);
      if (journalReturnFocus && typeof journalReturnFocus.focus == "function") {
        journalReturnFocus.focus();
      }
      journalReturnFocus = null;
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Panel element references, section visibility, take-profit input
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const tpInput = byId("__tcTBInput"),
      reqEl = byId("__tcResult"),
      reqFromEl = byId("__tcResultFrom"),
      riskEl = byId("__tcRisk"),
      tpProgressEl = byId("__tcTPProgress"),
      tpRemainEl = byId("__tcTPRemain"),
      tpBarEl = byId("__tcTPBar"),
      tpBarTrackEl = byId("__tcTPBarTrack"),
      tpLineEl = byId("__tcTPLine"),
      warnEl = byId("__tcWarn"),
      panelCloseBtn = byId("__tcClose"),
      slInput = byId("__tcSLInput"),
      lockLabelEl = byId("__tcLockLabel"),
      lockTimerEl = byId("__tcLockTimerText"),
      lockMetaEl = byId("__tcLockMeta"),
      minPayoutInput = byId("__tcMinRpInput"),
      multiBtn = byId("__tcMultiStatus"),
      logBtn = byId("__tcLogBtn"),
      journalBtn = byId("__tcJournalBtn"),
      contentEl = byId("__tcContent"),
      loaderEl = byId("__tcLoader"),
      loaderTextEl = byId("__tcLoaderText"),
      projectionsDot = qs("#__tcSecProjections .tcDot"),
      targetsDot = qs("#__tcSecTargets .tcDot"),
      todayPlEl = byId("__tcTodayPL"),
      goalField = byId("__tcGoalFld"),
      goalValEl = byId("__tcGoalVal"),
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
    const sections = Array.from(panel.querySelectorAll("#__tcContent > .tcSec")),
      sectionAnchors = sections.map((t) => {
        const e = document.createComment(t.id);
        t.parentNode.insertBefore(e, t);
        return e;
      });
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
    let sectionVisibility = (() => {
      try {
        const t = JSON.parse(prefGet(KEY_VISIBILITY) || "null");
        return Array.isArray(t) && t.length === 4 ? t.map((t) => (t ? 1 : 0)) : [1, 1, 1, 1];
      } catch (t) {
        return [1, 1, 1, 1];
      }
    })();
    function applyVisibility(t) {
      if (Array.isArray(t)) {
        for (
          sectionVisibility = t.slice(0, sections.length).map((t) => (t ? 1 : 0));
          sectionVisibility.length < sections.length;

        ) {
          sectionVisibility.push(1);
        }
        saveVisibilityStored(sectionVisibility);
      }
      sections.forEach((t, e) => {
        const n = sectionVisibility[e] !== 0,
          o = t.isConnected;
        if (n && !o) {
          sectionAnchors[e].parentNode.insertBefore(t, sectionAnchors[e].nextSibling);
        } else if (!n && o) {
          t.remove();
        }
      });
      requestAnimationFrame(updateScrollAffordance);
    }
    applyVisibility(sectionVisibility);
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
      },
      tpFetchBtn = byId("__tcTPFetchBtn"),
      tpSaveBtn = byId("__tcTPSaveBtn");
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
      if (tpSaveBtn) {
        tpSaveBtn.classList.add("tcTPLocked");
        setTimeout(() => tpSaveBtn.classList.remove("tcTPLocked"), 900);
      }
      scheduleRecalc();
    }
    if (tpFetchBtn) {
      tpFetchBtn.addEventListener("click", function () {
        setTpManualDate("");
        if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({
            [KEY_TP_MANUAL_DATE]: "",
          });
        }
        journal._tpToday = void 0;
        if (tpFetchBtn) {
          tpFetchBtn.classList.add("tcRefreshSpin");
        }
        fetchJournal();
        setTimeout(() => {
          if (tpFetchBtn) {
            tpFetchBtn.classList.remove("tcRefreshSpin");
          }
        }, 700);
      });
    }
    if (tpSaveBtn) {
      tpSaveBtn.addEventListener("click", () => {
        if (tpInput) {
          tpInput.focus();
        }
        saveTp();
        if (tpInput) {
          tpInput.blur();
        }
      });
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
    const slDisplayEl = byId("__tcSLDisplay");
    if (slInput) {
      slInput.setAttribute("readonly", "readonly");
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Stop loss: daily setup modal, persistence, trailing SL
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
      const n = byId("__tcSLFld");
      if (n) {
        n.style.display = "";
      }
      const o = byId("__tcSLInputWrap");
      if (o) {
        o.style.display = "";
      }
      if (slInput) {
        slInput.value = fmtInputMoney(e);
        slInput.style.display = "";
        autosizeInput(slInput);
      }
      if (slDisplayEl) {
        slDisplayEl.style.display = "none";
      }
      scheduleRecalc();
    }
    // Daily stop-loss setup (v1.24.0: editable). Suggests 85% of the balance; the amount can be typed or
    // picked with the % buttons. Confirming stores today's SL and the trail distance it implies, so a
    // lower SL isn't immediately pulled back up by the trailing SL (see slPreTpTrail).
    const SL_SETUP_PRESETS = [70, 75, 80, 85, 90];
    const SL_SETUP_DEFAULT_PCT = 85;
    function closeSlSetup() {
      const t = byId("__tcSLSetup");
      if (!t) {
        return;
      }
      if (window.__tcSLBalanceTimer) {
        clearTimeout(window.__tcSLBalanceTimer);
        delete window.__tcSLBalanceTimer;
      }
      if (t._tcOnVisible) {
        document.removeEventListener("visibilitychange", t._tcOnVisible);
        t._tcOnVisible = null;
      }
      if (window.__tcSLBlocker) {
        document.removeEventListener("click", window.__tcSLBlocker, { capture: true });
        document.removeEventListener("keydown", window.__tcSLBlocker, { capture: true });
        delete window.__tcSLBlocker;
      }
      const card = t.firstElementChild;
      if (card) {
        card.style.transition = "transform 0.3s cubic-bezier(0.16,1,0.3,1),opacity 0.25s";
        card.style.transform = "scale(0.94) translateY(-8px)";
        card.style.opacity = "0";
      }
      setTimeout(() => t.remove(), 320);
    }
    function confirmSl(balance, sl) {
      const today = getDayKey();
      const trail = slTrailFor(balance, sl);
      if (hasSyncStorage()) {
        chrome.storage.sync.set({
          [KEY_SL_VALUE]: sl,
          [KEY_SL_DATE]: today,
          [KEY_SL_INIT_BAL]: balance,
          [KEY_SL_TRAIL]: trail,
        });
      }
      writeSlLocalBackup(sl, today, balance, trail);
      slPeak = balance;
      slPreTpTrail = trail;
      slArmed = true;
      applySl(sl);
      closeSlSetup();
    }
    function showSlSetup() {
      if (byId("__tcSLSetup")) {
        return;
      }
      const t = document.createElement("div");
      t.id = "__tcSLSetup";
      t.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;background:oklch(0% 0 0/0.82);backdrop-filter:blur(24px);display:flex;align-items:center;justify-content:center;font-family:"DM Sans",system-ui,sans-serif;font-size:' +
        journalFontSize +
        "px;";
      const presetBtn = (pct) =>
        `<button type="button" data-sl-pct="${pct}" style="flex:1;background:oklch(100% 0 0/0.06);color:oklch(90% 0.01 257);border:1px solid oklch(100% 0 0/0.12);border-radius:10px;padding:0.45em 0;font-size:0.8em;font-weight:700;cursor:pointer;">${pct}%</button>`;
      t.innerHTML =
        ' <div style="background:var(--tc-bg,oklch(13.5% 0.018 257/0.97));border:1px solid oklch(100% 0 0/0.1);border-radius:20px;padding:2.4em 2.8em;text-align:center;box-shadow:0 48px 120px oklch(0% 0 0/0.8),inset 0 1px 0 oklch(100% 0 0/0.15);max-width:380px;width:90%;">' +
        ' <div style="font-size:0.62em;font-weight:900;text-transform:uppercase;letter-spacing:0.28em;color:oklch(67% 0.018 257);margin-bottom:1.2em;">Daily Risk Setup</div>' +
        ' <div style="font-size:1.7em;font-weight:800;color:oklch(97% 0.005 257);letter-spacing:-0.02em;line-height:1.15;margin-bottom:0.45em;">Set Stop Loss</div>' +
        ' <div style="font-size:0.82em;color:oklch(67% 0.018 257);margin-bottom:1.4em;line-height:1.5;">Suggested at 85% of your balance. Type an amount or pick a %.</div>' +
        ' <div style="display:flex;align-items:center;gap:0.4em;background:oklch(100% 0 0/0.05);border:1px solid oklch(100% 0 0/0.14);border-radius:12px;padding:0.55em 0.9em;margin-bottom:0.7em;">' +
        '   <span id="__tcSLSetupCur" style="font-weight:800;color:oklch(75% 0.015 257);">₹</span>' +
        '   <input id="__tcSLSetupInput" type="text" inputmode="decimal" autocomplete="off" aria-label="Stop loss amount" placeholder="Reading balance…" disabled style="flex:1;min-width:0;background:transparent;border:none;outline:none;color:oklch(97% 0.005 257);font-family:\'DM Mono\',monospace;font-size:1.25em;font-weight:700;text-align:right;" />' +
        '   <span id="__tcSLSetupPct" style="font-family:\'DM Mono\',monospace;font-size:0.8em;color:oklch(67% 0.018 257);min-width:3.2em;text-align:right;"></span>' +
        " </div>" +
        ' <div style="display:flex;gap:0.35em;margin-bottom:1.3em;">' +
        SL_SETUP_PRESETS.map(presetBtn).join("") +
        " </div>" +
        ' <button id="__tcSLConfirmBtn" type="button" disabled style="background:var(--tc-grn,oklch(76% 0.16 145));color:oklch(12% 0 0);border:none;border-radius:12px;padding:0.82em 2em;font-size:1em;font-weight:800;cursor:pointer;width:100%;letter-spacing:0.02em;opacity:0.5;transition:opacity 0.2s,filter 0.2s;">Calculating…</button>' +
        ' <div id="__tcSLSetupMeta" style="font-size:0.68em;color:oklch(55% 0.015 257);margin-top:1em;letter-spacing:0.04em;">Reading balance…</div>' +
        " </div>";
      shadow.appendChild(t);
      // Blocks page clicks/keys until the SL is confirmed; anything coming from the panel's own shadow tree
      // (the setup form) passes. Checks the whole event path, so it works for open and closed roots alike.
      window.__tcSLBlocker = (e) => {
        if (!t.isConnected) {
          return;
        }
        const path = e.composedPath ? e.composedPath() : [];
        const fromPanel = path.includes(shadowHost) || e.target === shadowHost || shadowHost.contains(e.target);
        if (!fromPanel) {
          e.stopPropagation();
          e.preventDefault();
        }
      };
      document.addEventListener("click", window.__tcSLBlocker, {
        capture: true,
      });
      document.addEventListener("keydown", window.__tcSLBlocker, {
        capture: true,
      });
      requestAnimationFrame(() => {
        const e = t.firstElementChild;
        e.style.cssText +=
          "transform:scale(0.92) translateY(16px);opacity:0;transition:transform 0.45s cubic-bezier(0.16,1,0.3,1),opacity 0.35s;";
        requestAnimationFrame(() => {
          e.style.transform = "";
          e.style.opacity = "1";
        });
      });
      const input = t.querySelector("#__tcSLSetupInput"),
        pctEl = t.querySelector("#__tcSLSetupPct"),
        confirmBtn = t.querySelector("#__tcSLConfirmBtn"),
        meta = t.querySelector("#__tcSLSetupMeta");
      let balance = NaN;
      const cur = () => detectCurrency();
      // Valid SL: a positive amount below the current balance.
      const update = () => {
        const sl = parsePlainNumber(input.value);
        const valid = !isNaN(balance) && sl > 0 && sl < balance;
        pctEl.textContent = !isNaN(balance) && sl > 0 ? Math.round((sl / balance) * 100) + "%" : "";
        confirmBtn.disabled = !valid;
        confirmBtn.style.opacity = valid ? "1" : "0.5";
        confirmBtn.textContent = valid ? `Set SL: ${cur()}${fmtInputMoney(Math.floor(sl))}` : isNaN(balance) ? "Calculating…" : "Enter an amount below your balance";
        t.querySelectorAll("[data-sl-pct]").forEach((b) => {
          const on = valid && Math.floor((balance * parseInt(b.getAttribute("data-sl-pct"), 10)) / 100) === Math.floor(sl);
          b.style.background = on ? "var(--tc-grn,oklch(76% 0.16 145))" : "oklch(100% 0 0/0.06)";
          b.style.color = on ? "oklch(12% 0 0)" : "oklch(90% 0.01 257)";
        });
        return valid ? Math.floor(sl) : NaN;
      };
      const setPct = (pct) => {
        input.value = String(Math.floor((balance * pct) / 100));
        update();
      };
      input.addEventListener("input", update);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const sl = update();
          if (!isNaN(sl)) {
            confirmSl(balance, sl);
          }
        }
      });
      t.addEventListener("click", (e) => {
        const b = e.target.closest && e.target.closest("[data-sl-pct]");
        if (b && !isNaN(balance)) {
          setPct(parseInt(b.getAttribute("data-sl-pct"), 10));
        }
      });
      confirmBtn.onclick = () => {
        const sl = update();
        if (!isNaN(sl)) {
          confirmSl(balance, sl);
        }
      };
      // Wait for Quotex to render the balance (v1.24.5: keeps waiting instead of giving up after ~21 s
      // and leaving a dead screen with the page still click-blocked — Quotex can take longer to render,
      // especially in a background tab where timers are throttled).
      let attempts = 0;
      let skipBtn = null;
      function offerSkip(label) {
        if (skipBtn) {
          skipBtn.textContent = label || skipBtn.textContent;
          return;
        }
        // Release the page blocker so Quotex stays usable while we keep waiting.
        if (window.__tcSLBlocker) {
          document.removeEventListener("click", window.__tcSLBlocker, { capture: true });
          document.removeEventListener("keydown", window.__tcSLBlocker, { capture: true });
          delete window.__tcSLBlocker;
        }
        skipBtn = document.createElement("button");
        skipBtn.type = "button";
        skipBtn.id = "__tcSLSkipBtn";
        skipBtn.textContent = label || "Skip for now";
        skipBtn.style.cssText =
          "margin-top:0.9em;background:transparent;color:oklch(72% 0.015 257);border:1px solid oklch(100% 0 0/0.15);border-radius:10px;padding:0.5em 1.2em;font-size:0.78em;font-weight:700;cursor:pointer;width:100%;";
        skipBtn.onclick = closeSlSetup;
        meta.parentElement.appendChild(skipBtn);
      }
      function waitForBalance() {
        if (!t.isConnected) {
          return;
        }
        const n = readAccountBalance();
        // A zero balance is a real balance, not a failure (v1.24.5): the account simply has no funds, so
        // there is nothing to protect. Say so, let the screen be closed, and keep watching in case the
        // balance changes (a deposit, or switching between the live and demo account).
        if (n === 0) {
          balance = NaN;
          input.disabled = true;
          input.value = "";
          input.placeholder = "—";
          confirmBtn.disabled = true;
          confirmBtn.style.opacity = "0.5";
          confirmBtn.textContent = "No balance to protect";
          meta.textContent = `Balance: ${cur()}0 — set a stop loss once the account has funds.`;
          offerSkip("Close");
          window.__tcSLBalanceTimer = setTimeout(waitForBalance, 2000);
          return;
        }
        if (!isNaN(n) && n > 0) {
          balance = n;
          t.querySelector("#__tcSLSetupCur").textContent = cur();
          input.disabled = false;
          input.placeholder = "";
          meta.textContent = `Balance: ${cur()}${fmtInputMoney(n)}`;
          if (skipBtn) {
            skipBtn.remove();
            skipBtn = null;
          }
          setPct(SL_SETUP_DEFAULT_PCT);
          confirmBtn.classList.remove("tcSLBtnReveal");
          requestAnimationFrame(() => confirmBtn.classList.add("tcSLBtnReveal"));
          confirmBtn.addEventListener("animationend", () => confirmBtn.classList.remove("tcSLBtnReveal"), {
            once: true,
          });
          return;
        }
        attempts++;
        if (attempts >= 10) {
          meta.textContent = "Waiting for your balance — Quotex may still be loading.";
          offerSkip();
        }
        // 1 s while the page is probably still loading, then every 3 s, for as long as the screen is open.
        window.__tcSLBalanceTimer = setTimeout(waitForBalance, attempts < 30 ? 1000 : 3000);
      }
      window.__tcSLBalanceTimer = setTimeout(waitForBalance, 800);
      // A background tab throttles timers; re-check as soon as it's shown again.
      t._tcOnVisible = () => {
        if (t.isConnected && isNaN(balance)) {
          waitForBalance();
        }
      };
      document.addEventListener("visibilitychange", t._tcOnVisible);
    }
    const KEY_SL_LS_DATE = "__tradeCalc_sl_ls_date",
      KEY_SL_LS_VALUE = "__tradeCalc_sl_ls_value",
      KEY_SL_LS_INIT_BAL = "__tradeCalc_sl_ls_init_bal",
      KEY_SL_TP_LOCK = "__tradeCalc_sl_tp_lock",
      KEY_SL_TP_LOCK_DATE = "__tradeCalc_sl_tp_lock_date",
      KEY_SL_LS_TP_LOCK = "__tradeCalc_sl_ls_tp_lock",
      KEY_SL_LS_TP_LOCK_DATE = "__tradeCalc_sl_ls_tp_lock_date",
      // v1.24.0: pre-TP trail distance for today (fraction below the peak), set by the SL setup screen.
      KEY_SL_TRAIL = "__tradeCalc_sl_trail",
      KEY_SL_LS_TRAIL = "__tradeCalc_sl_ls_trail";
    function readSlLocalBackup() {
      try {
        return {
          [KEY_SL_DATE]: prefGet(KEY_SL_LS_DATE),
          [KEY_SL_VALUE]: prefGet(KEY_SL_LS_VALUE),
          [KEY_SL_INIT_BAL]: prefGet(KEY_SL_LS_INIT_BAL),
          [KEY_SL_TP_LOCK]: prefGet(KEY_SL_LS_TP_LOCK),
          [KEY_SL_TP_LOCK_DATE]: prefGet(KEY_SL_LS_TP_LOCK_DATE),
          [KEY_SL_TRAIL]: prefGet(KEY_SL_LS_TRAIL),
        };
      } catch (t) {
        return {};
      }
    }
    function writeSlLocalBackup(t, e, n, trail) {
      try {
        prefSet(KEY_SL_LS_DATE, e);
        prefSet(KEY_SL_LS_VALUE, String(t));
        if (!(n == null || isNaN(n))) {
          prefSet(KEY_SL_LS_INIT_BAL, String(n));
        }
        if (typeof trail == "number" && !isNaN(trail)) {
          prefSet(KEY_SL_LS_TRAIL, String(trail));
        }
      } catch (t) {}
    }
    let slPeak = NaN,
      slTpLock = NaN,
      slArmed = false,
      postTpGapPct = (() => {
        try {
          return clampPostTpGap(prefGet(KEY_POST_TP_GAP));
        } catch (t) {
          return 5;
        }
      })(),
      sysLockDisabled = (() => {
        try {
          const t = prefGet(KEY_SYS_LOCK_DISABLED);
          return t == null || t === "1";
        } catch (t) {
          return true;
        }
      })();
    function isSysLockDisabled() {
      return sysLockDisabled;
    }
    const SL_PRE_TP_TRAIL = 0.2,
      SL_POST_TP_GAP_DEFAULT = 0.05,
      SL_POST_TP_GAP_MAX = 0.15;
    // Pre-TP trail distance for today. 20% by default; a lower SL chosen in the setup screen widens it
    // so the trailing SL doesn't immediately lift the SL back to 80% of the balance (v1.24.0).
    let slPreTpTrail = SL_PRE_TP_TRAIL;
    function slTrailFor(balance, sl) {
      const gap = 1 - sl / balance;
      return isFinite(gap) ? Math.min(0.95, Math.max(SL_PRE_TP_TRAIL, Math.round(gap * 10000) / 10000)) : SL_PRE_TP_TRAIL;
    }
    function updateTrailingSl(t, e) {
      if (!slArmed) {
        return;
      }
      const n = (function (t, e, n, o, r, a) {
        if (isNaN(e) || e <= 0) {
          return null;
        }
        const i = isNaN(a) ? SL_POST_TP_GAP_DEFAULT : Math.min(SL_POST_TP_GAP_MAX, Math.max(0.01, a)),
          c = isNaN(t) || e > t ? e : t,
          s = !isNaN(n) && n > 0,
          l = !isNaN(o) || (s && e >= n),
          d = isNaN(o) ? (l ? n : NaN) : o,
          u = l ? Math.max(Math.floor(d), Math.floor(c * (1 - i))) : Math.floor(c * (1 - slPreTpTrail));
        return {
          newPeak: c,
          tpLock: d,
          newSL: u > (isNaN(r) ? 0 : r) ? u : NaN,
        };
      })(slPeak, t, e, slTpLock, parsePlainNumber(slInput ? slInput.value : ""), postTpGapPct / 100);
      if (!n) {
        return;
      }
      const o = getDayKey(),
        r = isNaN(slPeak) || n.newPeak > slPeak,
        a = isNaN(slTpLock) && !isNaN(n.tpLock);
      slPeak = n.newPeak;
      slTpLock = n.tpLock;
      if (a) {
        try {
          prefSet(KEY_SL_LS_TP_LOCK, String(n.tpLock));
          prefSet(KEY_SL_LS_TP_LOCK_DATE, o);
        } catch (t) {}
        if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({
            [KEY_SL_TP_LOCK]: n.tpLock,
            [KEY_SL_TP_LOCK_DATE]: o,
          });
        }
      }
      if (isNaN(n.newSL)) {
        if (r) {
          try {
            prefSet(KEY_SL_LS_INIT_BAL, String(n.newPeak));
          } catch (t) {}
        }
      } else {
        if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({
            [KEY_SL_VALUE]: n.newSL,
            [KEY_SL_DATE]: o,
            [KEY_SL_INIT_BAL]: n.newPeak,
          });
        }
        writeSlLocalBackup(n.newSL, o, n.newPeak);
        applySl(n.newSL);
      }
    }
    function setPostTpGap(t) {
      const e = clampPostTpGap(t);
      postTpGapPct = e;
      setPostTpGapStored(e);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // SL bootstrap from storage, font sizes, min payout, sheet URL, logging, theme
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const KEY_SL_ENABLED = "__tradeCalc_sl_enabled";
    const hasSyncStorage = () => typeof chrome != "undefined" && chrome.storage && chrome.storage.sync;
    // Picks today's stop loss from synced storage or the localStorage backup (v1.21.1, B14). It used to
    // trust sync only: when sync had no SL for today (e.g. a dropped write, since storage.sync has write
    // quotas) the setup screen reappeared even though today's SL was saved locally. Both stores are
    // written together and the trailing SL only moves up, so if both have today's SL the higher one wins.
    function pickTodaysSl(syncData) {
      const today = getDayKey();
      const candidates = [syncData, readSlLocalBackup()].filter(
        (s) => s && s[KEY_SL_DATE] === today && parseFloat(s[KEY_SL_VALUE]) > 0,
      );
      if (!candidates.length) {
        return null;
      }
      const best = candidates.reduce((a, b) => (parseFloat(b[KEY_SL_VALUE]) > parseFloat(a[KEY_SL_VALUE]) ? b : a));
      const tpLockSource = candidates.find((s) => s[KEY_SL_TP_LOCK_DATE] === today && parseFloat(s[KEY_SL_TP_LOCK]) > 0);
      const trail = parseFloat(best[KEY_SL_TRAIL]);
      return {
        value: parseFloat(best[KEY_SL_VALUE]),
        peak: parseFloat(best[KEY_SL_INIT_BAL]),
        trail: trail > 0 && trail < 1 ? trail : SL_PRE_TP_TRAIL,
        tpLock: tpLockSource ? parseFloat(tpLockSource[KEY_SL_TP_LOCK]) : NaN,
        fromSync: best === syncData,
      };
    }
    function applySlSettings(stored, forceEnabled) {
      if (stored[KEY_SYS_LOCK_DISABLED] != null) {
        sysLockDisabled = stored[KEY_SYS_LOCK_DISABLED] !== false;
        setSysLockDisabledStored(sysLockDisabled);
      }
      if (!forceEnabled && stored[KEY_SL_ENABLED] === false) {
        disableSl();
        return;
      }
      if (stored[KEY_POST_TP_GAP] != null) {
        postTpGapPct = clampPostTpGap(stored[KEY_POST_TP_GAP]);
        setPostTpGapStored(postTpGapPct);
      }
      const sl = pickTodaysSl(stored);
      if (!sl) {
        showSlSetup();
        return;
      }
      slPeak = isNaN(sl.peak) ? sl.value / 0.85 : sl.peak;
      slTpLock = sl.tpLock;
      slPreTpTrail = sl.trail;
      slArmed = true;
      applySl(sl.value);
      if (!sl.fromSync && hasSyncStorage()) {
        // Repair sync so other tabs and devices see today's SL too.
        chrome.storage.sync.set({
          [KEY_SL_VALUE]: sl.value,
          [KEY_SL_DATE]: getDayKey(),
          [KEY_SL_INIT_BAL]: slPeak,
          [KEY_SL_TRAIL]: slPreTpTrail,
        });
      }
    }
    // Reads SL settings (sync, falling back to the local backup after 1.5 s) and applies them.
    // `forceEnabled` is used when the popup switch turns SL on before its storage write has landed.
    function bootstrapSl(forceEnabled) {
      let done = false;
      const once = (stored) => {
        if (done) {
          return;
        }
        done = true;
        applySlSettings(stored || readSlLocalBackup(), forceEnabled);
      };
      if (!hasSyncStorage()) {
        once(readSlLocalBackup());
        return;
      }
      const timer = setTimeout(() => once(readSlLocalBackup()), 1500);
      chrome.storage.sync.get(
        [
          KEY_SL_VALUE,
          KEY_SL_DATE,
          KEY_SL_ENABLED,
          KEY_SL_INIT_BAL,
          KEY_SL_TP_LOCK,
          KEY_SL_TP_LOCK_DATE,
          KEY_SL_TRAIL,
          KEY_POST_TP_GAP,
          KEY_SYS_LOCK_DISABLED,
        ],
        (stored) => {
          clearTimeout(timer);
          once(stored);
        },
      );
    }
    // Turns the stop loss off without a reload (v1.21.1, B10): hides the SL field, stops trailing and
    // closes the daily setup screen if it's open. The saved SL stays in storage for re-enabling.
    function disableSl() {
      slArmed = false;
      slPeak = NaN;
      slTpLock = NaN;
      slPreTpTrail = SL_PRE_TP_TRAIL;
      if (slInput) {
        slInput.value = "";
      }
      const field = byId("__tcSLFld");
      if (field) {
        field.style.display = "none";
      }
      const setup = byId("__tcSLSetup");
      if (setup) {
        setup.remove();
      }
      if (window.__tcSLBlocker) {
        document.removeEventListener("click", window.__tcSLBlocker, { capture: true });
        document.removeEventListener("keydown", window.__tcSLBlocker, { capture: true });
        delete window.__tcSLBlocker;
      }
      scheduleRecalc();
    }
    bootstrapSl(false);
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
      setJournalFontSize = (t) => {
        if (isMobileWidth()) {
          return;
        }
        journalFontSize = Math.min(Math.max(t, 8), 48);
        journalModal.style.fontSize = journalFontSize + "px";
        dangerOverlay.style.fontSize = journalFontSize + "px";
        const e = byId("__tcSLSetup");
        if (e) {
          e.style.fontSize = journalFontSize + "px";
        }
        ((t) => {
          try {
            prefSet(KEY_JOURNAL_FONT_SIZE, t);
          } catch (t) {}
        })(journalFontSize);
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
    const LOG_BTN_ICONS = {
        idle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        loading:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="animation:tcSpin 1s linear infinite;" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>',
        success:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      },
      logSection = sections.find((t) => t.id === "__tcSecLog") || byId("__tcSecLog");
    function applySheetUrlVisibility(t) {
      if (!logSection) {
        return;
      }
      const e = t && t.trim().length > 0;
      if (journalBtn) {
        journalBtn.style.display = e ? "" : "none";
      }
      const n = sections.indexOf(logSection);
      if (n >= 0) {
        const t = e ? 1 : 0;
        if (sectionVisibility[n] !== t) {
          sectionVisibility[n] = t;
          saveVisibilityStored(sectionVisibility);
          applyVisibility(sectionVisibility);
        }
      }
    }
    let sheetUrl = (() => {
      try {
        return prefGet(KEY_SHEET_URL) || "";
      } catch (t) {
        return "";
      }
    })();
    function getSheetUrl() {
      return sheetUrl;
    }
    if (journal.rows.length > 0) {
      applySheetTp();
      renderTodayPl();
      scheduleRecalc();
    }
    renderGoal();
    if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get("sheetUrl", (t) => {
        const e = t.sheetUrl || "";
        sheetUrl = e;
        setSheetUrlStored(e);
        applySheetUrlVisibility(e);
        if (e) {
          fetchJournal();
        }
      });
    } else {
      applySheetUrlVisibility(sheetUrl);
      if (sheetUrl) {
        fetchJournal();
      }
    }
    if (logBtn) {
      logBtn.addEventListener("click", () => {
        const t = readBalance();
        if (isNaN(t)) {
          alert("Balance not found!");
          return;
        }
        const e = getSheetUrl();
        if (!e) {
          alert("Sheet URL not configured. Add it in the extension popup.");
          return;
        }
        const n = () => {
          logBtn.innerHTML = LOG_BTN_ICONS.idle;
          logBtn.setAttribute("aria-label", "Open activity log");
          logBtn.setAttribute("data-tc-tip", "Open activity log");
          logBtn.style.background = "";
          logBtn.style.color = "";
          logBtn.disabled = false;
        };
        logBtn.disabled = true;
        logBtn.setAttribute("aria-label", "Logging…");
        logBtn.innerHTML = LOG_BTN_ICONS.loading;
        fetch(e, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain",
          },
          body: JSON.stringify({
            action: "log_balance",
            balance: t,
            timestamp: new Date().toISOString(),
            sessionDate: getDayKey(),
            sessionDay: getDayLabel(),
          }),
        })
          .then(() => {
            ((t) => {
              try {
                prefSet(KEY_BAL_LOGGED_DATE, t);
              } catch (t) {}
            })(getDayKey());
            logBtn.innerHTML = LOG_BTN_ICONS.success;
            logBtn.setAttribute("aria-label", "Logged");
            logBtn.style.background = "var(--tc-grn)";
            logBtn.style.color = "white";
            setTimeout(n, 2000);
            setTimeout(fetchJournal, 800);
          })
          .catch((t) => {
            console.error("Sheet Log Error", t);
            logBtn.innerHTML = LOG_BTN_ICONS.error;
            logBtn.setAttribute("aria-label", "Log failed — could not reach the sheet");
            logBtn.setAttribute(
              "data-tc-tip",
              "Couldn't reach the sheet. Check your connection, then try again.",
            );
            logBtn.style.background = "var(--tc-red)";
            logBtn.style.color = "white";
            setTimeout(n, 7000);
          });
      });
    }
    if (journalBtn) {
      journalBtn.addEventListener("click", function () {
        journalReturnFocus = activeEl();
        journalModal.classList.add("tcJournalOpen");
        journalModal.addEventListener("keydown", trapJournalFocus);
        const t = byId("__tcJournalClose");
        if (t) {
          t.focus();
        }
        if (journal.rows.length > 0) {
          renderJournalTable(journal.rows);
          fetchJournal();
        } else {
          const t = byId("__tcJournalTableWrap");
          if (t) {
            t.innerHTML =
              '<div class="tcJournalSkeleton">' +
              [
                [2, 8, 7, 7, 6, 7, 5, 5, 5, 10],
                [2, 9, 7, 7, 5, 7, 5, 5, 5, 9],
                [2, 7, 8, 7, 7, 8, 5, 4, 4, 8],
              ]
                .map(
                  (t) =>
                    '<div class="tcJournalSkRow">' +
                    t.map((t) => `<div class="tcJournalSkCell" style="width:${t}em;"></div>`).join("") +
                    "</div>",
                )
                .join("") +
              "</div>";
          }
          fetchJournal();
        }
      });
    }
    const themeBtn = byId("__tcThemeBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        isLightTheme = !isLightTheme;
        setThemeStored(isLightTheme ? "light" : "dark");
        panel.classList.toggle("tcLightMode", isLightTheme);
        if (restoreBtn) {
          restoreBtn.classList.toggle("tcLightMode", isLightTheme);
        }
      });
    }
    const journalCloseBtn = byId("__tcJournalClose");
    if (journalCloseBtn) {
      journalCloseBtn.addEventListener("click", closeJournal);
    }
    const journalRefreshBtn = byId("__tcJournalRefresh");
    if (journalRefreshBtn) {
      journalRefreshBtn.addEventListener("click", fetchJournal);
    }
    journalModal.addEventListener("click", (t) => {
      if (t.target === journalModal) {
        closeJournal();
      }
    });
    window.__tcJournalEsc = (t) => {
      if (t.key === "Escape" && journalModal.classList.contains("tcJournalOpen")) {
        closeJournal();
      }
    };
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
    const investMultToggleBtn = byId("__tcImToggle");
    if (investMultToggleBtn) {
      const t = () => {
        const t = byId("__tcInvestMult");
        investMultToggleBtn.classList.toggle("tcImToggleOff", !!t && t.style.display === "none");
      };
      investMultToggleBtn.addEventListener("click", () => {
        const e = byId("__tcInvestMult");
        if (e) {
          e.style.display = e.style.display === "none" ? "" : "none";
        }
        t();
      });
      t();
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
        return Array.from(openTradeRowsLive).filter((row) => !isSettledRow(row) && hasRunningClock(row));
      }
      // v1.25.0: a running trade's row holds both a pair name and a mm:ss countdown, and no settled marker.
      const rows = resolveList("openTradeRows", document, [".ib6yR", ".RLj1p"], (root) => {
        const clocks = leafMatches(root, CLOCK_ONLY_RE);
        const seen = new Set();
        const out = [];
        for (const clock of clocks) {
          for (let el = clock.parentElement, hops = 0; el && hops < 4; el = el.parentElement, hops++) {
            // Stop before anything page-sized: a deal row is a small block holding one pair and one clock.
            if (el.closest("#__tradeCalc") || el.querySelector("#graph, #trade-button, #tab-active")) {
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
        return out;
      });
      return rows.filter((row) => !isSettledRow(row) && hasRunningClock(row));
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
    function readAccountBalance() {
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
      const n = document.getElementById("trade-button");
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
    let noTradesSince = Date.now() - 2000;
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
      autoCloseRunning = false;
    function autoCloseStep(t, e) {
      if (e >= 20) {
        autoCloseRunning = false;
        return;
      }
      const n = getPairTabs().find((e) => {
        const n = tabPayout(e);
        // Only tabs that actually have a close control (v1.24.4).
        return !isNaN(n) && n < t && !tabHasOpenTrade(e) && !!getTabCloseBtn(e);
      });
      if (!n) {
        autoCloseRunning = false;
        return;
      }
      const tabsBefore = getPairTabs().length;
      synthClick(getTabCloseBtn(n));
      window.__tcAutoCloseStepTimer = setTimeout(() => {
        // Stop if the click didn't close anything, instead of clicking again every 300 ms (v1.24.4).
        if (getPairTabs().length >= tabsBefore) {
          autoCloseRunning = false;
          return;
        }
        autoCloseStep(t, e + 1);
      }, 300);
    }
    function autoCloseLowPayoutTabs(t, e) {
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
      const t = parseInt(minPayoutInput.value, 10) || 89;
      if (!isNaN(t)) {
        autoCloseLowPayoutTabs(t);
        maybeAutoOpenPair(t);
      }
    });
    const TRADE_BTN_SELECTOR = "#trade-button button, .hkjXJ button, .bSenO button";
    let lastTradeBtnLock = null,
      lastTradeBtnEl = null;
    function setTradeButtonsDisabled(t) {
      const e = document.querySelector(TRADE_BTN_SELECTOR);
      if (lastTradeBtnLock === t && e === lastTradeBtnEl) {
        return;
      }
      lastTradeBtnLock = t;
      lastTradeBtnEl = e;
      // v1.27.0: their buttons keep their own state. A blocked trade is stopped in the capture phase by
      // __tcTradeBlocker (which also reads tradingBlocked); the greying is only so you can see it.
      const n = e ? document.querySelectorAll(TRADE_BTN_SELECTOR) : [];
      for (let e = 0; e < n.length; e++) {
        const o = n[e];
        o.style.filter = t ? "grayscale(1)" : "";
        o.style.opacity = t ? "0.55" : "";
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Loss streak tracking, edge flash, native "Set limit" lock
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    let lossStreak = (() => {
        try {
          const t = parseInt(prefGet(KEY_LOSS_STREAK), 10);
          return isNaN(t) ? 0 : t;
        } catch (t) {
          return 0;
        }
      })(),
      lastLossTs = (() => {
        try {
          const t = parseInt(prefGet(KEY_LAST_LOSS_TS), 10);
          return isNaN(t) ? 0 : t;
        } catch (t) {
          return 0;
        }
      })(),
      seenTrades = (() => {
        try {
          return new Set(JSON.parse(prefGet(KEY_SEEN_TRADES) || "[]"));
        } catch (t) {
          return new Set();
        }
      })();
    function expireLossStreak() {
      if (lossStreak > 0 && lastLossTs && Date.now() - lastLossTs > 900000) {
        lossStreak = 0;
        setLossStreakStored(0);
      }
    }
    !(function () {
      const t = getDayKey();
      if (
        (() => {
          try {
            return prefGet(KEY_STREAK_DATE) || "";
          } catch (t) {
            return "";
          }
        })() !== t
      ) {
        lossStreak = 0;
        lastLossTs = 0;
        seenTrades = new Set();
        setLossStreakStored(0);
        setLastLossTsStored(0);
        ((t) => {
          try {
            prefSet(KEY_SEEN_TRADES, JSON.stringify(Array.from(t).slice(-50)));
          } catch (t) {}
        })(seenTrades);
        ((t) => {
          try {
            prefSet(KEY_STREAK_DATE, t || "");
          } catch (t) {}
        })(t);
      }
    })();
    expireLossStreak();
    window.__tcRegisterOutcome = function (t) {
      expireLossStreak();
      if (t) {
        lossStreak += 1;
        lastLossTs = Date.now();
        setLastLossTsStored(lastLossTs);
      } else {
        lossStreak = 0;
      }
      setLossStreakStored(lossStreak);
      try {
        document.dispatchEvent(
          new CustomEvent("__tcLossStreak", {
            detail: {
              streak: lossStreak,
              isLoss: t,
            },
          }),
        );
      } catch (t) {}
      if (lossStreak >= 3) {
        if (
          typeof chrome != "undefined" &&
          chrome.runtime &&
          chrome.runtime.sendMessage &&
          !isSysLockDisabled()
        ) {
          try {
            chrome.runtime.sendMessage({
              type: "SYS_LOCK",
              mode: "streak",
            });
          } catch (t) {}
        }
        lossStreak = 0;
        setLossStreakStored(0);
      }
    };
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
      if (hasBalance) {
        updateTrailingSl(balanceNow, tpValue);
      }
      const slRaw = slInput.value,
        slValue = parsePlainNumber(slRaw),
        minPayout = parseInt(minPayoutInput.value, 10) || 89;
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
      if (openPnlEls.length > 0) {
        noTradesSince = 0;
      } else if (noTradesSince === 0) {
        noTradesSince = Date.now();
        setTimeout(scheduleRecalc, 2000);
      }
      const hasSl = !isNaN(slValue) && slValue > 0;
      if (hasSl && hasBalance && openPnlEls.length === 0 && Date.now() - noTradesSince >= 1800) {
        if (balanceNow <= slValue) {
          if (!window.__tcSLBreachNotified) {
            window.__tcSLBreachNotified = true;
            try {
              document.dispatchEvent(
                new CustomEvent("__tcSLBreach", {
                  detail: {
                    balance: balanceNow,
                    sl: slValue,
                  },
                }),
              );
            } catch (t) {}
            // v1.21.0: an SL breach no longer locks anything. It used to lock Quotex's "Set limit"
            // button for the day and send SYS_LOCK "sl" (6 h site block + close tabs).
          }
        } else if (window.__tcSLBreachNotified) {
          window.__tcSLBreachNotified = false;
        }
      }
      setText(riskEl, isNaN(riskPct) ? "—" : riskPct.toFixed(2) + "%");
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
      const tradeCapReached = openTradeCount() >= maxTrades,
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
      if (tpLineEl) {
        const t = getTodayTpFromSheet();
        if (t && hasBalance) {
          const {
            remaining: e,
            overshoot: n,
            pctDisplay: o,
            barPct: r,
          } = (function (t, e) {
            const n = t.target,
              o = e,
              r = n - o;
            let a;
            a =
              !isNaN(t.start) && n > t.start
                ? 100 * Math.max(0, (o - t.start) / (n - t.start))
                : 100 * Math.max(0, o / n);
            const i = a >= 100;
            return {
              remaining: r,
              overshoot: i,
              pctDisplay: i ? a.toFixed(2) : Math.round(a).toString(),
              barPct: Math.min(100, Math.round(a)),
            };
          })(t, balanceNow);
          setText(tpProgressEl, (n ? "✓ " : "") + o + "%");
          if (tpProgressEl) {
            tpProgressEl.style.color = n ? "var(--tc-grn)" : "";
          }
          setText(
            tpRemainEl,
            e > 0
              ? detectCurrency() +
                  (function (t) {
                    if (!isFinite(t)) {
                      return "—";
                    }
                    const e = Math.abs(t),
                      n = t < 0 ? "-" : "";
                    return isInr()
                      ? e >= 10000000
                        ? n + (e / 10000000).toFixed(e >= 100000000 ? 0 : 1).replace(/\.0$/, "") + "Cr"
                        : e >= 100000
                          ? n + (e / 100000).toFixed(1).replace(/\.0$/, "") + "L"
                          : e >= 1000
                            ? n + (e / 1000).toFixed(e >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k"
                            : n + Math.round(e)
                      : e >= 1000000000
                        ? n + (e / 1000000000).toFixed(e >= 10000000000 ? 0 : 1).replace(/\.0$/, "") + "B"
                        : e >= 1000000
                          ? n + (e / 1000000).toFixed(e >= 10000000 ? 0 : 1).replace(/\.0$/, "") + "M"
                          : e >= 1000
                            ? n + (e / 1000).toFixed(e >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k"
                            : n + Math.round(e);
                  })(e) +
                  " left"
              : "reached",
          );
          if (tpBarEl) {
            tpBarEl.style.width = r + "%";
          }
          if (tpBarTrackEl) {
            setDisplay(tpBarTrackEl, r > 0 ? "block" : "none");
          }
          setDisplay(tpLineEl, "flex");
        } else {
          setDisplay(tpLineEl, "none");
        }
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
        window._tcTimeBtnCache =
          t.find((t) => TF_LABEL_RE.test((t.textContent || "").trim())) ||
          t[0] ||
          document.querySelector(".M6Rz0 .Wy5Or");
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
      return e ? normLabel(e.textContent) : "";
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
    function getExpiryBox() {
      return document.querySelector(".NEJ1S");
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
      const e = t.querySelector(".EWNJc");
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
    function isActiveTab(t) {
      return t.id === "tab-active" || t.classList.contains("tab-active");
    }
    function activateTab(t) {
      const e = t.querySelector(".WRocw") || t.querySelector(".l5ftG") || t.querySelector(".pC7xL");
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
      return NaN;
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Trade click guard (double-click, max trades, min payout)
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    window.__tcTradeBlocker = (t) => {
      if (!t._tcFired && t.target.closest("#trade-button button, .bSenO button, .hkjXJ button")) {
        const e = Date.now();
        if (!multiMode && e - lastTradeClickAt < 1500) {
          t.stopPropagation();
          t.preventDefault();
          return;
        }
        if (openTradeCount() >= maxTrades) {
          t.stopPropagation();
          t.preventDefault();
          scheduleRecalc();
          return;
        }
        const n = readPayoutPct(),
          o = parseInt(minPayoutInput.value, 10) || 89;
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
        recordPlacement();
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
        if (focused && focused.closest && focused.closest("#trade-button, .bSenO, .hkjXJ, .deal-amount-input")) {
          return;
        }
      }
      if (t.key === "Enter") {
        const e = byId("__tcLogBtn");
        if (e && !e.disabled) {
          t.preventDefault();
          e.click();
        }
        return;
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
        if (!hkLeftRight) {
          return;
        }
        const e = getStepMult() > 1 ? getStepFactor() : 1;
        if (e > 1) {
          if (!(stakeInputEl && stakeInputEl.isConnected)) {
            stakeInputEl =
              document.querySelector(".deal-amount-input input.input-control__input") ||
              document.querySelector("input.input-control__input");
          }
          const n = stakeInputEl;
          if (n) {
            t.preventDefault();
            const o = n.value.includes("%");
            let r = parseMoney(n.value);
            if (isNaN(r) || r <= 0) {
              r = 1;
            }
            let a = t.code === "ArrowRight" ? r * e : r / e;
            a = o ? Math.round(a) : Math.round(100 * a) / 100;
            if (a < 1) {
              a = 1;
            }
            if (o && a > 100) {
              a = 100;
            }
            typeInto(n, String(a));
          }
        } else {
          let e = document.querySelectorAll(".deal-amount-input .VK9Nw");
          if (e.length < 2) {
            e = document.querySelectorAll(".deal-amount-input .YqVwL");
          }
          if (e.length >= 2) {
            t.preventDefault();
            const stepBtn = t.code === "ArrowLeft" ? e[0] : e[1];
            if (hkFocusMode) {
              // Focus mode (v1.29.0): select the platform's own -/+ button and let the next Enter or
              // Space activate it. Focus stays on it, so a run of steps costs one key each after the
              // first, and every click is generated by the browser.
              try {
                stepBtn.focus({ preventScroll: true });
              } catch (n) {}
              if (warnEl) {
                setText(warnEl, (t.code === "ArrowLeft" ? "Amount −" : "Amount +") + " selected — press Enter to step");
                setDisplay(warnEl, "block");
                warnEl.classList.add("tcWarnVisible");
              }
              return;
            }
            synthClick(stepBtn);
          }
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
        if (openTradeCount() >= maxTrades) {
          t.preventDefault();
          scheduleRecalc();
          return;
        }
        const n = readPayoutPct(),
          o = parseInt(minPayoutInput.value, 10) || 89;
        if (!isNaN(n) && n < o) {
          return;
        }
        const r = (function () {
          let t = document.querySelectorAll("#trade-button button");
          if (t.length >= 2) {
            return t;
          }
          const e = document.querySelector("svg.icon-arrow-up-circle")?.closest("button"),
            n = document.querySelector("svg.icon-arrow-down-circle")?.closest("button");
          if (e && n) {
            return [e, n];
          }
          const o = Array.from(document.querySelectorAll("button")).filter((t) => !t.closest("#__tradeCalc")),
            r = o.find((t) => t.querySelector(".WRS3E")?.textContent.trim() === "Up"),
            a = o.find((t) => t.querySelector(".WRS3E")?.textContent.trim() === "Down");
          if (r && a) {
            return [r, a];
          } else {
            t = document.querySelectorAll(".hkjXJ button, .bSenO button");
            return t.length >= 2 ? t : [];
          }
        })();
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
          const t = parseInt(minPayoutInput.value, 10) || 89;
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
                      const n = parseInt(minPayoutInput.value, 10);
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
        autoCloseLowPayoutTabs(parseInt(minPayoutInput.value, 10) || 89, true);
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
      window.__tcJournalEsc(t);
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
        r =
          document.getElementById("tab-active") ||
          document.querySelector(".dJ15T") ||
          document.querySelector(".pPomf");
      tradeLog.unshift({
        uuid: null,
        ts: Date.now(),
        pair: getTabName(r) || "",
        amount: o,
        bal: t,
      });
      saveTradeLog();
    }
    function readDetailField(t, e) {
      if (!t) {
        return "";
      }
      const n = t.querySelectorAll("li");
      for (let t = 0; t < n.length; t++) {
        const o = n[t].querySelector(".AUfBG") || n[t].querySelector(".qWutN");
        if (o && o.textContent.trim().toLowerCase().indexOf(e) === 0) {
          const e = n[t].querySelector(".w3o70") || n[t].querySelector(".UFtUT");
          return e ? e.textContent.trim() : "";
        }
      }
      return "";
    }
    function tagHistoryEntryBalances() {
      if (!entryTagsOn) {
        return;
      }
      const t = document.querySelectorAll(".ib6yR, .SDEZP");
      let e = false;
      for (let n = 0; n < t.length; n++) {
        const o = t[n],
          r = o.querySelector(".Fqtla"),
          a = o.querySelector(".O5xJP");
        if (!r && !a) {
          continue;
        }
        const i = a || o;
        if (i.querySelector("." + ids.tcPlacedBal)) {
          continue;
        }
        const s = o.querySelector(".RxOUE") || o.querySelector(".glItV"),
          l = s ? s.textContent.trim() : "";
        let d = NaN;
        if (r) {
          let t = r.textContent || "";
          const e = r.querySelector(".lCITV");
          if (e) {
            t = t.replace(e.textContent, "");
          }
          d = parseNum(t);
        } else {
          const t = a.querySelector(".h6J0L");
          let e = t ? t.textContent : "";
          const n = t && t.querySelector(".B7WYW");
          if (n) {
            e = e.replace(n.textContent, "");
          }
          d = parseNum(e);
        }
        const u = o.querySelector(".ow8Ej") || o.querySelector(".b98_V"),
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
    function getAssetDropdown() {
      return (
        document.querySelector("#asset-select-dropdown") ||
        document.querySelector(".a_IoG") ||
        document.querySelector(".yejPg") ||
        document.querySelector(".nu9IG")
      );
    }
    function getAssetAddButton() {
      const t = (t) => {
        const e = document.querySelector(t);
        return e && e.closest("button");
      };
      return (
        document.querySelector("#asset-select--button button") ||
        document.querySelector("#asset-select--button") ||
        t("#trade-page-content svg.icon-plus") ||
        t("svg.icon-plus")
      );
    }
    function isAssetDropdownOpen() {
      const t = document.querySelector("#asset-select-dropdown");
      if (!t) {
        return false;
      }
      const e = getComputedStyle(t);
      if (e.display === "none" || e.visibility === "hidden" || parseFloat(e.opacity || "1") === 0) {
        return false;
      }
      const n = t.getBoundingClientRect();
      return n.width > 1 && n.height > 1;
    }
    function closeAssetDropdownStep(t) {
      if (!isAssetDropdownOpen()) {
        return true;
      }
      const e = document.querySelector("#asset-select-dropdown"),
        n = e && e.querySelector('[aria-label="Close"]'),
        o = getAssetAddButton(),
        r = o && !o.closest(".deal-amount-input") && !o.closest("#__tradeCalc");
      if (t === 0 && n && !n.closest("#__tradeCalc")) {
        synthClick(n);
      } else if (t === 1 || t >= 4) {
        if (
          !(function () {
            const t =
              document.querySelector("#graph canvas") ||
              document.querySelector("canvas.layer.plot") ||
              document.querySelector("#graph") ||
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
        e = Array.from(t.querySelectorAll("*")).filter((t) => {
          const e = t.textContent || "";
          return (
            !(!/[A-Z]{3}\/[A-Z]{3}/.test(e) || !/\d+%/.test(e)) &&
            !Array.from(t.children).some((t) => {
              const e = t.textContent || "";
              return /[A-Z]{3}\/[A-Z]{3}/.test(e) && /\d+%/.test(e);
            })
          );
        });
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
    function isPairTabOpen(t) {
      return getPairTabs().some((e) => normKey(getTabName(e)) === t);
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Page observer (v1.23.0): one MutationObserver on document.body feeds the three consumers that used
    // to each observe the whole body subtree: the account-label spoof, recalc scheduling and the trade
    // history "Entry balance" tags. Cleanup disconnects it through window.__tradeCalcObs.
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
    function ensureAssetDropdown(t, e) {
      if (getOtcAssetRows().length) {
        e();
      } else if (t >= 32) {
        otcRebuildBusy = false;
      } else {
        if (!isAssetDropdownOpen()) {
          const t = getAssetAddButton();
          if (!(!t || t.closest(".deal-amount-input") || t.closest("#__tradeCalc"))) {
            synthClick(t);
          }
        }
        window.__tcOtcRebuildTimer = setTimeout(() => ensureAssetDropdown(t + 1, e), 150);
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
      allBelowSince = 0,
      // v1.54.1: why this did or did not act, for the diagnostics line. Whether a pair SHOULD have been
      // opened cannot be judged from outside the tab without the payouts it was looking at.
      autoOpenReason = "starting up";
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
        return shown;
      }
      const asset = storeAssetFor(tab);
      return asset && asset.payout != null ? asset.payout : NaN;
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
    function bestAssetAboveFloor(min) {
      const assets = readQuotexAssets();
      if (!assets) {
        return null;
      }
      const open = new Set(getPairTabs().map((t) => normKey(getTabName(t))));
      let best = null;
      for (const symbol in assets) {
        const a = assets[symbol];
        if (!a || !a.active || a.payout == null || !(a.payout >= min)) {
          continue;
        }
        const norm = normKey(a.label || symbol);
        if (!norm || open.has(norm)) {
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
    function autoOpenBetterPair(min) {
      autoOpenBusy = true;
      otcRebuildBusy = true; // the rebuild hotkeys and this must never drive the list at the same time
      lastAutoOpenAt = Date.now();
      // ensureAssetDropdown gives up silently after 32 tries; without this the flag would stay set.
      window.__tcAutoOpenTimer = setTimeout(() => {
        if (autoOpenBusy) {
          autoOpenFinish();
        }
      }, 12000);
      const wanted = bestAssetAboveFloor(min);
      autoOpenReason = wanted ? "opening " + wanted.label + " at " + wanted.payout + "%" : "looking for a pair above " + min + "%";
      ensureAssetDropdown(0, () => {
        const rows = getAssetChoices(),
          open = new Set(getPairTabs().map((t) => normKey(getTabName(t)))),
          pick =
            (wanted && rows.find((r) => r.norm === wanted.norm)) ||
            rows
              .filter((r) => !isNaN(r.payout) && r.payout >= min && !open.has(r.norm))
              .sort((a, b) => b.payout - a.payout || a.name.localeCompare(b.name))[0],
          target = pick && (pick.click || pick.row);
        if (!target || !target.isConnected) {
          autoOpenReason = "nothing in the asset list clears " + min + "%";
          autoOpenFinish();
          return;
        }
        synthClick(target);
        waitUntil(() => isPairTabOpen(pick.norm), 80, 800, autoOpenFinish);
      });
    }
    function maybeAutoOpenPair(min) {
      const stop = (why) => {
        autoOpenReason = why;
      };
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
      if (now - lastAutoOpenAt < AUTO_OPEN_AGAIN_MS) {
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
      if (payouts.some((p) => p >= min)) {
        allBelowSince = 0;
        return stop("a pair is at or above " + min + "%");
      }
      if (!allBelowSince) {
        allBelowSince = now;
        return stop("every pair below " + min + "% - waiting to see if it holds");
      }
      if (now - allBelowSince < AUTO_OPEN_SETTLE_MS) {
        return stop("every pair below " + min + "% - waiting to see if it holds");
      }
      allBelowSince = 0;
      autoOpenReason = "every pair below " + min + "% - opening one";
      autoOpenBetterPair(min);
    }
    function closeAssetDropdown() {
      if (window.__tcAssetCloseTimer) {
        clearTimeout(window.__tcAssetCloseTimer);
        window.__tcAssetCloseTimer = null;
      }
      let t = 0;
      const e = () => {
        try {
          if (!isAssetDropdownOpen() || t >= 8) {
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
      waitUntil(() => !isAssetDropdownOpen(), 100, 600, e);
    }
    if (typeof chrome != "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        [
          KEY_OTC_AUTO,
          KEY_CHIP_POS,
          KEY_MAX_TRADES,
          KEY_MAX_TWO,
          KEY_TIMER_X,
          KEY_TIMER_Y,
          KEY_HK_UPDOWN,
          KEY_HK_LEFTRIGHT,
          KEY_MARQUEE_MSG,
          KEY_MARQUEE_SPEED,
          KEY_MTF_TFS,
          KEY_MTF_COUNT,
          KEY_MTF_AUTOFILL,
          KEY_MTF_SETTLE,
          KEY_MTF_FLIP,
          KEY_MTF_FLIP_BARS,
        ],
        (t) => {
          if (!t) {
            return;
          }
          if (KEY_CHIP_POS in t && t[KEY_CHIP_POS]) {
            chipPos = normChipPos(t[KEY_CHIP_POS]);
            setChipPosStored(chipPos);
          }
          if (KEY_MAX_TRADES in t && t[KEY_MAX_TRADES] != null) {
            maxTrades = clampMaxTrades(t[KEY_MAX_TRADES]);
            setMaxTradesStored(maxTrades);
          } else if (KEY_MAX_TWO in t && typeof t[KEY_MAX_TWO] == "boolean") {
            maxTrades = t[KEY_MAX_TWO] ? 2 : 4;
            setMaxTradesStored(maxTrades);
          }
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
          if (KEY_HK_LEFTRIGHT in t) {
            hkLeftRight = t[KEY_HK_LEFTRIGHT] === true;
            setHkLeftRightStored(hkLeftRight);
          }
          if (KEY_MARQUEE_SPEED in t) {
            marqueeSpeed = clampMarqueeSpeed(t[KEY_MARQUEE_SPEED]);
            setMarqueeSpeedStored(marqueeSpeed);
          }
          if (KEY_MARQUEE_MSG in t) {
            marqueeMsg = t[KEY_MARQUEE_MSG] || "";
            setMarqueeMsgStored(marqueeMsg);
          }
          renderMarquee();
          const e = getMtfTfs().join(",") + "|" + getMtfCount();
          if (KEY_MTF_TFS in t && t[KEY_MTF_TFS]) {
            setMtfTfs(t[KEY_MTF_TFS]);
          }
          if (KEY_MTF_COUNT in t && t[KEY_MTF_COUNT] != null) {
            setMtfCount(t[KEY_MTF_COUNT]);
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
    const settleTracker = new Map();
    // v1.22.0: settled trades come from the store's closed deals when the bridge is available. The page
    // rows below (`.A7vDd` / `.Os2ep`) no longer exist on the current Quotex build, so the loss streak
    // could never trigger (B7). Deals already closed when the panel starts are the baseline, not outcomes.
    let storeClosedSeen = null;
    let outcomesVia = "page";
    function trackStoreOutcomes() {
      const state = readQuotexState();
      if (!state || !Array.isArray(state.closedDeals)) {
        return false;
      }
      const deals = dealsForThisAccount(state.closedDeals);
      if (storeClosedSeen === null) {
        storeClosedSeen = new Set(deals.map((d) => d.id));
        return true;
      }
      // Oldest first, so the streak counts in the order the trades closed.
      for (const d of deals.slice().reverse()) {
        if (!d.id || storeClosedSeen.has(d.id)) {
          continue;
        }
        storeClosedSeen.add(d.id);
        if (typeof window.__tcRegisterOutcome == "function") {
          window.__tcRegisterOutcome(!(d.profit > 0));
        }
      }
      return true;
    }
    every(500, function () {
      if (trackStoreOutcomes()) {
        outcomesVia = "store";
        settleTracker.clear();
        return;
      }
      outcomesVia = "page";
      const t = document.getElementsByClassName("A7vDd"),
        e = new Set();
      for (let n = 0; n < t.length; n++) {
        const o = t[n],
          r = getDealKey(o);
        if (!r) {
          continue;
        }
        e.add(r);
        const a = o.querySelector(".Os2ep"),
          i = a ? parseMoney(a.textContent) : NaN;
        if (isNaN(i)) {
          if (!settleTracker.has(r)) {
            settleTracker.set(r, 0);
          }
        } else {
          settleTracker.set(r, i);
        }
      }
      for (const [t, n] of Array.from(settleTracker.entries())) {
        if (!e.has(t)) {
          settleTracker.delete(t);
          if (typeof window.__tcRegisterOutcome == "function") {
            window.__tcRegisterOutcome(!(n > 0));
          }
        }
      }
    });
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
    function fmtCountdown(t, e) {
      if (t < 0) {
        t = 0;
      }
      const n = Math.floor(t / 60),
        o = t % 60,
        r = Math.floor(e / 10),
        a = (t) => (t < 10 ? "0" + t : "" + t);
      return a(n) + ":" + a(o) + "." + a(r);
    }
    let cursorPos = null,
      cursorInGraph = false,
      chipRaf = 0,
      liveTagRaf = 0;
    function positionChip(t, e) {
      if (!t) {
        return;
      }
      const n = t.id === ids.tcProjChip;
      if (isNarrowMobile()) {
        if (t.style.position !== "fixed") {
          t.style.position = "fixed";
          t.style.transform = "none";
          t.style.top = "auto";
        }
        t.style.left = "196px";
        t.style.right = "121px";
        if (n) {
          const e = byId(ids.tcTradeTimer),
            n = e && e.style.display === "block" ? e.offsetHeight + 8 : 0;
          t.style.bottom = 210 + n + "px";
        } else {
          t.style.bottom = "210px";
        }
        t._tcPosX = t._tcPosY = t._tcPxX = t._tcPxY = null;
      } else {
        if (t.style.position === "fixed") {
          t.style.position = "absolute";
          t.style.right = "auto";
          t.style.bottom = "auto";
        }
        if (chipPos === "cursor" && cursorInGraph && cursorPos && e) {
          const o = e.getBoundingClientRect();
          let r = cursorPos.x - o.left,
            a = cursorPos.y - o.top + (n ? -30 : 30);
          r = Math.max(8, Math.min(r, o.width - 8));
          const i = t.offsetHeight || 30;
          a = n ? Math.max(i + 4, Math.min(a, o.height - 4)) : Math.max(4, Math.min(a, o.height - i - 4));
          if (t._tcPxX !== r) {
            t._tcPxX = r;
            t.style.left = r + "px";
          }
          if (t._tcPxY !== a) {
            t._tcPxY = a;
            t.style.top = a + "px";
          }
          t.style.transform = n ? "translate(-50%, -100%)" : "translate(-50%, 0)";
          t._tcPosX = t._tcPosY = null;
        } else {
          let e, o;
          if (chipPos === "center") {
            e = 50;
            o = n ? 56 : 44;
          } else {
            e = n ? 50 : timerX;
            o = n ? 10 : timerY;
          }
          if (t._tcPosX !== e) {
            t._tcPosX = e;
            t.style.left = e + "%";
          }
          if (t._tcPosY !== o) {
            t._tcPosY = o;
            t.style.top = o + "%";
          }
          t.style.transform = "translate(-50%, -50%)";
          t._tcPxX = t._tcPxY = null;
        }
      }
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
            const t = document.getElementById("graph");
            positionChip(byId(ids.tcTradeTimer), t);
            positionChip(byId(ids.tcProjChip), t);
          });
        }
      }
    };
    window.__tcTimerMouseLeave = () => {
      cursorInGraph = false;
      const t = document.getElementById("graph");
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
      const n = document.getElementById("graph");
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
            time: fmtCountdown(isNaN(trade.secondsLeft) ? 0 : trade.secondsLeft, 0),
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
          time: fmtCountdown(g, _),
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
    // Marquee message
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    function renderMarquee() {
      let t = byId("__tcMarquee");
      const e = (marqueeMsg || "").trim();
      if (!e) {
        if (t) {
          t.remove();
        }
        return;
      }
      if (!t) {
        t = document.createElement("div");
        t.id = "__tcMarquee";
        t.innerHTML = '<span class="tcMarqueeTrack"></span>';
        shadow.appendChild(t);
      }
      const n = t.firstChild;
      if (n._tcMsg !== e) {
        n._tcMsg = e;
        n.textContent = e;
      }
      const o = Math.max(12, Math.min(60, Math.round(0.18 * e.length))),
        r = clampMarqueeSpeed(marqueeSpeed),
        a = Math.max(4, Math.min(120, Math.round((5 * o) / r)));
      if (n._tcDur !== a) {
        n._tcDur = a;
        t.style.setProperty("--tc-marquee-dur", a + "s");
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Investment multiplier widget
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const STEP_FACTORS = [1.3, 1.5];
    function getStepFactor() {
      const t = Math.round(10 * getStepMult()) / 10;
      return t > 1
        ? -1 !== STEP_FACTORS.indexOf(t)
          ? t
          : STEP_FACTORS.reduce((e, n) => (Math.abs(n - t) < Math.abs(e - t) ? n : e), STEP_FACTORS[0])
        : 1.5;
    }
    function multiplyStake(t) {
      if (!(stakeInputEl && stakeInputEl.isConnected)) {
        stakeInputEl =
          document.querySelector(".deal-amount-input input.input-control__input") ||
          document.querySelector("input.input-control__input");
      }
      const e = stakeInputEl;
      if (!e) {
        return;
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
    }
    function renderInvestMultLabels(t) {
      const e = getStepFactor(),
        n = e === Math.round(e) ? String(e) : e.toFixed(1),
        o = t.querySelector('[data-im="up"]'),
        r = t.querySelector('[data-im="cycle"]'),
        a = t.querySelector('[data-im="down"]');
      if (o) {
        o.textContent = "×" + n;
      }
      if (r) {
        r.textContent = n + "×";
      }
      if (a) {
        a.textContent = "÷" + n;
      }
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
          mtfFillPendingFor = t.symbol; // opening a pair queues its fill (v1.35.0)
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
          const entry = mtfSymbol && mtfEntries[mtfSymbol + "@" + tfSec];
          const have = entry && entry.candles ? entry.candles.length : 0;
          if (have > most) {
            most = have;
            quiet = 0;
          } else {
            quiet++;
          }
          // Three quiet polls is the platform saying it has finished with this timeframe.
          if ((have > 0 && quiet >= 3) || Date.now() > deadline) {
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
        return stop("switched off in the popup");
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
      const e = parseInt(t.style.left, 10),
        n = parseInt(t.style.top, 10);
      if (isNaN(e) || isNaN(n)) {
        return;
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
        '<div class="tcMtfBar" data-mtf="drag"><span class="tcMtfPair" data-mtf="pair">—</span><button type="button" class="tcMtfSync" data-mtf="sync" aria-label="Refresh every timeframe" title="Visit each timeframe once and come back (blocked while a trade is open)">' +
        SYNC_ICON_SVG +
        '</button><span class="tcMtfGrip"></span></div>' +
        n +
        ["e", "w", "n", "s", "ne", "nw", "se", "sw"]
          .map((t) => '<div class="tcMtfRz" data-rz="' + t + '"></div>')
          .join("");
      t.addEventListener("click", (ev) => {
        const hit = ev.target.closest("[data-mtf]");
        if (hit && hit.getAttribute("data-mtf") === "sync") {
          ev.preventDefault();
          runMtfSync();
          return;
        }
        // v1.30.0: the timeframe label is the switch — click 5m and the platform chart goes to 5m, so
        // you can act on the cell you were just reading without going through their menu.
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
          return;
        }
        const e = Date.now();
        if (e - mtfLastPull >= 300) {
          mtfLastPull = e;
          pullChartSnapshot();
        }
        renderMtf(t);
        maybeAutofillMtf();
      })();
      if (byId("__tcMobileBar")) {
        renderMobileBar();
      }
    });
    // v1.31.2: a diagnostics line in the site's own storage. The health check lives in the popup, which
    // can only be read by whoever is sitting at the browser — no help when the panel is misbehaving in a
    // tab someone else has to reason about. This writes the same facts where any tab on qxbroker.com can
    // read them back: which build is running, the pair, what the auto-fill is waiting for, and the chart's
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
            autofill: mtfAutofill ? mtfAutofillReason : "switched off in the popup",
            openTrades: openTradeCount(),
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
    // Mobile bar (≤ 640 px)
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    const MOBILE_TIMEFRAMES = [
        "5s",
        "10s",
        "15s",
        "30s",
        "1m",
        "2m",
        "3m",
        "5m",
        "10m",
        "15m",
        "30m",
        "1h",
        "4h",
      ],
      KEY_MOBILE_POS = "__tradeCalc_mobile_pos_v3";
    function isNarrowMobile() {
      return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    }
    function getMobileTfItems() {
      return Array.from(document.querySelectorAll(".mIAGo"));
    }
    function getMobileTfButton() {
      return (document.querySelector(".Q1Na4 .icon-ellipsis") || {}).closest
        ? document.querySelector(".Q1Na4 .icon-ellipsis").closest(".Q1Na4")
        : document.querySelector(".Q1Na4");
    }
    function getMobileActiveTf() {
      const t = document.querySelector(".mIAGo.jAWQ4");
      if (t) {
        return (t.textContent || "").trim();
      }
      const e =
        document.querySelector(".NDbAT") ||
        Array.from(document.querySelectorAll(".HgaSf")).find((t) =>
          /^\d+\s*[smhd]$/i.test((t.textContent || "").trim()),
        );
      return e ? (e.textContent || "").trim() : "";
    }
    function stepMobileTimeframe(t) {
      const e = getMobileActiveTf().toLowerCase(),
        n = MOBILE_TIMEFRAMES.findIndex((t) => t.toLowerCase() === e),
        o = MOBILE_TIMEFRAMES.length;
      !(function (t) {
        const e = () => {
          const e = getMobileTfItems().find(
            (e) => (e.textContent || "").trim().toLowerCase() === t.toLowerCase(),
          );
          if (e) {
            synthClick(e);
            setTimeout(() => {
              const t = document.querySelector("#graph canvas, .chart canvas, canvas");
              if (t) {
                synthClick(t);
              }
            }, 120);
          }
        };
        if (getMobileTfItems().length) {
          e();
          return;
        }
        const n = getMobileTfButton();
        if (n) {
          synthClick(n);
          setTimeout(e, 260);
        }
      })(-1 !== n ? MOBILE_TIMEFRAMES[(n + t + o) % o] : MOBILE_TIMEFRAMES[t > 0 ? 4 : o - 1]);
    }
    function getExpiryModeBtn(t) {
      const e = document.querySelector(".bLvbC") || document.querySelector(".NEJ1S");
      return e
        ? Array.from(e.querySelectorAll(".n6Y_k")).find(
            (e) => (e.textContent || "").trim().toLowerCase() === t,
          )
        : null;
    }
    const QUICK_MIN_PAYOUTS = [84, 86, 89];
    function setMinPayout(t) {
      if (minPayoutInput) {
        t = Math.max(1, Math.min(100, t));
        minPayoutInput.value = String(t);
        setMinPayoutStored(String(t));
        minPayoutInput.dispatchEvent(
          new Event("input", {
            bubbles: true,
          }),
        );
        renderMobileBar();
        scheduleRecalc();
      }
    }
    function nudgeMinPayout(t) {
      if (!minPayoutInput) {
        return;
      }
      const e = parseInt(minPayoutInput.value, 10);
      setMinPayout((isNaN(e) ? 89 : e) + t);
    }
    function createMobileBar() {
      let t = byId("__tcMobileBar");
      if (!t) {
        t = document.createElement("div");
        t.id = "__tcMobileBar";
        t.innerHTML =
          '<div class="tcMbHandle" data-mb="drag" aria-hidden="true"><span class="tcMbGrip"></span></div><div class="tcMbRow"><span class="tcMbLbl">Timeframe</span><div class="tcMbCtl"><button class="tcMbBtn" data-mb="tfprev" aria-label="Previous timeframe">‹</button><button class="tcMbVal" data-mb="tfopen" aria-label="Change chart timeframe"><b id="__tcMbTF">—</b></button><button class="tcMbBtn" data-mb="tfnext" aria-label="Next timeframe">›</button></div></div><div class="tcMbRow"><span class="tcMbLbl">Time</span><div class="tcMbCtl"><button class="tcMbBtn" data-mb="time" aria-label="Toggle trade time timer/clock"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></button><button class="tcMbVal" data-mb="time" aria-label="Toggle trade time timer/clock"><b id="__tcMbTime">—</b></button><button class="tcMbBtn" data-mb="time" aria-label="Toggle trade time timer/clock"><svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></button></div></div><div class="tcMbRow"><span class="tcMbLbl">Multiplier</span><div class="tcMbCtl"><button class="tcMbBtn" data-mb="invdown" aria-label="Divide investment">−</button><button class="tcMbVal" data-mb="invfactor" aria-label="Change multiplier factor"><b id="__tcMbFactor">×2</b></button><button class="tcMbBtn" data-mb="invup" aria-label="Multiply investment">+</button></div></div><div class="tcMbRow" data-mb-row="rp"><span class="tcMbLbl" id="__tcMbRpLbl">Payout (min —)</span><div class="tcMbCtl"><button class="tcMbBtn" data-mb="rpdown" aria-label="Lower minimum payout">−</button><button class="tcMbVal tcMbValGrn" data-mb="rp" aria-label="Live payout vs minimum"><b id="__tcMbRpNow">—</b></button><button class="tcMbBtn" data-mb="rpup" aria-label="Raise minimum payout">+</button></div><div class="tcMbQuick">' +
          QUICK_MIN_PAYOUTS.map(
            (t) =>
              '<button class="tcMbQuickBtn" data-mb="rpset" data-rp="' +
              t +
              '" aria-label="Set minimum payout to ' +
              t +
              ' percent">' +
              t +
              "</button>",
          ).join("") +
          "</div></div>";
        t.addEventListener("click", (t) => {
          const e = t.target.closest("[data-mb]");
          if (!e) {
            return;
          }
          const n = e.getAttribute("data-mb");
          if (n === "tfprev") {
            stepMobileTimeframe(-1);
          } else if (n === "tfnext") {
            stepMobileTimeframe(1);
          } else if (n === "tfopen") {
            const t = getMobileTfButton();
            if (t) {
              synthClick(t);
            }
          } else if (n === "time") {
            !(function () {
              const t = document.querySelector(".bLvbC") || document.querySelector(".NEJ1S");
              if (!t) {
                return;
              }
              const e = Array.from(t.querySelectorAll(".n6Y_k")).find((t) => t.classList.contains("K8TIp"));
              if (e && (e.textContent || "").trim().toLowerCase() === "timer") {
                const t = getExpiryModeBtn("time");
                if (t) {
                  synthClick(t);
                }
              } else {
                const e = getExpiryModeBtn("timer");
                if (e) {
                  synthClick(e);
                  setTimeout(() => {
                    const e = getExpiryTimeItems(t).find(
                      (t) => (t.textContent || "").trim() === "00:10",
                    );
                    if (e) {
                      synthClick(e);
                    }
                  }, 240);
                }
              }
            })();
          } else if (n === "invup") {
            multiplyStake(getStepFactor());
          } else if (n === "invdown") {
            multiplyStake(1 / getStepFactor());
          } else if (n === "invfactor") {
            const t = STEP_FACTORS.indexOf(getStepFactor());
            setStepMult(STEP_FACTORS[(t + 1) % STEP_FACTORS.length]);
            renderMobileBar();
          } else if (n === "rpdown") {
            nudgeMinPayout(-1);
          } else if (n === "rpup") {
            nudgeMinPayout(1);
          } else if (n === "rpset") {
            const t = parseInt(e.getAttribute("data-rp"), 10);
            if (!isNaN(t)) {
              setMinPayout(t);
            }
          }
        });
        const e = t.querySelector('[data-mb="drag"]');
        let n = false,
          o = 0,
          r = 0,
          a = 0,
          i = 0;
        const c = (e, c) => {
            n = true;
            const s = t.getBoundingClientRect();
            a = s.left;
            i = s.top;
            o = e;
            r = c;
          },
          s = (e, c) => {
            if (!n) {
              return;
            }
            let s = a + (e - o),
              l = i + (c - r);
            s = Math.max(2, Math.min(window.innerWidth - t.offsetWidth - 2, s));
            l = Math.max(2, Math.min(window.innerHeight - t.offsetHeight - 2, l));
            t.style.left = s + "px";
            t.style.top = l + "px";
            t.style.transform = "none";
            t.style.bottom = "auto";
          },
          l = () => {
            if (n) {
              n = false;
              try {
                prefSet(
                  KEY_MOBILE_POS,
                  JSON.stringify({
                    x: parseInt(t.style.left, 10),
                    y: parseInt(t.style.top, 10),
                  }),
                );
              } catch (t) {}
            }
          };
        e.addEventListener(
          "touchstart",
          (t) => {
            const e = t.touches[0];
            c(e.clientX, e.clientY);
          },
          {
            passive: true,
          },
        );
        window.addEventListener(
          "touchmove",
          (t) => {
            if (n) {
              const e = t.touches[0];
              s(e.clientX, e.clientY);
              t.preventDefault();
            }
          },
          {
            passive: false,
          },
        );
        window.addEventListener("touchend", l);
        e.addEventListener("mousedown", (t) => {
          c(t.clientX, t.clientY);
          t.preventDefault();
        });
        window.addEventListener("mousemove", (t) => s(t.clientX, t.clientY));
        window.addEventListener("mouseup", l);
        window.__tcMobileDragMove = s;
        if (panel && panel.classList && panel.classList.contains("tcLightMode")) {
          t.classList.add("tcLightMode");
        }
        shadow.appendChild(t);
        try {
          const e = JSON.parse(prefGet(KEY_MOBILE_POS) || "null");
          if (e && typeof e.x == "number") {
            t.style.left = e.x + "px";
            t.style.top = e.y + "px";
            t.style.bottom = "auto";
            t.style.transform = "none";
            clampMobileBar(t);
          }
        } catch (t) {}
      }
      renderMobileBar();
    }
    function clampMobileBar(t) {
      if (!t) {
        return;
      }
      const e = parseInt(t.style.left, 10),
        n = parseInt(t.style.top, 10);
      if (isNaN(e) || isNaN(n)) {
        return;
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
    function renderMobileBar() {
      const t = byId("__tcMobileBar");
      if (!t) {
        return;
      }
      const e = byId("__tcMbTF");
      if (e) {
        e.textContent = getMobileActiveTf() || "—";
      }
      const n = byId("__tcMbTime");
      if (n) {
        n.textContent = (function () {
          const t = document.querySelector(".bLvbC") || document.querySelector(".NEJ1S");
          if (!t) {
            return "—";
          }
          const e = Array.from(t.querySelectorAll(".n6Y_k")).find((t) => t.classList.contains("K8TIp")),
            n = e ? (e.textContent || "").trim().toLowerCase() : "",
            o = (t.querySelector("input") || {}).value || "";
          if (n === "timer") {
            const t = o.split(":");
            return t.length ? parseInt(t[t.length - 1], 10) + "s" : "timer";
          }
          return "clk";
        })();
      }
      const o = byId("__tcMbFactor");
      if (o) {
        o.textContent = "×" + getStepFactor();
      }
      const r = byId("__tcMbRpNow"),
        a = byId("__tcMbRpLbl"),
        i = readPayoutPct(),
        c = (minPayoutInput && parseInt(minPayoutInput.value, 10)) || 89;
      if (a) {
        a.textContent = "Payout (min " + c + "%)";
      }
      if (r) {
        r.textContent = isNaN(i) ? "—" : i + "%";
      }
      t.classList.toggle("tcMbRpLow", !isNaN(i) && i < c);
      const s = t.getElementsByClassName("tcMbQuickBtn");
      for (let t = 0; t < s.length; t++) {
        s[t].classList.toggle("tcMbQuickOn", parseInt(s[t].getAttribute("data-rp"), 10) === c);
      }
    }
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    // Layout mode switch, startup, popup message handling
    // ────────────────────────────────────────────────────────────────────────────────────────────────
    function applyLayoutMode() {
      if (isNarrowMobile()) {
        if (panel && panel.style.display !== "none") {
          panel._tcMobHidden = true;
          panel.style.display = "none";
        }
        const t = byId("__tcInvestMult");
        if (t) {
          t.style.display = "none";
        }
        if (restoreBtn) {
          restoreBtn.style.display = "none";
        }
        destroyMtf();
        createMobileBar();
        clampMobileBar(byId("__tcMobileBar"));
      } else {
        const t = byId("__tcMobileBar");
        if (t) {
          t.remove();
        }
        if (panel && panel._tcMobHidden) {
          panel.style.display = "flex";
          panel._tcMobHidden = false;
        }
        const e = byId("__tcInvestMult");
        if (e) {
          e.style.display = "";
        }
        if (readFlag(KEY_MTF_ON, false)) {
          createMtf();
        }
        clampToViewport(byId("__tcMTF"));
      }
    }
    window.__tcMobileResize = () => applyLayoutMode();
    window.addEventListener("resize", window.__tcMobileResize);
    renderMarquee();
    (function () {
      let t = byId("__tcInvestMult");
      if (!t) {
        t = document.createElement("div");
        t.id = "__tcInvestMult";
        t.innerHTML =
          '<button type="button" class="tcImBtn tcImUp" data-im="up" aria-label="Multiply investment by factor" title="Multiply investment"></button><button type="button" class="tcImBtn tcImFactor" data-im="cycle" aria-label="Change multiplier factor" title="Tap to change factor"></button><button type="button" class="tcImBtn tcImDown" data-im="down" aria-label="Divide investment by factor" title="Divide investment"></button>';
        t.addEventListener("click", (e) => {
          const n = e.target.closest("[data-im]");
          if (!n) {
            return;
          }
          const o = n.getAttribute("data-im");
          if (o === "cycle") {
            const e = STEP_FACTORS.indexOf(getStepFactor());
            setStepMult(STEP_FACTORS[(e + 1) % STEP_FACTORS.length]);
            renderInvestMultLabels(t);
          } else {
            const t = getStepFactor();
            multiplyStake(o === "up" ? t : 1 / t);
          }
        });
        shadow.appendChild(t);
      }
      renderInvestMultLabels(t);
    })();
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
    applyLayoutMode();
    if (readFlag(KEY_MTF_ON, false) && !isNarrowMobile()) {
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
        const status = !el ? "missing" : via === "class" ? "ok" : "fallback";
        add(label, status, via === "learned" ? "learned " + learnedSelectors[key].sel : via, el ? textOf(el).slice(0, 24) || el.tagName.toLowerCase() : "");
      }
      const balance = readAccountBalance();
      add("Balance value", isNaN(balance) ? "missing" : "ok", "page", isNaN(balance) ? "" : balance);
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
      const domOpen = getOpenTradePnlEls().length;
      const storeOpen = storeOpenTradeCount();
      add("Open trades", isNaN(storeOpen) && !domOpen ? "fallback" : "ok", isNaN(storeOpen) ? "page" : "store + page", domOpen + " page · " + (isNaN(storeOpen) ? "—" : storeOpen) + " store");
      add("Settled trades (loss streak)", outcomesVia === "store" ? "ok" : "fallback", outcomesVia, "streak " + lossStreak);
      // Lists (v1.25.0). A menu that isn't open right now can't be checked; that's "not open", not broken.
      const openRows = getOpenTradeRows();
      const storeTrades = storeOpenTrades();
      const openCount = openRows.length || (storeTrades ? storeTrades.length : 0);
      add(
        "Open trades list",
        !openCount ? "idle" : openRows.length ? (listVia.openTradeRows === "class" ? "ok" : "fallback") : "ok",
        openRows.length ? listVia.openTradeRows || "page" : storeTrades ? "store" : "none",
        openCount ? openCount + " open" : "no open trades",
      );
      add("Trade timers", !openCount ? "idle" : "ok", openRows.length ? "page" : timersVia, openCount ? openCount + " tracked" : "no open trades");
      const dropdown = getAssetDropdown();
      const assetRows = dropdown ? getAssetRows(dropdown) : [];
      add(
        "Asset list rows",
        !dropdown ? "idle" : assetRows.length ? (listVia.assetRows === "class" ? "ok" : "fallback") : "missing",
        dropdown ? listVia.assetRows || "heuristic" : "not open",
        dropdown ? assetRows.length + " rows" : "not open",
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
        !mtfAutofill ? "idle" : /^(ready|filling|filled)/.test(mtfAutofillReason) ? "ok" : "fallback",
        byId("__tcMTF") ? "charts open" : "charts hidden",
        mtfAutofillReason,
      );
      const version =
        typeof chrome != "undefined" && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : "";
      return { version, build: BUILD_VERSION, url: location.pathname, rows };
    }
    if (typeof chrome != "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      // Kept on window so cleanup can remove it (hotfix v1.20.1): otherwise a torn-down panel's
      // listener stays registered and answers the popup's GET_STATE with stale values after a relaunch.
      window.__tcMsgListener = (t, e, n) => {
        if (t.type === "GET_STATE") {
          n({
            theme: getTheme(),
            fontSize: parseInt(getFontSizeStored(), 10),
            journalFontSize: parseInt(getJournalFontSizeStored(), 10),
            visibility: sectionVisibility.slice(),
            sheetUrl: getSheetUrl(),
            otcAuto: otcAuto,
            chipPos: chipPos,
            maxTrades: maxTrades,
            timerX: timerX,
            timerY: timerY,
            hkUpDown: hkUpDown,
            hkLeftRight: hkLeftRight,
            marquee: marqueeMsg,
            marqueeSpeed: marqueeSpeed,
            mtfTfs: getMtfTfs(),
            mtfCount: getMtfCount(),
            mtfAutofill,
            mtfSettle: getMtfSettle(),
            mtfFlip: mtfFlipOn,
            mtfFlipBars: getMtfFlipBars(),
            relabelDemo,
            entryTags: entryTagsOn,
            hkFocusMode,
          });
        } else if (t.type === "SET_THEME") {
          const e = t.theme === "light";
          setThemeStored(t.theme);
          if (e) {
            panel.classList.add("tcLightMode");
            if (restoreBtn) {
              restoreBtn.classList.add("tcLightMode");
            }
          } else {
            panel.classList.remove("tcLightMode");
            if (restoreBtn) {
              restoreBtn.classList.remove("tcLightMode");
            }
          }
        } else if (t.type === "SET_SIZE") {
          setPanelFontSize(t.size);
        } else if (t.type === "SET_JOURNAL_SIZE") {
          setJournalFontSize(t.size);
        } else if (t.type === "SET_VISIBILITY") {
          const e = Array.isArray(t.visibility) ? t.visibility : sectionVisibility;
          saveVisibilityStored(e);
          applyVisibility(e);
        } else if (t.type === "SET_SHEET_URL") {
          o = t.url || "";
          sheetUrl = o || "";
          setSheetUrlStored(sheetUrl);
          applySheetUrlVisibility(sheetUrl);
        } else if (t.type === "SET_MAX_TRADES") {
          maxTrades = clampMaxTrades(t.value);
          setMaxTradesStored(maxTrades);
          scheduleRecalc();
        } else if (t.type === "SET_CHIP_POS") {
          chipPos = normChipPos(t.mode);
          setChipPosStored(chipPos);
          const e = document.getElementById("graph");
          positionChip(byId(ids.tcTradeTimer), e);
          positionChip(byId(ids.tcProjChip), e);
        } else if (t.type === "SET_OTC_AUTO") {
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
        } else if (t.type === "SET_HOTKEYS") {
          if ("upDown" in t) {
            hkUpDown = !!t.upDown;
            setHkUpDownStored(hkUpDown);
          }
          if ("leftRight" in t) {
            hkLeftRight = !!t.leftRight;
            setHkLeftRightStored(hkLeftRight);
          }
        } else if (t.type === "SET_MARQUEE") {
          if ("message" in t) {
            marqueeMsg = t.message || "";
            setMarqueeMsgStored(marqueeMsg);
          }
          if (typeof t.speed == "number") {
            marqueeSpeed = clampMarqueeSpeed(t.speed);
            setMarqueeSpeedStored(marqueeSpeed);
          }
          renderMarquee();
        } else if (t.type === "SET_SYS_LOCK_DISABLED") {
          if (void 0 !== sysLockDisabled) {
            sysLockDisabled = !!t.disabled;
            setSysLockDisabledStored(sysLockDisabled);
          }
        } else if (t.type === "GET_HEALTH") {
          let report;
          try {
            report = buildHealthReport();
          } catch (err) {
            report = { error: String(err && err.message ? err.message : err), rows: [] };
          }
          n(report);
        } else if (t.type === "SET_HK_FOCUS_MODE") {
          hkFocusMode = !!t.enabled;
          prefSet(KEY_HK_FOCUS_MODE, hkFocusMode ? "1" : "0");
        } else if (t.type === "SET_PAGE_MARKS") {
          if ("relabel" in t) {
            relabelDemo = !!t.relabel;
            prefSet(KEY_RELABEL_DEMO, relabelDemo ? "1" : "0");
            if (relabelDemo) {
              spoofLiveAccountLabel();
            } else {
              undoRelabel();
            }
          }
          if ("entryTags" in t) {
            entryTagsOn = !!t.entryTags;
            prefSet(KEY_ENTRY_TAGS, entryTagsOn ? "1" : "0");
            if (entryTagsOn) {
              tagHistoryEntryBalances();
            } else {
              document.querySelectorAll("." + ids.tcPlacedBal).forEach((el) => el.remove());
            }
          }
        } else if (t.type === "SET_SL_ENABLED") {
          if (t.enabled) {
            bootstrapSl(true);
          } else {
            disableSl();
          }
        } else if (t.type === "SET_POST_TP_GAP") {
          setPostTpGap(t.value);
          scheduleRecalc();
        } else if (t.type === "SET_MTF") {
          if ("tfs" in t) {
            setMtfTfs(t.tfs);
          }
          if ("count" in t) {
            setMtfCount(t.count);
          }
          if ("autofill" in t) {
            setMtfAutofill(t.autofill);
          }
          if ("settle" in t) {
            setMtfSettle(t.settle);
          }
          if ("flip" in t) {
            setMtfFlip(t.flip);
          }
          if ("flipBars" in t) {
            setMtfFlipBars(t.flipBars);
          }
          rebuildMtf();
        }
        var o;
        return true;
      };
      chrome.runtime.onMessage.addListener(window.__tcMsgListener);
    }
  };
  // ────────────────────────────────────────────────────────────────────────────────────────────────
  // Launcher: first start, SPA URL changes, popup TOGGLE_PANEL
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
  // Set when the user turns the panel off from the popup, so navigation doesn't bring it back.
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
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg.type === "TOGGLE_PANEL") {
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
