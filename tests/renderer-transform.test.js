'use strict';

const assert = require('node:assert/strict');
const { reconstructBaseline, verifyBaseline } = require('../scripts/reconstruct-renderer');
const { transformRenderer, CHART_CDN, CHART_LOCAL } = require('../scripts/renderer-transform');

const baseline = reconstructBaseline();
verifyBaseline(baseline);
const output = transformRenderer(baseline.toString('utf8'));

assert(!output.includes(CHART_CDN), 'Chart.js CDN should be replaced by the local vendor file.');
assert(output.includes(CHART_LOCAL), 'Local Chart.js path is missing.');
assert(output.includes('./desktop-performance.js'), 'Desktop performance layer is missing.');
assert(output.includes('./ui/bootstrap.js'), 'Desktop UI bootstrap is missing.');
assert(output.includes('./ui/stability-runtime.js'), 'Desktop stability runtime is missing.');
assert(output.indexOf('./ui/stability-runtime.js') < output.indexOf('./ui/bootstrap.js'), 'Stability runtime must load before the desktop shell bootstrap.');
for(const css of ['tokens.css','shell.css','components.css','workspaces.css','stability.css','visual-hotfix.css','layout-v214.css','layout-v215.css','update-center.css','final-polish.css','overview-polish.css','widget-polish.css','typography-polish.css','journal-polish.css','journal-premium.css','backtest-premium.css','backtest-layout-v217.css','backtest-polish-v218.css','backtest-calendar-v219.css','backtest-state-guard.css','workspace-routing-fix.css']){
  assert(output.includes(`./ui/${css}`),`Desktop stylesheet missing: ${css}`);
}
assert(output.indexOf('./ui/backtest-layout-v217.css') < output.indexOf('./ui/backtest-polish-v218.css'),'2.1.18 must override 2.1.17.');
assert(output.indexOf('./ui/backtest-polish-v218.css') < output.indexOf('./ui/backtest-calendar-v219.css'),'2.1.19 must override 2.1.18.');
assert(output.indexOf('./ui/backtest-calendar-v219.css') < output.indexOf('./ui/backtest-state-guard.css'),'Backtesting state guard must load after 2.1.19.');
assert(output.indexOf('./ui/backtest-state-guard.css') < output.indexOf('./ui/workspace-routing-fix.css'),'Workspace visibility guard must remain final.');
assert(output.includes('requestIdleCallback(deferred,{timeout:900})'),'Deferred startup block is missing.');
assert(output.includes('// Un seul cycle de rendu'),'Single-render boot marker is missing.');
console.log('renderer transform OK');
