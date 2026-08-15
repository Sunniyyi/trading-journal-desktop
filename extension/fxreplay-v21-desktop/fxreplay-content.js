
(()=>{
  if(window.__FXR_TJ_SYNC_V4__)return;window.__FXR_TJ_SYNC_V4__=true;

  let hookReady=false,lastQueued='',lastUrl=location.href;
  const screenshotQueuedSources=new Set();
  const clean=s=>String(s??'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
  const keynorm=s=>clean(s).toLowerCase().replace(/[^a-z0-9]/g,'');
  const normAsset=s=>clean(s).toUpperCase().replace(/^[A-Z0-9._-]+:/,'').replace(/[^A-Z0-9]/g,'');
  const TELEMETRY=/(^|\/)(logs?|telemetry|analytics|metrics?|events?|track|tracking|sentry|posthog|amplitude|segment|mixpanel|datadog)(\/|$|\?)/i;
  const NON_TRADE_META=/\/strateg(?:y|ies)\/.*\/trades\/(?:score|rating|analytics|stats)(?:\/|$|\?)/i;
  const TRADE_LIST=/\/trading\/api\/v1\/trades(?:\/|$|\?)/i;
  const isJournalPopup=()=>/journal-side-panel-popup/i.test(location.pathname)||new URLSearchParams(location.search).has('tradeId');
  function syncProgress(percent,phase,detail,state='working',extra={}){chrome.runtime.sendMessage({type:'SYNC_PROGRESS',progress:{percent,phase,detail,state,...extra}}).catch(()=>{});}



  function num(v){
    if(v===null||v===undefined||v==='')return null;
    if(typeof v==='number')return Number.isFinite(v)?v:null;
    const m=String(v).replace(/\u2212/g,'-').replace(/\s/g,'').replace(',','.').match(/[-+]?\d+(?:\.\d+)?/);
    return m&&Number.isFinite(+m[0])?+m[0]:null;
  }
  function side(v){
    const s=clean(v).toLowerCase();if(/short|sell|vente|bear/.test(s))return'short';if(/long|buy|achat|bull/.test(s))return'long';return'';
  }
  function tf(v){
    const s=clean(v).toUpperCase().replace(/\s/g,'');
    const map={'1M':'M1','3M':'M3','5M':'M5','15M':'M15','30M':'M30','45M':'M45','60M':'H1','1H':'H1','2H':'H2','4H':'H4','1D':'D1','D':'D1','1W':'W1','W':'W1'};
    return map[s]||(/^M\d+$|^H\d+$|^[DWM]\d+$/.test(s)?s:'');
  }
  function chartTimezone(){
    try{return new URLSearchParams(location.search).get('chartTimezoneId')||'';}catch(_){return'';}
  }
  function instantDate(v){
    if(typeof v==='number'&&v>1e10){const d=new Date(v);return isNaN(d)?null:d;}
    const s=clean(v);
    if(!s)return null;
    // Convert only strings that explicitly represent an instant.
    if(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)||/^\d{13}$/.test(s)){
      const d=new Date(/^\d{13}$/.test(s)?Number(s):s);
      return isNaN(d)?null:d;
    }
    return null;
  }
  function zonedParts(v){
    const d=instantDate(v);if(!d)return null;
    const tz=chartTimezone()||undefined;
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{
        timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
      }).formatToParts(d);
      const o={};for(const p of parts)o[p.type]=p.value;
      return{date:`${o.year}-${o.month}-${o.day}`,time:`${o.hour}:${o.minute}:${o.second}`};
    }catch(_){
      return{date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
             time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`};
    }
  }
  function clock(v){
    const zp=zonedParts(v);if(zp)return zp.time;
    const m=clean(v).match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\b/i);if(!m)return'';
    let h=+m[1],ap=(m[4]||'').toUpperCase();if(ap==='PM'&&h<12)h+=12;if(ap==='AM'&&h===12)h=0;
    const base=`${String(h).padStart(2,'0')}:${m[2]}`;
    return m[3]?`${base}:${m[3]}`:base;
  }
  function date(v){
    const zp=zonedParts(v);if(zp)return zp.date;
    const s=clean(v);
    let m=s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if(m)return`${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;

    m=s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
    if(m){
      let y=+m[3];if(y<100)y+=2000;
      const a=+m[1],b=+m[2];
      // FX Replay journal has been observed displaying e.g.
      // "1/7/26, 1:15:59 PM" while the chart is Wed 07 Jan 2026.
      // Therefore its slash notation is M/D/YY even under /fr-FR/.
      let mo=a,d=b;
      // Non-ambiguous fallback if the first component cannot be a month.
      if(a>12&&b<=12){d=a;mo=b;}
      if(d>=1&&d<=31&&mo>=1&&mo<=12)
        return`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    return'';
  }
  function parse(s){
    if(!s||typeof s!=='string')return null;
    try{return JSON.parse(s);}catch(_){}
    try{const p=new URLSearchParams(s),o={};let n=0;for(const[k,v]of p.entries()){o[k]=v;n++;}return n?o:null;}catch(_){}
    return null;
  }
  function objects(v,out=[],depth=0){
    if(depth>9||v==null)return out;
    if(Array.isArray(v)){for(const x of v.slice(0,100))objects(x,out,depth+1);}
    else if(typeof v==='object'){out.push(v);for(const x of Object.values(v))objects(x,out,depth+1);}
    return out;
  }

  const A={
    id:['tradeid','trade_id','journaltradeid','positionid','position_id','executionid','execution_id','orderid','order_id','id'],
    correlationId:['correlationid','correlation_id','correlation','clientcorrelationid','client_correlation_id'],
    asset:['asset','symbol','instrument','pair','market','ticker','tradingsymbol'],
    side:['side','direction','type','orderside','positiontype'],
    entry:['entry','entryprice','entry_price','openprice','open_price','averageentryprice','avgentryprice','entrypoint'],
    exit:['exit','exitprice','exit_price','closeprice','close_price','averageexitprice','avgexitprice','closedprice','closingprice'],
    stop:['stoploss','stop_loss','sl','stopprice','stop_price'],
    tp:['takeprofit','take_profit','tp','targetprice','target_price','takeprofitprice'],
    pnl:[
      'pnl','realizedpnl','realized_pnl','realisedpnl','realised_pnl',
      'closedpnl','closed_pnl','tradepnl','trade_pnl','netpnl','net_pnl',
      'profitloss','profit_loss','netprofitloss','net_profit_loss',
      'realizedprofit','realized_profit','realisedprofit','realised_profit',
      'closedprofit','closed_profit','tradeprofit','trade_profit',
      'netprofit','net_profit','profitamount','profit_amount',
      'pnlaccountcurrency','pnl_in_account_currency','pnlincurrency',
      'realizedpnlaccountcurrency','realized_pnl_account_currency',
      'profit','pl','result'
    ],
    resultR:['rmultiple','r_multiple','resultinr','resultr','result_r','rresult'],
    rr:['riskreward','risk_reward','riskrewardratio','risk_reward_ratio','rr','r_r'],
    timeframe:['timeframe','time_frame','interval','resolution','tf'],
    entryTime:['entrydate','entry_date','entrydatetime','entry_datetime','entrytime','entry_time','opentime','open_time','openedat','opened_at','entrytimestamp','entry_timestamp'],
    exitTime:[
      'exitdate','exit_date','exitdatetime','exit_datetime',
      'exittime','exit_time','closetime','close_time',
      'closeddate','closed_date','closedtime','closed_time',
      'closedat','closed_at','exittimestamp','exit_timestamp',
      'closetimestamp','close_timestamp'
    ],
    comment:['comment','comments','note','notes','journalnote','journal_note','description','review'],
    setup:['setup','strategy','strategytag','strategy_tag','tag'],
    sessionName:['backtestingsessionname','backtesting_session_name','sessionname','session_name']
  };
  function mapped(o){
    if(!o||typeof o!=='object'||Array.isArray(o))return{};
    const n={};for(const[k,v]of Object.entries(o))n[keynorm(k)]=v;
    const g=name=>{
      for(const a of A[name]){
        const k=keynorm(a);
        if(Object.prototype.hasOwnProperty.call(n,k))return n[k];
      }
    };
    const numericValue=v=>num(v)!=null;
    const pnlKeyScore=k=>{
      const x=keynorm(k);
      if(/unreal|floating|openpnl|openprofit|percentage|percent|pct|pips?|ticks?|points?|takeprofit|target/.test(x))return-999;
      if(x==='realizedpnl'||x==='realisedpnl')return120;
      if(x.includes('realizedpnl')||x.includes('realisedpnl'))return115;
      if(x==='netpnl'||x.includes('netpnl'))return110;
      if(x==='closedpnl'||x.includes('closedpnl'))return108;
      if(x==='tradepnl'||x.includes('tradepnl'))return106;
      if(x==='pnl')return105;
      if(x.includes('pnl')&&/(account|currency|amount|value)/.test(x))return103;
      if(x.includes('pnl'))return98;
      if(x.includes('profitloss')||x.includes('netprofitloss'))return95;
      if(x.includes('realizedprofit')||x.includes('realisedprofit'))return92;
      if(x.includes('closedprofit')||x.includes('tradeprofit'))return88;
      if(x.includes('netprofit'))return85;
      if(x==='profit')return80;
      if(x==='pl')return72;
      return-999;
    };
    let fuzzyPnl, fuzzyScore=-999;
    for(const [k,v] of Object.entries(o)){
      if(!numericValue(v))continue;
      const s=pnlKeyScore(k);
      if(s>fuzzyScore){fuzzyScore=s;fuzzyPnl=v;}
    }
    const directPnl=g('pnl');
    return{
      id:g('id'),correlationId:g('correlationId'),
      asset:g('asset'),side:g('side'),entry:g('entry'),exit:g('exit'),
      stopLoss:g('stop'),takeProfit:g('tp'),
      pnl:directPnl!==undefined?directPnl:fuzzyPnl,
      resultR:g('resultR'),plannedRR:g('rr'),timeframe:g('timeframe'),
      entryTime:g('entryTime'),exitTime:g('exitTime'),comment:g('comment'),setup:g('setup'),sessionName:g('sessionName'),
      status:n['status']??n['tradestatus']??n['positionstatus']??n['orderstatus'],
      orderStatusRaw:n['orderstatusraw']??n['rawstatus']
    };
  }
  function score(m){
    let s=0;if(m.id!=null)s+=2;if(m.correlationId!=null)s+=4;if(m.asset!=null)s+=3;if(m.side!=null)s+=2;if(m.entry!=null)s+=3;if(m.exit!=null)s+=4;if(m.pnl!=null)s+=5;if(m.entryTime!=null)s+=2;if(m.exitTime!=null)s+=2;if(m.stopLoss!=null)s++;if(m.takeProfit!=null)s++;if(m.resultR!=null)s+=2;return s;
  }
  function bestPayload(strings){
    const ms=[];
    for(const s of strings){const j=parse(s);if(!j)continue;for(const o of objects(j))ms.push(mapped(o));}
    ms.sort((a,b)=>score(b)-score(a));
    const out={};
    // merge top few, but only useful fields
    for(const m of ms.slice(0,8)){
      for(const k of Object.keys(m))if((out[k]===undefined||out[k]===null||out[k]==='')&&m[k]!==undefined&&m[k]!==null&&m[k]!=='')out[k]=m[k];
    }
    return{out,score:score(out)};
  }

  function mappedObjects(strings){
    const rows=[];
    for(const s of strings){
      const j=parse(s);if(!j)continue;
      for(const o of objects(j)){
        if(!o||typeof o!=='object'||Array.isArray(o))continue;
        const m=mapped(o);
        if(score(m)>=4)rows.push(m);
      }
    }
    return rows;
  }

  function wallMinutes(d,t){
    if(!d||!t)return null;
    const dm=d.match(/^(\d{4})-(\d{2})-(\d{2})$/),tm=t.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if(!dm||!tm)return null;
    return Date.UTC(+dm[1],+dm[2]-1,+dm[3],+tm[1],+tm[2],+(tm[3]||0))/60000;
  }

  function selectTradeListPayload(strings){
    const rows=mappedObjects(strings);
    if(!rows.length)return bestPayload(strings).out;

    const h=header();
    const cAsset=normAsset(h.asset||'');
    const cSide=side(h.side||'');
    const hDate=date(h.date||''),hTime=clock(h.time||'');
    const hWall=wallMinutes(hDate,hTime);

    const candidates=rows.filter(r=>r.entry!=null&&(r.entryTime!=null||r.asset!=null));
    if(!candidates.length)return rows.sort((a,b)=>score(b)-score(a))[0];

    const ranked=candidates.map((r,idx)=>{
      let s=score(r)*10;
      const ra=normAsset(r.asset||''),rs=side(r.side||'');
      if(cAsset&&ra===cAsset)s+=180;
      else if(cAsset&&ra&&ra!==cAsset)s-=300;
      if(cSide&&rs===cSide)s+=80;
      else if(cSide&&rs&&rs!==cSide)s-=120;

      const rd=date(r.entryTime),rt=clock(r.entryTime),rw=wallMinutes(rd,rt);
      if(hWall!=null&&rw!=null){
        const diff=Math.abs(rw-hWall);
        if(diff===0)s+=500;
        else if(diff<=1)s+=420;
        else if(diff<=5)s+=300;
        else if(diff<=30)s+=120;
        else if(diff<=180)s+=30;
        else s-=Math.min(400,diff/5);
      }
      // Stable tiebreaker: later entryDate wins when the journal header is absent.
      const inst=instantDate(r.entryTime);
      const ts=inst?inst.getTime():0;
      return{r,s,ts,idx};
    }).sort((a,b)=>b.s-a.s||b.ts-a.ts||a.idx-b.idx);

    return ranked[0].r;
  }

  function schemaKeys(strings){
    const keys=new Map();
    for(const s of strings){
      const j=parse(s);if(!j)continue;
      for(const o of objects(j)){
        if(!o||typeof o!=='object'||Array.isArray(o))continue;
        for(const [k,v] of Object.entries(o)){
          const nk=keynorm(k);
          if(!nk)continue;
          const type=typeof v;
          const useful=(type==='number'||type==='string'||type==='boolean');
          if(useful)keys.set(k,(keys.get(k)||0)+1);
        }
      }
    }
    return [...keys.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,32)
      .map(x=>x[0])
      .join(', ');
  }

  async function ctx(){
    try{return (await chrome.runtime.sendMessage({type:'GET_STATE'}))?.state?.lastChartContext||{};}catch(_){return{};}
  }
  function header(){
    const lines=(document.body?.innerText||'').split(/\n+/).map(clean).filter(Boolean).slice(0,40);
    const h=lines.find(x=>/(?:[A-Z0-9._-]+:)?[A-Z]{3,8}\/?[A-Z]{3,8}\s*,\s*(?:buy|sell|long|short)\b/i.test(x))||'';
    const m=h.match(/(?:[A-Z0-9._-]+:)?([A-Z0-9]{3,12}\/?[A-Z0-9]{2,12})\s*,\s*(buy|sell|long|short)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
    return m?{asset:m[1],side:m[2],time:m[3],date:m[4],raw:h}:{raw:h};
  }
  function tradeId(){return new URLSearchParams(location.search).get('tradeId')||'';}
  function sid(t){
    const id=t.tradeId||t.networkId;if(id)return'fxr-trade-'+id;
    let h=2166136261>>>0,str=[t.asset,t.date,t.time,t.entry,t.side].join('|');
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return'fxr-'+h.toString(36);
  }
  async function makeTrade(raw,channel,label){
    const c=await ctx(),h=header();
    const t={
      networkId:raw.id,
      correlationId:clean(raw.correlationId||''),
      tradeId:tradeId()||raw.id||'',
      status:clean(raw.status||''),
      orderStatusRaw:clean(raw.orderStatusRaw||''),
      asset:normAsset(raw.asset||h.asset||c.asset||''),
      side:side(raw.side||h.side||''),
      entry:num(raw.entry),exit:num(raw.exit),stopLoss:num(raw.stopLoss),takeProfit:num(raw.takeProfit),pnl:num(raw.pnl),
      resultR:num(raw.resultR),plannedRR:num(raw.plannedRR),
      timeframe:tf(raw.timeframe||c.timeframe||''),
      // Structured entryDate is the activation timestamp. The Journal header
      // may show a later record/order time, so it is only a fallback.
      date:date(raw.entryTime)||(isJournalPopup()&&h.date?date(h.date):''),
      time:clock(raw.entryTime)||(isJournalPopup()&&h.time?clock(h.time):''),
      entryDateRaw:clean(raw.entryTime||''),
      entryTimestampTrusted:!!clean(raw.entryTime||''),
      endDate:date(raw.exitTime),
      endTime:clock(raw.exitTime),
      exitDateRaw:clean(raw.exitTime||''),
      comment:clean(raw.comment||''),setup:clean(raw.setup||''),sessionName:clean(raw.sessionName||''),
      url:location.href,capturedAt:Date.now(),detectedLabel:h.raw||[raw.asset,clock(raw.entryTime)].filter(Boolean).join(' · '),
      runtimeChannel:channel,runtimeLabel:label
    };
    t.sourceId=sid(t);return t;
  }
  function missing(t){
    const m=[];
    if(!t.asset)m.push('actif');
    if(!t.date)m.push('date d’entrée');
    if(!t.time)m.push('heure d’entrée');
    if(!t.timeframe)m.push('UT');
    if(t.entry==null)m.push('entrée');
    if(t.stopLoss==null)m.push('SL');
    if(t.exit==null)m.push('sortie réelle');
    return m;
  }
  async function shot(){
    try{const s=(await chrome.runtime.sendMessage({type:'GET_STATE'}))?.state||{};if(s.captureVisible===false)return[];const r=await chrome.runtime.sendMessage({type:'CAPTURE_VISIBLE'});return r?.ok?[r.dataUrl]:[];}catch(_){return[];}
  }

  let localWatchIds=new Set();

  function pushWatchId(id){
    const s=clean(id);
    if(!s)return;
    localWatchIds.add(s);
    while(localWatchIds.size>20)localWatchIds.delete(localWatchIds.values().next().value);
    const ids=[...localWatchIds];
    window.postMessage({source:'fxr-extension-watch',type:'FXR_WATCH_IDS',ids},'*');
    chrome.runtime.sendMessage({type:'SET_WATCH_IDS',ids}).catch(()=>{});
  }

  async function restoreWatchIds(){
    try{
      const r=await chrome.runtime.sendMessage({type:'GET_STATE'});
      const ids=r?.state?.watchIds||[];
      for(const id of ids)localWatchIds.add(String(id));
      window.postMessage({source:'fxr-extension-watch',type:'FXR_WATCH_IDS',ids:[...localWatchIds]},'*');
    }catch(_){}
  }
  restoreWatchIds();

  function eventContainsWatch(ev){
    const txt=[ev.url,ev.request,ev.response,ev.value].filter(Boolean).join('\\n');
    for(const id of localWatchIds)if(id&&txt.includes(id))return id;
    return'';
  }

  async function processEvent(ev){
    const path=String(ev.url||'');
    if(TELEMETRY.test(path)||NON_TRADE_META.test(path))return;
    syncProgress(8,'Événement FX Replay détecté',`${ev.channel||'réseau'} · ${path||'événement'}`,'working');

    let pieces=[],label='';
    if(ev.channel==='fetch'||ev.channel==='xhr'||ev.channel==='debugger'||ev.channel.startsWith('websocket')||ev.channel.startsWith('debugger-websocket')){
      pieces=[ev.request||'',ev.response||''];
      label=ev.label||`${ev.channel.toUpperCase()} · ${(()=>{try{return new URL(ev.url,location.href).pathname}catch(_){return ev.url||''}})()}`;
    }else if(ev.channel==='indexeddb'){
      pieces=[ev.value||''];label=`INDEXEDDB · ${ev.store||'store'} · ${ev.operation||'write'}`;
    }else if(ev.channel==='storage'){
      pieces=[ev.value||''];label=`${String(ev.storage||'STORAGE').toUpperCase()} · ${ev.key||''}`;
    }else if(ev.channel.startsWith('broadcast')){
      pieces=[ev.value||''];label=`BROADCAST · ${ev.name||''}`;
    }else return;

    const isTradeList=TRADE_LIST.test(String(ev.url||''));
    const selectedTrade=isTradeList?selectTradeListPayload(pieces):null;
    const p=isTradeList?{out:selectedTrade||{},score:score(selectedTrade||{})}:bestPayload(pieces);
    await chrome.runtime.sendMessage({type:'RUNTIME_SEEN',label,score:p.score,channel:ev.channel});
    const matchedWatch=eventContainsWatch(ev);
    if(p.out.correlationId)pushWatchId(p.out.correlationId);
    if(matchedWatch){
      chrome.runtime.sendMessage({
        type:'CORRELATION_EVENT',
        label:`${label} · correlationId ${matchedWatch} · score ${p.score}`
      }).catch(()=>{});
    }
    if(isTradeList){
      const schema=schemaKeys(pieces);
      if(schema)chrome.runtime.sendMessage({type:'TRADES_SCHEMA',schema}).catch(()=>{});
    }

    const raw=p.out;
    const hasIdentity=raw.id!=null||(raw.asset!=null&&raw.entry!=null);
    const hasClosure=raw.exit!=null||raw.pnl!=null||raw.resultR!=null;

    // /trading/api/v1/trades is allowed to be partial: it gives us identity,
    // entry/date/asset/side. Details DOM completes exit/P&L later.
    if(isTradeList && p.score>=5 && hasIdentity){
      const t=await makeTrade(raw,ev.channel,label);
      const progressKey=String(t.sourceId||t.tradeId||t.correlationId||`${t.asset||''}|${t.entry||''}|${t.date||''}|${t.time||''}`);
      syncProgress(20,'Trade identifié','Actif / sens / entrée détectés. Fusion des données…','working',{tradeKey:progressKey,resetTrade:true});
      if(t.correlationId)pushWatchId(t.correlationId);
      await chrome.runtime.sendMessage({type:'MERGE_CANDIDATE',trade:t});
      if(isJournalPopup())setTimeout(()=>syncDetailsDom('api-trade-list'),60);
      return;
    }

    // If the payload carries one of our watched correlationIds, accept a
    // lower structural score: it is tied to the exact FX Replay trade.
    if(!matchedWatch){
      if(p.score<7||!hasIdentity||(!hasClosure&&p.score<10))return;
    }else{
      if(p.score<3)return;
    }

    const t=await makeTrade(raw,ev.channel,label);
    if(!t.correlationId&&matchedWatch)t.correlationId=matchedWatch;
    if(isJournalPopup()){
      const c=await ctx();
      inferBoundaryExit(t,c);
    }
    const merged=await chrome.runtime.sendMessage({type:'MERGE_CANDIDATE',trade:t});
    if(!merged?.ok)return;
    const mt=merged.trade;

    if(merged.complete){
      const fp=[mt.sourceId,mt.asset,mt.date,mt.time,mt.endDate,mt.endTime,mt.entry,mt.exit,mt.takeProfit,mt.pnl,mt.resultR,mt.comment].join('|');
      if(fp===lastQueued)return;
      const q=await chrome.runtime.sendMessage({type:'QUEUE_TRADE',trade:{...mt,images:[]}});
      if(q?.ok){
        lastQueued=fp;
        syncProgress(94,'Trade envoyé au site','Écriture immédiate. Screenshots en arrière-plan.','working');
        if(isJournalPopup())queueScreenshotsInBackground(mt);
        return;
      }
    }

    // Do not warn for generic partial API data. The Details parser is the
    // authoritative completion step for a journal trade.
    if(isJournalPopup())setTimeout(()=>syncDetailsDom('network-partial'),90);
  }

  window.addEventListener('message',e=>{
    if(e.source!==window||!e.data)return;
    if(e.data.source==='fxr-page-runtime'&&e.data.type==='FXR_RUNTIME_HOOK_READY'){
      hookReady=true;chrome.runtime.sendMessage({type:'RUNTIME_HOOK_READY'}).catch(()=>{});return;
    }
    if(e.data.source==='fxr-page-runtime'&&e.data.type==='FXR_RUNTIME_EVENT'){
      processEvent(e.data).catch(()=>{});
    }
  });

  function marketPriceNum(v){
    let s=clean(v).replace(/\s/g,'');
    if(!s)return null;
    if(s.includes(',')&&s.includes('.'))s=s.replace(/,/g,'');
    else if(s.includes(','))s=s.replace(',','.');
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  }

  function chartReplayDateTime(text){
    const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const m=String(text||'').match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+'?(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\b/i);
    if(!m)return{date:'',time:''};
    let y=+m[3];if(y<100)y+=2000;
    const mo=months[m[2].slice(0,3).toLowerCase()];
    return{
      date:`${y}-${String(mo).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`,
      time:`${String(+m[4]).padStart(2,'0')}:${m[5]}${m[6]?':'+m[6]:''}`
    };
  }

  function chartCurrentPrice(text){
    const s=String(text||'');
    const c=s.match(/\bC\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:[.,][0-9]+)?)\b/i);
    if(c){
      const n=marketPriceNum(c[1]);
      if(n!=null)return n;
    }
    return null;
  }

  function inferBoundaryExit(t,c){
    if(!t||t.exit!=null)return t;
    const ctxAge=Date.now()-Number(c?.at||0);
    const sameAsset=!t.asset||!c?.asset||normAsset(t.asset)===normAsset(c.asset);
    const current=marketPriceNum(c?.currentPrice);
    const entry=num(t.entry),sl=num(t.stopLoss),tp=num(t.takeProfit);
    if(!sameAsset||!(ctxAge>=0&&ctxAge<=10000)||current==null||entry==null||sl==null)return t;

    const eps=Math.max(1e-8,Math.abs(current)*1e-8);
    const isLong=String(t.side||'').toLowerCase()==='long';

    if(tp!=null){
      const hit=isLong ? current>=tp-eps : current<=tp+eps;
      if(hit){
        t.exit=tp;
        t.exitSource='tp-hit';
        t.exitInferred=true;
        t.endDate=c.replayDate||t.date||'';
        t.endTime=c.replayTime||'';
        return t;
      }
    }

    const slHit=isLong ? current<=sl+eps : current>=sl-eps;
    if(slHit){
      t.exit=sl;
      t.exitSource='sl-hit';
      t.exitInferred=true;
      t.endDate=c.replayDate||t.date||'';
      t.endTime=c.replayTime||'';
    }
    return t;
  }

  // Main chart context
  async function publish(){
    if(/journal-side-panel-popup/i.test(location.pathname))return;
    const txt=document.body?.innerText||'';
    let asset='';const am=txt.match(/\b(?:OANDA:)?(XAUUSD|XAGUSD|EURUSD|GBPUSD|USDJPY|AUDUSD|USDCAD|USDCHF|NZDUSD|BTCUSD|BTCUSDT|ETHUSD|ETHUSDT|NAS100|US100|US30|SPX500|GER40|DE40)\b/i);if(am)asset=normAsset(am[1]);
    let timeframe='';for(const e of document.querySelectorAll('button,[role="button"],[aria-pressed="true"],[data-state="active"],.active')){const x=tf(e.textContent||e.getAttribute('aria-label'));if(x){timeframe=x;break;}}
    if(asset||timeframe)chrome.runtime.sendMessage({type:'SET_CHART_CONTEXT',context:{asset,timeframe,url:location.href}}).catch(()=>{});
  }
  publish();setInterval(publish,1800);


  /* ----------------------------------------------------------
     V6: FX Replay Journal "Details" parser
     Observed UI: Tag groups | Details. We click Details, wait for
     React to render it, then read label/value pairs from the DOM.
     ---------------------------------------------------------- */
  function visible(el){
    if(!el)return false;
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  }
  function exactText(el,words){
    const t=clean(el?.textContent).toLowerCase();
    return words.some(w=>t===w.toLowerCase());
  }
  async function openDetailsTab(){
    if(!isJournalPopup())return false;
    const words=['details','détails','detail'];
    const candidates=[...document.querySelectorAll('button,[role="tab"],[role="button"],a,div,span')].filter(visible);
    const el=candidates.find(x=>exactText(x,words));
    if(!el)return false;
    const selected=el.getAttribute('aria-selected')==='true'||
      el.getAttribute('data-state')==='active'||
      /\b(active|selected|on)\b/i.test(String(el.className||''));
    if(!selected){
      try{el.click();}catch(_){}
      await new Promise(r=>setTimeout(r,120));
    }
    return true;
  }
  function valueAfterLabel(labels){
    const all=[...document.querySelectorAll('label,dt,dd,th,td,span,div,p,strong,b')].filter(visible);
    for(const node of all){
      const txt=clean(node.textContent);
      if(!txt||txt.length>85)continue;
      const hit=labels.some(l=>new RegExp('^'+l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*:?$','i').test(txt));
      if(!hit)continue;
      const candidates=[
        node.nextElementSibling,
        node.parentElement?.querySelector(':scope > dd'),
        node.parentElement?.children?.[1],
        node.closest('[class*="row"],[class*="detail"],li')?.querySelector('[class*="value"],strong,b,input')
      ];
      for(const c of candidates){
        if(!c||c===node)continue;
        const v=clean(c.value??c.textContent);
        if(v&&v!==txt&&v.length<160)return v;
      }
      const pt=clean(node.parentElement?.textContent);
      if(pt&&pt!==txt&&pt.length<220){
        const rest=clean(pt.replace(txt,'')).replace(/^[:\s\-–—]+/,'');
        if(rest)return rest;
      }
    }
    return'';
  }
  function numberAfterLabel(labels){
    const v=valueAfterLabel(labels);
    if(v)return num(v);
    const txt=document.body?.innerText||'';
    for(const l of labels){
      const re=new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[:\\n]\\s*([-+€$£]?\\s*\\d+(?:[.,]\\d+)?)','i');
      const m=txt.match(re);if(m)return num(m[1]);
    }
    return null;
  }

  function parseNumericToken(token){
    let s=clean(token).replace(/\u2212/g,'-').replace(/\s/g,'');if(!s)return null;
    if(s.includes(',')&&s.includes('.'))s=s.replace(/,/g,'');else if(s.includes(','))s=s.replace(',','.');
    const n=Number(s);return Number.isFinite(n)?n:null;
  }
  function numericTokens(text){
    const m=clean(text).match(/[-+]?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)/g)||[];
    return m.map((raw,i)=>({raw,n:parseNumericToken(raw),i})).filter(x=>x.n!=null);
  }
  function plausibleNear(n,ref){if(!Number.isFinite(n)||n<=0)return false;if(!Number.isFinite(ref)||ref<=0)return true;return n>=ref/20&&n<=ref*20;}
  function fuzzyNumberAfterLabel(labels,reference=null){
    const direct=valueAfterLabel(labels),directNums=numericTokens(direct);
    if(directNums.length){
      if(Number.isFinite(reference)&&reference>0){
        const ranked=directNums.filter(x=>plausibleNear(x.n,reference)).sort((a,b)=>Math.abs(Math.log(a.n/reference))-Math.abs(Math.log(b.n/reference))||a.i-b.i);
        if(ranked.length)return ranked[0].n;
      }else{
        const useful=directNums.filter(x=>Math.abs(x.n)>10);if(useful.length)return useful[useful.length-1].n;
        return directNums[directNums.length-1].n;
      }
    }
    const body=clean(document.body?.innerText||'').replace(/\n+/g,' ');let best=null;
    for(const label of labels){
      const re=new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig');let m;
      while((m=re.exec(body))){
        const segment=body.slice(m.index+m[0].length,m.index+m[0].length+95),nums=numericTokens(segment);
        for(const x of nums){
          if(x.n<=0)continue;let score=x.i*.18;
          if(Number.isFinite(reference)&&reference>0){if(!plausibleNear(x.n,reference))score+=20;else score+=Math.abs(Math.log(x.n/reference))*4;}
          else if(x.n<=10)score+=3;
          if(!best||score<best.score)best={n:x.n,score};
        }
      }
    }
    return best?.n??null;
  }
  function noteText(){
    const els=[...document.querySelectorAll('textarea,[contenteditable="true"],input[type="text"]')].filter(visible);
    const ranked=els.map(e=>{
      const v=clean(e.value??e.innerText??e.textContent);
      const ctx=clean(e.closest('section,form,div')?.innerText||'').toLowerCase();
      let sc=v.length;
      if(/note|journal|comment|review|reason|reasoning/.test(ctx))sc+=500;
      if(/search|recherche/.test(ctx))sc-=500;
      return{v,sc};
    }).filter(x=>x.v.length>0).sort((a,b)=>b.sc-a.sc);
    const v=ranked[0]?.v||'';
    if(/^(loading\.{0,3}|add tag|enter text or type ['"]?\/['"]? for commands)$/i.test(v))return'';
    return v;
  }
  async function srcToDataUrl(src){
    if(!src)return null;
    if(src.startsWith('data:image/'))return src;
    if(src.startsWith('blob:')){
      try{
        const r=await fetch(src);if(!r.ok)return null;
        const b=await r.blob();
        return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b);});
      }catch(_){return null;}
    }
    try{
      const r=await fetch(src,{credentials:'include'});if(!r.ok)return null;
      const b=await r.blob();if(!b.type.startsWith('image/'))return null;
      return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b);});
    }catch(_){return null;}
  }

  function screenshotElementScore(el){
    const r=el.getBoundingClientRect();
    const iw=Number(el.naturalWidth||el.width||0),ih=Number(el.naturalHeight||el.height||0);
    const w=Math.max(r.width,iw),h=Math.max(r.height,ih);
    if(w<240||h<100)return-999;

    const renderedRatio=r.width/Math.max(1,r.height);
    const intrinsicRatio=iw>0&&ih>0?iw/ih:renderedRatio;
    const ratio=intrinsicRatio||renderedRatio;

    // FXReplay chart screenshots are landscape. Square/circular placeholders
    // and profile/icon media are not useful trade screenshots.
    if(ratio<1.45||ratio>6.0)return-700;

    let s=Math.min(700,w*h/1000);
    if(iw>=500)s+=120;
    if(ih>=180)s+=80;
    if(ratio>=1.7&&ratio<=3.8)s+=160;

    const txt=clean(el.closest('div,section,article')?.innerText||'').toLowerCase();
    const alt=clean(el.getAttribute?.('alt')||'').toLowerCase();
    const cls=clean(el.className||'').toLowerCase();
    const src=clean(el.currentSrc||el.src||'').toLowerCase();

    if(/screenshot|capture|chart|tradingview/.test(txt+' '+alt+' '+cls+' '+src))s+=300;
    if(/avatar|logo|icon|emoji|flag|placeholder|skeleton|loader|loading/.test(alt+' '+cls+' '+src))s-=900;
    return s;
  }

  function backgroundUrl(el){
    try{
      const bg=getComputedStyle(el).backgroundImage||'';
      const m=bg.match(/^url\(["']?(.*?)["']?\)$/i);
      return m?m[1]:'';
    }catch(_){return'';}
  }

  async function canvasData(canvas){
    try{
      if(canvas.width<240||canvas.height<100)return null;
      return canvas.toDataURL('image/jpeg',0.82);
    }catch(_){return null;}
  }

  async function captureElementViaDebugger(el,{scroll=true}={}){
    const oldX=window.scrollX,oldY=window.scrollY;
    try{
      if(scroll){
        try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});}
        catch(_){el.scrollIntoView({block:'center'});}
        await new Promise(r=>setTimeout(r,260));
      }
      const r=el.getBoundingClientRect();
      if(r.width<180||r.height<80)return null;

      const resp=await chrome.runtime.sendMessage({
        type:'CAPTURE_DEBUG_CLIP',
        rect:{
          left:r.left,top:r.top,width:r.width,height:r.height,
          viewportWidth:window.innerWidth,viewportHeight:window.innerHeight
        }
      });
      return resp?.ok&&resp.dataUrl?resp.dataUrl:null;
    }catch(_){return null;}
    finally{
      if(scroll){
        try{window.scrollTo({left:oldX,top:oldY,behavior:'instant'});}
        catch(_){window.scrollTo(oldX,oldY);}
        await new Promise(r=>setTimeout(r,80));
      }
    }
  }


  async function imageQuality(dataUrl){
    try{
      const im=await new Promise((res,rej)=>{
        const img=new Image();
        img.onload=()=>res(img);img.onerror=rej;img.src=dataUrl;
      });
      const W=72,H=48;
      const c=document.createElement('canvas');c.width=W;c.height=H;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(im,0,0,W,H);
      const d=ctx.getImageData(0,0,W,H).data;

      let sum=0,sum2=0,edge=0,colorful=0;
      const gray=new Float32Array(W*H);
      for(let i=0,p=0;i<d.length;i+=4,p++){
        const r=d[i],g=d[i+1],b=d[i+2];
        const y=.2126*r+.7152*g+.0722*b;
        gray[p]=y;sum+=y;sum2+=y*y;
        const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
        if(mx-mn>18)colorful++;
      }
      const n=W*H,mean=sum/n,variance=Math.max(0,sum2/n-mean*mean);
      for(let y=1;y<H;y++){
        for(let x=1;x<W;x++){
          const i=y*W+x;
          const gx=Math.abs(gray[i]-gray[i-1]);
          const gy=Math.abs(gray[i]-gray[i-W]);
          if(gx+gy>34)edge++;
        }
      }
      const edgeRatio=edge/((W-1)*(H-1));
      const colorfulRatio=colorful/n;

      // Real chart screenshots generally contain axes/candles/text and thus
      // significant local edges. Empty placeholders/gradients do not.
      const valid =
        edgeRatio>=0.035 ||
        (variance>=900 && edgeRatio>=0.018) ||
        (variance>=650 && colorfulRatio>=0.12 && edgeRatio>=0.012);

      return{valid,variance,edgeRatio,colorfulRatio,mean,width:im.naturalWidth,height:im.naturalHeight};
    }catch(_){
      return{valid:false,variance:0,edgeRatio:0,colorfulRatio:0,mean:0,width:0,height:0};
    }
  }

  async function validScreenshotData(data){
    if(!data||!data.startsWith('data:image/'))return null;
    const q=await imageQuality(data);
    if(!q.valid)return null;
    return{data,q};
  }

  function journalScreenshotCandidates(){
    const rows=[];
    const seen=new Set();

    const push=(el,type,src='')=>{
      if(!el||seen.has(el))return;
      seen.add(el);
      const r=el.getBoundingClientRect();
      const sc=screenshotElementScore(el);
      if(sc<=-400)return;
      rows.push({
        el,type,src,score:sc,
        absTop:r.top+window.scrollY,
        area:Math.max(0,r.width*r.height)
      });
    };

    // Prefer screenshots that live in the upper media area of the Journal.
    for(const img of document.querySelectorAll('img')){
      const src=img.currentSrc||img.src||'';
      if(src)push(img,'img',src);
    }
    for(const c of document.querySelectorAll('canvas'))push(c,'canvas','');

    // Clickable wrappers are important because FX Replay can place the
    // interaction on the parent rather than the <img>.
    for(const el of document.querySelectorAll('button,[role="button"],a,figure,[class*="screenshot"],[class*="image"],[class*="media"]')){
      const img=el.querySelector?.('img,canvas');
      if(img){
        const src=img.currentSrc||img.src||'';
        push(img,img.tagName==='CANVAS'?'canvas':'img',src);
      }
    }

    rows.sort((a,b)=>b.score-a.score||b.area-a.area||a.absTop-b.absTop);

    // De-duplicate DOM representations of the same screenshot.
    const out=[];
    for(const r of rows){
      if(out.some(x=>Math.abs(x.absTop-r.absTop)<50))continue;
      out.push(r);
    }
    return out.slice(0,8);
  }

  function largestVisibleMedia(){
    const items=[];
    for(const el of document.querySelectorAll('img,canvas')){
      if(!visible(el))continue;
      const r=el.getBoundingClientRect();
      if(r.width<260||r.height<120)continue;
      const ratio=r.width/Math.max(1,r.height);
      if(ratio<1.35||ratio>6.5)continue;
      items.push({el,r,area:r.width*r.height});
    }
    items.sort((a,b)=>b.area-a.area);
    return items[0]?.el||null;
  }

  function screenshotViewerLooksOpen(beforeEl){
    const m=largestVisibleMedia();
    if(!m)return false;
    if(beforeEl&&m===beforeEl)return false;
    const r=m.getBoundingClientRect();
    // A lightbox/full viewer is expected to be significantly larger than a thumbnail.
    const br=beforeEl?.getBoundingClientRect?.();
    if(br&&r.width<br.width*1.25&&r.height<br.height*1.25)return false;
    return true;
  }

  async function clickScreenshotOpen(candidate){
    const el=candidate.el;
    const targets=[
      el.closest('button,[role="button"],a,figure,[class*="screenshot"],[class*="image"],[class*="media"]'),
      el
    ].filter(Boolean);

    for(const t of targets){
      try{
        t.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      }catch(_){
        try{t.scrollIntoView({block:'center'});}catch(__){}
      }
      await new Promise(r=>setTimeout(r,120));
      try{t.click();}catch(_){}
      await new Promise(r=>setTimeout(r,420));
      if(screenshotViewerLooksOpen(el))return true;
    }
    return false;
  }

  async function closeScreenshotViewer(){
    // Prefer explicit close buttons.
    const candidates=[...document.querySelectorAll('button,[role="button"],[aria-label],svg')].filter(visible);
    const close=candidates.find(el=>{
      const t=clean(
        el.getAttribute?.('aria-label')||
        el.getAttribute?.('title')||
        el.textContent||''
      ).toLowerCase();
      return t==='close'||t==='fermer'||t==='×'||t==='x'||t.includes('close');
    });
    if(close){
      try{close.closest('button,[role="button"]')?.click?.()||close.click();}catch(_){}
      await new Promise(r=>setTimeout(r,220));
      return;
    }
    // Escape is safer than clicking the backdrop.
    try{
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));
    }catch(_){}
    await new Promise(r=>setTimeout(r,220));
  }

  async function captureOpenedScreenshot(){
    const media=largestVisibleMedia();
    if(!media)return null;

    // If the viewer exposes a true full-resolution image URL, use it.
    if(media.tagName==='IMG'){
      const src=media.currentSrc||media.src||'';
      if(src){
        const direct=await srcToDataUrl(src);
        const checked=await validScreenshotData(direct);
        if(checked)return checked;
      }
    }
    if(media.tagName==='CANVAS'){
      const direct=await canvasData(media);
      const checked=await validScreenshotData(direct);
      if(checked)return checked;
    }

    // Otherwise capture the large rendered media in the FX Replay tab itself.
    const data=await captureElementViaDebugger(media,{scroll:false});
    return await validScreenshotData(data);
  }


  async function strictScreenshotQuality(dataUrl){
    try{
      if(!dataUrl||!dataUrl.startsWith('data:image/'))return{valid:false,reason:'not-image'};

      const im=await new Promise((res,rej)=>{
        const img=new Image();
        img.onload=()=>res(img);
        img.onerror=rej;
        img.src=dataUrl;
      });

      // Reject tiny/empty outputs.
      if((im.naturalWidth||0)<220||(im.naturalHeight||0)<90)
        return{valid:false,reason:'too-small'};

      const W=96,H=60;
      const c=document.createElement('canvas');
      c.width=W;c.height=H;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(im,0,0,W,H);
      const px=ctx.getImageData(0,0,W,H).data;

      const gray=new Float32Array(W*H);
      let sum=0,sum2=0;
      let dark=0,bright=0,colorful=0;
      for(let i=0,p=0;i<px.length;i+=4,p++){
        const r=px[i],g=px[i+1],b=px[i+2];
        const y=.2126*r+.7152*g+.0722*b;
        gray[p]=y;
        sum+=y;sum2+=y*y;
        if(y<35)dark++;
        if(y>225)bright++;
        if(Math.max(r,g,b)-Math.min(r,g,b)>22)colorful++;
      }

      const n=W*H;
      const mean=sum/n;
      const variance=Math.max(0,sum2/n-mean*mean);

      let strongEdges=0,weakEdges=0;
      let edgeEnergy=0;
      for(let y=1;y<H;y++){
        for(let x=1;x<W;x++){
          const i=y*W+x;
          const e=Math.abs(gray[i]-gray[i-1])+Math.abs(gray[i]-gray[i-W]);
          edgeEnergy+=e;
          if(e>26)weakEdges++;
          if(e>52)strongEdges++;
        }
      }
      const edgeN=(W-1)*(H-1);
      const weakRatio=weakEdges/edgeN;
      const strongRatio=strongEdges/edgeN;
      const avgEdge=edgeEnergy/edgeN;
      const colorfulRatio=colorful/n;
      const darkRatio=dark/n;
      const brightRatio=bright/n;

      // A chart screenshot has text, candles, axes, horizontal/vertical lines.
      // A placeholder/gradient can have variance but almost no local structure.
      const structural =
        strongRatio>=0.018 &&
        weakRatio>=0.055 &&
        avgEdge>=9.0;

      const highDetail =
        strongRatio>=0.035 &&
        weakRatio>=0.085;

      const visuallyRich =
        variance>=1050 &&
        strongRatio>=0.012 &&
        weakRatio>=0.045 &&
        (colorfulRatio>=0.035 || darkRatio>=0.08 || brightRatio>=0.20);

      const valid = structural || highDetail || visuallyRich;

      return{
        valid,
        reason:valid?'ok':'low-structure',
        variance,
        strongRatio,
        weakRatio,
        avgEdge,
        colorfulRatio,
        darkRatio,
        brightRatio,
        width:im.naturalWidth,
        height:im.naturalHeight
      };
    }catch(_){
      return{valid:false,reason:'decode-failed'};
    }
  }

  async function strictScreenshot(dataUrl){
    const q=await strictScreenshotQuality(dataUrl);
    return q.valid?{data:dataUrl,q}:null;
  }

  async function collectJournalImages(){
    if(!isJournalPopup())return[];

    const originalX=window.scrollX,originalY=window.scrollY;
    const candidates=journalScreenshotCandidates();
    const out=[],seenSig=new Set(),log=[];

    for(const c of candidates){
      if(out.length>=2)break;

      let checked=null;
      const opened=await clickScreenshotOpen(c);

      if(opened){
        checked=await captureOpenedScreenshot();
        if(checked){
          log.push(`viewer:OK(e=${checked.q.edgeRatio.toFixed(3)},v=${Math.round(checked.q.variance)})`);
        }else{
          log.push('viewer:rejeté');
        }
        await closeScreenshotViewer();
      }

      // Fallback: direct source or exact thumbnail crop, but only if it passes
      // visual validation. Viewer result always has priority.
      if(!checked){
        let data=null;
        if(c.type==='canvas')data=await canvasData(c.el);
        else if(c.src)data=await srcToDataUrl(c.src);

        checked=await validScreenshotData(data);
        if(!checked){
          data=await captureElementViaDebugger(c.el,{scroll:true});
          checked=await validScreenshotData(data);
        }
        if(checked)log.push(`fallback:OK(e=${checked.q.edgeRatio.toFixed(3)},v=${Math.round(checked.q.variance)})`);
      }

      if(!checked)continue;

      // FINAL GATE v19:
      // Even if the older validator accepted it, never send a visually empty
      // placeholder to the Trade Journal.
      const strict=await strictScreenshot(checked.data);
      if(!strict){
        log.push('final:rejeté-placeholder');
        continue;
      }

      const data=strict.data;
      const q=strict.q;
      const sig=data.length+'|'+data.slice(0,140)+'|'+data.slice(-140);
      if(seenSig.has(sig))continue;
      seenSig.add(sig);
      log.push(`final:OK(se=${q.strongRatio.toFixed(3)},we=${q.weakRatio.toFixed(3)},v=${Math.round(q.variance)})`);
      out.push(data);
    }

    try{window.scrollTo({left:originalX,top:originalY,behavior:'instant'});}
    catch(_){window.scrollTo(originalX,originalY);}

    chrome.runtime.sendMessage({
      type:'DETAILS_DIAG',
      diag:`screenshots candidats=${candidates.length} · valides=${out.length} · ${log.slice(0,8).join(' | ')}`
    }).catch(()=>{});

    return out.slice(0,2);
  }
  function detailFieldSnapshot(){
    const labels=[];
    for(const e of document.querySelectorAll('label,dt,th,[class*="label"],span,div')){
      if(!visible(e))continue;
      const t=clean(e.textContent);
      if(t&&t.length<=45&&/entry|exit|close|open|stop|take|profit|pnl|p&l|risk|reward|multiple|size|side|asset|date|time/i.test(t)){
        if(!labels.includes(t))labels.push(t);
      }
      if(labels.length>=35)break;
    }
    return labels.join(' · ');
  }
  function queueScreenshotsInBackground(trade){
    const sourceId=String(trade?.sourceId||'');
    if(!sourceId||screenshotQueuedSources.has(sourceId))return;
    screenshotQueuedSources.add(sourceId);
    setTimeout(async()=>{
      try{
        const images=await collectJournalImages();
        if(!images?.length)return;
        await chrome.runtime.sendMessage({type:'QUEUE_SCREENSHOT_UPDATE',trade:{...trade,images,screenshotUpdate:true}});
      }catch(_){}
    },180);
  }

  async function syncDetailsDom(reason='details'){
    if(!isJournalPopup())return{ok:false,error:'Journal popup non ouvert.'};
    syncProgress(32,'Lecture du Journal FX Replay','Ouverture de Details et lecture des champs…','working');
    await openDetailsTab();await new Promise(r=>setTimeout(r,60));
    const h=header(),c=await ctx();
    let entryPrice=numberAfterLabel(['Entry Price','Entry','Open Price','Average Entry Price','Prix d’entrée','Entrée']);
    let stopPrice=numberAfterLabel(['Stop Loss','Stop Price','Stop','SL']);
    if(stopPrice==null||!plausibleNear(stopPrice,entryPrice))stopPrice=fuzzyNumberAfterLabel(['Stop Loss','Stop Price','Stop','SL'],entryPrice);
    let takeProfit=numberAfterLabel(['Take Profit','Take Profit Price','Target','TP']);
    if(takeProfit==null||!plausibleNear(takeProfit,entryPrice))takeProfit=fuzzyNumberAfterLabel(['Take Profit','Take Profit Price','Target','TP'],entryPrice);
    const exitReference=takeProfit??entryPrice??stopPrice;
    const exitRaw=valueAfterLabel(['Exit Price','Exit','Close Price','Closing Price','Average Exit Price','Prix de sortie','Sortie']);
    let actualExit=numberAfterLabel(['Exit Price','Exit','Close Price','Closing Price','Average Exit Price','Prix de sortie','Sortie']);
    if(actualExit==null||!plausibleNear(actualExit,exitReference))actualExit=fuzzyNumberAfterLabel(['Exit Price','Exit','Close Price','Closing Price','Average Exit Price','Prix de sortie','Sortie'],exitReference);
    const pnl=numberAfterLabel([
      'Realized PnL','Realized P&L','Realised PnL','Realised P&L','Net PnL','Net P&L',
      'Closed PnL','Closed P&L','Trade PnL','Trade P&L','Profit / Loss','Profit/Loss',
      'Net Profit','Realized Profit','Realised Profit','Profit','P&L','PnL','Result','Résultat'
    ]);
    const resultR=numberAfterLabel([
      'R Multiple','R-Multiple','R multiple','Result R','Résultat R','R Result'
    ]);
    const plannedRR=numberAfterLabel([
      'Risk/Reward','Risk Reward','Risk Reward Ratio','R:R','RR'
    ]);

    const entryDateDetails=valueAfterLabel(['Entry Date','Open Date']);
    const entryTimeDetails=valueAfterLabel(['Entry Time','Open Time']);
    const exitDateDetails=valueAfterLabel(['Exit Date','Close Date','Closed Date','Closed At']);
    const exitTimeDetails=valueAfterLabel(['Exit Time','Close Time','Closed Time']);
    const t={
      tradeId:tradeId(),
      asset:normAsset(valueAfterLabel(['Asset','Instrument','Symbol','Pair','Actif'])||h.asset||c.asset||''),
      side:side(valueAfterLabel(['Side','Direction','Sens','Type'])||h.side||''),
      // Explicit Details "Entry Date" is authoritative for activation time.
      date:date(entryDateDetails)||(h.date?date(h.date):''),
      time:clock(entryTimeDetails||entryDateDetails)||(h.time?clock(h.time):''),
      entryDateRaw:clean(entryDateDetails||entryTimeDetails||''),
      entryTimestampTrusted:!!clean(entryDateDetails||entryTimeDetails||''),
      endDate:date(exitDateDetails||exitTimeDetails||''),
      endTime:clock(exitTimeDetails||exitDateDetails||''),
      exitDateRaw:clean(exitDateDetails||exitTimeDetails||''),
      timeframe:tf(valueAfterLabel(['Timeframe','Time Frame','Interval','UT'])||c.timeframe||''),
      entry:entryPrice,
      exit:actualExit,
      stopLoss:stopPrice,
      takeProfit:takeProfit,
      pnl,
      resultR,
      plannedRR,
      comment:noteText(),
      setup:valueAfterLabel(['Strategy','Setup','Stratégie'])||'',
      url:location.href,capturedAt:Date.now(),
      detectedLabel:h.raw||[h.asset,h.time].filter(Boolean).join(' · '),
      runtimeChannel:'details-dom',runtimeLabel:'Journal Details'
    };
    inferBoundaryExit(t,c);t.sourceId=sid(t);
    const known=[['Actif',!!t.asset],['Date',!!t.date],['Heure',!!t.time],['UT',!!t.timeframe],['Entry',t.entry!=null],['SL',t.stopLoss!=null],['Exit',t.exit!=null]];
    const knownCount=known.filter(x=>x[1]).length,fieldPct=Math.min(72,42+knownCount*4),missingNow=known.filter(x=>!x[1]).map(x=>x[0]);
    syncProgress(t.exit!=null?72:fieldPct,t.exit!=null?'Prix de sortie résolu':'Lecture des champs',known.map(x=>`${x[0]} ${x[1]?'✓':'✗'}`).join(' · ')+(missingNow.length?` · manque : ${missingNow.join(', ')}`:''),t.exit!=null?'working':'waiting');
    const boundaryInfo=t.exitInferred
      ?` · sortie auto=${t.exitSource} @${t.exit} · prix replay=${c?.currentPrice??'—'} · fin=${t.endDate||'—'} ${t.endTime||'—'}`
      :'';
    const diag=`${reason} · date=${t.date||'—'} ${t.time||'—'} · labels: ${detailFieldSnapshot()||'aucun label reconnu'} · entry=${t.entry??'—'} exit=${t.exit??'—'} (raw=${clean(exitRaw)||'—'}) · SL=${t.stopLoss??'—'} TP=${t.takeProfit??'—'}${boundaryInfo} · P&L=${t.pnl??'—'} R=${t.resultR??'—'} RR=${t.plannedRR??'—'}`;
    chrome.runtime.sendMessage({type:'DETAILS_DIAG',diag}).catch(()=>{});
    chrome.runtime.sendMessage({type:'RUNTIME_SEEN',label:'DOM · Journal Details',score:20,channel:'details-dom'}).catch(()=>{});

    const mr=await chrome.runtime.sendMessage({type:'MERGE_CANDIDATE',trade:t});
    if(!mr?.ok)return mr;
    const mt=mr.trade;
    const miss=missing(mt);

    if(mr.complete){
      const fp=[mt.sourceId,mt.asset,mt.date,mt.time,mt.endDate,mt.endTime,mt.entry,mt.exit,mt.takeProfit,mt.pnl,mt.resultR,mt.comment].join('|');
      if(fp===lastQueued)return{ok:true,skipped:true,trade:mt};
      syncProgress(82,'Trade complet','Données obligatoires validées. Envoi immédiat au Backtest…','working');
      const q=await chrome.runtime.sendMessage({type:'QUEUE_TRADE',trade:{...mt,images:[]}});
      if(q?.ok){
        lastQueued=fp;
        syncProgress(94,'Trade envoyé au site','Écriture immédiate. Les screenshots sont récupérés en arrière-plan.','working');
        queueScreenshotsInBackground(mt);
        return{ok:true,trade:mt};
      }
      return q;
    }

    // Important: this warning is now based on the actual Details tab, not on
    // summary/score endpoints.
    const err=`Journal Details lu, en attente de : ${miss.join(', ')}. Le P&L FX Replay n’est plus requis.`;
    await chrome.runtime.sendMessage({type:'SET_ERROR',error:err,detectedLabel:mt.detectedLabel||mt.asset||mt.sourceId});
    return{ok:false,error:err,trade:mt};
  }

  // Manual DOM fallback: useful for diagnosis, not primary auto-sync.
  async function manual(){
    if(isJournalPopup())return syncDetailsDom('manual-details');
    return{ok:false,error:'Ouvre le trade dans le Journal FX Replay, puis relance la lecture.'};
  }


  // Auto-sync whenever a journal trade popup is open. FX Replay renders
  // asynchronously, so we retry after load and after relevant DOM mutations.
  if(isJournalPopup()){
    setTimeout(()=>syncDetailsDom('popup-open-fast').catch(()=>{}),80);
    setTimeout(()=>syncDetailsDom('popup-retry-fast').catch(()=>{}),350);
    setTimeout(()=>syncDetailsDom('popup-retry-fast-2').catch(()=>{}),850);
    let fastAttempts=0;
    const fastTimer=setInterval(()=>{
      fastAttempts++;
      if(fastAttempts>18){clearInterval(fastTimer);return;}
      syncDetailsDom('fast-watch').catch(()=>{});
    },450);
    setInterval(()=>syncDetailsDom('boundary-watch').catch(()=>{}),2200);

    let detailTimer=null;
    const detailObserver=new MutationObserver(ms=>{
      let useful=false;
      for(const m of ms){
        for(const n of m.addedNodes||[]){
          const txt=clean(n?.textContent);
          if(txt&&/details|entry|exit|close|pnl|p&l|profit|risk|reward|multiple|take profit|stop loss/i.test(txt)){
            useful=true;break;
          }
        }
        if(useful)break;
      }
      if(useful){
        clearTimeout(detailTimer);
        detailTimer=setTimeout(()=>syncDetailsDom('details-render').catch(()=>{}),90);
      }
    });
    detailObserver.observe(document.documentElement,{childList:true,subtree:true});
  }

  chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(msg?.type==='CAPTURE_NOW'){manual().then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message||String(e)}));return true;}
    if(msg?.type==='DEBUG_NETWORK_EVENT'&&msg.event){
      processEvent(msg.event).then(()=>sendResponse({ok:true})).catch(e=>sendResponse({ok:false,error:e.message||String(e)}));
      return true;
    }
    if(msg?.type==='GET_CONTENT_DIAG'){sendResponse({ok:true,hookReady,url:location.href});}
  });

  setInterval(()=>{if(location.href!==lastUrl){lastUrl=location.href;publish();}},700);
})();
