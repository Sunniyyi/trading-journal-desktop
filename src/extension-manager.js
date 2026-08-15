'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const { app } = require('electron');

function versionParts(v) {
  return String(v || '0').split('.').map(x => Number.parseInt(x, 10) || 0);
}

function compareVersions(a, b) {
  const aa = versionParts(a), bb = versionParts(b);
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) {
    const x = aa[i] || 0, y = bb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

async function exists(p) {
  try { await fs.access(p); return true; }
  catch (_) { return false; }
}

async function readManifest(dir) {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
  } catch (_) {
    return null;
  }
}

function bundledExtensionDir() {
  if (!app.isPackaged) return path.join(app.getAppPath(), 'extension', 'fxreplay-v21-desktop');
  const candidates = [
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'extension', 'fxreplay-v21-desktop'),
    path.join(process.resourcesPath || '', 'app', 'extension', 'fxreplay-v21-desktop'),
    path.join(app.getAppPath(), 'extension', 'fxreplay-v21-desktop')
  ];
  return candidates.find(p => fsSync.existsSync(path.join(p, 'manifest.json'))) || candidates[0];
}

function managedExtensionDir() {
  return path.join(app.getPath('userData'), 'FXReplay Extension');
}

async function copyTree(source, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  const wanted = new Set(entries.map(e => e.name));

  // Remove files from previous versions that no longer exist in the bundled extension.
  if (await exists(dest)) {
    for (const old of await fs.readdir(dest, { withFileTypes: true })) {
      if (old.name === '.desktop-managed.json') continue;
      if (!wanted.has(old.name)) {
        await fs.rm(path.join(dest, old.name), { recursive: true, force: true });
      }
    }
  }

  for (const entry of entries) {
    const src = path.join(source, entry.name);
    const out = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(src, out);
    } else if (entry.isFile()) {
      await fs.copyFile(src, out);
    }
  }
}

async function syncManagedExtension() {
  const source = bundledExtensionDir();
  const dest = managedExtensionDir();
  const sourceManifest = await readManifest(source);
  if (!sourceManifest) {
    return { ok: false, error: `Manifest extension introuvable : ${source}` };
  }

  const before = await readManifest(dest);
  await fs.mkdir(dest, { recursive: true });
  await copyTree(source, dest);
  const after = await readManifest(dest);
  if (!after) return { ok: false, error: 'La copie de l’extension n’a pas produit de manifest valide.' };

  const syncedAt = Date.now();
  const meta = {
    managedBy: 'Trading Journal Desktop',
    channel: 'desktop-managed-v1',
    version: after.version || sourceManifest.version || '0.0.0',
    syncedAt
  };
  await fs.writeFile(path.join(dest, '.desktop-managed.json'), JSON.stringify(meta, null, 2), 'utf8');

  return {
    ok: true,
    path: dest,
    version: meta.version,
    sourceVersion: sourceManifest.version || '',
    previousVersion: before?.version || '',
    changed: !before || compareVersions(meta.version, before.version) !== 0,
    syncedAt,
    filesReady: true,
    channel: meta.channel
  };
}

module.exports = {
  syncManagedExtension,
  managedExtensionDir,
  bundledExtensionDir,
  compareVersions
};
