'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname,'../src/renderer/ui/backtest-layout-v217.css'),'utf8');
const count = (s,ch) => [...s].filter(c=>c===ch).length;

assert.equal(count(css,'{'),count(css,'}'),'Backtesting 2.1.17 CSS braces must stay balanced.');
assert(css.includes('overflow-y:auto!important'),'Backtesting workspace must own vertical scrolling.');
assert(css.includes('#viewBacktest .bt-main'),'Backtesting main column scroll reset is missing.');
assert(css.includes('overflow:visible!important'),'Inner Backtesting containers must not trap vertical scrolling.');
assert(css.includes('grid-template-areas:'),'Backtesting overview/simulation area layout is missing.');
assert(css.includes('"chart performance"'),'Overview must prioritize chart and performance side by side.');
assert(css.includes('"mc dsr"'),'Monte-Carlo and DSR first-row layout is missing.');
assert(css.includes('"wf wf"'),'Walk-Forward full-width row is missing.');
assert(css.includes('grid-template-columns:228px minmax(0,1fr)'),'Trades filter rail width correction is missing.');
assert(css.includes('@container tj-backtest'),'Backtesting width-aware responsive correction is missing.');
assert(!css.includes('#viewTrading'),'2.1.17 Backtesting correction must not style Journal.');
assert(!css.includes('#viewScan'),'2.1.17 Backtesting correction must not style Scan TA.');

console.log('backtest layout v2.1.17 OK');
