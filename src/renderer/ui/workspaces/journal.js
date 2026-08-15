import { $, el, afterPaint } from '../lib/dom.js';

export function enhanceJournal(){
  const view=$('#viewTrading');
  if(!view || view.dataset.tjV2==='1') return;
  view.dataset.tjV2='1';
  view.classList.add('tj-workspace','tj-journal-workspace');

  const stats=$('#stats',view);
  const chart=$('#chartCard',view);
  const table=$('#tableSection',view);
  const dash=$('.dash-duo',view);
  if(stats && chart && table){
    const grid=el('div','tj-journal-grid');
    grid.append(table,chart);
    stats.after(grid);
    if(dash && !dash.children.length) dash.remove();
  }
  afterPaint(()=>window.dispatchEvent(new Event('resize')));
}
