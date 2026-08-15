const KEY='tj-desktop-layout-v3';
const DEFAULTS={sidebarCollapsed:false,inspectorOpen:true,inspectorWidth:340,density:'comfortable'};

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function read(){
  try{return{...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')};}
  catch(_){return{...DEFAULTS};}
}
function write(state){
  try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}
}

export function initLayoutController({inspector,onLayoutChange}={}){
  const state=read();
  let focus=false;

  const apply=()=>{
    document.body.classList.toggle('tj-sidebar-collapsed',!!state.sidebarCollapsed);
    document.body.classList.toggle('tj-inspector-open',!!state.inspectorOpen&&!focus);
    document.body.classList.toggle('tj-focus-mode',focus);
    document.body.classList.toggle('tj-density-compact',state.density==='compact');
    document.documentElement.style.setProperty('--tj-inspector-open-width',`${clamp(Number(state.inspectorWidth)||340,286,480)}px`);
    document.querySelector('#tjSidebarToggle')?.setAttribute('aria-pressed',String(!!state.sidebarCollapsed));
    document.querySelector('#tjInspectorToggle')?.setAttribute('aria-pressed',String(!!state.inspectorOpen&&!focus));
    const density=document.querySelector('#tjDensityToggle');
    if(density)density.textContent=state.density==='compact'?'Densité compacte':'Densité confort';
    const focusButton=document.querySelector('#tjFocusToggle');
    if(focusButton){focusButton.classList.toggle('is-active',focus);focusButton.textContent=focus?'Quitter Focus':'Mode Focus';}
    write(state);onLayoutChange?.({...state,focus});
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  };

  const toggleSidebar=()=>{state.sidebarCollapsed=!state.sidebarCollapsed;apply();};
  const toggleInspector=force=>{state.inspectorOpen=typeof force==='boolean'?force:!state.inspectorOpen;if(focus&&state.inspectorOpen)focus=false;apply();};
  const toggleFocus=force=>{focus=typeof force==='boolean'?force:!focus;apply();};
  const toggleDensity=()=>{state.density=state.density==='compact'?'comfortable':'compact';apply();};
  const setInspectorWidth=width=>{state.inspectorWidth=clamp(Number(width)||340,286,480);apply();};

  document.querySelector('#tjSidebarToggle')?.addEventListener('click',toggleSidebar);
  document.querySelector('#tjInspectorToggle')?.addEventListener('click',()=>toggleInspector());
  document.querySelector('#tjFocusToggle')?.addEventListener('click',()=>toggleFocus());
  document.querySelector('#tjDensityToggle')?.addEventListener('click',toggleDensity);
  document.querySelector('#tjInspectorClose')?.addEventListener('click',()=>toggleInspector(false));

  const handle=inspector?.querySelector('.tj-inspector-resizer');
  if(handle){
    handle.addEventListener('pointerdown',event=>{
      if(!state.inspectorOpen)return;
      handle.setPointerCapture?.(event.pointerId);
      const startX=event.clientX,startWidth=state.inspectorWidth;
      const move=e=>{
        const width=clamp(startWidth+(startX-e.clientX),286,480);
        state.inspectorWidth=width;
        document.documentElement.style.setProperty('--tj-inspector-open-width',`${width}px`);
        onLayoutChange?.({...state,focus});
      };
      const up=e=>{handle.releasePointerCapture?.(e.pointerId);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);write(state);window.dispatchEvent(new Event('resize'));};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
    });
  }

  document.addEventListener('keydown',event=>{
    const mod=event.ctrlKey||event.metaKey;
    if(mod&&!event.shiftKey&&event.key.toLowerCase()==='b'){event.preventDefault();toggleSidebar();}
    if(mod&&event.shiftKey&&event.key.toLowerCase()==='e'){event.preventDefault();toggleInspector();}
    if(mod&&event.shiftKey&&event.key.toLowerCase()==='f'){event.preventDefault();toggleFocus();}
    if(event.key==='Escape'&&focus){event.preventDefault();toggleFocus(false);}
  });

  apply();
  return{state,toggleSidebar,toggleInspector,toggleFocus,toggleDensity,setInspectorWidth,isFocus:()=>focus};
}
