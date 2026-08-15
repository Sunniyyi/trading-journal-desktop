import { el } from './lib/dom.js';

const UPDATE_STATES={
  idle:{label:'À vérifier',tone:'neutral'},
  current:{label:'À jour',tone:'good'},
  checking:{label:'Vérification',tone:'info'},
  available:{label:'Disponible',tone:'info'},
  downloading:{label:'Téléchargement',tone:'info'},
  ready:{label:'Prête',tone:'good'},
  error:{label:'Erreur',tone:'bad'},
  development:{label:'Développement',tone:'neutral'}
};

function formatDate(value){
  const n=Number(value)||0;if(!n)return 'Jamais';
  try{return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(n));}catch(_){return new Date(n).toLocaleString();}
}
function stateMeta(state){return UPDATE_STATES[state]||{label:String(state||'Inconnu'),tone:'neutral'};}
function cleanVersion(value){const v=String(value||'').trim();return v&&v!=='—'?v:'';}

function createMetric(label,valueId){
  const card=el('div','tj-update-metric');
  card.innerHTML=`<span>${label}</span><strong id="${valueId}">—</strong>`;
  return card;
}

export function createUpdateCenter(){
  let status={state:'idle',version:'',progress:0,checkedAt:0};
  let busy=false;
  let unsubscribe=null;

  const overlay=el('div','tj-update-overlay',{id:'tjUpdateCenter',hidden:'hidden'});
  overlay.innerHTML=`
    <section class="tj-update-center" role="dialog" aria-modal="true" aria-labelledby="tjUpdateCenterTitle">
      <header class="tj-update-center-head">
        <div>
          <div class="tj-eyebrow">Système</div>
          <h2 id="tjUpdateCenterTitle">Centre de mise à jour</h2>
          <p>Trading Journal Desktop se met à jour depuis les releases officielles GitHub.</p>
        </div>
        <button class="tj-update-close" type="button" aria-label="Fermer">✕</button>
      </header>
      <div class="tj-update-center-body">
        <div class="tj-update-hero">
          <div class="tj-update-orb" aria-hidden="true"><span></span></div>
          <div class="tj-update-hero-copy">
            <div class="tj-update-state-row"><span class="tj-update-state" data-tone="neutral">À vérifier</span><span class="tj-update-version-line">Version installée <b id="tjUpdateInstalled">—</b></span></div>
            <h3 id="tjUpdateHeadline">Vérification de l’état du logiciel…</h3>
            <p id="tjUpdateDetail">Lecture des informations de mise à jour.</p>
          </div>
        </div>
        <div class="tj-update-progress" hidden>
          <div class="tj-update-progress-row"><span id="tjUpdateProgressLabel">Progression</span><b id="tjUpdateProgressPct">0%</b></div>
          <div class="tj-update-track"><span id="tjUpdateProgressFill"></span></div>
        </div>
        <div class="tj-update-metrics" id="tjUpdateMetrics"></div>
        <div class="tj-update-notice" id="tjUpdateNotice">
          <span>✓</span><div><b>Canal stable</b><small>Base V206 et FXReplay V21 restent protégés pendant les mises à jour de l’interface.</small></div>
        </div>
      </div>
      <footer class="tj-update-center-foot">
        <button class="tj-update-btn" id="tjUpdateCheck" type="button">↻ Vérifier maintenant</button>
        <span class="tj-update-foot-spacer"></span>
        <button class="tj-update-btn tj-update-btn-primary" id="tjUpdatePrimary" type="button" hidden>Action</button>
      </footer>
    </section>`;

  const metrics=overlay.querySelector('#tjUpdateMetrics');
  metrics.append(
    createMetric('Version installée','tjUpdateMetricInstalled'),
    createMetric('Dernière version','tjUpdateMetricLatest'),
    createMetric('Dernière vérification','tjUpdateMetricChecked')
  );

  const $=selector=>overlay.querySelector(selector);
  const close=()=>{overlay.hidden=true;document.body.classList.remove('tj-update-center-open');};

  function render(raw={}){
    status={...status,...raw};
    const state=String(status.state||'idle');
    const meta=stateMeta(state);
    const progress=Math.max(0,Math.min(100,Number(status.progress)||0));
    const installed=cleanVersion(status.version)||'Inconnue';
    const explicitLatest=cleanVersion(status.downloadedVersion)||cleanVersion(status.availableVersion);
    const latest=explicitLatest||(Number(status.checkedAt)?installed:'À vérifier');
    const phase=String(status.phase||state);
    const stateChip=$('.tj-update-state');

    overlay.dataset.updateState=state;
    stateChip.textContent=meta.label;stateChip.dataset.tone=meta.tone;
    $('#tjUpdateInstalled').textContent=installed;
    $('#tjUpdateMetricInstalled').textContent=installed;
    $('#tjUpdateMetricLatest').textContent=latest;
    $('#tjUpdateMetricChecked').textContent=formatDate(status.checkedAt);
    $('#tjUpdateDetail').textContent=status.detail||'Aucune opération de mise à jour en cours.';

    let headline='Trading Journal est prêt à être vérifié.';
    if(state==='current')headline='Trading Journal est à jour.';
    if(state==='checking')headline='Recherche de la dernière version…';
    if(state==='available')headline=`Trading Journal ${latest} est disponible.`;
    if(state==='downloading')headline=phase==='installing'?`Finalisation de Trading Journal ${latest}…`:`Téléchargement de Trading Journal ${latest}…`;
    if(state==='ready')headline=`Trading Journal ${latest} est prêt à être lancé.`;
    if(state==='error')headline='La mise à jour a rencontré un problème.';
    if(state==='development')headline='Mises à jour désactivées en mode développement.';
    $('#tjUpdateHeadline').textContent=headline;

    const progressBox=$('.tj-update-progress');
    const showProgress=state==='checking'||state==='downloading'||state==='ready';
    progressBox.hidden=!showProgress;
    $('#tjUpdateProgressPct').textContent=state==='checking'&&progress<=0?'…':`${progress}%`;
    $('#tjUpdateProgressLabel').textContent=phase==='installing'?'Installation':state==='checking'?'Vérification':'Progression';
    $('#tjUpdateProgressFill').style.width=`${state==='checking'&&progress<=0?24:progress}%`;
    progressBox.classList.toggle('is-indeterminate',state==='checking'&&progress<=0);

    const primary=$('#tjUpdatePrimary');
    primary.hidden=true;primary.dataset.action='';primary.textContent='Action';
    if(state==='available'){
      primary.hidden=false;primary.textContent=`Mettre à jour vers ${latest}`;primary.dataset.action='start';
    }else if(state==='ready'){
      primary.hidden=false;primary.textContent='Redémarrer et appliquer';primary.dataset.action='restart';
    }else if(state==='error'){
      primary.hidden=false;primary.textContent='Réessayer';primary.dataset.action='check';
    }

    const disabled=busy||state==='checking'||state==='downloading';
    $('#tjUpdateCheck').disabled=disabled;
    primary.disabled=busy||state==='downloading';

    const notice=$('#tjUpdateNotice');
    notice.classList.toggle('is-error',state==='error');
    notice.querySelector('span').textContent=state==='error'?'!':'✓';
    notice.querySelector('b').textContent=state==='error'?'Action requise':'Canal stable';
    notice.querySelector('small').textContent=state==='error'?(status.detail||'Vérifie ta connexion puis réessaie.'):'Base V206 et FXReplay V21 restent protégés pendant les mises à jour de l’interface.';

    window.dispatchEvent(new CustomEvent('tj:update-ui-status',{detail:status}));
  }

  async function hydrateInstalledVersion(next={}){
    if(cleanVersion(next.version))return next;
    try{
      const version=cleanVersion(await window.desktopApp?.getAppVersion?.());
      return version?{...next,version}:next;
    }catch(_){return next;}
  }

  async function run(action){
    if(busy||!window.desktopApp)return;
    busy=true;render(status);
    try{
      let next;
      if(action==='check')next=await window.desktopApp.checkForUpdates?.();
      if(action==='start')next=await window.desktopApp.startUpdate?.();
      if(action==='restart')next=await window.desktopApp.restartForUpdate?.();
      if(next&&typeof next==='object')render(await hydrateInstalledVersion(next));
    }catch(err){render({state:'error',phase:'error',detail:err?.message||String(err)});}
    finally{busy=false;render(status);}
  }

  $('#tjUpdateCheck').addEventListener('click',()=>run('check'));
  $('#tjUpdatePrimary').addEventListener('click',e=>run(e.currentTarget.dataset.action));
  $('.tj-update-close').addEventListener('click',close);
  overlay.addEventListener('mousedown',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});
  document.body.appendChild(overlay);

  if(typeof window.desktopApp?.onUpdateStatus==='function')unsubscribe=window.desktopApp.onUpdateStatus(async next=>render(await hydrateInstalledVersion(next||{})));

  async function open(){
    overlay.hidden=false;document.body.classList.add('tj-update-center-open');
    let current={};
    try{
      current=await hydrateInstalledVersion(await window.desktopApp?.getUpdateStatus?.()||{});
      render(current);
    }catch(_){
      current=await hydrateInstalledVersion(status);
      render(current);
    }
    const needsInitialCheck=!Number(current.checkedAt)&&['idle','current'].includes(String(current.state||'idle'));
    if(needsInitialCheck&&!busy)await run('check');
    $('.tj-update-close')?.focus();
  }

  return {open,close,render,destroy(){unsubscribe?.();overlay.remove();}};
}
