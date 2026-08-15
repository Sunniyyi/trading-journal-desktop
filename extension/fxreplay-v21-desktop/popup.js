
function ago(ts){if(!ts)return'jamais';const s=Math.round((Date.now()-ts)/1000);if(s<8)return'à l’instant';if(s<60)return`${s}s`;return`${Math.round(s/60)} min`;}
async function refresh(){
  const r=await chrome.runtime.sendMessage({type:'GET_STATE'});if(!r?.ok)return;const s=r.state||{},sel=document.getElementById('target');
  sel.innerHTML='<option value="">— aucune page —</option>'+(s.pages||[]).map(p=>`<option value="${p.id}">${p.title}</option>`).join('');sel.value=s.targetPageId||'';
  document.getElementById('auto').checked=s.autoSync!==false;document.getElementById('shot').checked=s.captureVisible!==false;document.getElementById('pending').textContent=(s.queue||[]).length;
  const prog=s.syncProgress||{},pp=Math.max(0,Math.min(100,Number(prog.percent)||0));
  const ppct=document.getElementById('progressPct'),pbar=document.getElementById('progressBar'),pphase=document.getElementById('progressPhase'),pdetail=document.getElementById('progressDetail');
  if(ppct)ppct.textContent=Math.round(pp)+'%';if(pbar)pbar.style.width=pp+'%';if(pphase)pphase.textContent=prog.phase||'Prêt';if(pdetail)pdetail.textContent=prog.detail||'En attente…';const pel=document.getElementById('progressElapsed');if(pel){const started=Number(prog.startedAt)||0;pel.textContent=started?((Date.now()-started)/1000).toFixed(1)+' s':'0.0 s';}
  const f=document.getElementById('file');const bridgeOk=!!s.desktopConnected||!!s.fileAccess;f.textContent=s.desktopConnected?'APPLICATION':(s.fileAccess?'FICHIER':'NON');f.className=bridgeOk?'ok':'bad';
  const eu=document.getElementById('extupdate');if(eu){eu.textContent=s.extensionUpdateStatus||'géré par l’application';eu.className=s.desktopConnected?'ok':'warn';}
  const site=document.getElementById('site');site.textContent=ago(s.siteSeenAt);site.className=s.siteSeenAt&&Date.now()-s.siteSeenAt<9000?'ok':'warn';
  const dbg=document.getElementById('dbg');dbg.textContent=(s.debuggerTabs||[]).length?`${s.debuggerTabs.length} onglet(s) attaché(s)`:'NON';dbg.className=(s.debuggerTabs||[]).length?'ok':'bad';
  document.getElementById('dbgevent').textContent=s.lastDebuggerEvent||s.lastDebuggerError||'—';
  const hook=document.getElementById('hook');hook.textContent=s.runtimeHookReadyAt?ago(s.runtimeHookReadyAt):'NON';hook.className=s.runtimeHookReadyAt?'ok':'warn';
  document.getElementById('watch').textContent=(s.watchIds||[]).length;
  document.getElementById('corr').textContent=s.lastCorrelationEvent||'—';
  document.getElementById('tf').textContent=s.lastChartContext?`${s.lastChartContext.asset||''} ${s.lastChartContext.timeframe||''}`.trim()||'—':'—';
  document.getElementById('detected').textContent=s.lastDetected||'—';
  document.getElementById('details').textContent='Details DOM : '+(s.lastDetailsDiag||'en attente…');

  const msg=document.getElementById('status');
  if(!s.desktopConnected&&!s.fileAccess){msg.textContent='Ouvre Trading Journal Desktop, ou active l’accès file:// pour le mode legacy.';msg.className='bad';}
  else if(!s.siteSeenAt||Date.now()-s.siteSeenAt>10000){msg.textContent='Le Trade Journal n’a pas répondu récemment.';msg.className='warn';}
  else if(!(s.debuggerTabs||[]).length){msg.textContent='Network Debugger non attaché. Clique sur le bouton de reconnexion.';msg.className='bad';}
  else if(!s.targetPageId){msg.textContent='Choisis une page Backtest cible.';msg.className='warn';}
  else if(s.lastError){msg.textContent=s.lastError;msg.className='bad';}
  else{msg.textContent='Prêt. La barre ci-dessus montre exactement où en est l’enregistrement.';msg.className='ok';}
}
document.getElementById('target').addEventListener('change',async e=>{await chrome.runtime.sendMessage({type:'SET_TARGET',targetPageId:e.target.value});refresh();});
document.getElementById('auto').addEventListener('change',async e=>{await chrome.runtime.sendMessage({type:'SET_OPTIONS',autoSync:e.target.checked});refresh();});
document.getElementById('shot').addEventListener('change',async e=>{await chrome.runtime.sendMessage({type:'SET_OPTIONS',captureVisible:e.target.checked});refresh();});
document.getElementById('reconnect').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'ENSURE_SITE_BRIDGE'});setTimeout(refresh,700);});
document.getElementById('debugger').addEventListener('click',async()=>{
  const b=document.getElementById('debugger');b.disabled=true;b.textContent='Connexion…';
  await chrome.runtime.sendMessage({type:'ENSURE_DEBUGGER'});
  b.disabled=false;b.textContent='⌁ Reconnecter le Network Debugger';setTimeout(refresh,500);
});
document.getElementById('capture').addEventListener('click',async()=>{
  const b=document.getElementById('capture');b.disabled=true;b.textContent='Lecture…';
  const r=await chrome.runtime.sendMessage({type:'MANUAL_CAPTURE'});
  b.disabled=false;b.textContent='Forcer la lecture du trade ouvert';
  const msg=document.getElementById('status');msg.textContent=r?.ok?'Lecture terminée.':(r?.error||'Lecture impossible.');msg.className=r?.ok?'ok':'bad';refresh();
});
refresh();setInterval(refresh,1000);
