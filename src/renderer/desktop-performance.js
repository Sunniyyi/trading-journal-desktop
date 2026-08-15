/* Trading Journal Desktop — performance layer
   Loaded after the immutable V206 core. It only replaces hot-path helpers;
   the journal data model and backup format stay unchanged. */
(() => {
  'use strict';

  const perf = window.__tjDesktopPerf = window.__tjDesktopPerf || {
    version: 1,
    storageWritesQueued: 0,
    storageWritesFlushed: 0,
    deferredAnalytics: 0,
    monteCarloWorker: false
  };

  function installChartDefaults() {
    try {
      if (typeof Chart === 'undefined') return;
      Chart.defaults.animation = false;
      Chart.defaults.responsive = true;
      Chart.defaults.maintainAspectRatio = false;
    } catch (_) {}
  }

  function installStorageLayer() {
    try {
      if (typeof storageSet !== 'function' || typeof storageSetSync !== 'function' || typeof idbPut !== 'function') return;

      // localStorage is synchronous. Mirroring multi-megabyte JSON strings there
      // freezes the UI and usually fails at quota anyway. IndexedDB remains the
      // durable primary store; only small values keep a localStorage fallback.
      const LOCAL_MIRROR_LIMIT = 256 * 1024; // characters (~512 KiB worst-case UTF-16)
      const pending = new Map();
      let flushPromise = null;

      const canMirror = value => !_db || String(value ?? '').length <= LOCAL_MIRROR_LIMIT;

      function flushQueue() {
        if (!_db) return Promise.resolve();
        if (flushPromise) return flushPromise;

        flushPromise = (async () => {
          // Keep draining until no newer value remains. If a key is changed while an
          // older snapshot is in flight, the newer value stays in `pending` and is
          // written afterwards, so an obsolete async write can never win the race.
          while (pending.size) {
            const batch = [...pending.entries()];
            pending.clear();
            for (const [key, value] of batch) {
              try {
                await idbPut(key, value);
                perf.storageWritesFlushed++;
              } catch (err) {
                console.warn('[Desktop storage] IndexedDB write failed:', key, err);
              }
            }
          }
        })().finally(() => {
          flushPromise = null;
          if (pending.size) queueMicrotask(flushQueue);
        });

        return flushPromise;
      }

      function queueIdb(key, value) {
        if (!_db) return false;
        // Latest-write-wins per key. FXReplay can update a trade and its screenshots
        // almost back-to-back; there is no reason to persist the obsolete middle state.
        pending.set(key, value);
        perf.storageWritesQueued++;
        queueMicrotask(flushQueue);
        return true;
      }

      storageSet = function desktopStorageSet(key, value) {
        storeCache[key] = value;
        let durable = false;

        if (queueIdb(key, value)) durable = true;

        if (canMirror(value)) {
          try {
            localStorage.setItem(key, value);
            durable = true;
          } catch (_) {}
        } else {
          // Remove stale giant mirrors left by older builds. The same value is in IDB.
          try { localStorage.removeItem(key); } catch (_) {}
        }
        return durable;
      };

      storageSetSync = async function desktopStorageSetSync(key, value) {
        storeCache[key] = value;
        let durable = false;

        if (_db) {
          // Use the same ordered queue as normal writes and wait until it drains.
          // This preserves latest-write-wins even when an earlier write is already
          // in flight for the same key.
          pending.set(key, value);
          perf.storageWritesQueued++;
          try {
            await flushQueue();
            durable = true;
          } catch (_) {}
        }
        if (canMirror(value)) {
          try { localStorage.setItem(key, value); durable = true; } catch (_) {}
        } else {
          try { localStorage.removeItem(key); } catch (_) {}
        }
        return durable;
      };

      perf.flushStorage = flushQueue;
      perf.pendingStorageWrites = () => pending.size;

      // Clean only known oversized mirrors. No journal data is deleted from IDB.
      if (_db) {
        for (const key of [KEY, BT_PAGES_KEY, DAY_NOTES_KEY]) {
          try {
            const value = storeCache[key];
            if (typeof value === 'string' && value.length > LOCAL_MIRROR_LIMIT) localStorage.removeItem(key);
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[Desktop performance] storage layer not installed:', err);
    }
  }

  function installLazyAnalytics() {
    if (!('IntersectionObserver' in window)) return;

    const pendingPerf = new Map();
    let pendingMistakes = null;
    const originalPerf = typeof renderPerfInto === 'function' ? renderPerfInto : null;
    const originalMistakes = typeof renderMistakeAnalytics === 'function' ? renderMistakeAnalytics : null;
    if (!originalPerf && !originalMistakes) return;

    const nearViewport = el => {
      if (!el || !el.isConnected) return true;
      const r = el.getBoundingClientRect();
      return r.bottom >= -650 && r.top <= innerHeight + 650;
    };

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const perfKey = el.dataset.tjLazyPerf;
        if (perfKey && pendingPerf.has(perfKey)) {
          const args = pendingPerf.get(perfKey);
          pendingPerf.delete(perfKey);
          try { originalPerf(...args); } catch (err) { console.warn('[Lazy perf]', err); }
        }
        if (el.id === 'mistakeAnalyticsCard' && pendingMistakes) {
          const list = pendingMistakes;
          pendingMistakes = null;
          try { originalMistakes(list); } catch (err) { console.warn('[Lazy mistakes]', err); }
        }
      }
    }, { rootMargin: '650px 0px' });

    if (originalPerf) {
      renderPerfInto = function desktopRenderPerfInto(boxId, list, base) {
        const box = document.getElementById(boxId);
        if (!box || nearViewport(box)) return originalPerf(boxId, list, base);
        box.dataset.tjLazyPerf = boxId;
        pendingPerf.set(boxId, [boxId, list, base]);
        observer.observe(box);
        perf.deferredAnalytics++;
      };
    }

    if (originalMistakes) {
      renderMistakeAnalytics = function desktopRenderMistakes(list) {
        const card = document.getElementById('mistakeAnalyticsCard');
        if (!card || nearViewport(card)) return originalMistakes(list);
        pendingMistakes = list;
        observer.observe(card);
        perf.deferredAnalytics++;
      };
    }
  }

  function installMonteCarloWorker() {
    try {
      if (typeof runMonteCarlo !== 'function' || typeof Worker === 'undefined') return;
      const legacyRun = runMonteCarlo;

      runMonteCarlo = async function desktopRunMonteCarlo() {
        if (_mcRunning) return;
        const sel = (typeof btGetFiltered === 'function') ? btGetFiltered() : [];
        const rets = sel.map(t => Number(t.result) || 0);
        const empty = document.getElementById('mcEmpty');
        const res = document.getElementById('mcResults');
        if (rets.length < 10) return legacyRun();

        let runs = Math.min(100000, parseInt((document.getElementById('mcRuns') || {}).value, 10) || 10000);
        const nIn = parseInt((document.getElementById('mcN') || {}).value, 10);
        const N = Math.min(5000, Math.max(5, Number.isFinite(nIn) && nIn > 0 ? nIn : rets.length));
        const MAX_OPS = 60e6;
        let clamped = false;
        if (runs * N > MAX_OPS) { runs = Math.max(1000, Math.floor(MAX_OPS / N)); clamped = true; }
        const ruinPct = Math.min(100, Math.max(1, parseFloat((document.getElementById('mcRuin') || {}).value) || 8));
        const base = (typeof btBaseCapital === 'function') ? (Number(btBaseCapital()) || 0) : 0;

        const btn = document.getElementById('mcRunBtn');
        const btnTxt = btn ? btn.textContent : '🎲 Lancer';
        _mcRunning = true;
        if (btn) btn.disabled = true;

        let worker;
        try {
          worker = new Worker('./workers/monte-carlo-worker.js');
          perf.monteCarloWorker = true;
          const result = await new Promise((resolve, reject) => {
            worker.onmessage = event => {
              const msg = event.data || {};
              if (msg.type === 'progress') {
                if (btn) btn.textContent = `⏳ ${Math.max(0, Math.min(100, Math.round(msg.percent || 0)))} %`;
                return;
              }
              if (msg.type === 'result') resolve(msg.result);
              else if (msg.type === 'error') reject(new Error(msg.error || 'Erreur Monte-Carlo worker'));
            };
            worker.onerror = event => reject(new Error(event.message || 'Worker Monte-Carlo indisponible'));
            worker.postMessage({ rets, runs, N, ruinPct, base, clamped });
          });

          _mcRenderStats(result.stats);
          _mcDrawChart(result.labels, result.bands, result.samples, base);
          _mcCtx = {
            pageId: (typeof currentBtPageId !== 'undefined') ? currentBtPageId : null,
            monthId: (typeof currentBtMonthId !== 'undefined') ? currentBtMonthId : null
          };
          if (empty) empty.style.display = 'none';
          if (res) res.style.display = '';
        } catch (err) {
          console.warn('[Desktop Monte-Carlo] Worker fallback:', err);
          perf.monteCarloWorker = false;
          _mcRunning = false;
          if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
          try { worker?.terminate(); } catch (_) {}
          return legacyRun();
        } finally {
          try { worker?.terminate(); } catch (_) {}
          _mcRunning = false;
          if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
        }
      };
    } catch (err) {
      console.warn('[Desktop performance] Monte-Carlo worker not installed:', err);
    }
  }

  installChartDefaults();
  installStorageLayer();
  installLazyAnalytics();
  installMonteCarloWorker();
})();
