import { $, el, text, observeText, callLegacy } from '../lib/dom.js';

const sources={
  capital:['#statCapital .val','#statCapital .sub'],
  pnl:['#statPnl .val','#statPnl .sub'],
  wr:['#statWr .val','#statWr .sub'],
  pf:['#statPf .val','#statPf .sub'],
  rr:['#statRr .val','#statRr .sub']
};

function kpi(label,key,tone=''){
  const card=el('div',`tj-kpi ${tone}`);
  card.innerHTML=`<div class="tj-kpi-label">${label}</div><div class="tj-kpi-value" data-kpi="${key}">—</div><div class="tj-kpi-sub" data-kpi-sub="${key}">—</div>`;
  return card;
}
function action(title,detail,icon,handler){
  const button=el('button','tj-action-card',{type:'button'});
  button.innerHTML=`<strong>${icon} ${title}</strong><span>${detail}</span>`;
  button.addEventListener('click',handler);
  return button;
}
function update(view){
  for(const [key,[v,s]] of Object.entries(sources)){
    const value=view.querySelector(`[data-kpi="${key}"]`);
    const sub=view.querySelector(`[data-kpi-sub="${key}"]`);
    if(value)value.textContent=text(v);
    if(sub)sub.textContent=text(s,'Aucune donnée');
    if(key==='pnl' && value){
      value.closest('.tj-kpi')?.classList.toggle('bad',value.textContent.trim().startsWith('-'));
      value.closest('.tj-kpi')?.classList.toggle('good',!value.textContent.trim().startsWith('-'));
    }
  }
  const bias=text('#ctxBriefBias','NEUTRE');
  const headline=text('#ctxBriefHeadline','Contexte non actualisé');
  view.querySelectorAll('[data-overview="bias"]').forEach(node=>{node.textContent=bias;});
  const headlineNode=view.querySelector('[data-overview="context-headline"]'); if(headlineNode) headlineNode.textContent=headline;
  const vol=text('#ctxVolValue','—'), news=text('#ctxNewsValue','—'), attention=text('#ctxAttentionLevel','—');
  view.querySelectorAll('[data-overview="vol"]').forEach(node=>{node.textContent=vol;});
  view.querySelectorAll('[data-overview="news"]').forEach(node=>{node.textContent=news;});
  view.querySelectorAll('[data-overview="attention"]').forEach(node=>{node.textContent=attention;});

  const target=$('#fxrTargetPage');
  const risk=$('#fxrRiskAmount');
  const pageText=target?.selectedOptions?.[0]?.textContent?.trim()||'Aucune page';
  const riskText=risk?.value?`${risk.value} €`:'—';
  const pendingText=text('#fxrPendingCount','0');
  const lastText=text('#fxrLastImport','—');
  view.querySelectorAll('[data-overview="target-page"]').forEach(node=>{node.textContent=pageText;});
  view.querySelectorAll('[data-overview="risk"]').forEach(node=>{node.textContent=riskText;});
  view.querySelectorAll('[data-overview="pending"]').forEach(node=>{node.textContent=pendingText;});
  view.querySelectorAll('[data-overview="last-import"]').forEach(node=>{node.textContent=lastText;});

  const phase=view.querySelector('[data-overview="fxr-phase"]'); if(phase) phase.textContent=text('#fxrProgressPhase','Prêt');
  const pctRaw=text('#fxrProgressPct','0%'); const pct=Math.max(0,Math.min(100,parseFloat(pctRaw)||0));
  const bar=view.querySelector('.tj-session-progress>i'); if(bar) bar.style.width=`${pct}%`;
  const pctNode=view.querySelector('[data-overview="fxr-pct"]'); if(pctNode) pctNode.textContent=`${Math.round(pct)}%`;
}
export function buildOverview(navigate){
  const view=el('section','tj-workspace',{id:'tjOverviewView'});
  const kpis=el('div','tj-kpi-grid');
  kpis.append(kpi('Capital actuel','capital','good'),kpi('P&L total','pnl','good'),kpi('Win rate','wr'),kpi('Profit factor','pf'),kpi('R:R moyen','rr'));

  const main=el('div','tj-overview-main');
  const activity=el('section','tj-panel tj-overview-activity');
  activity.innerHTML=`<div class="tj-panel-head"><div><div class="tj-eyebrow">Pilotage</div><div class="tj-panel-title">État du logiciel</div><div class="tj-panel-subtitle">Les informations utiles sans ouvrir cinq écrans.</div></div><span class="tj-badge good">● Actif</span></div><div class="tj-activity-list">
    <div class="tj-activity-row"><div class="tj-activity-icon">↯</div><div><b>FX Replay</b><small data-overview="fxr-phase">Prêt</small></div><div class="tj-activity-value" data-overview="fxr-pct">0%</div></div>
    <div class="tj-activity-row"><div class="tj-activity-icon">▤</div><div><b>Page Backtest cible</b><small data-overview="target-page">Aucune page</small></div><div class="tj-activity-value">Cible</div></div>
    <div class="tj-activity-row"><div class="tj-activity-icon">◉</div><div><b>Risque fixe session</b><small data-overview="risk">—</small></div><div class="tj-activity-value">1R</div></div>
    <div class="tj-activity-row"><div class="tj-activity-icon">⇣</div><div><b>File d’attente</b><small><span data-overview="pending">0</span> élément(s)</small></div><div class="tj-activity-value">Queue</div></div>
    <div class="tj-activity-row"><div class="tj-activity-icon">✓</div><div><b>Dernier import</b><small data-overview="last-import">—</small></div><div class="tj-activity-value">FXR</div></div>
  </div><div class="tj-session-progress"><i></i></div>`;

  const summary=el('section','tj-panel tj-overview-summary');
  summary.innerHTML=`<div class="tj-panel-head"><div><div class="tj-eyebrow">Résumé du jour</div><div class="tj-panel-title" data-overview="context-headline">Contexte non actualisé</div></div><span class="tj-badge" data-overview="bias">NEUTRE</span></div>
  <div class="tj-summary-block"><h3>Contexte marché</h3><div class="tj-summary-line"><span>Biais potentiel</span><b data-overview="bias">NEUTRE</b></div><div class="tj-summary-line"><span>Volatilité</span><b data-overview="vol">—</b></div><div class="tj-summary-line"><span>News / macro</span><b data-overview="news">—</b></div><div class="tj-summary-line"><span>Attention</span><b data-overview="attention">—</b></div></div>
  <div class="tj-summary-block"><h3>Session active</h3><div class="tj-summary-line"><span>Page cible</span><b data-overview="target-page">—</b></div><div class="tj-summary-line"><span>Risque fixe</span><b data-overview="risk">—</b></div><div class="tj-summary-line"><span>Dernier import</span><b data-overview="last-import">—</b></div></div>`;

  const actions=el('section','tj-panel tj-overview-actions-panel');
  actions.innerHTML=`<div class="tj-panel-head"><div><div class="tj-eyebrow">Accès rapide</div><div class="tj-panel-title">Actions</div></div></div>`;
  const grid=el('div','tj-overview-actions');
  grid.append(
    action('Nouveau trade','Ajouter rapidement une opération.','＋',()=>{navigate('journal');callLegacy('fabNewTrade');}),
    action('Backtesting','Ouvrir la session et ses pages.','▥',()=>navigate('backtesting')),
    action('FX Replay','Page, risque et progression.','↯',()=>document.dispatchEvent(new CustomEvent('tj:toggle-fxr'))),
    action('Contexte','Actualiser ton biais marché.','◎',()=>navigate('context')),
    action('Decision Gate','Valider le plan avant l’entrée.','◇',()=>navigate('gate')),
    action('Discipline','Analyser les erreurs d’exécution.','◈',()=>navigate('discipline'))
  );
  actions.appendChild(grid);
  main.append(activity,summary,actions); view.append(kpis,main);

  const watched=[...Object.values(sources).flat().map(x=>$(x)),$('#ctxBriefBias'),$('#ctxBriefHeadline'),$('#ctxVolValue'),$('#ctxNewsValue'),$('#ctxAttentionLevel'),$('#fxrTargetPage'),$('#fxrRiskAmount'),$('#fxrPendingCount'),$('#fxrLastImport'),$('#fxrProgressPhase'),$('#fxrProgressPct')];
  observeText(watched,()=>update(view));
  $('#fxrTargetPage')?.addEventListener('change',()=>update(view)); $('#fxrRiskAmount')?.addEventListener('input',()=>update(view));
  update(view);
  return view;
}
