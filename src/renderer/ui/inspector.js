import { $, el, text, observeText, callLegacy } from './lib/dom.js';
import { byId } from './config.js';

const workspaceHints={
  overview:['Vérifie la cible FX Replay avant une session.','Utilise le contexte marché avant de passer au Decision Gate.'],
  journal:['Travaille une journée ou une période à la fois.','Les tableaux défilent dans leur panneau : garde la vue principale fixe.'],
  backtesting:['Fixe le risque au niveau de la session, pas trade par trade.','Compare la courbe, les trades puis les simulations dans cet ordre.'],
  scan:['Dépose les timeframes les plus utiles avant de lancer l’analyse.','Privilégie une lecture HTF → LTF pour garder un scénario cohérent.'],
  context:['Lis d’abord biais, volatilité et catalyseurs.','Le contexte sert à filtrer les trades, pas à forcer une entrée.'],
  gate:['Un élément bloquant doit rester visible avant la décision.','Le verdict doit confirmer ton plan, pas le remplacer.'],
  discipline:['Cherche les erreurs répétées avant les erreurs coûteuses isolées.','Transforme chaque revue en une règle concrète pour la prochaine session.']
};
const related={
  overview:[['journal','Journal'],['backtesting','Backtesting'],['context','Contexte']],
  journal:[['discipline','Discipline'],['gate','Decision Gate'],['backtesting','Backtesting']],
  backtesting:[['journal','Journal'],['discipline','Analyse'],['context','Contexte']],
  scan:[['context','Contexte'],['gate','Decision Gate'],['journal','Journal']],
  context:[['scan','Scan TA'],['gate','Decision Gate'],['journal','Journal']],
  gate:[['context','Contexte'],['journal','Journal'],['discipline','Discipline']],
  discipline:[['journal','Journal'],['gate','Decision Gate'],['backtesting','Backtesting']]
};

function safe(v,fallback='—'){const s=String(v??'').trim();return s||fallback;}
function esc(v){return safe(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function metric(label,value,cls=''){
  return `<div class="tj-inspector-metric ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}

export function createInspector({navigate}={}){
  const aside=el('aside','tj-inspector',{id:'tjInspector'});
  aside.innerHTML=`<div class="tj-inspector-resizer" title="Redimensionner"></div>
    <div class="tj-inspector-head"><div><span class="tj-eyebrow">Panneau contextuel</span><h2 id="tjInspectorTitle">Vue d’ensemble</h2></div><button class="tj-icon-button" id="tjInspectorClose" type="button" title="Fermer">✕</button></div>
    <div class="tj-inspector-scroll">
      <section class="tj-inspector-section" id="tjInspectorSnapshot"></section>
      <section class="tj-inspector-section"><div class="tj-inspector-section-title">Accès liés</div><div class="tj-inspector-links" id="tjInspectorLinks"></div></section>
      <section class="tj-inspector-section"><div class="tj-inspector-section-title">Repères</div><div class="tj-inspector-hints" id="tjInspectorHints"></div></section>
      <section class="tj-inspector-section"><div class="tj-inspector-section-title">Outils</div><div class="tj-inspector-toolgrid">
        <button type="button" data-inspector-action="fxr">↯ <span>FX Replay</span></button>
        <button type="button" data-inspector-action="update">⇩ <span>Mises à jour</span></button>
        <button type="button" data-inspector-action="density">Aa <span id="tjDensityToggle">Densité confort</span></button>
        <button type="button" data-inspector-action="settings">⚙ <span>Paramètres</span></button>
      </div></section>
      <div class="tj-inspector-shortcuts"><span><kbd>Ctrl</kbd><kbd>B</kbd> Navigation</span><span><kbd>Ctrl</kbd><kbd>⇧</kbd><kbd>E</kbd> Inspecteur</span><span><kbd>Ctrl</kbd><kbd>⇧</kbd><kbd>F</kbd> Focus</span></div>
    </div>`;

  const title=aside.querySelector('#tjInspectorTitle');
  const snapshot=aside.querySelector('#tjInspectorSnapshot');
  const links=aside.querySelector('#tjInspectorLinks');
  const hints=aside.querySelector('#tjInspectorHints');
  let active='overview';

  function renderSnapshot(){
    if(!snapshot)return;
    if(active==='backtesting'||active==='overview'){
      const page=$('#fxrTargetPage')?.selectedOptions?.[0]?.textContent?.trim()||'Aucune page';
      const risk=$('#fxrRiskAmount')?.value?`${$('#fxrRiskAmount').value} €`:'—';
      const pending=text('#fxrPendingCount','0');
      snapshot.innerHTML=`<div class="tj-inspector-section-title">Session active</div><div class="tj-inspector-metrics">${metric('Page cible',page)}${metric('Risque fixe',risk)}${metric('En attente',pending)}${metric('Dernier import',text('#fxrLastImport','—'))}</div>`;
      return;
    }
    if(active==='journal'){
      snapshot.innerHTML=`<div class="tj-inspector-section-title">Journal</div><div class="tj-inspector-metrics">${metric('Capital',text('#statCapital .val','—'),'good')}${metric('P&L',text('#statPnl .val','—'))}${metric('Win rate',text('#statWr .val','—'))}${metric('Profit factor',text('#statPf .val','—'))}</div>`;
      return;
    }
    if(active==='context'){
      snapshot.innerHTML=`<div class="tj-inspector-section-title">Lecture marché</div><div class="tj-inspector-metrics">${metric('Biais',text('#ctxBriefBias','—'))}${metric('Volatilité',text('#ctxVolValue','—'))}${metric('News',text('#ctxNewsValue','—'))}${metric('Attention',text('#ctxAttentionLevel','—'))}</div>`;
      return;
    }
    if(active==='discipline'){
      const vals=[...document.querySelectorAll('#mistakeKpis span')].slice(0,4).map(x=>safe(x.textContent));
      snapshot.innerHTML=`<div class="tj-inspector-section-title">Discipline</div><div class="tj-inspector-metrics">${metric('Relus',vals[0]||'—')}${metric('Propres',vals[1]||'—','good')}${metric('Avec erreur',vals[2]||'—','bad')}${metric('Coût',vals[3]||'—','bad')}</div>`;
      return;
    }
    snapshot.replaceChildren(
      el('div','tj-inspector-section-title',{text:byId(active)?.label||'Workspace'}),
      el('div','tj-inspector-note',{text:'Ce panneau reste volontairement léger : il donne les repères utiles sans dupliquer l’écran principal.'})
    );
  }

  function setWorkspace(id){
    active=id||'overview';
    const item=byId(active);if(title)title.textContent=item?.label||'Trading Journal';
    const rel=related[active]||related.overview;
    links?.replaceChildren(...rel.map(([target,label])=>{
      const b=el('button','tj-inspector-link',{type:'button',text:label});b.addEventListener('click',()=>navigate?.(target));return b;
    }));
    hints?.replaceChildren(...(workspaceHints[active]||[]).map(h=>el('div','tj-inspector-hint',{text:h})));
    renderSnapshot();
  }

  aside.querySelector('[data-inspector-action="fxr"]')?.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('tj:toggle-fxr')));
  aside.querySelector('[data-inspector-action="update"]')?.addEventListener('click',()=>window.desktopApp?.openUpdateCenter?.());
  aside.querySelector('[data-inspector-action="settings"]')?.addEventListener('click',()=>callLegacy('openSettings'));

  const watched=[$('#fxrTargetPage'),$('#fxrRiskAmount'),$('#fxrPendingCount'),$('#fxrLastImport'),$('#statCapital .val'),$('#statPnl .val'),$('#statWr .val'),$('#statPf .val'),$('#ctxBriefBias'),$('#ctxVolValue'),$('#ctxNewsValue'),$('#ctxAttentionLevel'),...document.querySelectorAll('#mistakeKpis span')].filter(Boolean);
  observeText(watched,renderSnapshot);
  $('#fxrTargetPage')?.addEventListener('change',renderSnapshot);$('#fxrRiskAmount')?.addEventListener('input',renderSnapshot);
  setWorkspace('overview');
  return{element:aside,setWorkspace,refresh:renderSnapshot};
}
