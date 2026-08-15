'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const premium = fs.readFileSync(path.join(__dirname,'../src/renderer/ui/backtest-premium.css'),'utf8');
const guard = fs.readFileSync(path.join(__dirname,'../src/renderer/ui/backtest-state-guard.css'),'utf8');

const count = (s,ch) => [...s].filter(c=>c===ch).length;
assert.equal(count(premium,'{'),count(premium,'}'),'Backtesting premium CSS braces must stay balanced.');
assert.equal(count(guard,'{'),count(guard,'}'),'Backtesting state guard CSS braces must stay balanced.');
assert(premium.includes('container-name:tj-backtest'),'Backtesting must adapt to its actual workspace width.');
assert(premium.includes('.bt-page-row.on'),'Backtesting page navigation active state is missing.');
assert(premium.includes('#sumPageBreakdown .sum-row'),'Global summary breakdown polish is missing.');
assert(premium.includes('#btStats'),'Backtesting KPI ribbon polish is missing.');
assert(premium.includes('.tj-bt-dashboard-grid'),'Backtesting overview dashboard polish is missing.');
assert(premium.includes('.tj-bt-trades-grid'),'Backtesting trades workspace polish is missing.');
assert(premium.includes('.tj-bt-sims-grid'),'Backtesting simulations polish is missing.');
assert(premium.includes('.bt-month-card'),'Backtesting month cards polish is missing.');
assert(premium.includes('@container tj-backtest'),'Backtesting container-responsive rules are missing.');
assert(!premium.includes('#viewTrading'),'Backtesting premium CSS must not style the Journal.');
assert(!premium.includes('#viewScan'),'Backtesting premium CSS must not style Scan TA.');
assert(guard.includes('[style*="display:none"]'),'Backtesting guard must preserve compact inline display:none states.');
assert(guard.includes('[style*="display: none"]'),'Backtesting guard must preserve spaced inline display: none states.');

console.log('backtest premium OK');
