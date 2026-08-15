'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// IMPORTANT: this preload runs with sandbox:true. Electron only provides a
// restricted require() in sandboxed preloads, so this file must stay
// self-contained and must not require local CommonJS modules.

function postToPage(message) {
  window.postMessage(message, '*');
}

function installPageBridge() {
  window.addEventListener('DOMContentLoaded', () => {
    postToPage({ source: 'fxr-extension', type: 'FXR_EXTENSION_BRIDGE_READY', at: Date.now(), desktop: true });

    window.addEventListener('message', event => {
      if (event.source !== window || !event.data || event.data.source !== 'trade-journal-fxr') return;
      const d = event.data;
      if (d.type === 'FXR_SITE_CONFIG') {
        ipcRenderer.send('renderer:site-config', { pages: d.pages || [], targetPageId: d.targetPageId || '', version: d.version || '' });
      } else if (d.type === 'FXR_IMPORT_ACK' && d.id) {
        ipcRenderer.send('renderer:import-ack', { id: d.id, sourceId: d.sourceId || '', kind: d.kind || 'trade' });
      } else if (d.type === 'FXR_IMPORT_FAIL' && d.id) {
        ipcRenderer.send('renderer:import-fail', { id: d.id, error: d.error || 'Import refusé', kind: d.kind || 'trade' });
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
}

const HUD_ID = 'tj-desktop-update-hud';
const HUD_STYLE_ID = 'tj-desktop-update-hud-style';

function ensureUpdateHud() {
  let hud = document.getElementById(HUD_ID);
  if (hud) return hud;

  if (!document.getElementById(HUD_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = HUD_STYLE_ID;
    style.textContent = `
      #${HUD_ID}{position:fixed;right:18px;bottom:78px;width:min(380px,calc(100vw - 36px));z-index:2147483646;box-sizing:border-box;padding:11px 12px 10px;border:1px solid rgba(116,173,255,.28);border-radius:14px;background:rgba(7,15,34,.94);box-shadow:0 18px 50px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.04);color:#e7f0ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;backdrop-filter:blur(14px)}
      #${HUD_ID}[hidden]{display:none!important}
      #${HUD_ID} .tj-up-row{display:flex;align-items:center;gap:9px;min-width:0}
      #${HUD_ID} .tj-up-dot{width:9px;height:9px;border-radius:999px;flex:0 0 auto;background:#6e8cff;box-shadow:0 0 16px rgba(110,140,255,.65)}
      #${HUD_ID}[data-state="downloading"] .tj-up-dot,#${HUD_ID}[data-state="installing"] .tj-up-dot{animation:tjUpdatePulse 1.15s ease-in-out infinite}
      #${HUD_ID}[data-state="ready"] .tj-up-dot{background:#52e0af;box-shadow:0 0 16px rgba(82,224,175,.55)}
      #${HUD_ID}[data-state="error"] .tj-up-dot{background:#ff6f86;box-shadow:0 0 16px rgba(255,111,134,.55)}
      #${HUD_ID} .tj-up-main{min-width:0;flex:1}#${HUD_ID} .tj-up-title{font-size:12px;line-height:1.2;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${HUD_ID} .tj-up-detail{margin-top:3px;font-size:10.5px;line-height:1.3;color:#9fb0cf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${HUD_ID} .tj-up-pct{font-size:12px;font-weight:900;color:#cfe0ff;min-width:38px;text-align:right}
      #${HUD_ID} .tj-up-track{position:relative;height:5px;margin-top:9px;border-radius:99px;overflow:hidden;background:rgba(130,155,205,.16)}#${HUD_ID} .tj-up-fill{position:absolute;inset:0 auto 0 0;width:0%;border-radius:inherit;background:linear-gradient(90deg,#5cc8ff,#7d7cff,#51e2c2);transition:width .2s ease}#${HUD_ID}[data-indeterminate="true"] .tj-up-fill{width:35%!important;animation:tjUpdateSlide 1.05s ease-in-out infinite}
      #${HUD_ID} .tj-up-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:9px}#${HUD_ID} button{appearance:none;border:1px solid rgba(130,168,235,.25);border-radius:9px;background:rgba(100,137,210,.12);color:#dce8ff;padding:6px 9px;font:700 10px/1.1 Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer}#${HUD_ID} button.tj-up-primary{border-color:rgba(101,218,192,.38);background:rgba(48,183,155,.16);color:#9ff2dc}
      @keyframes tjUpdatePulse{0%,100%{transform:scale(.82);opacity:.72}50%{transform:scale(1.18);opacity:1}}@keyframes tjUpdateSlide{0%{left:-35%}55%{left:55%}100%{left:105%}}
      @media(prefers-reduced-motion:reduce){#${HUD_ID} .tj-up-dot,#${HUD_ID} .tj-up-fill{animation:none!important;transition:none!important}}
    `;
    document.documentElement.appendChild(style);
  }

  hud = document.createElement('div');
  hud.id = HUD_ID;
  hud.hidden = true;
  hud.innerHTML = '<div class="tj-up-row"><span class="tj-up-dot"></span><div class="tj-up-main"><div class="tj-up-title">Mises à jour Trading Journal</div><div class="tj-up-detail">Initialisation…</div></div><div class="tj-up-pct"></div></div><div class="tj-up-track"><div class="tj-up-fill"></div></div><div class="tj-up-actions"></div>';
  document.body.appendChild(hud);
  return hud;
}

function hudButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await handler(); } finally { button.disabled = false; }
  });
  return button;
}

function renderUpdateHud(rawStatus) {
  if (!document.body) return;
  const status = rawStatus || {};
  const hud = ensureUpdateHud();
  const state = String(status.state || 'idle');
  const phase = String(status.phase || state);
  const progress = Math.max(0, Math.min(100, Number(status.progress) || 0));
  const version = status.availableVersion || status.downloadedVersion || '';
  const title = hud.querySelector('.tj-up-title');
  const detail = hud.querySelector('.tj-up-detail');
  const pct = hud.querySelector('.tj-up-pct');
  const fill = hud.querySelector('.tj-up-fill');
  const actions = hud.querySelector('.tj-up-actions');

  hud.dataset.state = phase;
  hud.dataset.indeterminate = (phase === 'checking' || ((phase === 'downloading' || phase === 'installing') && progress <= 0)) ? 'true' : 'false';
  actions.replaceChildren();

  if (state === 'idle' || state === 'current' || state === 'development') {
    hud.hidden = true;
    return;
  }

  hud.hidden = false;
  fill.style.width = `${progress}%`;

  if (state === 'checking') {
    title.textContent = 'Recherche d’une mise à jour…'; detail.textContent = status.detail || 'Connexion à GitHub…'; pct.textContent = ''; return;
  }
  if (state === 'available') {
    title.textContent = `Mise à jour ${version || ''} disponible`; detail.textContent = 'Tu peux continuer à utiliser le journal pendant la mise à jour.'; pct.textContent = '';
    actions.appendChild(hudButton('Mettre à jour', 'tj-up-primary', () => ipcRenderer.invoke('desktop:start-update')));
    actions.appendChild(hudButton('Détails', '', () => ipcRenderer.invoke('desktop:open-update-center')));
    return;
  }
  if (state === 'downloading') {
    title.textContent = phase === 'installing' ? `Finalisation de la MAJ ${version || ''}` : `Téléchargement de la MAJ ${version || ''}`; detail.textContent = status.detail || 'La mise à jour continue en arrière-plan.'; pct.textContent = `${Math.round(progress)}%`; return;
  }
  if (state === 'ready') {
    title.textContent = `Mise à jour ${status.downloadedVersion || version || ''} prête`; detail.textContent = 'Redémarre quand tu veux pour utiliser la nouvelle version.'; pct.textContent = '100%'; fill.style.width = '100%';
    actions.appendChild(hudButton('Redémarrer', 'tj-up-primary', () => ipcRenderer.invoke('desktop:restart-update')));
    actions.appendChild(hudButton('Détails', '', () => ipcRenderer.invoke('desktop:open-update-center')));
    return;
  }
  if (state === 'error') {
    title.textContent = 'Mise à jour interrompue'; detail.textContent = status.detail || 'Une erreur est survenue.'; pct.textContent = ''; fill.style.width = '0%';
    actions.appendChild(hudButton('Réessayer', 'tj-up-primary', () => ipcRenderer.invoke('desktop:check-update')));
    actions.appendChild(hudButton('Détails', '', () => ipcRenderer.invoke('desktop:open-update-center')));
  }
}

installPageBridge();

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('desktop:get-update-status').then(renderUpdateHud).catch(() => {});
});
ipcRenderer.on('desktop:update-status', (_event, status) => renderUpdateHud(status || {}));

contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  bridgeVersion: '1.4.0',
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
  onUpdateStatus: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status || {});
    ipcRenderer.on('desktop:update-status', listener);
    return () => ipcRenderer.removeListener('desktop:update-status', listener);
  },
  onRequestUpdateCenter: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('desktop:request-update-center', listener);
    return () => ipcRenderer.removeListener('desktop:request-update-center', listener);
  }
});
