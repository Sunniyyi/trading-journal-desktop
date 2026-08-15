'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { app, autoUpdater, dialog, shell, Notification } = require('electron');

const DEFAULT_CONFIG = {
  enabled: true,
  githubRepo: 'Sunniyyi/trading-journal-desktop',
  feedUrl: '',
  checkIntervalMinutes: 10,
  checkOnStartup: true
};

let status = {
  state: 'disabled',
  detail: 'Canal de mise à jour non configuré.',
  checkedAt: 0,
  availableVersion: '',
  downloadedVersion: ''
};
let timer = null;
let updateConfig = { ...DEFAULT_CONFIG };
let manualCheckPending = false;
let manualCheckTimer = null;

function configPath() {
  return path.join(app.getPath('userData'), 'update-config.json');
}

async function ensureConfigFile() {
  const p = configPath();
  try {
    const raw = await fs.readFile(p, 'utf8');
    const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
    updateConfig = { ...DEFAULT_CONFIG, ...(data || {}) };
  } catch (_) {
    updateConfig = { ...DEFAULT_CONFIG };
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(updateConfig, null, 2), 'utf8');
  }
  return updateConfig;
}

function feedFromConfig(cfg) {
  if (cfg.feedUrl) return String(cfg.feedUrl).trim();
  const repo = String(cfg.githubRepo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  if (/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    return `https://update.electronjs.org/${repo}/${process.platform}-${process.arch}/${app.getVersion()}`;
  }
  return '';
}

function setStatus(patch) {
  status = { ...status, ...patch };
  return status;
}

function clearManualTimer() {
  if (manualCheckTimer) clearTimeout(manualCheckTimer);
  manualCheckTimer = null;
}

function showCheckingNotification() {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Trading Journal',
        body: `Recherche d’une mise à jour… Version actuelle : ${app.getVersion()}`
      }).show();
    }
  } catch (_) {}
}

async function checkForUpdates({ manual = false } = {}) {
  await ensureConfigFile();

  if (!app.isPackaged) {
    const out = setStatus({ state: 'development', detail: 'Auto-update disponible uniquement dans l’application installée.', checkedAt: Date.now() });
    if (manual) await dialog.showMessageBox({ type: 'info', title: 'Mises à jour', message: out.detail });
    return out;
  }

  if (!updateConfig.enabled) {
    const out = setStatus({ state: 'disabled', detail: 'Les mises à jour automatiques ne sont pas encore activées.', checkedAt: Date.now() });
    if (manual) await dialog.showMessageBox({
      type: 'info', title: 'Mises à jour non configurées',
      message: 'Les mises à jour automatiques sont désactivées.',
      detail: `Configuration : ${configPath()}`
    });
    return out;
  }

  const feed = feedFromConfig(updateConfig);
  if (!feed) {
    const out = setStatus({ state: 'error', detail: 'Configuration updater invalide.', checkedAt: Date.now() });
    if (manual) await dialog.showErrorBox('Mise à jour', out.detail);
    return out;
  }

  try {
    manualCheckPending = manual === true;
    clearManualTimer();
    autoUpdater.setFeedURL({ url: feed });
    setStatus({ state: 'checking', detail: 'Recherche d’une mise à jour…', checkedAt: Date.now() });

    if (manualCheckPending) {
      showCheckingNotification();
      manualCheckTimer = setTimeout(async () => {
        if (!manualCheckPending) return;
        manualCheckPending = false;
        setStatus({ state: 'error', detail: 'Aucune réponse du serveur de mise à jour après 20 secondes.', checkedAt: Date.now() });
        await dialog.showMessageBox({
          type: 'warning',
          title: 'Vérification des mises à jour',
          message: 'La vérification prend anormalement longtemps.',
          detail: 'Aucune réponse n’a été reçue après 20 secondes. Vérifie ta connexion Internet puis réessaie.'
        });
      }, 20000);
    }

    autoUpdater.checkForUpdates();
  } catch (err) {
    clearManualTimer();
    const wasManual = manualCheckPending || manual;
    manualCheckPending = false;
    const out = setStatus({ state: 'error', detail: err.message || String(err), checkedAt: Date.now() });
    if (wasManual) await dialog.showErrorBox('Mise à jour', out.detail);
    return out;
  }
  return status;
}

async function initUpdater() {
  await ensureConfigFile();

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking', detail: 'Recherche d’une mise à jour…', checkedAt: Date.now() });
  });

  autoUpdater.on('update-available', async () => {
    clearManualTimer();
    const wasManual = manualCheckPending;
    manualCheckPending = false;
    setStatus({ state: 'downloading', detail: 'Mise à jour disponible, téléchargement en arrière-plan…', checkedAt: Date.now() });
    if (wasManual) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Mise à jour trouvée',
        message: 'Une nouvelle version de Trading Journal est disponible.',
        detail: 'Le téléchargement démarre automatiquement en arrière-plan. Une nouvelle fenêtre apparaîtra lorsqu’elle sera prête à être installée.'
      });
    }
  });

  autoUpdater.on('update-not-available', async () => {
    clearManualTimer();
    const wasManual = manualCheckPending;
    manualCheckPending = false;
    setStatus({ state: 'current', detail: 'Application à jour.', checkedAt: Date.now() });
    if (wasManual) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Trading Journal à jour',
        message: `Tu utilises déjà la dernière version : ${app.getVersion()}.`,
        detail: 'Aucune mise à jour plus récente n’est disponible.'
      });
    }
  });

  autoUpdater.on('error', async err => {
    clearManualTimer();
    const wasManual = manualCheckPending;
    manualCheckPending = false;
    const detail = err?.message || String(err);
    setStatus({ state: 'error', detail, checkedAt: Date.now() });
    if (wasManual) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Erreur de mise à jour',
        message: 'Trading Journal n’a pas pu vérifier les mises à jour.',
        detail
      });
    }
  });

  autoUpdater.on('update-downloaded', async (_event, _notes, releaseName) => {
    clearManualTimer();
    manualCheckPending = false;
    setStatus({ state: 'downloaded', detail: 'Mise à jour téléchargée.', downloadedVersion: String(releaseName || '') });
    const answer = await dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour prête',
      message: 'Une nouvelle version de Trading Journal a été téléchargée.',
      detail: 'Tu peux redémarrer maintenant. Sinon, elle sera appliquée au prochain redémarrage.',
      buttons: ['Redémarrer et installer', 'Plus tard'],
      defaultId: 0,
      cancelId: 1
    });
    if (answer.response === 0) autoUpdater.quitAndInstall();
  });

  if (!app.isPackaged || !updateConfig.enabled) return;

  const mins = Math.max(1, Number(updateConfig.checkIntervalMinutes) || 10);
  if (updateConfig.checkOnStartup !== false) {
    setTimeout(() => checkForUpdates().catch(() => {}), process.argv.includes('--squirrel-firstrun') ? 12000 : 4000);
  }
  clearInterval(timer);
  timer = setInterval(() => checkForUpdates().catch(() => {}), mins * 60 * 1000);
}

async function openUpdaterConfig() {
  await ensureConfigFile();
  return shell.openPath(configPath());
}

function getUpdaterStatus() {
  return { ...status, configPath: configPath(), enabled: !!updateConfig.enabled, version: app.getVersion() };
}

module.exports = {
  initUpdater,
  checkForUpdates,
  openUpdaterConfig,
  getUpdaterStatus,
  configPath
};
