import { $, el, afterPaint } from '../lib/dom.js';

function button(label,id,onClick){
  const b=el('button','tj-section-tab',{type:'button',text:label,dataset:{btTab:id}});
  b.addEventListener('click',()=>onClick(id));
  return b;
}

function viewButton(label,id,onClick){
  const b=el('button','tj-bt-view-btn',{type:'button',text:label,dataset:{btView:id}});
  b.addEventListener('click',()=>onClick(id));
  return b;
}

function decorateSimulationCard(card,{kind,step,subtitle}){
  if(!card) return;
  card.classList.add('tj-bt-sim-card-v223',`tj-bt-sim-${kind}`);
  const head=card.querySelector('.mc-head');
  if(head){
    head.classList.add('tj-bt-sim-head-v223');
    const meta=el('div','tj-bt-sim-meta-v223');
    meta.append(
      el('span','tj-bt-sim-step-v223',{text:`ÉTAPE ${step}`}),
      el('span','tj-bt-sim-subtitle-v223',{text:subtitle})
    );
    head.after(meta);
  }
  card.querySelector('.mc-params')?.classList.add('tj-bt-sim-controls-v223');
  card.querySelector('.mc-empty')?.classList.add('tj-bt-sim-note-v223');
}

export function enhanceBacktesting(){
  const view=$('#viewBacktest');
  if(!view || view.dataset.tjV2==='1') return;
  view.dataset.tjV2='1';
  view.classList.add('tj-workspace','tj-backtest-workspace');

  const detail=$('#btDetail',view);
  const layout=$('.bt-detail-layout',detail);
  const main=$('.bt-main-col',layout);
  const side=$('.bt-side-col',layout);
  if(!detail || !layout || !main) return;

  const tabsRow=el('div','tj-bt-tabs-row');
  const tabs=el('div','tj-section-tabs');
  const hint=el('span','tj-badge',{text:'Vue claire · panneaux séparés'});
  tabsRow.append(tabs,hint);
  const context=$('.bt-context',detail);
  if(context) context.after(tabsRow); else detail.prepend(tabsRow);

  const overview=el('section','tj-bt-panel-group',{dataset:{btGroup:'overview'}});
  const trades=el('section','tj-bt-panel-group',{dataset:{btGroup:'trades',btTradesMode:'calendar'}});
  const sims=el('section','tj-bt-panel-group',{dataset:{btGroup:'simulations'}});

  const stats=$('#btStats',main), chart=$('#btChartCard',main), comment=$('.bt-comment-card',main), perf=$('#btPerfCard',main);
  const mc=$('#btMcCard',main), wf=$('#btWfCard',main), dsr=$('#btDsrCard',main);
  const months=$('#btMonthsCard',main), back=$('#btBackBar',main), cal=$('#btDayCalCard',main);
  const tbody=$('#btTbody',main);
  const table=tbody?.closest('.tablecard')||null;
  const pagination=$('#btPagination',main);

  const dashboard=el('div','tj-bt-dashboard-grid');
  const dashMain=el('div','tj-bt-dashboard-main');
  const dashSide=el('div','tj-bt-dashboard-side');

  // 2.1.22: the six diagnostics belong to the analytical canvas, not above it.
  if(stats){
    stats.classList.add('tj-bt-kpi-strip');
    dashboard.appendChild(stats);
  }

  if(chart) dashMain.appendChild(chart);
  if(comment){
    comment.classList.add('tj-bt-note-card','is-compact');
    const noteToggle=el('button','tj-bt-note-toggle',{type:'button',text:'Agrandir la note'});
    noteToggle.setAttribute('aria-expanded','false');
    noteToggle.addEventListener('click',()=>{
      const expanded=comment.classList.toggle('is-expanded');
      comment.classList.toggle('is-compact',!expanded);
      noteToggle.textContent=expanded?'Réduire la note':'Agrandir la note';
      noteToggle.setAttribute('aria-expanded',String(expanded));
      afterPaint(()=>window.dispatchEvent(new Event('resize')));
    });
    comment.appendChild(noteToggle);
    dashSide.appendChild(comment);
  }
  if(perf) dashSide.appendChild(perf);
  dashboard.append(dashMain,dashSide);
  overview.appendChild(dashboard);

  const tradesGrid=el('div','tj-bt-trades-grid');
  const tradesLeft=el('aside','tj-bt-trades-left');
  const tradesRight=el('div','tj-bt-trades-right');
  const tradesHead=el('div','tj-bt-trades-head');
  const tradesCopy=el('div','tj-bt-trades-copy');
  tradesCopy.append(
    el('span','tj-bt-trades-eyebrow',{text:'EXPLORATION DES TRADES'}),
    el('strong','tj-bt-trades-title',{text:'Calendrier & exécutions'}),
    el('span','tj-bt-trades-sub',{text:'Le calendrier est la vue principale. Passe au tableau seulement quand tu veux auditer ligne par ligne.'})
  );
  const modeBar=el('div','tj-bt-view-switch',{role:'group','aria-label':'Mode d’affichage des trades'});

  const setTradesMode=id=>{
    if(id==='gallery'){
      if(typeof window.openGallery==='function') window.openGallery('backtest');
      else side?.querySelector('button[onclick*="openGallery"]')?.click();
      return;
    }
    trades.dataset.btTradesMode=id;
    modeBar.querySelectorAll('[data-bt-view]').forEach(x=>x.classList.toggle('is-active',x.dataset.btView===id));
    afterPaint(()=>window.dispatchEvent(new Event('resize')));
  };
  modeBar.append(
    viewButton('▦ Calendrier','calendar',setTradesMode),
    viewButton('☷ Tableau','table',setTradesMode),
    viewButton('▧ Galerie','gallery',setTradesMode)
  );
  tradesHead.append(tradesCopy,modeBar);

  if(side) tradesLeft.appendChild(side);
  if(table) table.classList.add('tj-bt-trades-table');
  tradesRight.appendChild(tradesHead);
  [back,months,cal,table,pagination].filter(Boolean).forEach(node=>tradesRight.appendChild(node));
  tradesGrid.append(tradesLeft,tradesRight); trades.appendChild(tradesGrid);

  // 2.1.23: simulations become a guided robustness lab while preserving V206 controls and handlers.
  sims.classList.add('tj-bt-sims-page-v223');
  const simsIntro=el('div','tj-bt-sims-intro tj-bt-sims-hero-v223');
  const simsCopy=el('div','tj-bt-sims-intro-copy');
  simsCopy.append(
    el('span','tj-bt-trades-eyebrow',{text:'LABORATOIRE DE ROBUSTESSE'}),
    el('strong','tj-bt-sims-title',{text:'Tester la stratégie au-delà du simple P&L'}),
    el('span','tj-bt-trades-sub',{text:'Trois validations complémentaires : distribution du risque, significativité statistique, puis comportement hors-échantillon.'})
  );
  const simsFlow=el('div','tj-bt-sims-flow-v223',{role:'list','aria-label':'Ordre recommandé des simulations'});
  [
    ['01','Monte-Carlo'],
    ['02','PSR / DSR'],
    ['03','Walk-Forward']
  ].forEach(([n,label])=>{
    const chip=el('span','tj-bt-sims-flow-chip-v223',{role:'listitem'});
    chip.append(el('b','',{text:n}),el('span','',{text:label}));
    simsFlow.appendChild(chip);
  });
  simsIntro.append(simsCopy,simsFlow);

  decorateSimulationCard(mc,{
    kind:'mc',
    step:'01',
    subtitle:'Stress-teste l’ordre des trades et la dispersion des trajectoires possibles.'
  });
  decorateSimulationCard(dsr,{
    kind:'dsr',
    step:'02',
    subtitle:'Mesure la crédibilité statistique du Sharpe en tenant compte des variantes testées.'
  });
  decorateSimulationCard(wf,{
    kind:'wf',
    step:'03',
    subtitle:'Vérifie si la stratégie conserve sa qualité sur des fenêtres hors-échantillon.'
  });

  const simsGrid=el('div','tj-bt-sims-grid tj-bt-sims-grid-v223');
  [mc,dsr,wf].filter(Boolean).forEach(node=>simsGrid.appendChild(node));
  sims.append(simsIntro,simsGrid);

  layout.replaceChildren(overview,trades,sims);

  const activate=id=>{
    tabs.querySelectorAll('[data-bt-tab]').forEach(x=>x.classList.toggle('is-active',x.dataset.btTab===id));
    layout.querySelectorAll('[data-bt-group]').forEach(x=>x.classList.toggle('is-visible',x.dataset.btGroup===id));
    if(id==='trades' && !trades.dataset.btTradesMode) setTradesMode('calendar');
    afterPaint(()=>window.dispatchEvent(new Event('resize')));
  };
  tabs.append(button('Vue d’ensemble','overview',activate),button('Trades & calendrier','trades',activate),button('Simulations','simulations',activate));
  setTradesMode('calendar');
  activate('overview');
}
