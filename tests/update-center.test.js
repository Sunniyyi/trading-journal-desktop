'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src/renderer/ui/update-center.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/renderer/ui/update-center.css'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'src/preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/renderer/ui/shell.js'), 'utf8');

for (const marker of ['getAppVersion','hydrateInstalledVersion','needsInitialCheck',"idle:{label:'À vérifier'"]) {
  assert(js.includes(marker), `Update center recovery marker missing: ${marker}`);
}
assert(css.includes('.tj-update-btn[hidden]{display:none!important}'), 'Hidden update actions must never leak through legacy button styles.');
assert(css.includes('[data-update-state="checking"] .tj-update-orb span'), 'Update orb animation must be state-driven.');

assert(preload.includes("const { contextBridge, ipcRenderer } = require('electron')"), 'Sandbox preload must only depend on Electron APIs.');
assert(!preload.includes("require('./preload/"), 'Sandbox preload must not require local CommonJS modules.');
assert(preload.includes('contextBridge.exposeInMainWorld'), 'Sandbox preload must expose the desktop bridge.');
assert(preload.includes('getAppVersion'), 'Preload must expose installed app version.');
assert(preload.includes('onUpdateStatus'), 'Preload must expose live updater status.');
assert(preload.includes('onRequestUpdateCenter'), 'Preload must expose integrated update-center requests.');
assert(preload.includes('FXR_EXTENSION_BRIDGE_READY'), 'FXReplay page bridge must remain embedded in the sandbox preload.');
assert(preload.includes('renderUpdateHud'), 'Background updater HUD must remain embedded in the sandbox preload.');

assert(main.includes("ipcMain.handle('desktop:get-app-version'"), 'Main process must expose installed app version over IPC.');
assert(main.includes('requestIntegratedUpdateCenter'), 'Main process must route update center requests to the integrated UI.');
assert(main.includes("mainWindow.webContents.send('desktop:request-update-center')"), 'Main process must signal the renderer to open the integrated update center.');
assert(shell.includes('onRequestUpdateCenter'), 'Desktop shell must listen for native update-center requests.');

console.log('update center sandbox bridge OK');
