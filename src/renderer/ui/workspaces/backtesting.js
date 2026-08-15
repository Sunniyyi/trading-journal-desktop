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

  if(stats) overview.appendChild(stats);
  const dashboard=el('div','tj-bt-dashboard-grid');
  const dashMain=el('div','tj-bt-dashboard-main');
  const dashSide=el('div','tj-bt-dashboard-side');
  if(chart) dashMain.appendChild(chart);
  if(comment) dashSide.appendChild(comment);
  if(perf) dashSide.appendChild(perf);
  dashboard.append(dashMain,dashSide); overview.appendChild(dashboard);

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

  const simsIntro=el('div','tj-bt-sims-intro');
  simsIntro.append(
    el('div','tj-bt-sims-intro-copy'),
    el('span','tj-bt-sims-note',{text:'Monte-Carlo · Robustesse statistique · Validation hors-échantillon'})
  );
  const simsCopy=simsIntro.firstElementChild;
  simsCopy?.append(
    el('span','tj-bt-trades-eyebrow',{text:'LABORATOIRE DE ROBUSTESSE'}),
    el('strong','tj-bt-sims-title',{text:'Tester la stratégie au-delà du simple P&L'}),
    el('span','tj-bt-trades-sub',{text:'Commence par Monte-Carlo, vérifie ensuite la significativité avec PSR/DSR, puis termine par Walk-Forward.'})
  );
  const simsGrid=el('div','tj-bt-sims-grid');
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
