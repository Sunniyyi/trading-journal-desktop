'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/renderer/ui/backtest-simulations-v223.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/renderer/ui/workspaces/backtesting.js'), 'utf8');

assert(css.includes('.tj-bt-sims-hero-v223'), 'Simulations premium hero styling is missing.');
assert(css.includes('"mc dsr"'), 'Monte-Carlo and PSR/DSR must share the desktop row.');
assert(css.includes('"wf wf"'), 'Walk-Forward must remain full width below the first row.');
assert(css.includes('gap:22px!important'), 'Simulations premium spacing must remain generous.');
assert(css.includes('min-height:42px!important'), 'Simulation controls must remain comfortably sized.');
assert(css.includes('@container tj-backtest'), 'Simulations premium layout must respond to actual Backtesting width.');
assert(!css.includes('#mcResults{display:'), 'Premium CSS must not force Monte-Carlo result visibility.');
assert(!css.includes('#wfResults{display:'), 'Premium CSS must not force Walk-Forward result visibility.');
assert(!css.includes('#dsrResults{display:'), 'Premium CSS must not force PSR/DSR result visibility.');

assert(js.includes("sims.classList.add('tj-bt-sims-page-v223')"), 'Simulations workspace marker is missing.');
assert(js.includes("kind:'mc'"), 'Monte-Carlo premium card decoration is missing.');
assert(js.includes("kind:'dsr'"), 'PSR/DSR premium card decoration is missing.');
assert(js.includes("kind:'wf'"), 'Walk-Forward premium card decoration is missing.');
assert(js.includes("['01','Monte-Carlo']"), 'Recommended simulations workflow is missing.');
assert(js.includes("['02','PSR / DSR']"), 'PSR/DSR workflow step is missing.');
assert(js.includes("['03','Walk-Forward']"), 'Walk-Forward workflow step is missing.');

console.log('backtest simulations v2.1.23 OK');
