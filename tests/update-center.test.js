'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src/renderer/ui/update-center.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/ui/update-center.css'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'src/preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

for (const marker of ['getAppVersion','hydrateInstalledVersion','needsInitialCheck',"idle:{label:'À vérifier'"]) {
  assert(js.includes(marker), `Update center recovery marker missing: ${marker}`);
}
assert(css.includes('.tj-update-btn[hidden]{display:none!important}'), 'Hidden update actions must never leak through legacy button styles.');
assert(css.includes('[data-update-state="checking"] .tj-update-orb span'), 'Update orb animation must be state-driven.');
assert(preload.includes('getAppVersion'), 'Preload must expose installed app version.');
assert(main.includes("ipcMain.handle('desktop:get-app-version'"), 'Main process must expose installed app version over IPC.');
console.log('update center recovery OK');
