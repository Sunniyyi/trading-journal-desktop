'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const https = require('node:https');
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

function normalizedRepo(cfg = updateConfig) {
  return String(cfg.githubRepo || '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
}

function feedFromConfig(cfg) {
  if (cfg.feedUrl) return String(cfg.feedUrl).trim();
  const repo = normalizedRepo(cfg);
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

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '').split('-')[0];
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split('.').map(n => Number.parseInt(n, 10) || 0);
  const right = normalizeVersion(b).split('.').map(n => Number.parseInt(n, 10) || 0);
  const len = Math.max(left.length, right.length, 3);
  for (let i = 0; i < len; i += 1) {
    const l = left[i] || 0;
    const r = right[i] || 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

function notify(title, body) {
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  } catch (_) {}
}

function fetchLatestRelease() {
  const repo = normalizedRepo();
  return new Promise((resolve, reject) => {
    if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
      reject(new Error('Dépôt GitHub invalide.'));
      return;
    }

    const req = https.get({
      hostname: 'api.github.com',
      path: `/repos/${repo}/releases/latest`,
      headers: {
        'User-Agent': 'Trading-Journal-Desktop',
        Accept: 'application/vnd.github+json'
      },
      timeout: 12000
    }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GitHub a répondu ${res.statusCode}.`));
          return;
        }
        try {
          const data = JSON.parse(raw);
          resolve({
            version: normalizeVersion(data.tag_name || data.name || ''),
            name: String(data.name || data.tag_name || ''),
            url: String(data.html_url || ''),
            publishedAt: String(data.published_at || '')
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error('Délai GitHub dépassé.')));
    req.on('error', reject);
  });
}

async function checkForUpdates({ manual = false } = {}) {
  await ensureConfigFile();

  if (!app.isPackaged) {
    const out = setStatus({ state: 'development', detail: 'Auto-update disponible uniquement dans l’application installée.', checkedAt: Date.now() });
    if (manual) await dialog.showMessageBox({ type: 'info', title: 'Mises à jour', message: out.detail });
    return out;
  }

  if (!updateConfig.enabled) {
    const out = setStatus({ state: 'disabled', detail: 'Les mises à jour automatiques sont désactivées.', checkedAt: Date.now() });
    if (manual) await dialog.showMessageBox({
      type: 'info', title: 'Mises à jour désactivées',
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
      notify('Trading Journal — Mise à jour', `Recherche en cours… Version installée : ${app.getVersion()}`);
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

async function installDownloadedUpdate() {
  if (status.state !== 'downloaded') {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Aucune mise à jour prête',
      message: 'Aucune mise à jour n’est encore prête à être installée.',
      detail: 'Ouvre le Centre de mise à jour ou clique sur « Vérifier maintenant » pour rechercher la dernière version.'
    });
    return false;
  }
  autoUpdater.quitAndInstall();
  return true;
}

async function showUpdateCenter() {
  await ensureConfigFile();
  const currentVersion = normalizeVersion(app.getVersion());
  let latest = null;
  let lookupError = '';

  try {
    latest = await fetchLatestRelease();
    if (latest.version) status.availableVersion = latest.version;
  } catch (err) {
    lookupError = err?.message || String(err);
  }

  const newestVersion = latest?.version || status.availableVersion || 'inconnue';
  const newerExists = latest?.version
    ? compareVersions(latest.version, currentVersion) > 0
    : status.state === 'downloading' || status.state === 'downloaded';

  let message = 'Trading Journal est à jour.';
  let stateLine = 'Aucune mise à jour plus récente détectée.';
  if (status.state === 'downloaded') {
    message = 'Une mise à jour est prête à être installée.';
    stateLine = 'Téléchargement terminé. Tu peux l’installer maintenant.';
  } else if (status.state === 'downloading') {
    message = 'Une nouvelle mise à jour est disponible.';
    stateLine = 'Téléchargement en cours en arrière-plan.';
  } else if (newerExists) {
    message = 'Une nouvelle mise à jour est disponible.';
    stateLine = 'Clique sur « Mettre à jour maintenant » pour lancer le téléchargement.';
  } else if (lookupError) {
    message = 'Impossible de confirmer la dernière version publiée.';
    stateLine = `Erreur : ${lookupError}`;
  }

  const detail = [
    `Version installée : ${currentVersion}`,
    `Dernière version publiée : ${newestVersion}`,
    '',
    `État : ${stateLine}`
  ].join('\n');

  let buttons;
  if (status.state === 'downloaded') {
    buttons = ['Redémarrer et installer', 'Vérifier à nouveau', 'Fermer'];
  } else if (newerExists) {
    buttons = ['Mettre à jour maintenant', 'Vérifier à nouveau', 'Fermer'];
  } else {
    buttons = ['Vérifier à nouveau', 'Fermer'];
  }

  const result = await dialog.showMessageBox({
    type: newerExists || status.state === 'downloaded' ? 'info' : lookupError ? 'warning' : 'info',
    title: 'Centre de mise à jour — Trading Journal',
    message,
    detail,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    noLink: true
  });

  const action = buttons[result.response];
  if (action === 'Redémarrer et installer') {
    autoUpdater.quitAndInstall();
    return;
  }
  if (action === 'Mettre à jour maintenant') {
    await checkForUpdates({ manual: false });
    await dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour lancée',
      message: 'Le téléchargement de la nouvelle version a été lancé.',
      detail: 'Tu peux continuer à utiliser Trading Journal. Dès que la mise à jour sera prête, une fenêtre te proposera de redémarrer et de l’installer.'
    });
    return;
  }
  if (action === 'Vérifier à nouveau') {
    await checkForUpdates({ manual: true });
  }
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
    notify('Trading Journal — Mise à jour disponible', 'Une nouvelle version est disponible et son téléchargement démarre automatiquement.');
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
    const downloadedVersion = normalizeVersion(releaseName || status.availableVersion || '');
    setStatus({ state: 'downloaded', detail: 'Mise à jour téléchargée.', downloadedVersion });
    notify('Trading Journal — Mise à jour prête', 'La nouvelle version est téléchargée et prête à être installée.');
    const answer = await dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour prête',
      message: 'Une nouvelle version de Trading Journal a été téléchargée.',
      detail: `Version installée : ${app.getVersion()}\nMise à jour : ${downloadedVersion || 'nouvelle version'}\n\nTu peux l’installer maintenant ou plus tard depuis le menu « Mises à jour ».`,
      buttons: ['Redémarrer et installer', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
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
  showUpdateCenter,
  installDownloadedUpdate,
  openUpdaterConfig,
  getUpdaterStatus,
  configPath
};
