
(()=>{
  if(window.__FXR_TJ_RUNTIME_HOOK_V4__)return;
  window.__FXR_TJ_RUNTIME_HOOK_V4__=true;

  const MAX=220000;
  const TRADE_KW=/trade|journal|position|order|execution|fill|filled|close|closed|exit|entry|stop.?loss|take.?profit|pnl|profit|risk.?reward|r.?multiple/i;
  const TELEMETRY=/(^|\/)(logs?|telemetry|analytics|metrics?|events?|track|tracking|sentry|posthog|amplitude|segment|mixpanel|datadog)(\/|$|\?)/i;
  const WATCH_IDS=new Set();
  function containsWatched(payload){
    const txt=safeText(payload);
    if(!txt)return false;
    for(const id of WATCH_IDS){
      if(id && txt.includes(id))return true;
    }
    return false;
  }


  function safeText(v){
    if(v==null)return'';
    if(typeof v==='string')return v.slice(0,MAX);
    if(v instanceof ArrayBuffer){
      try{return new TextDecoder().decode(new Uint8Array(v)).slice(0,MAX);}catch(_){return'[ArrayBuffer]';}
    }
    if(ArrayBuffer.isView(v)){
      try{return new TextDecoder().decode(new Uint8Array(v.buffer,v.byteOffset,v.byteLength)).slice(0,MAX);}catch(_){return'[TypedArray]';}
    }
    try{return JSON.stringify(v,(k,val)=>{
      if(val instanceof Blob)return`[Blob ${val.type||''} ${val.size||0}]`;
      if(val instanceof File)return`[File ${val.name||''} ${val.size||0}]`;
      return val;
    }).slice(0,MAX);}catch(_){return String(v).slice(0,MAX);}
  }
  function shortUrl(url){
    try{return new URL(String(url||''),location.href).pathname;}catch(_){return String(url||'');}
  }
  function emit(channel,detail){
    try{
      window.postMessage({
        source:'fxr-page-runtime',
        type:'FXR_RUNTIME_EVENT',
        channel,
        at:Date.now(),
        ...detail
      },'*');
    }catch(_){}
  }
  function relevant(url,payload){
    const path=shortUrl(url);
    if(TELEMETRY.test(path))return false;
    if(containsWatched(payload))return true;
    return TRADE_KW.test([path,safeText(payload)].join('\n'));
  }

  // ----------------------------------------------------------
  // FETCH
  // ----------------------------------------------------------
  try{
    const nativeFetch=window.fetch;
    window.fetch=async function(input,init){
      const url=typeof input==='string'?input:(input&&input.url)||'';
      const method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
      let request='';
      try{
        const body=init&&init.body;
        if(body instanceof FormData){
          const o={};for(const [k,v] of body.entries())o[k]=typeof v==='string'?v:`[File ${v.name||''}]`;
          request=safeText(o);
        }else if(body instanceof URLSearchParams)request=body.toString();
        else request=safeText(body);
      }catch(_){}

      const response=await nativeFetch.apply(this,arguments);
      try{
        const path=shortUrl(url);
        const write=!['GET','HEAD','OPTIONS'].includes(method);
        if(!TELEMETRY.test(path)&&(write||relevant(url,request))){
          const clone=response.clone();
          const ct=(clone.headers.get('content-type')||'').toLowerCase();
          if(ct.includes('json')||ct.includes('text')||write||relevant(url,request)){
            clone.text().then(txt=>{
              if(write||relevant(url,request)||relevant(url,txt)){
                emit('fetch',{url:String(url),method,status:response.status,request,response:txt});
              }
            }).catch(()=>emit('fetch',{url:String(url),method,status:response.status,request,response:''}));
          }
        }
      }catch(_){}
      return response;
    };
  }catch(_){}

  // ----------------------------------------------------------
  // XHR
  // ----------------------------------------------------------
  try{
    const XHR=window.XMLHttpRequest;
    const nativeOpen=XHR.prototype.open,nativeSend=XHR.prototype.send;
    XHR.prototype.open=function(method,url){
      this.__fxrMethod=String(method||'GET').toUpperCase();
      this.__fxrUrl=String(url||'');
      return nativeOpen.apply(this,arguments);
    };
    XHR.prototype.send=function(body){
      const request=safeText(body);
      this.addEventListener('loadend',()=>{
        try{
          const path=shortUrl(this.__fxrUrl);
          const write=!['GET','HEAD','OPTIONS'].includes(this.__fxrMethod);
          if(TELEMETRY.test(path))return;
          let response='';
          if(this.responseType===''||this.responseType==='text')response=this.responseText||'';
          else if(this.responseType==='json')response=safeText(this.response);
          if(write||relevant(this.__fxrUrl,request)||relevant(this.__fxrUrl,response)){
            emit('xhr',{url:this.__fxrUrl,method:this.__fxrMethod,status:this.status,request,response});
          }
        }catch(_){}
      },{once:true});
      return nativeSend.apply(this,arguments);
    };
  }catch(_){}

  // ----------------------------------------------------------
  // WEBSOCKET (text + Blob + ArrayBuffer)
  // ----------------------------------------------------------
  try{
    const NativeWS=window.WebSocket;
    function WrappedWS(url,protocols){
      const ws=protocols===undefined?new NativeWS(url):new NativeWS(url,protocols);
      try{
        const send=ws.send;
        ws.send=function(data){
          const txt=safeText(data);
          if(relevant(url,txt))emit('websocket-send',{url:String(url),method:'WS',request:txt,response:'',status:0});
          return send.apply(this,arguments);
        };
        ws.addEventListener('message',ev=>{
          try{
            if(typeof ev.data==='string'){
              if(relevant(url,ev.data))emit('websocket',{url:String(url),method:'WS',request:'',response:ev.data,status:0});
            }else if(ev.data instanceof Blob){
              ev.data.text().then(t=>{if(relevant(url,t))emit('websocket',{url:String(url),method:'WS',request:'',response:t,status:0});}).catch(()=>{});
            }else if(ev.data instanceof ArrayBuffer||ArrayBuffer.isView(ev.data)){
              const t=safeText(ev.data);
              if(relevant(url,t))emit('websocket',{url:String(url),method:'WS',request:'',response:t,status:0});
            }
          }catch(_){}
        });
      }catch(_){}
      return ws;
    }
    WrappedWS.prototype=NativeWS.prototype;
    for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED'])Object.defineProperty(WrappedWS,k,{value:NativeWS[k]});
    window.WebSocket=WrappedWS;
  }catch(_){}

  // ----------------------------------------------------------
  // IndexedDB: captures actual object writes, which is useful if
  // FX Replay persists simulator/session data locally.
  // ----------------------------------------------------------
  try{
    const P=window.IDBObjectStore&&window.IDBObjectStore.prototype;
    if(P){
      for(const method of ['put','add']){
        const native=P[method];
        P[method]=function(value,key){
          try{
            const store=this.name||'';
            const payload=safeText(value);
            if(TRADE_KW.test(store)||TRADE_KW.test(payload)){
              emit('indexeddb',{store,operation:method,key:safeText(key),value:payload});
            }
          }catch(_){}
          return native.apply(this,arguments);
        };
      }
    }
  }catch(_){}

  // ----------------------------------------------------------
  // localStorage / sessionStorage
  // ----------------------------------------------------------
  try{
    const SP=window.Storage&&window.Storage.prototype;
    const native=SP&&SP.setItem;
    if(native){
      SP.setItem=function(key,value){
        try{
          const k=String(key||''),v=safeText(value);
          if(TRADE_KW.test(k)||TRADE_KW.test(v)){
            emit('storage',{storage:this===window.localStorage?'localStorage':this===window.sessionStorage?'sessionStorage':'Storage',key:k,value:v});
          }
        }catch(_){}
        return native.apply(this,arguments);
      };
    }
  }catch(_){}

  // ----------------------------------------------------------
  // BroadcastChannel — often used by React apps / multiple panels
  // ----------------------------------------------------------
  try{
    const BC=window.BroadcastChannel;
    if(BC){
      function WrappedBC(name){
        const ch=new BC(name);
        try{
          const nativePost=ch.postMessage;
          ch.postMessage=function(data){
            const payload=safeText(data);
            if(TRADE_KW.test(String(name))||TRADE_KW.test(payload)){
              emit('broadcast-send',{name:String(name),value:payload});
            }
            return nativePost.apply(this,arguments);
          };
          ch.addEventListener('message',ev=>{
            const payload=safeText(ev.data);
            if(TRADE_KW.test(String(name))||TRADE_KW.test(payload)){
              emit('broadcast',{name:String(name),value:payload});
            }
          });
        }catch(_){}
        return ch;
      }
      WrappedBC.prototype=BC.prototype;
      window.BroadcastChannel=WrappedBC;
    }
  }catch(_){}


  window.addEventListener('message',e=>{
    if(e.source!==window||!e.data||e.data.source!=='fxr-extension-watch')return;
    if(e.data.type==='FXR_WATCH_IDS'){
      const ids=Array.isArray(e.data.ids)?e.data.ids:[];
      WATCH_IDS.clear();
      for(const id of ids){
        const s=String(id||'').trim();
        if(s)WATCH_IDS.add(s);
      }
    }
  });

  window.postMessage({source:'fxr-page-runtime',type:'FXR_RUNTIME_HOOK_READY',at:Date.now()},'*');
})();
