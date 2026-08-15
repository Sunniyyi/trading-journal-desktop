# Migration sûre depuis le V206 Chrome vers l'application

L'application utilise **le fichier V206 original comme renderer**, sans réécriture fonctionnelle. En revanche, Electron possède son propre profil navigateur : les IndexedDB/localStorage de Chrome ne sont pas automatiquement visibles dans l'application.

## Pour ne perdre aucune donnée

1. Ouvre ton V206 actuel dans Chrome.
2. Dans les réglages du journal, clique sur **⬇ Sauvegarde** et garde le fichier `.json`.
3. Lance l'application desktop.
4. Dans le menu **Trading Journal**, choisis **Importer une sauvegarde V206…**.
5. Sélectionne le JSON. L'application transmet le fichier au mécanisme `importJSON()` déjà présent dans V206.
6. Vérifie : pages Backtest, trades, capital, notes de pages/jours, paramètres et événements personnalisés.
7. Garde le JSON original quelques jours avant de supprimer quoi que ce soit.

## Stockage après migration

Le renderer tourne dans une session Electron persistante (`persist:trading-journal-desktop`). Les mécanismes V206 existants restent actifs : IndexedDB + miroir localStorage + sauvegardes JSON.

Le dossier Electron peut être ouvert depuis **Trading Journal > Ouvrir le dossier de données**.
