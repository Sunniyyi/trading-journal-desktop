import { $, el, text, callLegacy, observeText, afterPaint } from './lib/dom.js';
import { WORKSPACES, byId, byLegacy } from './config.js';
import { buildOverview } from './workspaces/overview.js';
import { buildDiscipline } from './workspaces/discipline.js';
import { enhanceJournal } from './workspaces/journal.js';
import { enhanceBacktesting } from './workspaces/backtesting.js';
import { createCommandPalette } from './command-palette.js';
import { createInspector } from './inspector.js';
import { initLayoutController } from './layout-controller.js';
import { createUpdateCenter } from './update-center.js';

const state={active:'overview',legacySwitch:null,routing:false,inspector:null,layout:null};
const viewDisplay={viewTrading:'flex',viewBacktest:'flex',viewScan:'block',viewContext:'block',viewGate:'block'};

function iconLabel(item){return `<span class="tj-nav-icon">${item.icon}</span><span class="tj-nav-label">${item.label}</span>`;}
function setHeader(item){
  const title=$('#tjWorkspaceTitle'),sub=$('#tjWorkspaceSubtitle'),crumb=$('#tjWorkspaceCrumb');
  if(title)title.textContent=item?.title||'Trading Journal';
  if(sub)sub.textContent=item?.subtitle||'';
  if(crumb)crumb.textContent=item?.label||'Workspace';
}
function setActiveNav(id){document.querySelectorAll('.tj-nav-button').forEach(b=>b.classList.toggle('is-active',b.dataset.workspace===id));}
function legacyViews(){return WORKSPACES.filter(x=>x.viewId).map(x=>document.getElementById(x.viewId)).filter(Boolean);}
function hideCustom(){['tjOverviewView','tjDisciplineView'].forEach(id=>{const v=document.getElementById(id);if(v)v.hidden=true;});}
function setLegacyVisibility(activeViewId=''){legacyViews().forEach(v=>v.style.setProperty('display',v.id===activeViewId?(viewDisplay[v.id]||'block'):'none','important'));}
function hideLegacy(){setLegacyVisibility('');document.body.classList.remove('bt-mode','scan-mode','context-mode','gate-mode');}

export function navigate(id,{fromLegacy=false}={}){
  const item=byId(id);if(!item)return;
  if(item.action==='settings'){callLegacy('openSettings');return;}
  state.active=id;setActiveNav(id);setHeader(item);hideCustom();state.inspector?.setWorkspace(id);document.body.dataset.workspace=id;
  if(item.legacy){
    if(!fromLegacy&&typeof state.legacySwitch==='function'){
      state.routing=true;try{state.legacySwitch(item.legacy);}finally{state.routing=false;}
      setLegacyVisibility(item.viewId);
    }else setLegacyVisibility(item.viewId);
  }else{
    hideLegacy();
    const custom=document.getElementById(id==='overview'?'tjOverviewView':'tjDisciplineView');if(custom)custom.hidden=false;
    if(id==='discipline')callLegacy('render');
  }
  afterPaint(()=>window.dispatchEvent(new Event('resize')));
}

function buildSidebar(shell){
  const sidebar=el('aside','tj-sidebar');
  const brand=el('div','tj-brand');
  brand.innerHTML='<div class="tj-brand-mark">TJ</div><div class="tj-brand-copy"><b>Trading Journal</b><small>Desktop Workbench</small></div><button class="tj-sidebar-toggle" id="tjSidebarToggle" type="button" title="Réduire la navigation · Ctrl+B">‹</button>';
  const nav=el('nav','tj-nav');
  for(const item of WORKSPACES){
    const b=el('button','tj-nav-button',{type:'button',dataset:{workspace:item.id},title:item.label});b.innerHTML=iconLabel(item);b.addEventListener('click',()=>navigate(item.id));nav.appendChild(b);
  }
  const foot=el('div','tj-sidebar-foot');
  foot.innerHTML='<div class="tj-profile"><div class="tj-profile-avatar">TJ</div><div class="tj-profile-copy"><b>Espace local</b><small>Données privées sur ce PC</small></div><span class="tj-profile-state" title="Stockage local actif"></span></div>';
  sidebar.append(brand,nav,foot);shell.appendChild(sidebar);
}
function buildTopbar(shell){
  const top=el('header','tj-topbar');
  top.innerHTML=`<div class="tj-workspace-heading"><div class="tj-workspace-kicker"><span class="tj-workspace-pulse"></span><span id="tjWorkspaceCrumb">Accueil</span></div><h1 id="tjWorkspaceTitle">Vue d’ensemble</h1><p id="tjWorkspaceSubtitle">Résumé de ta performance, de la session et des outils actifs.</p></div>
  <div class="tj-search" id="tjGlobalSearch" role="button" tabindex="0"><span class="tj-search-icon">⌕</span><span class="tj-search-placeholder">Rechercher une vue, une commande, une action…</span><span class="tj-kbd">Ctrl K</span></div>
  <div class="tj-top-actions"><button class="tj-top-button" id="tjToolsButton" type="button">⚡ <span>Outils</span></button><button class="tj-top-button" id="tjFxrButton" type="button">↯ <span>FX Replay</span></button><button class="tj-top-button" id="tjInspectorToggle" type="button" title="Inspecteur · Ctrl+Shift+E">◫ <span>Inspecteur</span></button><button class="tj-top-button" id="tjFocusToggle" type="button" title="Mode Focus · Ctrl+Shift+F">Mode Focus</button><button class="tj-top-button tj-update-button" id="tjUpdateButton" type="button" title="Centre de mise à jour"><span class="tj-sync-dot"></span><span id="tjUpdateLabel">À jour</span></button><button class="tj-top-button is-primary" id="tjNewTrade" type="button">＋ Nouveau trade</button></div>`;
  shell.appendChild(top);
}
function buildStatusbar(shell){
  const bar=el('footer','tj-statusbar');
  bar.innerHTML=`<div class="tj-status-item"><span class="tj-status-label">Session / page cible</span><span class="tj-status-value" id="tjStatusPage">—</span></div>
  <div class="tj-status-item"><span class="tj-status-label">Risque fixe</span><span class="tj-status-value" id="tjStatusRisk">—</span></div>
  <div class="tj-status-item"><span class="tj-status-label">File d’attente</span><span class="tj-status-value" id="tjStatusPending">0</span></div>
  <div class="tj-status-item"><span class="tj-status-label">Dernier import</span><span class="tj-status-value" id="tjStatusImport">—</span></div>
  <div class="tj-status-item"><span class="tj-status-label">FX Replay</span><span class="tj-status-value is-good" id="tjStatusFxr">Prêt</span></div>
  <button class="tj-status-action" id="tjStatusFxrBtn" type="button">Ouvrir FXR</button>`;
  shell.appendChild(bar);
}
function createFxrDrawer(){
  const drawer=el('aside','',{id:'tjFxrDrawer',hidden:'hidden'});
  const head=el('div','tj-panel-head');head.innerHTML='<div><div class="tj-eyebrow">Synchronisation</div><div class="tj-panel-title">FX Replay → Backtest</div><div class="tj-panel-subtitle">Page cible, risque fixe et progression d’import.</div></div><button class="ghost mini" id="tjFxrClose" type="button">✕</button>';
  drawer.appendChild(head);
  const card=$('#fxrSyncCard');if(card)drawer.appendChild(card);
  document.body.appendChild(drawer);
  const toggle=force=>{drawer.hidden=typeof force==='boolean'?!force:!drawer.hidden;};
  document.addEventListener('tj:toggle-fxr',()=>toggle());$('#tjFxrClose')?.addEventListener('click',()=>toggle(false));
  return toggle;
}
function createToolsMenu(){
  const menu=el('div','tj-tools-menu',{id:'tjToolsMenu',hidden:'hidden'});
  const item=(icon,label,fn)=>{const b=el('button','tj-tools-item',{type:'button'});b.innerHTML=`<span>${icon}</span><b>${label}</b>`;b.addEventListener('click',()=>{menu.hidden=true;fn();});return b;};
  menu.append(
    item('📡','Widget marché',()=>callLegacy('mwToggleEnabled')),
    item('📰','Widget news',()=>callLegacy('nwToggleEnabled')),
    item('🖼','Galerie',()=>callLegacy('openGallery',state.active==='backtesting'?'backtest':'journal')),
    item('🎯','Objectifs',()=>callLegacy('openGoals')),
    item('⚙','Paramètres',()=>callLegacy('openSettings'))
  );
  document.body.appendChild(menu);
  const toggle=()=>{menu.hidden=!menu.hidden;};
  document.addEventListener('mousedown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==document.getElementById('tjToolsButton'))menu.hidden=true;});
  return toggle;
}
function syncStatus(){
  const target=$('#fxrTargetPage');
  $('#tjStatusPage').textContent=target?.selectedOptions?.[0]?.textContent?.trim()||'Aucune page';
  $('#tjStatusRisk').textContent=$('#fxrRiskAmount')?.value?`${$('#fxrRiskAmount').value} €`:'—';
  $('#tjStatusPending').textContent=text('#fxrPendingCount','0');
  $('#tjStatusImport').textContent=text('#fxrLastImport','—');
  $('#tjStatusFxr').textContent=text('#fxrProgressPhase','Prêt');
  state.inspector?.refresh();
}
function syncUpdateButton(raw={}){
  const button=$('#tjUpdateButton'),label=$('#tjUpdateLabel');if(!button||!label)return;
  const updateState=String(raw.state||'idle');
  const progress=Math.max(0,Math.min(100,Number(raw.progress)||0));
  const version=raw.availableVersion||raw.downloadedVersion||'';
  button.dataset.updateState=updateState;
  if(updateState==='checking')label.textContent='Vérification';
  else if(updateState==='available')label.textContent=version?`MAJ ${version}`:'Mise à jour';
  else if(updateState==='downloading')label.textContent=progress>0?`${Math.round(progress)}%`:'Téléchargement';
  else if(updateState==='ready')label.textContent='Redémarrer';
  else if(updateState==='error')label.textContent='Erreur MAJ';
  else label.textContent='À jour';
}
function wireLegacyRouter(){
  state.legacySwitch=window.switchTab;
  if(typeof state.legacySwitch!=='function')return;
  window.switchTab=function(tab){
    const out=state.legacySwitch(tab);
    if(!state.routing){const item=byLegacy(tab);if(item){state.active=item.id;setActiveNav(item.id);setHeader(item);hideCustom();setLegacyVisibility(item.viewId);state.inspector?.setWorkspace(item.id);document.body.dataset.workspace=item.id;}}
    return out;
  };
}
export function initDesktopShell(){
  if(document.getElementById('tjAppShell'))return;
  document.body.classList.add('tj-desktop-v2');
  const settings=$('#settingsOverlay');if(settings)document.body.appendChild(settings);
  const backup=$('#autoBackupWarning');

  const shell=el('div','',{id:'tjAppShell'});buildSidebar(shell);buildTopbar(shell);
  const stage=el('main','tj-stage');const backupSlot=el('div','tj-backup-slot');if(backup)backupSlot.appendChild(backup);stage.appendChild(backupSlot);shell.appendChild(stage);
  state.inspector=createInspector({navigate});shell.appendChild(state.inspector.element);buildStatusbar(shell);document.body.prepend(shell);

  const workspaceClasses={viewTrading:'tj-journal-workspace',viewBacktest:'tj-backtest-workspace',viewScan:'tj-scan-workspace',viewContext:'tj-context-workspace',viewGate:'tj-gate-workspace'};
  for(const item of WORKSPACES.filter(x=>x.viewId)){
    const view=document.getElementById(item.viewId);if(view){view.classList.add('tj-workspace');if(workspaceClasses[item.viewId])view.classList.add(workspaceClasses[item.viewId]);stage.appendChild(view);}
  }
  enhanceJournal();enhanceBacktesting();
  const overview=buildOverview(navigate),discipline=buildDiscipline();stage.prepend(overview);stage.appendChild(discipline);

  wireLegacyRouter();
  state.layout=initLayoutController({inspector:state.inspector.element,onLayoutChange:()=>state.inspector?.refresh()});
  const palette=createCommandPalette(navigate,state.layout);
  const toggleFxr=createFxrDrawer(),toggleTools=createToolsMenu(),updateCenter=createUpdateCenter();
  $('#tjGlobalSearch')?.addEventListener('click',palette.open);$('#tjGlobalSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();palette.open();}});
  $('#tjNewTrade')?.addEventListener('click',()=>{navigate('journal');callLegacy('fabNewTrade');});
  $('#tjToolsButton')?.addEventListener('click',toggleTools);
  $('#tjFxrButton')?.addEventListener('click',()=>toggleFxr());$('#tjStatusFxrBtn')?.addEventListener('click',()=>toggleFxr());
  $('#tjUpdateButton')?.addEventListener('click',()=>updateCenter.open());
  window.addEventListener('tj:update-ui-status',e=>syncUpdateButton(e.detail||{}));
  window.desktopApp?.getUpdateStatus?.().then(status=>{updateCenter.render(status||{});syncUpdateButton(status||{});}).catch(()=>{});

  const watched=[$('#fxrTargetPage'),$('#fxrRiskAmount'),$('#fxrPendingCount'),$('#fxrLastImport'),$('#fxrProgressPhase')].filter(Boolean);observeText(watched,syncStatus);$('#fxrTargetPage')?.addEventListener('change',syncStatus);$('#fxrRiskAmount')?.addEventListener('input',syncStatus);syncStatus();
  navigate('overview');
  afterPaint(()=>window.dispatchEvent(new Event('resize')));
}
