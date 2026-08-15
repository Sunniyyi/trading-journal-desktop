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
assert(output.includes('requestIdleCallback(deferred,{timeout:900})'), 'Deferred startup block is missing.');
assert(output.includes('// Un seul cycle de rendu'), 'Single-render boot marker is missing.');

console.log('renderer transform OK');
