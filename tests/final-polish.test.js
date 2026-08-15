'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const rel = 'src/renderer/ui/final-polish.css';
const full = path.join(root, rel);
assert(fs.existsSync(full), 'Final polish stylesheet must exist.');
const css = fs.readFileSync(full, 'utf8');
const size = fs.statSync(full).size;
assert(size > 5000, 'Final polish stylesheet is unexpectedly small.');
assert(size < 40000, `Final polish stylesheet is too large (${size} bytes). Split it before it becomes a monolith.`);

for (const marker of [
  ':root{',
  '--tj-topbar:82px',
  'body.tj-desktop-v2 :focus-visible',
  '#tjOverviewView .tj-overview-main',
  '#viewTrading.tj-journal-workspace #journalCalGrid .cal-cell',
  '#viewBacktest.tj-backtest-workspace .tj-bt-dashboard-main>#btChartCard',
  '#viewScan.tj-scan-workspace #scanSlots',
  '#viewContext.tj-context-workspace .ctx-shell',
  '#viewGate.tj-gate-workspace .gate-layout',
  '#tjDisciplineView .tj-discipline-grid',
  '.tj-update-center{',
  '@media(max-width:1160px)',
  '@media(prefers-reduced-motion:reduce)'
]) {
  assert(css.includes(marker), `Final polish guard missing: ${marker}`);
}

assert(css.includes('font-size:12px!important'), 'Readable 12px content scale must be present.');
assert(css.includes('min-height:40px!important'), 'Interactive controls must keep a usable minimum height.');
assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'), 'Three-column analytical layouts must remain supported on wide desktop screens.');

console.log('final polish OK');
