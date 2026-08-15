import { $, el, afterPaint } from '../lib/dom.js';

export function enhanceJournal(){
  const view=$('#viewTrading');
  if(!view || view.dataset.tjV2==='1') return;
  view.dataset.tjV2='1';
  view.classList.add('tj-workspace','tj-journal-workspace');

  const stats=$('#stats',view);
  const chart=$('#chartCard',view);
  const table=$('#tableSection',view);
  const calendar=$('#journalCalCard',view);
  const dash=$('.dash-duo',view);

  if(stats && chart && table){
    const grid=el('div','tj-journal-grid');
    const main=el('div','tj-journal-main');
    const side=el('aside','tj-journal-side');

    main.appendChild(table);
    if(calendar) main.appendChild(calendar);
    side.appendChild(chart);
    grid.append(main,side);
    stats.after(grid);

    if(dash && !dash.children.length) dash.remove();
  }

  afterPaint(()=>window.dispatchEvent(new Event('resize')));
}
