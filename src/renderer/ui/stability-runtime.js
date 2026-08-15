const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const stability=window.__tjUiStability=window.__tjUiStability||{version:2,chartReplacements:0,backupOffset:0};

function installChartReuseGuard(){
  const NativeChart=window.Chart;
  if(typeof NativeChart!=='function'||NativeChart.__tjReuseGuard)return;
  const release=target=>{
    try{
      const existing=NativeChart.getChart?.(target);
      if(!existing)return;
      existing.destroy();
      stability.chartReplacements++;
    }catch(error){console.warn('[Desktop UI] Chart cleanup failed:',error);}
  };
  const GuardedChart=new Proxy(NativeChart,{
    construct(target,args,newTarget){release(args[0]);return Reflect.construct(target,args,newTarget===GuardedChart?target:newTarget);},
    apply(target,thisArg,args){release(args[0]);return Reflect.apply(target,thisArg,args);}
  });
  Object.defineProperty(GuardedChart,'__tjReuseGuard',{value:true});
  window.Chart=GuardedChart;
}

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
  if(!trigger||!menu)return false;
  trigger.addEventListener('mousedown',event=>event.stopPropagation());
  trigger.addEventListener('click',()=>requestAnimationFrame(positionToolsMenu));
  window.addEventListener('resize',positionToolsMenu,{passive:true});
  window.addEventListener('scroll',positionToolsMenu,true);
  new MutationObserver(positionToolsMenu).observe(menu,{attributes:true,attributeFilter:['hidden']});
  return true;
}

function hardenCommandPalette(){
  const backdrop=document.querySelector('.tj-command-backdrop');
  const input=document.querySelector('.tj-command-input');
  const list=document.querySelector('.tj-command-list');
  if(!backdrop||!input||!list)return false;
  const reveal=()=>requestAnimationFrame(()=>list.querySelector('.tj-command-item.is-selected')?.scrollIntoView({block:'nearest'}));
  const resetSelection=()=>{
    if(backdrop.hidden)return;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    reveal();
  };
  new MutationObserver(resetSelection).observe(backdrop,{attributes:true,attributeFilter:['hidden']});
  input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp')reveal();});
  return true;
}

function hardenViewportUnits(){
  const apply=()=>document.documentElement.style.setProperty('--tj-viewport-height',`${window.innerHeight}px`);
  apply();
  window.addEventListener('resize',apply,{passive:true});
}

function isVisible(element){
  if(!element||!element.isConnected||element.hidden)return false;
  const style=getComputedStyle(element);
  return style.display!=='none'&&style.visibility!=='hidden'&&element.getClientRects().length>0;
}

function hardenBackupSpacing(){
  const warning=document.querySelector('#autoBackupWarning');
  if(!warning)return false;
  let frame=0;
  const update=()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const offset=isVisible(warning)?Math.ceil(warning.getBoundingClientRect().height)+12:0;
      stability.backupOffset=offset;
      document.documentElement.style.setProperty('--tj-backup-offset',`${offset}px`);
    });
  };
  new MutationObserver(update).observe(warning,{attributes:true,childList:true,subtree:true,characterData:true,attributeFilter:['class','style','hidden']});
  if('ResizeObserver'in window)new ResizeObserver(update).observe(warning);
  window.addEventListener('resize',update,{passive:true});
  update();
  return true;
}

function init(){
  hardenViewportUnits();
  let attempts=0;
  const attach=()=>{
    attempts++;
    const ready=[hardenToolsMenu(),hardenCommandPalette(),hardenBackupSpacing()].every(Boolean);
    if(!ready&&attempts<20)setTimeout(attach,100);
  };
  attach();
}

installChartReuseGuard();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(init),{once:true});
else requestAnimationFrame(init);
