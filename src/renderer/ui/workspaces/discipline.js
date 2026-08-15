import { $, el, observeText, text } from '../lib/dom.js';

function summaryCard(label,source,tone=''){
  const card=el('div',`tj-discipline-card ${tone}`);
  card.innerHTML=`<span>${label}</span><b data-source="${source}">—</b>`;
  return card;
}
function refresh(view){
  view.querySelectorAll('[data-source]').forEach(node=>{
    const source=node.dataset.source;
    node.textContent=text(source,'—');
  });
}
export function buildDiscipline(){
  const view=el('section','tj-workspace',{id:'tjDisciplineView'});
  const header=el('div','tj-discipline-header-cards');
  header.append(
    summaryCard('Trades relus','#mistakeKpis > div:nth-child(1) span'),
    summaryCard('Moy. trades propres','#mistakeKpis > div:nth-child(2) span'),
    summaryCard('Moy. trades avec erreur','#mistakeKpis > div:nth-child(3) span'),
    summaryCard('Coût estimé','#mistakeKpis > div:nth-child(4) span','bad')
  );
  const grid=el('div','tj-discipline-grid');
  const perf=$('#perfCard');
  const mistakes=$('#mistakeAnalyticsCard');
  if(perf) grid.appendChild(perf);
  if(mistakes) grid.appendChild(mistakes);
  view.append(header,grid);
  const watched=[...document.querySelectorAll('#mistakeKpis span'),$('#perfBody')];
  observeText(watched,()=>refresh(view));
  refresh(view);
  return view;
}
