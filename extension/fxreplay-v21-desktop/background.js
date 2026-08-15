
const DEFAULTS={
  autoSync:true,captureVisible:true,targetPageId:'',pages:[],queue:[],
  tradeCache:{},lastError:'',lastCapture:null,lastDetected:null,lastChartContext:null,
  lastRuntimeEvent:null,runtimeHookReadyAt:0,siteSeenAt:0,siteVersion:'',
  lastTradeSchema:'',lastDetailsDiag:'',lastCorrelationEvent:'',watchIds:[],bridgeLastError:'',bridgeLastAttemptAt:0,debuggerTabs:[],lastDebuggerEvent:'',lastDebuggerError:'',
  syncProgress:{percent:0,phase:'Prêt',detail:'En attente d’un trade FX Replay.',state:'idle',updatedAt:0,startedAt:0,tradeKey:''},
  activeProgressTradeKey:'',lastSuccess:null,lastScreenshotUpdate:null,
  desktopConnected:false,desktopSeenAt:0,extensionUpdateStatus:'géré par l’application',extensionUpdateCheckedAt:0
};

async function rawState(){return {...DEFAULTS,...await chrome.storage.local.get(DEFAULTS)};}
async function getState(){
  const s=await rawState();
  let fileAccess=false;
  try{fileAccess=await chrome.extension.isAllowedFileSchemeAccess();}catch(_){}
  return {...s,fileAccess};
}
async function setState(p){await chrome.storage.local.set(p);}
async function setSyncProgress(progress={}){
  const s=await rawState(),prev=s.syncProgress||DEFAULTS.syncProgress;
  const requested=Math.max(0,Math.min(100,Number(progress.percent??prev.percent??0)||0));
  const tradeKey=String(progress.tradeKey??prev.tradeKey??s.activeProgressTradeKey??'');
  const resetTrade=progress.resetTrade===true&&tradeKey&&tradeKey!==String(s.activeProgressTradeKey||'');

  let percent=requested,startedAt=Number(prev.startedAt)||0;
  if(resetTrade){
    startedAt=Date.now();
  }else{
    percent=Math.max(Number(prev.percent)||0,requested);
    if(!startedAt&&percent>0)startedAt=Date.now();
  }

  const next={
    percent,phase:String(progress.phase??prev.phase??'').slice(0,120),
    detail:String(progress.detail??prev.detail??'').slice(0,700),
    state:String(progress.state??prev.state??'working'),updatedAt:Date.now(),
    startedAt,tradeKey:tradeKey||String(prev.tradeKey||'')
  };
  const patch={syncProgress:next};
  if(resetTrade)patch.activeProgressTradeKey=tradeKey;
  await setState(patch);
  return next;
}


const DESKTOP_BRIDGE='http://127.0.0.1:17841';
let _desktopSyncBusy=false;
let _desktopLastStatusSig='';
let _extensionUpdateLastCheck=0;
let _extensionReloadScheduled=false;
const _desktopDelivering=new Set();

async function desktopFetch(path,options={}){
  const {timeoutMs=900,...fetchOptions}=options;
  const ctl=new AbortController();
  const t=setTimeout(()=>ctl.abort(),timeoutMs);
  try{return await fetch(DESKTOP_BRIDGE+path,{cache:'no-store',...fetchOptions,signal:ctl.signal});}
  finally{clearTimeout(t);}
}

function compareVersionStrings(a,b){
  const aa=String(a||'0').split('.').map(x=>parseInt(x,10)||0),bb=String(b||'0').split('.').map(x=>parseInt(x,10)||0);
  const n=Math.max(aa.length,bb.length);
  for(let i=0;i<n;i++){const x=aa[i]||0,y=bb[i]||0;if(x!==y)return x>y?1:-1;}
  return 0;
}

async function desktopCheckExtensionUpdate(){
  const now=Date.now();
  if(now-_extensionUpdateLastCheck<5000||_extensionReloadScheduled)return;
  _extensionUpdateLastCheck=now;
  try{
    const r=await desktopFetch('/api/extension-version',{timeoutMs:800});
    if(!r.ok)return;
    const info=await r.json();
    const current=chrome.runtime.getManifest().version||'0.0.0';
    const next=String(info.version||'');
    if(info.filesReady&&next&&compareVersionStrings(next,current)>0){
      _extensionReloadScheduled=true;
      await setState({extensionUpdateStatus:`mise à jour ${current} → ${next}`,extensionUpdateCheckedAt:now});
      setTimeout(()=>chrome.runtime.reload(),650);
    }else{
      await setState({extensionUpdateStatus:info.filesReady?`à jour · ${current}`:'dossier géré indisponible',extensionUpdateCheckedAt:now});
    }
  }catch(_){}
}

async function desktopApplyConfig(){
  const r=await desktopFetch('/api/config');
  if(!r.ok)throw new Error('Desktop config HTTP '+r.status);
  const cfg=await r.json();
  const pages=Array.isArray(cfg.pages)?cfg.pages:[];
  const state=await rawState();
  let target=state.targetPageId||'';
  if(target&&!pages.some(p=>p.id===target))target='';
  if(cfg.targetPageId&&pages.some(p=>p.id===cfg.targetPageId))target=cfg.targetPageId;
  await setState({pages,targetPageId:target,siteVersion:cfg.version||state.siteVersion||'',siteSeenAt:Date.now(),fileAccess:true,bridgeLastError:'',desktopConnected:true,desktopSeenAt:Date.now()});
}

async function ackTradeDesktop(id,sourceId='',kind='trade'){
  const state=await rawState();
  const item=(state.queue||[]).find(x=>x.id===id);
  const q=(state.queue||[]).filter(x=>x.id!==id);
  if(item?.kind==='screenshots'||kind==='screenshots'){
    await setState({queue:q,lastError:'',lastScreenshotUpdate:{at:Date.now(),asset:item?.trade?.asset||'Trade',sourceId:item?.trade?.sourceId||sourceId||'',count:Array.isArray(item?.trade?.images)?item.trade.images.length:0,saved:true}});
    return{ok:true,kind:'screenshots'};
  }
  const success={at:Date.now(),asset:item?.trade?.asset||'Trade',sourceId:item?.trade?.sourceId||sourceId||'',targetPageId:item?.targetPageId||state.targetPageId||''};
  await setState({queue:q,lastError:'',lastSuccess:success});
  await setSyncProgress({percent:100,state:'success',phase:'Enregistré',detail:`${success.asset} enregistré avec succès dans le Backtest.`});
  return{ok:true};
}

async function desktopDeliverItem(item){
  if(!item?.id||_desktopDelivering.has(item.id))return;
  _desktopDelivering.add(item.id);
  try{
    const r=await desktopFetch('/api/import',{timeoutMs:15000,method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({item})});
    const out=await r.json().catch(()=>({ok:false,error:'Réponse desktop illisible'}));
    if(r.ok&&out.ok!==false)await ackTradeDesktop(item.id,out.sourceId||'',item.kind||out.kind||'trade');
    else if(out.error)await setState({lastError:String(out.error)});
  }catch(_){}finally{_desktopDelivering.delete(item.id);}
}

async function desktopPushStatus(){
  const state=await getState();
  const payload={pending:(state.queue||[]).length,lastError:state.lastError||'',lastDetected:state.lastDetected||'',lastNetworkEvent:state.lastRuntimeEvent||'',targetPageId:state.targetPageId||'',progress:state.syncProgress||{},lastSuccess:state.lastSuccess||null,lastScreenshotUpdate:state.lastScreenshotUpdate||null};
  const sig=JSON.stringify(payload);
  if(sig===_desktopLastStatusSig)return;
  _desktopLastStatusSig=sig;
  await desktopFetch('/api/status',{method:'POST',headers:{'content-type':'application/json'},body:sig});
}

async function desktopSync(){
  if(_desktopSyncBusy)return;
  _desktopSyncBusy=true;
  try{
    await desktopApplyConfig();
    desktopCheckExtensionUpdate().catch(()=>{});
    const state=await getState();
    await desktopPushStatus();
    for(const item of state.queue||[])desktopDeliverItem(item).catch(()=>{});
  }catch(_){
    const st=await rawState();
    if(st.desktopConnected)await setState({desktopConnected:false});
  }finally{_desktopSyncBusy=false;}
}

async function ensureSiteBridge(){
  let fileAccess=false;
  try{fileAccess=await chrome.extension.isAllowedFileSchemeAccess();}catch(_){}
  if(!fileAccess){
    await setState({bridgeLastError:'Accès file:// non autorisé.',bridgeLastAttemptAt:Date.now()});
    return {ok:false,error:'file access denied'};
  }
  let tabs=[];
  try{tabs=await chrome.tabs.query({url:'file:///*'});}catch(e){
    await setState({bridgeLastError:'Impossible de rechercher les onglets file:// : '+(e.message||e),bridgeLastAttemptAt:Date.now()});
    return {ok:false,error:e.message||String(e)};
  }
  if(!tabs.length){
    await setState({bridgeLastError:'Aucun fichier Trade Journal ouvert.',bridgeLastAttemptAt:Date.now()});
    return {ok:false,error:'no file tabs'};
  }
  let injected=0,last='';
  for(const tab of tabs){
    if(!tab.id)continue;
    try{
      await chrome.scripting.executeScript({target:{tabId:tab.id},files:['site-bridge.js']});
      injected++;
    }catch(e){last=e.message||String(e);}
  }
  await setState({
    bridgeLastError:injected?'':(last||'Aucun bridge injecté.'),
    bridgeLastAttemptAt:Date.now()
  });
  return {ok:injected>0,injected,error:last};
}

function cacheKey(t){
  if(t.sourceId)return String(t.sourceId);
  if(t.tradeId)return'fxr-trade-'+String(t.tradeId);
  if(t.networkId)return'fxr-trade-'+String(t.networkId);
  const parts=[t.asset,t.date,t.time,t.entry,t.side].filter(x=>x!==null&&x!==undefined&&x!=='');
  return parts.length>=4?'fxr-partial-'+parts.join('|'):'';
}
function sameNumber(a,b){
  const x=Number(a),y=Number(b);if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  return Math.abs(x-y)<=Math.max(1e-8,Math.abs(x)*1e-7);
}
function findCompatibleKey(cache,t){
  const direct=cacheKey(t);
  if(direct&&cache[direct])return direct;
  const entries=Object.entries(cache);
  for(const [k,x] of entries){
    if(t.tradeId&&x.tradeId&&String(t.tradeId)===String(x.tradeId))return k;
    if(t.networkId&&x.networkId&&String(t.networkId)===String(x.networkId))return k;
    if(t.correlationId&&x.correlationId&&String(t.correlationId)===String(x.correlationId))return k;
  }
  for(const [k,x] of entries){
    const assetOk=!t.asset||!x.asset||String(t.asset)===String(x.asset);
    const sideOk=!t.side||!x.side||String(t.side)===String(x.side);
    if(!assetOk||!sideOk)continue;
    if(t.entry!=null&&x.entry!=null&&sameNumber(t.entry,x.entry))return k;
    if(t.date&&x.date&&t.time&&x.time&&t.date===x.date&&t.time===x.time)return k;
  }
  return direct;
}
function complete(t){
  const entry=Number(t.entry),stop=Number(t.stopLoss),exit=Number(t.exit);
  if(!(t.asset&&t.side&&t.date&&t.time&&t.timeframe))return false;
  if(t.entryTimestampTrusted!==true)return false;
  if(!(Number.isFinite(entry)&&entry>0&&Number.isFinite(stop)&&stop>0&&Number.isFinite(exit)&&exit>0))return false;
  if(!(Math.abs(entry-stop)>0))return false;
  if(t.side==='long'&&!(stop<entry))return false;
  if(t.side==='short'&&!(stop>entry))return false;
  return true;
}
function mergeTrade(a,b){
  const out={...(a||{})};
  const incoming=b||{};
  const source=String(incoming.runtimeChannel||'');
  const fromDetails=source==='details-dom';
  const incomingTimestampTrusted=incoming.entryTimestampTrusted===true;
  const existingTimestampTrusted=out.entryTimestampTrusted===true;

  const positivePriceFields=new Set(['entry','stopLoss','takeProfit','exit']);
  for(const [k,v] of Object.entries(incoming)){
    if(v===undefined||v===null||v==='')continue;
    if(Array.isArray(v)&&v.length===0)continue;

    // A partial network frame can contain 0/default numeric placeholders.
    // Never let those destroy a real FX Replay price already captured.
    if(positivePriceFields.has(k)){
      const n=Number(v);
      if(!Number.isFinite(n)||n<=0)continue;

      const prev=Number(out[k]);
      if(k==='entry'&&Number.isFinite(prev)&&prev>0&&!sameNumber(prev,n)&&!fromDetails){
        // Entry is immutable after execution. Only the explicit Journal
        // Details parser may correct a previously selected API-list row.
        continue;
      }
    }

    if(k==='date'||k==='time'){
      const prev=String(out[k]||'');
      // Never replace a trusted entry timestamp with an untrusted header/fallback.
      if(existingTimestampTrusted&&!incomingTimestampTrusted&&!fromDetails)continue;
      // Trusted API entryDate / Details may correct an earlier fallback timestamp.
      if(prev&&String(v)!==prev&&!incomingTimestampTrusted&&!fromDetails&&out.runtimeChannel==='details-dom')continue;
    }

    out[k]=v;
  }
  return out;
}
async function mergeCandidate(partial){
  const s=await rawState(),cache={...(s.tradeCache||{})};
  let key=findCompatibleKey(cache,partial);
  if(!key)key=cacheKey(partial);
  if(!key)return{ok:false,error:'Impossible d’identifier ce trade.'};

  const merged=mergeTrade(cache[key],partial);
  merged.sourceId=merged.sourceId||key;

  // If a provisional key becomes a stable tradeId, migrate it.
  const stable=cacheKey(merged);
  if(stable&&stable!==key&&stable.startsWith('fxr-trade-')){
    delete cache[key];key=stable;
  }
  cache[key]=merged;

  const keys=Object.keys(cache);
  if(keys.length>50)for(const k of keys.slice(0,keys.length-50))delete cache[k];

  await setState({tradeCache:cache,lastDetected:merged.detectedLabel||merged.asset||key});
  return{ok:true,key,trade:merged,complete:complete(merged)};
}
async function queueTrade(trade){
  const s=await rawState();
  if(!s.targetPageId){
    const err='Trade complet détecté, mais aucune page Backtest cible n’est sélectionnée.';
    await setState({lastError:err});await setSyncProgress({percent:90,state:'error',phase:'Page cible manquante',detail:err});
    return{ok:false,error:err};
  }
  const q=Array.isArray(s.queue)?s.queue:[];
  const sourceId=String(trade.sourceId||cacheKey(trade));
  const idx=q.findIndex(x=>x.trade?.sourceId===sourceId);
  const item={
    id:idx>=0?q[idx].id:'q'+Date.now()+Math.random().toString(36).slice(2,7),
    createdAt:Date.now(),targetPageId:s.targetPageId,trade:{...trade,sourceId}
  };
  if(idx>=0)q[idx]=item;else q.push(item);
  while(q.length>100)q.shift();
  await setState({queue:q,lastCapture:{at:Date.now(),asset:trade.asset||'',sourceId},lastError:''});
  await setSyncProgress({percent:92,state:'working',phase:'Envoi au Backtest',detail:`${trade.asset||'Trade'} complet · en attente de l’écriture dans le site.`});
  desktopSync().catch(()=>{});
  return{ok:true,item};
}

async function queueScreenshotUpdate(trade){
  const s=await rawState();
  if(!s.targetPageId)return{ok:false,error:'Aucune page Backtest cible.'};
  const images=Array.isArray(trade?.images)?trade.images.filter(Boolean):[];
  if(!images.length)return{ok:true,skipped:true};

  const q=Array.isArray(s.queue)?s.queue:[];
  const sourceId=String(trade.sourceId||cacheKey(trade));
  const item={
    id:'qs'+Date.now()+Math.random().toString(36).slice(2,7),
    kind:'screenshots',createdAt:Date.now(),targetPageId:s.targetPageId,
    trade:{...trade,sourceId,images}
  };
  q.push(item);
  while(q.length>100)q.shift();
  await setState({queue:q,lastScreenshotUpdate:{at:Date.now(),asset:trade.asset||'',sourceId,count:images.length}});
  desktopSync().catch(()=>{});
  return{ok:true,item};
}


const _dbgRequests=new Map();
const _dbgAttached=new Set();
const DBG_TELEMETRY=/(^|\/)(logs?|telemetry|analytics|metrics?|events?|track|tracking|sentry|posthog|amplitude|segment|mixpanel|datadog)(\/|$|\?)/i;
const DBG_RELEVANT=/trade|journal|position|order|execution|fill|close|exit|entry|stop|profit|pnl|backtest|session|strategy/i;

function dbgKey(tabId,requestId){return tabId+':'+requestId;}
function dbgPath(url){try{return new URL(url).pathname;}catch(_){return String(url||'');}}
function dbgInteresting(url,request='',response=''){
  const path=dbgPath(url);
  if(DBG_TELEMETRY.test(path))return false;
  return DBG_RELEVANT.test([path,request,response].join('\n'));
}
async function dbgSendToTab(tabId,ev){
  try{await chrome.tabs.sendMessage(tabId,{type:'DEBUG_NETWORK_EVENT',event:ev});}catch(_){}
}
async function attachDebuggerTab(tabId){
  if(!tabId||_dbgAttached.has(tabId))return true;
  try{
    await chrome.debugger.attach({tabId},'1.3');
    await chrome.debugger.sendCommand({tabId},'Network.enable',{
      maxTotalBufferSize:100000000,
      maxResourceBufferSize:5000000,
      maxPostDataSize:5000000
    });
    _dbgAttached.add(tabId);
    await syncDebuggerState('');
    return true;
  }catch(e){
    const msg=String(e?.message||e);
    // "Another debugger is already attached" occurs when DevTools is open.
    await syncDebuggerState(msg);
    return false;
  }
}
async function ensureFxReplayDebuggers(){
  let tabs=[];
  try{tabs=await chrome.tabs.query({url:'https://app.fxreplay.com/*'});}catch(_){}
  for(const t of tabs)if(t.id)await attachDebuggerTab(t.id);
  return [..._dbgAttached];
}
async function syncDebuggerState(error=''){
  const alive=[];
  for(const id of _dbgAttached){
    try{await chrome.tabs.get(id);alive.push(id);}catch(_){_dbgAttached.delete(id);}
  }
  await setState({debuggerTabs:alive,lastDebuggerError:error||''});
}
async function debuggerEventLabel(tabId,method,url){
  const path=dbgPath(url);
  const label=`DEBUGGER · ${String(method||'NET').replace('Network.','')} · ${path||url||''}`.slice(0,500);
  await setState({lastDebuggerEvent:label,lastDebuggerAt:Date.now(),lastDebuggerError:''});
  return label;
}

chrome.debugger.onDetach.addListener((source,reason)=>{
  if(source.tabId)_dbgAttached.delete(source.tabId);
  syncDebuggerState('Debugger détaché : '+reason).catch(()=>{});
});

chrome.debugger.onEvent.addListener(async(source,method,params)=>{
  const tabId=source.tabId;if(!tabId)return;
  try{
    if(method==='Network.requestWillBeSent'){
      const req=params.request||{},url=req.url||'',postData=req.postData||'';
      _dbgRequests.set(dbgKey(tabId,params.requestId),{
        url,method:req.method||'GET',request:postData,at:Date.now(),type:params.type||''
      });
      if(_dbgRequests.size>1000){
        const first=_dbgRequests.keys().next().value;_dbgRequests.delete(first);
      }
      return;
    }

    if(method==='Network.responseReceived'){
      const requestId=params.requestId,meta=_dbgRequests.get(dbgKey(tabId,requestId))||{};
      const res=params.response||{},url=res.url||meta.url||'';
      if(!dbgInteresting(url,meta.request,''))return;
      let body='';
      try{
        const b=await chrome.debugger.sendCommand({tabId},'Network.getResponseBody',{requestId});
        body=b?.body||'';
        if(b?.base64Encoded){
          try{body=atob(body);}catch(_){}
        }
      }catch(_){}
      if(!dbgInteresting(url,meta.request,body))return;
      const label=await debuggerEventLabel(tabId,method,url);
      await dbgSendToTab(tabId,{
        channel:'debugger',
        transport:'debugger',
        url,
        method:meta.method||'GET',
        request:meta.request||'',
        response:String(body||'').slice(0,1500000),
        status:Number(res.status)||0,
        resourceType:params.type||meta.type||'',
        at:Date.now(),
        label
      });
      return;
    }

    if(method==='Network.webSocketFrameReceived'||method==='Network.webSocketFrameSent'){
      const payload=params.response?.payloadData||'';
      if(!payload||!DBG_RELEVANT.test(payload))return;
      const label=await debuggerEventLabel(tabId,method,'websocket');
      await dbgSendToTab(tabId,{
        channel:method.endsWith('Sent')?'debugger-websocket-send':'debugger-websocket',
        transport:'debugger-websocket',
        url:'websocket',
        method:'WS',
        request:method.endsWith('Sent')?payload:'',
        response:method.endsWith('Received')?payload:'',
        status:0,
        at:Date.now(),
        label
      });
    }
  }catch(e){
    await setState({lastDebuggerError:String(e?.message||e)});
  }
});

chrome.tabs.onUpdated.addListener((tabId,changeInfo,tab)=>{
  if(changeInfo.status==='loading'&&/^https:\/\/app\.fxreplay\.com\//i.test(tab.url||'')){
    attachDebuggerTab(tabId).catch(()=>{});
  }
});
chrome.tabs.onRemoved.addListener(tabId=>{
  _dbgAttached.delete(tabId);
  for(const k of [..._dbgRequests.keys()])if(k.startsWith(tabId+':'))_dbgRequests.delete(k);
  syncDebuggerState('').catch(()=>{});
});

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  (async()=>{
    if(!msg?.type)return sendResponse({ok:false});

    if(msg.type==='GET_STATE'){
      // Self-heal both channels whenever the popup/site asks for state.
      ensureSiteBridge().catch(()=>{});
      ensureFxReplayDebuggers().catch(()=>{});
      return sendResponse({ok:true,state:await getState()});
    }

    if(msg.type==='ENSURE_DEBUGGER'){
      const ids=await ensureFxReplayDebuggers();
      return sendResponse({ok:ids.length>0,tabIds:ids});
    }

    if(msg.type==='ENSURE_SITE_BRIDGE'){
      const r=await ensureSiteBridge();
      return sendResponse(r);
    }

    if(msg.type==='SET_SITE_CONFIG'){
      const pages=Array.isArray(msg.pages)?msg.pages:[],s=await rawState();
      let target=s.targetPageId;
      if(target&&!pages.some(p=>p.id===target))target='';
      if(msg.targetPageId&&pages.some(p=>p.id===msg.targetPageId))target=msg.targetPageId;
      await setState({
        pages,targetPageId:target,siteVersion:msg.version||'',
        siteSeenAt:Date.now(),bridgeLastError:''
      });
      return sendResponse({ok:true,targetPageId:target});
    }

    if(msg.type==='SET_TARGET'){
      await setState({targetPageId:String(msg.targetPageId||''),lastError:''});
      return sendResponse({ok:true});
    }

    if(msg.type==='SET_CHART_CONTEXT'){
      await setState({lastChartContext:{...(msg.context||{}),at:Date.now()}});
      return sendResponse({ok:true});
    }

    if(msg.type==='RUNTIME_HOOK_READY'){
      await setState({runtimeHookReadyAt:Date.now()});
      return sendResponse({ok:true});
    }

    if(msg.type==='RUNTIME_SEEN'){
      await setState({
        lastRuntimeEvent:String(msg.label||'écriture FX Replay'),
        lastRuntimeAt:Date.now(),
        lastRuntimeScore:Number(msg.score)||0,
        lastRuntimeChannel:String(msg.channel||'')
      });
      return sendResponse({ok:true});
    }

    if(msg.type==='TRADES_SCHEMA'){
      await setState({lastTradeSchema:String(msg.schema||'').slice(0,800)});
      return sendResponse({ok:true});
    }

    if(msg.type==='DETAILS_DIAG'){
      const s=await rawState(),incoming=String(msg.diag||'').slice(0,900);
      const prev=String(s.lastDetailsDiag||'');
      const value=incoming.startsWith('screenshots ')
        ?(prev?prev+' · '+incoming:incoming)
        :incoming;
      await setState({lastDetailsDiag:value.slice(0,1500)});
      return sendResponse({ok:true});
    }

    if(msg.type==='SET_WATCH_IDS'){
      const ids=[...new Set((Array.isArray(msg.ids)?msg.ids:[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(-20);
      await setState({watchIds:ids});
      return sendResponse({ok:true,watchIds:ids});
    }

    if(msg.type==='CORRELATION_EVENT'){
      await setState({lastCorrelationEvent:String(msg.label||'').slice(0,900)});
      return sendResponse({ok:true});
    }

    if(msg.type==='SYNC_PROGRESS'){const p=await setSyncProgress(msg.progress||{});return sendResponse({ok:true,progress:p});}

    if(msg.type==='MERGE_CANDIDATE')return sendResponse(await mergeCandidate(msg.trade||{}));
    if(msg.type==='QUEUE_TRADE')return sendResponse(await queueTrade(msg.trade||{}));
    if(msg.type==='QUEUE_SCREENSHOT_UPDATE')return sendResponse(await queueScreenshotUpdate(msg.trade||{}));

    if(msg.type==='GET_QUEUE'){
      const s=await getState();
      return sendResponse({
        ok:true,queue:s.queue||[],targetPageId:s.targetPageId,lastError:s.lastError||'',
        lastDetected:s.lastDetected||'',pages:s.pages||[],siteSeenAt:s.siteSeenAt||0,
        fileAccess:s.fileAccess,lastChartContext:s.lastChartContext||null,
        lastRuntimeEvent:s.lastRuntimeEvent||'',lastRuntimeAt:s.lastRuntimeAt||0,
        lastRuntimeScore:s.lastRuntimeScore||0,lastRuntimeChannel:s.lastRuntimeChannel||'',
        runtimeHookReadyAt:s.runtimeHookReadyAt||0,lastTradeSchema:s.lastTradeSchema||'',
        lastDetailsDiag:s.lastDetailsDiag||'',lastCorrelationEvent:s.lastCorrelationEvent||'',
        watchIds:s.watchIds||[],debuggerTabs:s.debuggerTabs||[],
        lastDebuggerEvent:s.lastDebuggerEvent||'',lastDebuggerError:s.lastDebuggerError||'',
        syncProgress:s.syncProgress||DEFAULTS.syncProgress,lastSuccess:s.lastSuccess||null,lastScreenshotUpdate:s.lastScreenshotUpdate||null,
        desktopConnected:!!s.desktopConnected,desktopSeenAt:s.desktopSeenAt||0,
        bridgeLastError:s.bridgeLastError||'',bridgeLastAttemptAt:s.bridgeLastAttemptAt||0
      });
    }

    if(msg.type==='ACK_TRADE'){
      return sendResponse(await ackTradeDesktop(msg.id,msg.sourceId||'',msg.kind||'trade'));
    }
    if(msg.type==='IMPORT_FAILED'){
      const err=String(msg.error||'Le site a refusé l’import.');await setState({lastError:err});
      await setSyncProgress({percent:96,state:'error',phase:'Import refusé',detail:err});return sendResponse({ok:true});
    }

    if(msg.type==='SET_ERROR'){
      const err=String(msg.error||'');await setState({lastError:err,lastDetected:msg.detectedLabel||undefined});
      const s=await rawState(),prev=s.syncProgress||DEFAULTS.syncProgress;
      await setSyncProgress({percent:Math.max(20,Math.min(89,Number(prev.percent)||50)),state:/en attente/i.test(err)?'waiting':'error',phase:/en attente/i.test(err)?'Données incomplètes':'Diagnostic',detail:err});
      return sendResponse({ok:true});
    }

    if(msg.type==='CAPTURE_DEBUG_CLIP'){
      try{
        const tab=sender.tab;
        if(!tab?.id)return sendResponse({ok:false,error:'Onglet FX Replay source introuvable.'});
        const tabId=tab.id;
        if(!_dbgAttached.has(tabId)){
          const attached=await attachDebuggerTab(tabId);
          if(!attached)return sendResponse({ok:false,error:'Network Debugger non attaché à cet onglet FX Replay.'});
        }

        const rect=msg.rect||{};
        let metrics={};
        try{metrics=await chrome.debugger.sendCommand({tabId},'Page.getLayoutMetrics');}catch(_){}
        const vv=metrics?.cssVisualViewport||metrics?.visualViewport||{};
        const pageX=Number(vv.pageX)||0,pageY=Number(vv.pageY)||0;
        const width=Math.max(1,Number(rect.width)||1),height=Math.max(1,Number(rect.height)||1);
        const data=await chrome.debugger.sendCommand({tabId},'Page.captureScreenshot',{
          format:'jpeg',
          quality:84,
          fromSurface:true,
          captureBeyondViewport:true,
          clip:{
            x:pageX+(Number(rect.left)||0),
            y:pageY+(Number(rect.top)||0),
            width,
            height,
            scale:1
          }
        });
        if(!data?.data)return sendResponse({ok:false,error:'Capture CDP vide.'});
        return sendResponse({ok:true,dataUrl:'data:image/jpeg;base64,'+data.data});
      }catch(e){
        return sendResponse({ok:false,error:e?.message||String(e)});
      }
    }

    if(msg.type==='CAPTURE_VISIBLE'){
      try{
        const tab=sender.tab;if(!tab)return sendResponse({ok:false,error:'Onglet FX Replay introuvable.'});
        const dataUrl=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'jpeg',quality:58});
        return sendResponse({ok:true,dataUrl});
      }catch(e){return sendResponse({ok:false,error:e.message||String(e)});}
    }

    if(msg.type==='MANUAL_CAPTURE'){
      const tabs=await chrome.tabs.query({active:true,currentWindow:true}),tab=tabs[0];
      if(!tab||!/^https:\/\/app\.fxreplay\.com\//i.test(tab.url||'')){
        return sendResponse({ok:false,error:'Place-toi sur le trade FX Replay ouvert.'});
      }
      try{return sendResponse(await chrome.tabs.sendMessage(tab.id,{type:'CAPTURE_NOW',manual:true}));}
      catch(e){return sendResponse({ok:false,error:'Recharge FX Replay puis réessaie.'});}
    }

    if(msg.type==='SET_OPTIONS'){
      const patch={};
      if(typeof msg.autoSync==='boolean')patch.autoSync=msg.autoSync;
      if(typeof msg.captureVisible==='boolean')patch.captureVisible=msg.captureVisible;
      await setState(patch);return sendResponse({ok:true});
    }

    return sendResponse({ok:false});
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(()=>{ensureSiteBridge().catch(()=>{});ensureFxReplayDebuggers().catch(()=>{});});
chrome.runtime.onStartup.addListener(()=>{ensureSiteBridge().catch(()=>{});ensureFxReplayDebuggers().catch(()=>{});});
setInterval(()=>desktopSync().catch(()=>{}),250);
desktopSync().catch(()=>{});
