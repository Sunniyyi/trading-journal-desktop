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
  if (cfg.feedUrl) return String(cfg.feedUrl).trim().replace(/\/$/, '');
  const repo = normalizedRepo(cfg);
  if (/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    // Direct Squirrel.Windows static feed. GitHub redirects "latest" to the
    // newest stable release; RELEASES and the .nupkg therefore stay together.
    return `https://github.com/${repo}/releases/latest/download`;
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

function cleanUpdateError(err) {
  const raw = String(err?.message || err || 'Erreur inconnue');
  if (/\b404\b|introuvable/i.test(raw)) {
    return 'Les fichiers de mise à jour sont momentanément introuvables sur GitHub (404). Réessaie dans quelques instants.';
  }
  if (/ENOTFOUND|EAI_AGAIN|internet|network|réseau/i.test(raw)) {
    return 'Impossible de joindre GitHub. Vérifie ta connexion Internet puis réessaie.';
  }
  if (/timed? ?out|timeout|délai/i.test(raw)) {
    return 'GitHub met trop de temps à répondre. Réessaie dans quelques instants.';
  }
  const firstUseful = raw.split(/\r?\n/).find(line => line.trim() && !/System\.|Squirrel\.|---|stack|trace/i.test(line));
  return (firstUseful || raw).trim().slice(0, 500);
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
          const assets = Array.isArray(data.assets) ? data.assets : [];
          const hasReleases = assets.some(a => a?.name === 'RELEASES');
          const hasNupkg = assets.some(a => /-full\.nupkg$/i.test(String(a?.name || '')));
          resolve({
            version: normalizeVersion(data.tag_name || data.name || ''),
            name: String(data.name || data.tag_name || ''),
            url: String(data.html_url || ''),
            publishedAt: String(data.published_at || ''),
            updaterReady: hasReleases && hasNupkg
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

async function showAlreadyCurrent(version, manual) {
  setStatus({
    state: 'current',
    detail: 'Application à jour.',
    checkedAt: Date.now(),
    availableVersion: version || app.getVersion()
  });
  if (manual) {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Trading Journal à jour',
      message: 'Aucune nouvelle mise à jour n’est disponible.',
      detail: `Version installée : ${app.getVersion()}\nDernière version publiée : ${version || app.getVersion()}`,
      buttons: ['OK'],
      noLink: true
    });
  }
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
    if (manual) await dialog.showMessageBox({ type: 'error', title: 'Erreur de mise à jour', message: out.detail });
    return out;
  }

  setStatus({ state: 'checking', detail: 'Vérification de la dernière version sur GitHub…', checkedAt: Date.now() });
  if (manual) notify('Trading Journal — Mise à jour', `Vérification en cours… Version installée : ${app.getVersion()}`);

  let latest;
  try {
    latest = await fetchLatestRelease();
    if (latest.version) status.availableVersion = latest.version;
  } catch (err) {
    const detail = cleanUpdateError(err);
    setStatus({ state: 'error', detail, checkedAt: Date.now() });
    if (manual) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Erreur de mise à jour',
        message: 'Trading Journal n’a pas pu vérifier la dernière version sur GitHub.',
        detail,
        buttons: ['OK'],
        noLink: true
      });
    }
    return status;
  }

  if (!latest.version || compareVersions(latest.version, app.getVersion()) <= 0) {
    await showAlreadyCurrent(latest.version, manual);
    return status;
  }

  if (!latest.updaterReady) {
    const detail = `La version ${latest.version} est publiée, mais ses fichiers de mise à jour Squirrel ne sont pas encore tous disponibles.`;
    setStatus({ state: 'error', detail, checkedAt: Date.now(), availableVersion: latest.version });
    if (manual) {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Mise à jour en préparation',
        message: `La version ${latest.version} existe mais n’est pas encore prête à être installée automatiquement.`,
        detail: 'Attends quelques instants puis clique à nouveau sur « Vérifier maintenant ».',
        buttons: ['OK'],
        noLink: true
      });
    }
    return status;
  }

  try {
    manualCheckPending = manual === true;
    clearManualTimer();
    autoUpdater.setFeedURL({ url: feed });
    setStatus({
      state: 'checking',
      detail: `Mise à jour ${latest.version} trouvée. Préparation du téléchargement…`,
      checkedAt: Date.now(),
      availableVersion: latest.version
    });

    if (manualCheckPending) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Nouvelle mise à jour disponible',
        message: `Trading Journal ${latest.version} est disponible.`,
        detail: `Version installée : ${app.getVersion()}\nNouvelle version : ${latest.version}\n\nLe téléchargement va démarrer automatiquement.`,
        buttons: ['Télécharger la mise à jour'],
        noLink: true
      });

      manualCheckTimer = setTimeout(async () => {
        if (!manualCheckPending) return;
        manualCheckPending = false;
        setStatus({ state: 'error', detail: 'Le téléchargement n’a pas démarré après 30 secondes.', checkedAt: Date.now() });
        await dialog.showMessageBox({
          type: 'warning',
          title: 'Mise à jour',
          message: 'Le téléchargement ne démarre pas.',
          detail: 'Réessaie depuis le Centre de mise à jour. Si le problème persiste, les fichiers GitHub peuvent être temporairement indisponibles.',
          buttons: ['OK'],
          noLink: true
        });
      }, 30000);
    }

    autoUpdater.checkForUpdates();
  } catch (err) {
    clearManualTimer();
    const wasManual = manualCheckPending || manual;
    manualCheckPending = false;
    const detail = cleanUpdateError(err);
    const out = setStatus({ state: 'error', detail, checkedAt: Date.now() });
    if (wasManual) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Erreur de mise à jour',
        message: 'Le téléchargement de la mise à jour n’a pas pu démarrer.',
        detail,
        buttons: ['OK'],
        noLink: true
      });
    }
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
    lookupError = cleanUpdateError(err);
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
  } else if (newerExists && latest?.updaterReady !== false) {
    message = 'Une nouvelle mise à jour est disponible.';
    stateLine = 'Clique sur « Mettre à jour maintenant » pour lancer le téléchargement.';
  } else if (newerExists && latest?.updaterReady === false) {
    message = 'Une nouvelle version vient d’être publiée.';
    stateLine = 'Ses fichiers de mise à jour sont encore en préparation.';
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
  } else if (newerExists && latest?.updaterReady !== false) {
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
  if (action === 'Mettre à jour maintenant' || action === 'Vérifier à nouveau') {
    await checkForUpdates({ manual: true });
  }
}

async function initUpdater() {
  await ensureConfigFile();

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking', detail: 'Préparation du téléchargement…', checkedAt: Date.now() });
  });

  autoUpdater.on('update-available', async () => {
    clearManualTimer();
    const wasManual = manualCheckPending;
    manualCheckPending = false;
    setStatus({ state: 'downloading', detail: 'Mise à jour disponible, téléchargement en arrière-plan…', checkedAt: Date.now() });
    notify('Trading Journal — Téléchargement', `Téléchargement de la version ${status.availableVersion || 'disponible'} en cours.`);
    if (wasManual) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Téléchargement en cours',
        message: `Trading Journal ${status.availableVersion || 'nouvelle version'} est en cours de téléchargement.`,
        detail: 'Tu peux continuer à utiliser le journal. Une fenêtre apparaîtra automatiquement lorsque la mise à jour sera prête.',
        buttons: ['OK'],
        noLink: true
      });
    }
  });

  autoUpdater.on('update-not-available', async () => {
    clearManualTimer();
    const wasManual = manualCheckPending;
    manualCheckPending = false;
    setStatus({ state: 'current', detail: 'Application à jour.', checkedAt: Date.now() });
    if (wasManual) await showAlreadyCurrent(status.availableVersion || app.getVersion(), true);
  });

  autoUpdater.on('error', async err => {
    clearManualTimer();
    const wasManual = manualCheckPending;
    manualCheckPending = false;
    const detail = cleanUpdateError(err);
    setStatus({ state: 'error', detail, checkedAt: Date.now() });
    if (wasManual) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Erreur de mise à jour',
        message: 'Trading Journal n’a pas pu télécharger la mise à jour.',
        detail,
        buttons: ['OK'],
        noLink: true
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
      message: 'La nouvelle version de Trading Journal est prête.',
      detail: `Version installée : ${app.getVersion()}\nNouvelle version : ${downloadedVersion || status.availableVersion || 'nouvelle version'}\n\nRedémarre maintenant pour terminer l’installation.`,
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
