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
  version: '1.1.0',
  openFxReplay: () => ipcRenderer.invoke('desktop:open-fxreplay'),
  openDataFolder: () => ipcRenderer.invoke('desktop:open-data-folder'),
  importBackup: () => ipcRenderer.invoke('desktop:choose-backup'),
  getUpdateStatus: () => ipcRenderer.invoke('desktop:get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-update'),
  startUpdate: () => ipcRenderer.invoke('desktop:start-update'),
  restartForUpdate: () => ipcRenderer.invoke('desktop:restart-update'),
  openUpdateCenter: () => ipcRenderer.invoke('desktop:open-update-center')
});
