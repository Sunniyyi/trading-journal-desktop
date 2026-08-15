'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const https = require('node:https');
const { spawn } = require('node:child_process');
const { app, dialog, shell, Notification } = require('electron');

const OFFICIAL_REPO = 'Sunniyyi/trading-journal-desktop';
const DEFAULT_CONFIG = {
  enabled: true,
  githubRepo: OFFICIAL_REPO,
  feedUrl: '',
  checkIntervalMinutes: 10,
  checkOnStartup: true
};

let status = {
  state: 'idle',
  phase: 'idle',
  detail: 'Aucune mise à jour en cours.',
  checkedAt: 0,
  availableVersion: '',
  downloadedVersion: '',
  progress: 0
};
let timer = null;
let updateConfig = { ...DEFAULT_CONFIG };
let statusSink = null;
let updateProcess = null;
let currentRelease = null;

function configPath() {
  return path.join(app.getPath('userData'), 'update-config.json');
}

async function writeConfig() {
  const p = configPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(updateConfig, null, 2), 'utf8');
}

async function ensureConfigFile() {
  const p = configPath();
  let changed = false;
  try {
    const raw = await fs.readFile(p, 'utf8');
    const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
    updateConfig = { ...DEFAULT_CONFIG, ...(data || {}) };

    // Compatibility migration: early desktop builds could persist a temporary
    // repository name forever. Keep a custom feedUrl if one was explicitly set,
    // otherwise always migrate back to the official release repository.
    if (!String(updateConfig.feedUrl || '').trim() && updateConfig.githubRepo !== OFFICIAL_REPO) {
      updateConfig.githubRepo = OFFICIAL_REPO;
      changed = true;
    }
    if (updateConfig.enabled !== true) {
      updateConfig.enabled = true;
      changed = true;
    }
  } catch (_) {
    updateConfig = { ...DEFAULT_CONFIG };
    changed = true;
  }
  if (changed) await writeConfig();
  return updateConfig;
}

function normalizedRepo(cfg = updateConfig) {
  return String(cfg.githubRepo || OFFICIAL_REPO)
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
}

function feedForRelease(release) {
  if (String(updateConfig.feedUrl || '').trim()) return String(updateConfig.feedUrl).trim().replace(/\/$/, '');
  const repo = normalizedRepo();
  const tag = String(release?.tagName || '').trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo) || !tag) return '';
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}`;
}

function publicStatus() {
  return {
    ...status,
    enabled: !!updateConfig.enabled,
    version: app.getVersion(),
    configPath: configPath(),
    updating: !!updateProcess
  };
}

function emitStatus() {
  if (typeof statusSink !== 'function') return;
  try { statusSink(publicStatus()); } catch (_) {}
}

function setStatus(patch) {
  const next = { ...status, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch || {}, 'progress')) {
    const n = Number(patch.progress);
    next.progress = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : status.progress;
  }
  status = next;
  emitStatus();
  return publicStatus();
}

function setUpdaterStatusSink(fn) {
  statusSink = typeof fn === 'function' ? fn : null;
  emitStatus();
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
  if (/\b404\b|introuvable/i.test(raw)) return 'Les fichiers de mise à jour sont introuvables sur GitHub (404).';
  if (/ENOTFOUND|EAI_AGAIN|internet|network|réseau/i.test(raw)) return 'Impossible de joindre GitHub. Vérifie ta connexion Internet.';
  if (/timed? ?out|timeout|délai/i.test(raw)) return 'GitHub met trop de temps à répondre.';
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
          const releasesAsset = assets.find(a => a?.name === 'RELEASES');
          const packageAsset = assets.find(a => /-full\.nupkg$/i.test(String(a?.name || '')));
          resolve({
            version: normalizeVersion(data.tag_name || data.name || ''),
            tagName: String(data.tag_name || ''),
            name: String(data.name || data.tag_name || ''),
            url: String(data.html_url || ''),
            publishedAt: String(data.published_at || ''),
            updaterReady: !!releasesAsset && !!packageAsset,
            packageName: String(packageAsset?.name || ''),
            packageSize: Number(packageAsset?.size || 0)
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
    const out = setStatus({ state: 'development', phase: 'idle', detail: 'Les mises à jour sont disponibles uniquement dans l’application installée.', checkedAt: Date.now(), progress: 0 });
    if (manual) await dialog.showMessageBox({ type: 'info', title: 'Mises à jour', message: out.detail });
    return out;
  }

  if (updateProcess) {
    if (manual) await showUpdateCenter();
    return publicStatus();
  }

  setStatus({ state: 'checking', phase: 'checking', detail: 'Vérification de la dernière version sur GitHub…', checkedAt: Date.now(), progress: 0 });

  let latest;
  try {
    latest = await fetchLatestRelease();
    currentRelease = latest;
  } catch (err) {
    const detail = cleanUpdateError(err);
    const out = setStatus({ state: 'error', phase: 'error', detail, checkedAt: Date.now(), progress: 0 });
    if (manual) {
      await dialog.showMessageBox({ type: 'error', title: 'Erreur de mise à jour', message: 'Impossible de vérifier la dernière version.', detail, buttons: ['OK'], noLink: true });
    }
    return out;
  }

  if (!latest.version || compareVersions(latest.version, app.getVersion()) <= 0) {
    const out = setStatus({
      state: 'current',
      phase: 'idle',
      detail: 'Trading Journal est à jour.',
      checkedAt: Date.now(),
      availableVersion: latest.version || app.getVersion(),
      progress: 0
    });
    if (manual) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Trading Journal à jour',
        message: 'Aucune nouvelle mise à jour n’est disponible.',
        detail: `Version installée : ${app.getVersion()}\nDernière version publiée : ${latest.version || app.getVersion()}`,
        buttons: ['OK'], noLink: true
      });
    }
    return out;
  }

  if (!latest.updaterReady) {
    const detail = `La version ${latest.version} est publiée, mais ses fichiers Windows sont encore en préparation.`;
    const out = setStatus({ state: 'error', phase: 'error', detail, checkedAt: Date.now(), availableVersion: latest.version, progress: 0 });
    if (manual) await dialog.showMessageBox({ type: 'warning', title: 'Mise à jour en préparation', message: detail, buttons: ['OK'], noLink: true });
    return out;
  }

  const out = setStatus({
    state: 'available',
    phase: 'available',
    detail: `Trading Journal ${latest.version} est disponible.`,
    checkedAt: Date.now(),
    availableVersion: latest.version,
    progress: 0
  });
  notify('Trading Journal — Mise à jour disponible', `La version ${latest.version} est disponible.`);

  if (manual) {
    const answer = await dialog.showMessageBox({
      type: 'info',
      title: 'Nouvelle mise à jour disponible',
      message: `Trading Journal ${latest.version} est disponible.`,
      detail: `Version installée : ${app.getVersion()}\nNouvelle version : ${latest.version}`,
      buttons: ['Télécharger maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (answer.response === 0) return startAvailableUpdate({ manual: false });
  }
  return out;
}

function squirrelUpdateExe() {
  return path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
}

function parseProgressLine(line) {
  const match = String(line || '').trim().match(/^(100|[1-9]?\d)(?:\.\d+)?$/);
  return match ? Math.max(0, Math.min(100, Math.round(Number(match[1])))) : null;
}

async function restartIntoUpdatedVersion() {
  const updateExe = squirrelUpdateExe();
  try {
    await fs.access(updateExe);
    const child = spawn(updateExe, ['--processStart', path.basename(process.execPath)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: path.dirname(updateExe)
    });
    child.unref();
    app.quit();
    return true;
  } catch (err) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Redémarrage impossible',
      message: 'La mise à jour est installée mais Trading Journal n’a pas pu redémarrer automatiquement.',
      detail: 'Ferme puis relance Trading Journal depuis le menu Démarrer.\n\n' + cleanUpdateError(err),
      buttons: ['OK'], noLink: true
    });
    return false;
  }
}

async function startAvailableUpdate({ manual = false } = {}) {
  await ensureConfigFile();
  if (updateProcess) return publicStatus();

  let latest = currentRelease;
  if (!latest || !latest.version || compareVersions(latest.version, app.getVersion()) <= 0) {
    try {
      latest = await fetchLatestRelease();
      currentRelease = latest;
    } catch (err) {
      const detail = cleanUpdateError(err);
      setStatus({ state: 'error', phase: 'error', detail, progress: 0 });
      if (manual) await dialog.showMessageBox({ type: 'error', title: 'Mise à jour', message: detail, buttons: ['OK'], noLink: true });
      return publicStatus();
    }
  }

  if (!latest.updaterReady || compareVersions(latest.version, app.getVersion()) <= 0) return checkForUpdates({ manual });

  const feed = feedForRelease(latest);
  const updateExe = squirrelUpdateExe();
  try {
    await fs.access(updateExe);
  } catch (_) {
    const detail = 'Update.exe est introuvable. Lance Trading Journal depuis son installation Windows, pas depuis le dossier source.';
    setStatus({ state: 'error', phase: 'error', detail, progress: 0 });
    if (manual) await dialog.showMessageBox({ type: 'error', title: 'Mise à jour', message: detail, buttons: ['OK'], noLink: true });
    return publicStatus();
  }

  if (!feed) {
    const detail = 'L’adresse de la release GitHub est invalide.';
    setStatus({ state: 'error', phase: 'error', detail, progress: 0 });
    return publicStatus();
  }

  setStatus({
    state: 'downloading',
    phase: 'downloading',
    detail: `Téléchargement de Trading Journal ${latest.version}…`,
    availableVersion: latest.version,
    progress: 0
  });

  const child = spawn(updateExe, [`--update=${feed}`], {
    cwd: path.dirname(updateExe),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  updateProcess = child;
  emitStatus();

  let stdoutBuffer = '';
  let stderrText = '';
  let maxProgress = 0;

  const consumeStdout = chunk => {
    stdoutBuffer += String(chunk || '');
    const parts = stdoutBuffer.split(/[\r\n]+/);
    stdoutBuffer = parts.pop() || '';
    for (const line of parts) {
      const p = parseProgressLine(line);
      if (p === null) continue;
      maxProgress = Math.max(maxProgress, p);
      setStatus({
        state: 'downloading',
        phase: maxProgress >= 95 ? 'installing' : 'downloading',
        detail: maxProgress >= 95 ? `Finalisation de Trading Journal ${latest.version}…` : `Téléchargement de Trading Journal ${latest.version}…`,
        progress: maxProgress
      });
    }
  };

  child.stdout.on('data', consumeStdout);
  child.stderr.on('data', chunk => { stderrText += String(chunk || ''); });

  child.on('error', err => {
    updateProcess = null;
    const detail = cleanUpdateError(err);
    setStatus({ state: 'error', phase: 'error', detail, progress: 0 });
  });

  child.on('close', async code => {
    const trailing = parseProgressLine(stdoutBuffer);
    if (trailing !== null) maxProgress = Math.max(maxProgress, trailing);
    updateProcess = null;

    if (code !== 0) {
      const detail = cleanUpdateError(stderrText || `Update.exe a quitté avec le code ${code}.`);
      setStatus({ state: 'error', phase: 'error', detail, progress: 0 });
      notify('Trading Journal — Échec de mise à jour', detail);
      return;
    }

    setStatus({
      state: 'ready',
      phase: 'ready',
      detail: `Trading Journal ${latest.version} est prêt. Redémarre pour terminer.`,
      downloadedVersion: latest.version,
      availableVersion: latest.version,
      progress: 100
    });
    notify('Trading Journal — Mise à jour prête', `La version ${latest.version} est prête à être lancée.`);

    const answer = await dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour prête',
      message: `Trading Journal ${latest.version} est prêt.`,
      detail: 'Le téléchargement et la préparation sont terminés. Tu peux redémarrer maintenant ou continuer à travailler et redémarrer plus tard.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (answer.response === 0) await restartIntoUpdatedVersion();
  });

  return publicStatus();
}

async function installDownloadedUpdate() {
  if (status.state !== 'ready') {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Aucune mise à jour prête',
      message: updateProcess ? 'Une mise à jour est encore en cours.' : 'Aucune mise à jour n’est prête à être lancée.',
      detail: updateProcess ? `Progression actuelle : ${status.progress}%` : 'Vérifie d’abord les mises à jour.',
      buttons: ['OK'], noLink: true
    });
    return false;
  }
  return restartIntoUpdatedVersion();
}

async function showUpdateCenter() {
  await ensureConfigFile();

  if (updateProcess) {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Centre de mise à jour — Trading Journal',
      message: `Mise à jour ${status.availableVersion || ''} en cours — ${status.progress}%`,
      detail: status.detail,
      buttons: ['Continuer en arrière-plan'], noLink: true
    });
    return publicStatus();
  }

  if (status.state === 'ready') {
    const answer = await dialog.showMessageBox({
      type: 'info',
      title: 'Centre de mise à jour — Trading Journal',
      message: `Trading Journal ${status.downloadedVersion || status.availableVersion} est prêt.`,
      detail: `Version actuelle : ${app.getVersion()}\nNouvelle version : ${status.downloadedVersion || status.availableVersion}`,
      buttons: ['Redémarrer maintenant', 'Fermer'],
      defaultId: 0, cancelId: 1, noLink: true
    });
    if (answer.response === 0) await restartIntoUpdatedVersion();
    return publicStatus();
  }

  await checkForUpdates({ manual: true });
  return publicStatus();
}

async function initUpdater() {
  await ensureConfigFile();
  setStatus({ state: 'idle', phase: 'idle', detail: 'Recherche automatique activée.', progress: 0 });
  if (!app.isPackaged || !updateConfig.enabled) return;

  const mins = Math.max(1, Number(updateConfig.checkIntervalMinutes) || 10);
  if (updateConfig.checkOnStartup !== false) {
    setTimeout(() => checkForUpdates({ manual: false }).catch(() => {}), process.argv.includes('--squirrel-firstrun') ? 12000 : 4000);
  }
  clearInterval(timer);
  timer = setInterval(() => {
    if (!updateProcess && status.state !== 'ready') checkForUpdates({ manual: false }).catch(() => {});
  }, mins * 60 * 1000);
}

async function openUpdaterConfig() {
  await ensureConfigFile();
  return shell.openPath(configPath());
}

function getUpdaterStatus() {
  return publicStatus();
}

module.exports = {
  initUpdater,
  checkForUpdates,
  startAvailableUpdate,
  showUpdateCenter,
  installDownloadedUpdate,
  openUpdaterConfig,
  getUpdaterStatus,
  setUpdaterStatusSink,
  configPath
};
