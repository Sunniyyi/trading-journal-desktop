import { el, callLegacy } from './lib/dom.js';
import { WORKSPACES } from './config.js';

export function createCommandPalette(navigate){
  const backdrop=el('div','tj-command-backdrop',{hidden:'hidden'});
  const box=el('div','tj-command');
  const input=el('input','tj-command-input',{placeholder:'Rechercher une vue ou lancer une action…',autocomplete:'off'});
  const list=el('div','tj-command-list');
  box.append(input,list); backdrop.appendChild(box); document.body.appendChild(backdrop);

  const actions=[
    ...WORKSPACES.filter(x=>x.id!=='settings').map(x=>({icon:x.icon,title:x.label,detail:x.subtitle,run:()=>navigate(x.id)})),
    {icon:'＋',title:'Nouveau trade',detail:'Ouvrir le formulaire de création.',run:()=>{navigate('journal');callLegacy('fabNewTrade');}},
    {icon:'↯',title:'FX Replay',detail:'Ouvrir les paramètres et la progression de synchronisation.',run:()=>document.dispatchEvent(new CustomEvent('tj:toggle-fxr'))},
    {icon:'⚙',title:'Paramètres',detail:'Ouvrir les réglages du logiciel.',run:()=>callLegacy('openSettings')},
    {icon:'⇩',title:'Centre de mise à jour',detail:'Vérifier et installer les mises à jour.',run:()=>window.desktopApp?.openUpdateCenter?.()}
  ];
  let filtered=actions,selected=0;
  const close=()=>{backdrop.hidden=true;input.value='';render();};
  const open=()=>{backdrop.hidden=false;requestAnimationFrame(()=>input.focus());};
  const render=()=>{
    const q=input.value.trim().toLowerCase();
    filtered=actions.filter(x=>(x.title+' '+x.detail).toLowerCase().includes(q));
    selected=Math.min(selected,Math.max(0,filtered.length-1));
    list.replaceChildren(...filtered.map((x,i)=>{
      const b=el('button',`tj-command-item${i===selected?' is-selected':''}`,{type:'button'});
      b.innerHTML=`<span>${x.icon}</span><span><b>${x.title}</b><small>${x.detail}</small></span>`;
      b.addEventListener('click',()=>{x.run();close();}); return b;
    }));
  };
  input.addEventListener('input',()=>{selected=0;render();});
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();selected=Math.min(filtered.length-1,selected+1);render();}
    else if(e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,selected-1);render();}
    else if(e.key==='Enter'&&filtered[selected]){e.preventDefault();filtered[selected].run();close();}
    else if(e.key==='Escape')close();
  });
  backdrop.addEventListener('mousedown',e=>{if(e.target===backdrop)close();});
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();backdrop.hidden?open():close();}
    if(e.key==='Escape'&&!backdrop.hidden)close();
  });
  render();
  return {open,close};
}
