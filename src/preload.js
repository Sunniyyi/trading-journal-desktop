'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function postToPage(message) {
  window.postMessage(message, '*');
}

window.addEventListener('DOMContentLoaded', () => {
  // Makes the unchanged V206 page behave exactly as if site-bridge.js was injected.
  postToPage({ source: 'fxr-extension', type: 'FXR_EXTENSION_BRIDGE_READY', at: Date.now(), desktop: true });

  window.addEventListener('message', event => {
    if (event.source !== window || !event.data || event.data.source !== 'trade-journal-fxr') return;
    const d = event.data;
    if (d.type === 'FXR_SITE_CONFIG') {
      ipcRenderer.send('renderer:site-config', {
        pages: d.pages || [],
        targetPageId: d.targetPageId || '',
        version: d.version || ''
      });
    } else if (d.type === 'FXR_IMPORT_ACK' && d.id) {
      ipcRenderer.send('renderer:import-ack', {
        id: d.id,
        sourceId: d.sourceId || '',
        kind: d.kind || 'trade'
      });
    } else if (d.type === 'FXR_IMPORT_FAIL' && d.id) {
      ipcRenderer.send('renderer:import-fail', {
        id: d.id,
        error: d.error || 'Import refusé',
        kind: d.kind || 'trade'
      });
    } else if (d.type === 'FXR_RETRY_QUEUE') {
      ipcRenderer.send('renderer:retry-queue');
    }
  });
});

ipcRenderer.on('fxr:status', (_event, status) => {
  postToPage({ source: 'fxr-extension', type: 'FXR_EXTENSION_STATUS', ...(status || {}), desktop: true });
});

ipcRenderer.on('fxr:import', (_event, item) => {
  postToPage({ source: 'fxr-extension', type: 'FXR_IMPORT_TRADE', item, desktop: true });
});

ipcRenderer.on('desktop:import-backup', (_event, payload) => {
  try {
    const input = document.getElementById('importFile');
    if (!input) throw new Error('Import input not found');
    const file = new File([payload.content], payload.name || 'trade-journal-backup.json', { type: 'application/json' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (err) {
    console.error('[Desktop migration] Import failed:', err);
  }
});

contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  version: '1.0.1',
  openFxReplay: () => ipcRenderer.invoke('desktop:open-fxreplay'),
  openDataFolder: () => ipcRenderer.invoke('desktop:open-data-folder'),
  importBackup: () => ipcRenderer.invoke('desktop:choose-backup')
});
