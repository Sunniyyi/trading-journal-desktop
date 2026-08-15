
(()=>{
  // This file may be injected repeatedly by the self-healing background worker.
  if(!document.querySelector('meta[name="fxr-tradejournal-bridge"]'))return;
  if(window.__FXR_TJ_SITE_BRIDGE_V5__){
    window.postMessage({source:'fxr-extension',type:'FXR_EXTENSION_BRIDGE_PING',at:Date.now()},'*');
    return;
  }
  window.__FXR_TJ_SITE_BRIDGE_V5__=true;

  let lastSent='';
  window.addEventListener('message',e=>{
    if(e.source!==window||!e.data||e.data.source!=='trade-journal-fxr')return;
    const d=e.data;
    if(d.type==='FXR_SITE_CONFIG'){
      chrome.runtime.sendMessage({
        type:'SET_SITE_CONFIG',pages:d.pages||[],targetPageId:d.targetPageId||'',version:d.version||''
      }).catch(()=>{});
    }
    if(d.type==='FXR_IMPORT_ACK'&&d.id){chrome.runtime.sendMessage({type:'ACK_TRADE',id:d.id,sourceId:d.sourceId||'',kind:d.kind||'trade'}).catch(()=>{});}
    if(d.type==='FXR_IMPORT_FAIL'&&d.id){chrome.runtime.sendMessage({type:'IMPORT_FAILED',id:d.id,error:d.error||'',kind:d.kind||'trade'}).catch(()=>{});}
    if(d.type==='FXR_RETRY_QUEUE'){
      lastSent='';
      poll();
    }
  });

  async function poll(){
    try{
      const r=await chrome.runtime.sendMessage({type:'GET_QUEUE'});if(!r?.ok)return;
      window.postMessage({
        source:'fxr-extension',type:'FXR_EXTENSION_STATUS',
        pending:(r.queue||[]).length,lastError:r.lastError||'',lastDetected:r.lastDetected||'',
        lastNetworkEvent:r.lastRuntimeEvent||'',targetPageId:r.targetPageId||'',progress:r.syncProgress||{},lastSuccess:r.lastSuccess||null,lastScreenshotUpdate:r.lastScreenshotUpdate||null
      },'*');
      const sig=(r.queue||[]).map(x=>x.id+':'+x.createdAt).join('|');
      if(sig!==lastSent){
        lastSent=sig;
        for(const item of r.queue||[])window.postMessage({source:'fxr-extension',type:'FXR_IMPORT_TRADE',item},'*');
      }
    }catch(_){}
  }

  // This is only the legacy file:// compatibility bridge. Desktop uses the
  // local HTTP bridge directly, so there is no reason to wake Chrome 6-7x/sec.
  window.postMessage({source:'fxr-extension',type:'FXR_EXTENSION_BRIDGE_READY',at:Date.now()},'*');
  poll();setInterval(poll,750);
})();
