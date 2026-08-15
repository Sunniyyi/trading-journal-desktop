'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname,'../src/renderer/ui/backtest-polish-v218.css'),'utf8');
const count = (s,ch) => [...s].filter(c=>c===ch).length;

assert.equal(count(css,'{'),count(css,'}'),'Backtesting 2.1.18 CSS braces must stay balanced.');
assert(css.includes('input[type="checkbox"]'),'Backtesting sessions must explicitly reset checkbox sizing.');
assert(css.includes('width:15px!important'),'Backtesting checkbox width guard is missing.');
assert(css.includes('"chart performance"'),'Overview must keep chart and performance on the first row.');
assert(css.includes('"comment comment"'),'Overview comment must span the full dashboard width.');
assert(css.includes('#btTbody .trade-thumb.sm'),'Backtesting capture thumbnail polish is missing.');
assert(css.includes('.tj-section-tab.is-active'),'Backtesting segmented tab active state is missing.');
assert(css.includes('minmax(390px,.72fr)'),'DSR simulation needs a readable minimum width.');
assert(!css.includes('#viewTrading'),'Backtesting 2.1.18 CSS must not style the Journal.');
assert(!css.includes('#viewScan'),'Backtesting 2.1.18 CSS must not style Scan TA.');

console.log('backtest polish v218 OK');
