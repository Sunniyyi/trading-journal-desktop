const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function positionToolsMenu(){
  const menu=document.querySelector('#tjToolsMenu');
  const trigger=document.querySelector('#tjToolsButton');
  if(!menu||!trigger||menu.hidden)return;
  const rect=trigger.getBoundingClientRect();
  const gap=8;
  const width=menu.offsetWidth||210;
  const height=menu.offsetHeight||240;
  const left=clamp(rect.right-width,12,Math.max(12,window.innerWidth-width-12));
  const below=rect.bottom+gap;
  const top=below+height<=window.innerHeight-12?below:clamp(rect.top-height-gap,12,window.innerHeight-height-12);
  menu.style.left=`${Math.round(left)}px`;
  menu.style.top=`${Math.round(top)}px`;
}

function hardenToolsMenu(){
  const trigger=document.querySelector('#tjToolsButton');
  const menu=document.querySelector('#tjToolsMenu');
  if(!trigger||!menu)return;
  trigger.addEventListener('mousedown',event=>event.stopPropagation());
  trigger.addEventListener('click',()=>requestAnimationFrame(positionToolsMenu));
  window.addEventListener('resize',positionToolsMenu,{passive:true});
  new MutationObserver(positionToolsMenu).observe(menu,{attributes:true,attributeFilter:['hidden']});
}

function hardenCommandPalette(){
  const backdrop=document.querySelector('.tj-command-backdrop');
  const input=document.querySelector('.tj-command-input');
  const list=document.querySelector('.tj-command-list');
  if(!backdrop||!input||!list)return;
  const resetSelection=()=>{
    if(backdrop.hidden)return;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    requestAnimationFrame(()=>list.querySelector('.tj-command-item.is-selected')?.scrollIntoView({block:'nearest'}));
  };
  new MutationObserver(resetSelection).observe(backdrop,{attributes:true,attributeFilter:['hidden']});
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp')requestAnimationFrame(()=>list.querySelector('.tj-command-item.is-selected')?.scrollIntoView({block:'nearest'}));
  });
}

function hardenViewportUnits(){
  const apply=()=>document.documentElement.style.setProperty('--tj-viewport-height',`${window.innerHeight}px`);
  apply();
  window.addEventListener('resize',apply,{passive:true});
}

function init(){
  hardenToolsMenu();
  hardenCommandPalette();
  hardenViewportUnits();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(init),{once:true});
else requestAnimationFrame(init);
