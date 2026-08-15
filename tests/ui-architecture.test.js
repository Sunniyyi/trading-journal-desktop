'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const files = [
  'src/renderer/ui/bootstrap.js',
  'src/renderer/ui/stability-runtime.js',
  'src/renderer/ui/shell.js',
  'src/renderer/ui/config.js',
  'src/renderer/ui/command-palette.js',
  'src/renderer/ui/layout-controller.js',
  'src/renderer/ui/inspector.js',
  'src/renderer/ui/update-center.js',
  'src/renderer/ui/lib/dom.js',
  'src/renderer/ui/workspaces/overview.js',
  'src/renderer/ui/workspaces/journal.js',
  'src/renderer/ui/workspaces/backtesting.js',
  'src/renderer/ui/workspaces/discipline.js',
  'src/renderer/ui/tokens.css',
  'src/renderer/ui/shell.css',
  'src/renderer/ui/components.css',
  'src/renderer/ui/workspaces.css',
  'src/renderer/ui/stability.css',
  'src/renderer/ui/visual-hotfix.css',
  'src/renderer/ui/layout-v214.css',
  'src/renderer/ui/layout-v215.css',
  'src/renderer/ui/update-center.css'
];
for (const rel of files) {
  const full = path.join(root, rel);
  assert(fs.existsSync(full), `UI module missing: ${rel}`);
  const size = fs.statSync(full).size;
  assert(size > 20, `UI module unexpectedly empty: ${rel}`);
  assert(size < 40000, `UI module too large; split it before it becomes another monolith: ${rel} (${size} bytes)`);
}
const shell = fs.readFileSync(path.join(root, 'src/renderer/ui/shell.js'), 'utf8');
assert(shell.includes("navigate('overview')"), 'Overview must remain the default desktop workspace.');
assert(shell.includes('WORKSPACES'), 'Navigation must be driven by central workspace configuration.');
assert(shell.includes('createInspector'), 'Contextual inspector must stay isolated from the shell implementation.');
assert(shell.includes('initLayoutController'), 'Workbench layout state must stay isolated from the shell implementation.');
assert(shell.includes('createUpdateCenter'), 'The desktop shell must restore the integrated update center.');
assert(shell.includes("$('#tjUpdateButton')?.addEventListener('click',()=>updateCenter.open())"), 'Top-bar update button must open the in-app update center.');
const layout = fs.readFileSync(path.join(root, 'src/renderer/ui/layout-controller.js'), 'utf8');
for (const capability of ['toggleSidebar','toggleInspector','toggleFocus','toggleDensity']) {
  assert(layout.includes(capability), `Workbench capability missing: ${capability}`);
}
const config = fs.readFileSync(path.join(root, 'src/renderer/ui/config.js'), 'utf8');
for (const id of ['overview','journal','backtesting','scan','context','gate','discipline','settings']) {
  assert(config.includes(`id:'${id}'`), `Workspace missing from config: ${id}`);
}
const stability = fs.readFileSync(path.join(root, 'src/renderer/ui/stability.css'), 'utf8');
for (const marker of [
  '.tj-inspector-scroll{box-sizing:border-box}',
  '.tj-workspace{box-sizing:border-box;padding-top:var(--tj-backup-offset,0)}',
  '#settingsOverlay>div',
  'body.tj-inspector-open .tj-overview-actions{grid-template-columns:1fr}',
  '@media(max-width:1280px)',
  '@media(prefers-reduced-motion:reduce)'
]) {
  assert(stability.includes(marker), `Visual stability guard missing: ${marker}`);
}
const hotfix = fs.readFileSync(path.join(root, 'src/renderer/ui/visual-hotfix.css'), 'utf8');
for (const marker of [
  '#tjWorkspaceTitle::after',
  '.tj-journal-main',
  '.tj-bt-trades-right>.tablecard',
  '.tj-bt-sims-grid',
  '#viewScan.tj-scan-workspace',
  '.ctx-deep-details .ctx-attention-grid',
  '#viewGate.tj-gate-workspace',
  '#tjDisciplineView .tj-discipline-grid'
]) {
  assert(hotfix.includes(marker), `2.1.3 visual regression guard missing: ${marker}`);
}
const v214 = fs.readFileSync(path.join(root, 'src/renderer/ui/layout-v214.css'), 'utf8');
for (const marker of [
  '#btDetail[style*="display: none"]',
  '#viewScan.tj-scan-workspace #scanSlots',
  'grid-template-columns:repeat(3,minmax(0,1fr))',
  '#viewContext.tj-context-workspace .ctx-shell',
  '#viewGate.tj-gate-workspace .gate-rules-grid',
  '#tjDisciplineView .tj-discipline-grid'
]) {
  assert(v214.includes(marker), `2.1.4 layout regression guard missing: ${marker}`);
}
const v215 = fs.readFileSync(path.join(root, 'src/renderer/ui/layout-v215.css'), 'utf8');
for (const marker of [
  ':root{--tj-topbar:78px}',
  '#journalCalGrid .cal-cell',
  '#journalCalGrid .cal-day',
  'background-image:none!important',
  '.tj-bt-dashboard-main>#btChartCard',
  'min-height:clamp(500px,64vh,650px)'
]) {
  assert(v215.includes(marker), `2.1.5 visual regression guard missing: ${marker}`);
}
const updateCenter = fs.readFileSync(path.join(root, 'src/renderer/ui/update-center.js'), 'utf8');
for (const marker of ['Centre de mise à jour','checkForUpdates','startUpdate','restartForUpdate','onUpdateStatus']) {
  assert(updateCenter.includes(marker), `Update center capability missing: ${marker}`);
}
const updateCenterCss = fs.readFileSync(path.join(root, 'src/renderer/ui/update-center.css'), 'utf8');
for (const marker of ['.tj-update-overlay','.tj-update-center','.tj-update-progress','.tj-update-metrics','.tj-update-btn-primary']) {
  assert(updateCenterCss.includes(marker), `Update center visual guard missing: ${marker}`);
}
const journal = fs.readFileSync(path.join(root, 'src/renderer/ui/workspaces/journal.js'), 'utf8');
assert(journal.includes("$('#journalCalCard',view)"), 'Journal desktop layout must explicitly keep the calendar.');
assert(journal.includes("toolbar.after(calendar)"), 'Journal calendar must live inside the execution surface after its toolbar.');
const backtesting = fs.readFileSync(path.join(root, 'src/renderer/ui/workspaces/backtesting.js'), 'utf8');
assert(backtesting.includes("$('#btTbody',main)"), 'Backtesting trade table must be anchored from #btTbody, not the first generic tablecard.');
assert(backtesting.includes("[back,months,cal,table,pagination]"), 'Backtesting content rail order guard is missing.');
const stabilityRuntime = fs.readFileSync(path.join(root, 'src/renderer/ui/stability-runtime.js'), 'utf8');
for (const capability of ['installChartReuseGuard','positionToolsMenu','hardenCommandPalette','hardenViewportUnits','hardenBackupSpacing']) {
  assert(stabilityRuntime.includes(capability), `Visual stability runtime capability missing: ${capability}`);
}
assert(stabilityRuntime.includes("existing.destroy()"), 'Chart reuse guard must destroy an existing chart before the canvas is reused.');
const preload = fs.readFileSync(path.join(root, 'src/preload.js'), 'utf8');
assert(preload.includes('onUpdateStatus'), 'Preload must expose safe update status subscriptions to the renderer.');
assert(preload.includes("ipcRenderer.removeListener('desktop:update-status'"), 'Update subscription must be removable.');
console.log('ui architecture OK');
