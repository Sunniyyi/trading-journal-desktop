/* Trading Journal Desktop — Monte-Carlo worker
   Heavy bootstrap + percentile sorting runs off the renderer thread. */
'use strict';

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

self.onmessage = event => {
  try {
    const input = event.data || {};
    const rets = Array.isArray(input.rets) ? input.rets.map(Number).filter(Number.isFinite) : [];
    const runs = Math.max(1, Number(input.runs) | 0);
    const N = Math.max(1, Number(input.N) | 0);
    const ruinPct = Math.max(1, Math.min(100, Number(input.ruinPct) || 8));
    const base = Number(input.base) || 0;
    const M = rets.length;
    if (!M) throw new Error('Aucun rendement à simuler.');

    const CP = Math.min(N, 120);
    const cpIdx = [];
    for (let k = 1; k <= CP; k++) cpIdx.push(Math.round(k * N / CP) - 1);
    const BMAX = Math.min(runs, 10000);
    const finals = new Float64Array(runs);
    const maxDDs = new Float64Array(runs);
    const streaks = new Int32Array(runs);
    const cpVals = Array.from({ length: CP }, () => new Float64Array(BMAX));

    const progressStep = Math.max(1, Math.floor(runs / 100));
    for (let r = 0; r < runs; r++) {
      let cum = 0, peak = 0, mdd = 0, ls = 0, mls = 0, cp = 0;
      const rec = r < BMAX;
      for (let i = 0; i < N; i++) {
        const v = rets[(Math.random() * M) | 0];
        cum += v;
        if (cum > peak) peak = cum;
        const dd = peak - cum;
        if (dd > mdd) mdd = dd;
        if (v < 0) { ls++; if (ls > mls) mls = ls; }
        else if (v > 0) ls = 0;
        if (cp < CP && i === cpIdx[cp]) {
          if (rec) cpVals[cp][r] = cum;
          cp++;
        }
      }
      finals[r] = cum;
      maxDDs[r] = mdd;
      streaks[r] = mls;
      if (r % progressStep === 0 || r === runs - 1) {
        self.postMessage({ type: 'progress', percent: Math.round((r + 1) / runs * 100) });
      }
    }

    const fSorted = Array.from(finals).sort((a, b) => a - b);
    const dSorted = Array.from(maxDDs).sort((a, b) => a - b);
    const sSorted = Array.from(streaks).sort((a, b) => a - b);
    const f5 = percentile(fSorted, .05), f25 = percentile(fSorted, .25);
    const f50 = percentile(fSorted, .50), f75 = percentile(fSorted, .75), f95 = percentile(fSorted, .95);
    const d50 = percentile(dSorted, .50), d95 = percentile(dSorted, .95);
    const s50 = Math.round(percentile(sSorted, .50)), s95 = Math.round(percentile(sSorted, .95));

    let wins = 0;
    for (const v of finals) if (v > 0) wins++;
    const pWin = wins / runs * 100;

    let ladder = null, pCustom = null;
    if (base > 0) {
      const thresholds = [10, 20, 30];
      const abs = thresholds.map(t => base * t / 100);
      const counts = [0, 0, 0];
      let customCount = 0;
      const customAbs = base * ruinPct / 100;
      for (const d of maxDDs) {
        for (let j = 0; j < abs.length; j++) if (d >= abs[j]) counts[j]++;
        if (d >= customAbs) customCount++;
      }
      ladder = thresholds.map((th, j) => ({ th, p: counts[j] / runs * 100 }));
      pCustom = customCount / runs * 100;
    }

    const bands = { p5: [base], p25: [base], p50: [base], p75: [base], p95: [base] };
    for (let k = 0; k < CP; k++) {
      const arr = Array.from(cpVals[k]).sort((a, b) => a - b);
      bands.p5.push(base + percentile(arr, .05));
      bands.p25.push(base + percentile(arr, .25));
      bands.p50.push(base + percentile(arr, .50));
      bands.p75.push(base + percentile(arr, .75));
      bands.p95.push(base + percentile(arr, .95));
    }

    const labels = ['0', ...cpIdx.map(i => String(i + 1))];
    const samples = [];
    for (let s = 0; s < 8; s++) {
      const r = (Math.random() * BMAX) | 0;
      const path = [base];
      for (let k = 0; k < CP; k++) path.push(base + cpVals[k][r]);
      samples.push(path);
    }

    self.postMessage({
      type: 'result',
      result: {
        labels,
        bands,
        samples,
        stats: {
          runs, N, M, base, f5, f25, f50, f75, f95,
          d50, d95, s50, s95, pWin, ladder, pCustom,
          ruinPct, clamped: !!input.clamped, BMAX
        }
      }
    });
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err?.message || err) });
  }
};
