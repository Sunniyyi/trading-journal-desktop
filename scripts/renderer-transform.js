'use strict';

const CHART_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
const CHART_LOCAL = './vendor/chart.umd.js';

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Renderer transform: marqueur introuvable (${label}).`);
  if (source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`Renderer transform: marqueur non unique (${label}).`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function patchJournalView(source) {
  const from = `  if(isCal){ if(!journalCalYm) journalCalYm=defaultJournalYm(); renderJournalCalendar(); }\n  else render();`;
  const to = `  if(isCal && !journalCalYm) journalCalYm=defaultJournalYm();\n  // Un seul cycle de rendu : stats + courbe + analyses + calendrier.\n  render();`;
  return replaceOnce(source, from, to, 'setJournalView');
}

function patchBoot(source) {
  const re = /async function boot\(\)\{[\s\S]*?\n\}\nboot\(\);/;
  const match = source.match(re);
  if (!match) throw new Error('Renderer transform: boot() introuvable.');

  const replacement = `async function boot(){
  try{ await initStorage(); }catch(e){ console.error('initStorage',e); }
  const step=(name,fn)=>{ try{ fn(); }catch(e){ console.error(name,e); } };

  // Chemin critique : données, préférences et premier écran uniquement.
  // L'ancien boot initialisait tous les modules puis rendait plusieurs fois la page.
  step('loadSettings',loadSettings);
  step('load',load);
  step('btLoad',btLoad);
  step('loadJournalNotes',loadJournalNotes);
  step('loadDayNotes',loadDayNotes);
  step('applySettings',applySettings);
  step('visualThemeInit',visualThemeInit);
  step('purgeLayout',()=>{ if(settings.layout && Object.keys(settings.layout).length){ settings.layout={}; saveSettings(); } });
  step('applyLabels',applyLabels);
  step('updateStorageBar',updateStorageBar);
  step('fxrSyncInit',fxrSyncInit);
  step('fxrRiskUI',fxrRefreshRiskInput);

  // setJournalView déclenche désormais l'unique rendu initial complet.
  step('setJournalView',()=>setJournalView('calendar'));

  // Modules non critiques : initialisés après le premier paint pour garder une ouverture fluide.
  const deferred=()=>{
    step('newsInit',newsInit);
    step('nwInit',nwInit);
    step('mcInit',mcInit);
    step('wfInit',wfInit);
    step('dsrInit',dsrInit);
    step('animInit',animInit);
    step('scanInit',scanInit);
    step('mktInit',mktInit);
    step('mwInit',mwInit);
    step('ctxInit',ctxInit);
    step('gateInit',gateInit);
    step('uiInitWidgetWindows',uiInitWidgetWindows);
    step('initEditInteractions',initEditInteractions);
    step('ensureHandles',ensureHandles);
    // La sauvegarde auto repart toujours désactivée à l'ouverture.
    step('resetAutoBackup',()=>{ settings.autoBackup=false; });
    step('applyAutoBackupUI',applyAutoBackupUI);
    step('startAutoBackup',startAutoBackup);
    step('updateAutoBackupWarning',updateAutoBackupWarning);
  };
  if('requestIdleCallback' in window) requestIdleCallback(deferred,{timeout:900});
  else setTimeout(deferred,80);
}
boot();`;

  return source.replace(re, replacement);
}

function injectDesktopRuntime(source) {
  const marker = '<script type="module" id="localVlmBridgeModule">';
  const injection = [
    '<script src="./desktop-performance.js"></script>',
    '<script type="module" src="./ui/stability-runtime.js"></script>',
    '<script type="module" src="./ui/bootstrap.js"></script>',
    marker
  ].join('\n');
  return replaceOnce(source, marker, injection, 'desktop runtime injection');
}

function injectDesktopStyles(source) {
  const marker = '</head>';
  const links = [
    '<link rel="stylesheet" href="./ui/tokens.css">',
    '<link rel="stylesheet" href="./ui/shell.css">',
    '<link rel="stylesheet" href="./ui/components.css">',
    '<link rel="stylesheet" href="./ui/workspaces.css">',
    '<link rel="stylesheet" href="./ui/stability.css">',
    '<link rel="stylesheet" href="./ui/visual-hotfix.css">',
    '<link rel="stylesheet" href="./ui/layout-v214.css">',
    '<link rel="stylesheet" href="./ui/layout-v215.css">',
    '<link rel="stylesheet" href="./ui/update-center.css">',
    '<link rel="stylesheet" href="./ui/final-polish.css">',
    '<link rel="stylesheet" href="./ui/overview-polish.css">',
    '<link rel="stylesheet" href="./ui/widget-polish.css">',
    '<link rel="stylesheet" href="./ui/typography-polish.css">',
    '<link rel="stylesheet" href="./ui/journal-polish.css">',
    '<link rel="stylesheet" href="./ui/journal-premium.css">',
    '<link rel="stylesheet" href="./ui/workspace-routing-fix.css">'
  ].join('\n');
  if (!source.includes(marker)) throw new Error('Renderer transform: </head> introuvable.');
  return source.replace(marker, links + '\n' + marker);
}

function transformRenderer(html) {
  let out = String(html);
  out = replaceOnce(out, CHART_CDN, CHART_LOCAL, 'Chart.js local');
  out = patchJournalView(out);
  out = patchBoot(out);
  out = injectDesktopStyles(out);
  out = injectDesktopRuntime(out);
  return out;
}

module.exports = { transformRenderer, CHART_CDN, CHART_LOCAL };
