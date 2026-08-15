import { $, el, afterPaint } from '../lib/dom.js';

const ROLES=[
  {id:'context',label:'Contexte',weight:'45 %',detail:'Direction dominante'},
  {id:'structure',label:'Structure',weight:'35 %',detail:'Organisation du prix'},
  {id:'trigger',label:'Trigger',weight:'20 %',detail:'Confirmation immédiate'}
];

function shotReady(role,view){
  const id=role==='context'?'#scanImgContext':role==='structure'?'#scanImgStructure':'#scanImgTrigger';
  const img=$(id,view);
  return Boolean(img?.getAttribute('src'));
}

export function enhanceScan(){
  const view=$('#viewScan');
  if(!view || view.dataset.tjScanV220==='1')return;
  const shell=$('.scan-shell',view);
  const hero=$('.scan-hero',view);
  const toolbar=$('.scan-toolbar',view);
  const guide=$('.scan-capture-guide',view);
  const slots=$('#scanSlots',view);
  const runbar=$('.scan-runbar',view);
  const result=$('#scanResult',view);
  if(!shell||!toolbar||!slots||!runbar)return;

  view.dataset.tjScanV220='1';
  view.classList.add('tj-scan-premium');

  if(hero){
    const eyebrow=$('.scan-eyebrow',hero);
    if(eyebrow)eyebrow.textContent='SCAN TA · DIRECTION LAB';
  }

  const flow=el('section','tj-scan-flow',{dataset:{scanFlow:'capture'}});
  flow.innerHTML=`
    <div class="tj-scan-flow-step is-done" data-flow-step="config">
      <span class="tj-scan-flow-index">01</span><div><b>Configurer</b><small>Actif, profil et moteur</small></div>
    </div>
    <div class="tj-scan-flow-step is-current" data-flow-step="captures">
      <span class="tj-scan-flow-index">02</span><div><b>Capturer</b><small>HTF → structure → trigger</small></div>
    </div>
    <div class="tj-scan-flow-step" data-flow-step="analysis">
      <span class="tj-scan-flow-index">03</span><div><b>Analyser</b><small>Score et confluence</small></div>
    </div>
    <div class="tj-scan-flow-progress" aria-label="Progression des captures">
      <div><span id="tjScanCaptureProgress"></span></div><b id="tjScanCaptureCount">0/3</b>
    </div>`;
  toolbar.after(flow);

  const captureHead=el('div','tj-scan-section-head');
  captureHead.innerHTML=`<div><span class="tj-scan-section-kicker">ÉTAPE 02 · CAPTURES</span><h2>Lecture multi-timeframe</h2><p>Utilise le même actif et le même instant. Le contexte pèse davantage que le trigger dans le score final.</p></div><span class="tj-scan-section-state" id="tjScanCaptureState">Aucune capture</span>`;
  slots.before(captureHead);

  for(const role of ROLES){
    const slot=$(`.scan-slot[data-role="${role.id}"]`,slots);
    if(!slot)continue;
    const head=$('.scan-slot-head',slot);
    const select=$('select',head);
    if(head&&select&&!$('.tj-scan-slot-controls',head)){
      const controls=el('div','tj-scan-slot-controls');
      const weight=el('span','tj-scan-weight',{text:`Poids ${role.weight}`,title:`${role.label} contribue à ${role.weight} du score visuel avant normalisation.`});
      select.before(controls);controls.append(weight,select);
    }
    slot.dataset.scanWeight=role.weight;
  }

  if(result&&!$('.tj-scan-result-head',result)){
    const resultHead=el('div','tj-scan-result-head');
    resultHead.innerHTML='<div><span class="tj-scan-section-kicker">ÉTAPE 03 · SYNTHÈSE</span><h2>Lecture directionnelle</h2><p>Commence par le verdict et la confluence, puis ouvre les détails par timeframe si nécessaire.</p></div><span class="tj-scan-result-chip">Prix → structure → trigger</span>';
    result.prepend(resultHead);
  }

  if(guide&&!$('.tj-scan-guide-details',view)){
    const details=el('details','tj-scan-guide-details');
    const summary=el('summary','tj-scan-guide-summary');
    summary.innerHTML='<div><span class="tj-scan-guide-icon">?</span><div><b>Guide de capture</b><small>Standard, cadrage idéal et erreurs à éviter</small></div></div><span class="tj-scan-guide-open">Ouvrir</span>';
    guide.before(details);details.append(summary,guide);
    if(result)result.after(details);else runbar.after(details);
    details.addEventListener('toggle',()=>{const label=$('.tj-scan-guide-open',details);if(label)label.textContent=details.open?'Fermer':'Ouvrir';});
  }

  const progress=$('#tjScanCaptureProgress',flow);
  const countEl=$('#tjScanCaptureCount',flow);
  const stateEl=$('#tjScanCaptureState',view);
  const captureStep=$('[data-flow-step="captures"]',flow);
  const analysisStep=$('[data-flow-step="analysis"]',flow);

  const sync=()=>{
    const count=ROLES.filter(role=>shotReady(role.id,view)).length;
    if(progress)progress.style.width=`${Math.round(count/3*100)}%`;
    if(countEl)countEl.textContent=`${count}/3`;
    if(stateEl)stateEl.textContent=count===0?'Aucune capture':count===3?'3 captures prêtes':`${count} capture${count>1?'s':''} prête${count>1?'s':''}`;
    captureStep?.classList.toggle('is-done',count===3);
    captureStep?.classList.toggle('is-current',count<3);
    ROLES.forEach(role=>{
      const slot=$(`.scan-slot[data-role="${role.id}"]`,slots);
      slot?.classList.toggle('is-ready',shotReady(role.id,view));
    });
    const resultVisible=Boolean(result)&&result.style.display!=='none';
    analysisStep?.classList.toggle('is-current',count>0&&!resultVisible);
    analysisStep?.classList.toggle('is-done',resultVisible);
    flow.dataset.scanFlow=resultVisible?'result':count===3?'ready':count>0?'partial':'capture';
  };

  const observer=new MutationObserver(sync);
  ROLES.forEach(role=>{
    const id=role.id==='context'?'#scanImgContext':role.id==='structure'?'#scanImgStructure':'#scanImgTrigger';
    const img=$(id,view);if(img)observer.observe(img,{attributes:true,attributeFilter:['src','style']});
  });
  if(result)observer.observe(result,{attributes:true,attributeFilter:['style']});
  const readyText=$('#scanReadyText',view);if(readyText)observer.observe(readyText,{childList:true,characterData:true,subtree:true});
  $('#scanAsset',view)?.addEventListener('input',sync);
  $('#scanProfile',view)?.addEventListener('change',sync);
  sync();
  afterPaint(()=>window.dispatchEvent(new Event('resize')));
}

function start(){
  try{enhanceScan();}
  catch(error){console.error('[Desktop UI] Scan TA enhancement failed',error);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
