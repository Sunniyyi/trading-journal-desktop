import { $, el, afterPaint } from '../lib/dom.js';

function button(label,id,onClick){
  const b=el('button','tj-section-tab',{type:'button',text:label,dataset:{btTab:id}});
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
  const trades=el('section','tj-bt-panel-group',{dataset:{btGroup:'trades'}});
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
  if(side) tradesLeft.appendChild(side);
  [back,months,cal,table,pagination].filter(Boolean).forEach(node=>tradesRight.appendChild(node));
  tradesGrid.append(tradesLeft,tradesRight); trades.appendChild(tradesGrid);

  const simsGrid=el('div','tj-bt-sims-grid');
  [mc,wf,dsr].filter(Boolean).forEach(node=>simsGrid.appendChild(node));
  sims.appendChild(simsGrid);

  layout.replaceChildren(overview,trades,sims);

  const activate=id=>{
    tabs.querySelectorAll('[data-bt-tab]').forEach(x=>x.classList.toggle('is-active',x.dataset.btTab===id));
    layout.querySelectorAll('[data-bt-group]').forEach(x=>x.classList.toggle('is-visible',x.dataset.btGroup===id));
    afterPaint(()=>window.dispatchEvent(new Event('resize')));
  };
  tabs.append(button('Vue d’ensemble','overview',activate),button('Trades & calendrier','trades',activate),button('Simulations','simulations',activate));
  activate('overview');
}
