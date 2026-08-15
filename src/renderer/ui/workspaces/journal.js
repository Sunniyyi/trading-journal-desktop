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

    // Calendar and table are two modes of the same execution surface.
    // Keeping the calendar inside tableSection prevents the old min-height/table
    // shell from creating a large empty block when Calendar mode is active.
    if(calendar){
      const toolbar=$('.toolbar',table);
      if(toolbar) toolbar.after(calendar);
      else table.prepend(calendar);
    }

    main.appendChild(table);
    side.appendChild(chart);
    grid.append(main,side);
    stats.after(grid);

    if(dash && !dash.children.length) dash.remove();
  }

  afterPaint(()=>window.dispatchEvent(new Event('resize')));
}
