import { el, callLegacy } from './lib/dom.js';
import { WORKSPACES } from './config.js';

export function createCommandPalette(navigate,layout){
  const backdrop=el('div','tj-command-backdrop',{hidden:'hidden'});
  const box=el('div','tj-command');
  const input=el('input','tj-command-input',{placeholder:'Rechercher une vue, une commande ou une action…',autocomplete:'off'});
  const list=el('div','tj-command-list');
  const footer=el('div','tj-command-footer');footer.innerHTML='<span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>Entrée</kbd> ouvrir</span><span><kbd>Échap</kbd> fermer</span>';
  box.append(input,list,footer);backdrop.appendChild(box);document.body.appendChild(backdrop);

  const actions=[
    ...WORKSPACES.filter(x=>x.id!=='settings').map(x=>({icon:x.icon,title:x.label,detail:x.subtitle,group:'Navigation',run:()=>navigate(x.id)})),
    {icon:'＋',title:'Nouveau trade',detail:'Ouvrir le formulaire de création.',group:'Actions',run:()=>{navigate('journal');callLegacy('fabNewTrade');}},
    {icon:'↯',title:'FX Replay',detail:'Ouvrir la cible, le risque fixe et la progression.',group:'Actions',run:()=>document.dispatchEvent(new CustomEvent('tj:toggle-fxr'))},
    {icon:'◫',title:'Afficher / masquer l’inspecteur',detail:'Panneau contextuel redimensionnable à droite.',group:'Disposition',run:()=>layout?.toggleInspector?.()},
    {icon:'↔',title:'Réduire / développer la navigation',detail:'Basculer la sidebar entre mode complet et icônes.',group:'Disposition',run:()=>layout?.toggleSidebar?.()},
    {icon:'⛶',title:'Basculer le mode Focus',detail:'Masquer les panneaux périphériques pour maximiser le workspace.',group:'Disposition',run:()=>layout?.toggleFocus?.()},
    {icon:'Aa',title:'Changer la densité',detail:'Basculer entre affichage confort et compact.',group:'Disposition',run:()=>layout?.toggleDensity?.()},
    {icon:'⚙',title:'Paramètres',detail:'Ouvrir les réglages du logiciel.',group:'Système',run:()=>callLegacy('openSettings')},
    {icon:'⇩',title:'Centre de mise à jour',detail:'Vérifier et installer les mises à jour.',group:'Système',run:()=>window.desktopApp?.openUpdateCenter?.()}
  ];
  let filtered=actions,selected=0;
  const close=()=>{backdrop.hidden=true;input.value='';render();};
  const open=()=>{backdrop.hidden=false;requestAnimationFrame(()=>input.focus());};
  const render=()=>{
    const q=input.value.trim().toLowerCase();
    filtered=actions.filter(x=>(x.title+' '+x.detail+' '+x.group).toLowerCase().includes(q));
    selected=Math.min(selected,Math.max(0,filtered.length-1));
    const nodes=[];let lastGroup='';
    filtered.forEach((x,i)=>{
      if(x.group!==lastGroup){lastGroup=x.group;nodes.push(el('div','tj-command-group',{text:x.group}));}
      const b=el('button',`tj-command-item${i===selected?' is-selected':''}`,{type:'button'});
      b.innerHTML=`<span>${x.icon}</span><span><b>${x.title}</b><small>${x.detail}</small></span>`;
      b.addEventListener('click',()=>{x.run();close();});nodes.push(b);
    });
    list.replaceChildren(...nodes);
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
  return{open,close};
}
