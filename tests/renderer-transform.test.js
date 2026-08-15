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
assert(output.includes('./ui/tokens.css'), 'Desktop design tokens are missing.');
assert(output.includes('./ui/shell.css'), 'Desktop shell stylesheet is missing.');
assert(output.includes('./ui/components.css'), 'Desktop component stylesheet is missing.');
assert(output.includes('./ui/workspaces.css'), 'Desktop workspace stylesheet is missing.');
assert(output.includes('./ui/stability.css'), 'Desktop stability stylesheet is missing.');
assert(output.includes('./ui/visual-hotfix.css'), 'Desktop 2.1.3 visual hotfix stylesheet is missing.');
assert(output.includes('./ui/layout-v214.css'), 'Desktop 2.1.4 layout stylesheet is missing.');
assert(output.includes('./ui/layout-v215.css'), 'Desktop 2.1.5 polish stylesheet is missing.');
assert(output.includes('./ui/update-center.css'), 'Desktop integrated update-center stylesheet is missing.');
assert(output.includes('./ui/final-polish.css'), 'Desktop 2.1.9 final polish stylesheet is missing.');
assert(output.indexOf('./ui/layout-v215.css') < output.indexOf('./ui/update-center.css'), 'Update center styles must load after the 2.1.5 polish layer.');
assert(output.indexOf('./ui/update-center.css') < output.indexOf('./ui/final-polish.css'), 'Final polish must load last so it is the visual source of truth.');
assert(output.includes('requestIdleCallback(deferred,{timeout:900})'), 'Deferred startup block is missing.');
assert(output.includes('// Un seul cycle de rendu'), 'Single-render boot marker is missing.');

console.log('renderer transform OK');
