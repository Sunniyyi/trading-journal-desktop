'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/renderer/ui/backtest-overview-v222.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/renderer/ui/workspaces/backtesting.js'), 'utf8');

assert(css.includes('"kpis kpis"'), 'Backtesting overview must reserve a full-width KPI row.');
assert(css.includes('"chart performance"'), 'Chart and performance must remain side by side on desktop.');
assert(css.includes('"comment comment"'), 'Compact note must stay full width below analytics.');
assert(css.includes('#btStats.tj-bt-kpi-strip'), 'KPI strip styling is missing.');
assert(css.includes('height:68px!important'), 'Compact note default height must remain bounded.');
assert(css.includes('.tj-bt-note-card.is-expanded textarea'), 'Expanded note state is missing.');
assert(css.includes('resize:none!important'), 'Compact note should not resize until explicitly expanded.');

assert(js.includes("stats.classList.add('tj-bt-kpi-strip')"), 'Backtesting runtime must mark the KPI strip.');
assert(js.includes('dashboard.appendChild(stats);'), 'KPI strip must be moved inside the analytical dashboard.');
assert(!js.includes('if(stats) overview.appendChild(stats);'), 'KPI strip must no longer sit above the dashboard.');
assert(js.includes("el('button','tj-bt-note-toggle'"), 'Compact note toggle is missing.');
assert(js.includes("noteToggle.setAttribute('aria-expanded','false')"), 'Note toggle accessibility state is missing.');
assert(js.includes("expanded?'Réduire la note':'Agrandir la note'"), 'Note toggle labels must track state.');

console.log('backtest overview v2.1.22 OK');
