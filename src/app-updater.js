'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { app, autoUpdater, dialog, shell } = require('electron');

const DEFAULT_CONFIG = {
  enabled: true,
  // Recommended for this project: a PUBLIC GitHub repository using GitHub Releases.
  // Example: "my-user/trading-journal-desktop"
  githubRepo: 'Sunniyyi/trading-journal-desktop',
  // Alternative: direct Squirrel update feed base URL.
  // Example: "https://updates.example.com/trading-journal/win32/x64"
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
      message: 'Le mécanisme est prêt, mais aucun dépôt/serveur de mise à jour n’est configuré.',
      detail: `Configure une seule fois ${configPath()} avec un dépôt GitHub public (owner/repo) ou une URL de feed.`
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
    autoUpdater.setFeedURL({ url: feed });
    setStatus({ state: 'checking', detail: 'Recherche d’une mise à jour…', checkedAt: Date.now() });
    await autoUpdater.checkForUpdates();
  } catch (err) {
    const out = setStatus({ state: 'error', detail: err.message || String(err), checkedAt: Date.now() });
    if (manual) await dialog.showErrorBox('Mise à jour', out.detail);
    return out;
  }
  return status;
}

async function initUpdater() {
  await ensureConfigFile();

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking', detail: 'Recherche d’une mise à jour…', checkedAt: Date.now() }));
  autoUpdater.on('update-available', () => setStatus({ state: 'downloading', detail: 'Mise à jour disponible, téléchargement en arrière-plan…', checkedAt: Date.now() }));
  autoUpdater.on('update-not-available', () => setStatus({ state: 'current', detail: 'Application à jour.', checkedAt: Date.now() }));
  autoUpdater.on('error', err => setStatus({ state: 'error', detail: err?.message || String(err), checkedAt: Date.now() }));
  autoUpdater.on('update-downloaded', async (_event, _notes, releaseName) => {
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
    // Squirrel.Windows holds a lock briefly on first launch; wait before the first check.
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
  return { ...status, configPath: configPath(), enabled: !!updateConfig.enabled };
}

module.exports = {
  initUpdater,
  checkForUpdates,
  openUpdaterConfig,
  getUpdaterStatus,
  configPath
};
