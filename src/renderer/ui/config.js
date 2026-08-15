export const WORKSPACES=[
  {id:'overview',icon:'⌂',label:'Accueil',title:'Vue d’ensemble',subtitle:'Résumé de ta performance, de la session et des outils actifs.'},
  {id:'journal',legacy:'trading',viewId:'viewTrading',icon:'▣',label:'Journal',title:'Journal de trading',subtitle:'Trades, calendrier, courbe de capital et notes au même endroit.'},
  {id:'backtesting',legacy:'backtest',viewId:'viewBacktest',icon:'▥',label:'Backtesting',title:'Backtesting',subtitle:'Pages, import FX Replay, résultats, trades et simulations avancées.'},
  {id:'scan',legacy:'scan',viewId:'viewScan',icon:'⌾',label:'Scan TA',title:'Scan TA',subtitle:'Lecture multi-timeframe de screenshots avec workflow guidé.'},
  {id:'context',legacy:'context',viewId:'viewContext',icon:'◎',label:'Contexte marché',title:'Contexte marché',subtitle:'Biais, volatilité, catalyseurs et scénarios de marché.'},
  {id:'gate',legacy:'gate',viewId:'viewGate',icon:'◇',label:'Decision Gate',title:'Decision Gate',subtitle:'Contrôle pré-trade, règles de risque et verdict de conformité.'},
  {id:'discipline',icon:'◈',label:'Discipline & Analyse',title:'Discipline & Analyse',subtitle:'Performance, erreurs d’exécution et qualité de décision.'},
  {id:'settings',icon:'⚙',label:'Paramètres',title:'Paramètres',subtitle:'Préférences, sauvegardes et configuration du logiciel.',action:'settings'}
];
export const byId=id=>WORKSPACES.find(x=>x.id===id);
export const byLegacy=legacy=>WORKSPACES.find(x=>x.legacy===legacy);
