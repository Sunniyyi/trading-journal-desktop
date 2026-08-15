'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { installPageBridge } = require('./preload/page-bridge');
const { createUpdateHud } = require('./preload/update-hud');

installPageBridge({ window, document, ipcRenderer });

const renderUpdateHud = createUpdateHud({ document, ipcRenderer });
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('desktop:get-update-status').then(renderUpdateHud).catch(() => {});
});
ipcRenderer.on('desktop:update-status', (_event, status) => renderUpdateHud(status || {}));

contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  version: '1.3.0',
  openFxReplay: () => ipcRenderer.invoke('desktop:open-fxreplay'),
  openDataFolder: () => ipcRenderer.invoke('desktop:open-data-folder'),
  importBackup: () => ipcRenderer.invoke('desktop:choose-backup'),
  getAppVersion: () => ipcRenderer.invoke('desktop:get-app-version'),
  getUpdateStatus: () => ipcRenderer.invoke('desktop:get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-update'),
  startUpdate: () => ipcRenderer.invoke('desktop:start-update'),
  restartForUpdate: () => ipcRenderer.invoke('desktop:restart-update'),
  openUpdateCenter: () => ipcRenderer.invoke('desktop:open-update-center'),
  openUpdateConfig: () => ipcRenderer.invoke('desktop:open-update-config'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status || {});
    ipcRenderer.on('desktop:update-status', listener);
    return () => ipcRenderer.removeListener('desktop:update-status', listener);
  }
});
