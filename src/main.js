'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require('electron');

// Handle Squirrel.Windows install/update/uninstall events before normal startup.
if (require('electron-squirrel-startup')) process.exit(0);
const { BridgeServer } = require('./bridge-server');
const { syncManagedExtension, managedExtensionDir } = require('./extension-manager');
const {
  initUpdater,
  checkForUpdates,
  startAvailableUpdate,
  showUpdateCenter,
  installDownloadedUpdate,
  openUpdaterConfig,
  getUpdaterStatus,
  setUpdaterStatusSink
} = require('./app-updater');

const BRIDGE_PORT = 17841;
let mainWindow = null;
let bridgeServer = null;
let siteConfig = { pages: [], targetPageId: '', version: 'v206', siteSeenAt: 0 };
let managedExtensionInfo = { ok: false, version: '', path: '', filesReady: false, syncedAt: 0, channel: 'desktop-managed-v1' };
const pendingImports = new Map();

function sendUpdaterStatus(status = getUpdaterStatus()) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('desktop:update-status', status || {});
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1720,
    height: 1040,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#090d1c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:trading-journal-desktop',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'trade-journal.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle('Trading Journal — Desktop V1');
    sendUpdaterStatus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createMenu() {
  const template = [
    {
      label: 'Trading Journal',
      submenu: [
        { label: 'Importer une sauvegarde V206…', click: chooseBackup },
        { label: 'Ouvrir le dossier de données', click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { label: 'Ouvrir FX Replay dans Chrome', click: () => shell.openExternal('https://app.fxreplay.com/') },
        { label: 'Ouvrir le dossier de l’extension FXReplay', click: () => shell.openPath(managedExtensionDir()) },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' }
      ]
    },
    {
      label: 'Mises à jour',
      submenu: [
        {
          label: 'Centre de mise à jour…',
          accelerator: 'CmdOrCtrl+U',
          click: () => showUpdateCenter()
        },
        {
          label: 'Vérifier maintenant',
          click: () => checkForUpdates({ manual: true })
        },
        {
          label: 'Télécharger la mise à jour disponible',
          click: () => startAvailableUpdate({ manual: true })
        },
        {
          label: 'Redémarrer sur la mise à jour prête',
          click: () => installDownloadedUpdate()
        },
        { type: 'separator' },
        { label: `Version actuelle : ${app.getVersion()}`, enabled: false },
        { label: 'Configurer les mises à jour…', click: () => openUpdaterConfig() }
      ]
    },
    { label: 'Affichage', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function chooseBackup() {
  if (!mainWindow) return { ok: false };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer une sauvegarde Trade Journal V206',
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf8');
  mainWindow.webContents.send('desktop:import-backup', { name: path.basename(filePath), content });
  return { ok: true };
}

function waitForRendererImport(item) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingImports.delete(item.id);
      resolve({ ok: false, error: 'Le renderer n’a pas confirmé l’import sous 12 s.' });
    }, 12000);

    pendingImports.set(item.id, {
      resolve: result => {
        clearTimeout(timeout);
        pendingImports.delete(item.id);
        resolve(result);
      }
    });
    mainWindow?.webContents.send('fxr:import', item);
  });
}

function installIpc() {
  ipcMain.on('renderer:site-config', (_event, config) => {
    siteConfig = {
      pages: Array.isArray(config?.pages) ? config.pages : [],
      targetPageId: String(config?.targetPageId || ''),
      version: String(config?.version || 'v206'),
      siteSeenAt: Date.now()
    };
  });

  ipcMain.on('renderer:import-ack', (_event, result) => {
    pendingImports.get(result?.id)?.resolve({ ok: true, sourceId: result?.sourceId || '', kind: result?.kind || 'trade' });
  });

  ipcMain.on('renderer:import-fail', (_event, result) => {
    pendingImports.get(result?.id)?.resolve({ ok: false, error: result?.error || 'Import refusé', kind: result?.kind || 'trade' });
  });

  ipcMain.on('renderer:retry-queue', () => {
    // The Chrome extension polls the local bridge continuously, so no explicit action is required.
  });

  ipcMain.handle('desktop:open-fxreplay', () => shell.openExternal('https://app.fxreplay.com/'));
  ipcMain.handle('desktop:open-data-folder', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('desktop:choose-backup', chooseBackup);

  ipcMain.handle('desktop:get-update-status', () => getUpdaterStatus());
  ipcMain.handle('desktop:check-update', () => checkForUpdates({ manual: false }));
  ipcMain.handle('desktop:start-update', () => startAvailableUpdate({ manual: false }));
  ipcMain.handle('desktop:restart-update', () => installDownloadedUpdate());
  ipcMain.handle('desktop:open-update-center', () => showUpdateCenter());
}

async function startBridge() {
  bridgeServer = new BridgeServer({
    host: '127.0.0.1',
    port: BRIDGE_PORT,
    getConfig: async () => ({ ...siteConfig, siteSeenAt: siteConfig.siteSeenAt || Date.now() }),
    getExtensionInfo: async () => ({
      version: managedExtensionInfo.version || '',
      path: managedExtensionInfo.path || managedExtensionDir(),
      filesReady: managedExtensionInfo.filesReady === true,
      syncedAt: managedExtensionInfo.syncedAt || 0,
      channel: managedExtensionInfo.channel || 'desktop-managed-v1'
    }),
    onStatus: async status => {
      mainWindow?.webContents.send('fxr:status', status || {});
    },
    onImport: async item => {
      if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'Trading Journal n’est pas ouvert.' };
      return waitForRendererImport(item);
    }
  });
  await bridgeServer.start();
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.squirrel.TradingJournal.TradingJournal');
  // Persistent session guarantees IndexedDB/localStorage survive restarts.
  session.fromPartition('persist:trading-journal-desktop');

  // Copy the bundled V21 bridge into one stable folder. Chrome only needs this
  // folder to be loaded once; later application updates replace its files.
  try {
    managedExtensionInfo = await syncManagedExtension();
  } catch (err) {
    managedExtensionInfo = { ok: false, version: '', path: managedExtensionDir(), filesReady: false, syncedAt: Date.now(), error: err.message || String(err), channel: 'desktop-managed-v1' };
  }

  installIpc();
  setUpdaterStatusSink(sendUpdaterStatus);
  createMainWindow();
  createMenu();
  try {
    await startBridge();
  } catch (err) {
    dialog.showErrorBox('Bridge FXReplay indisponible', `Le port local ${BRIDGE_PORT} n’a pas pu être ouvert.\n\n${err.message || err}`);
  }

  try {
    await initUpdater();
  } catch (err) {
    console.error('[Updater] init failed:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  bridgeServer?.stop().catch(() => {});
});
