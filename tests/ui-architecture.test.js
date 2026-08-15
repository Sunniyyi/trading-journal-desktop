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
  'src/renderer/ui/lib/dom.js',
  'src/renderer/ui/workspaces/overview.js',
  'src/renderer/ui/workspaces/journal.js',
  'src/renderer/ui/workspaces/backtesting.js',
  'src/renderer/ui/workspaces/discipline.js',
  'src/renderer/ui/tokens.css',
  'src/renderer/ui/shell.css',
  'src/renderer/ui/components.css',
  'src/renderer/ui/workspaces.css',
  'src/renderer/ui/stability.css'
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
const layout = fs.readFileSync(path.join(root, 'src/renderer/ui/layout-controller.js'), 'utf8');
for (const capability of ['toggleSidebar','toggleInspector','toggleFocus','toggleDensity']) {
  assert(layout.includes(capability), `Workbench capability missing: ${capability}`);
}
const config = fs.readFileSync(path.join(root, 'src/renderer/ui/config.js'), 'utf8');
for (const id of ['overview','journal','backtesting','scan','context','gate','discipline','settings']) {
  assert(config.includes(`id:'${id}'`), `Workspace missing from config: ${id}`);
}
const stability = fs.readFileSync(path.join(root, 'src/renderer/ui/stability.css'), 'utf8');
for (const marker of ['.tj-inspector-scroll{box-sizing:border-box}','@media(max-width:1280px)','@media(prefers-reduced-motion:reduce)']) {
  assert(stability.includes(marker), `Visual stability guard missing: ${marker}`);
}
const stabilityRuntime = fs.readFileSync(path.join(root, 'src/renderer/ui/stability-runtime.js'), 'utf8');
for (const capability of ['positionToolsMenu','hardenCommandPalette','hardenViewportUnits']) {
  assert(stabilityRuntime.includes(capability), `Visual stability runtime capability missing: ${capability}`);
}
console.log('ui architecture OK');
