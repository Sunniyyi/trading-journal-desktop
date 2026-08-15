# Audit performance — Desktop 1.1

## Points traités

### Écritures de stockage

Le V206 écrivait chaque valeur à la fois dans `localStorage` et IndexedDB. `localStorage.setItem()` étant synchrone, les gros JSON contenant trades, pages Backtest et screenshots pouvaient bloquer le thread UI.

La couche desktop garde IndexedDB comme stockage durable principal et ne conserve un miroir `localStorage` que pour les petites valeurs. Les écritures IndexedDB successives sur une même clé sont fusionnées selon une logique latest-write-wins.

### Démarrage

L'ancien `boot()` initialisait tous les modules avant de rendre l'écran principal et effectuait un rendu initial supplémentaire avant de passer au calendrier.

Le build desktop garde uniquement les données, préférences, bridge FXReplay et premier rendu dans le chemin critique. Les modules secondaires sont initialisés après le premier paint via `requestIdleCallback` avec fallback timer.

### Analyses hors écran

Les blocs d'analyse de performance et Mistake Analytics pouvaient être recalculés alors qu'ils étaient loin de la zone visible. La couche desktop reporte ces calculs jusqu'à ce que le bloc approche du viewport.

### Monte-Carlo

La simulation et surtout les tris de percentiles pouvaient occuper le thread UI sur de gros runs. Le calcul est maintenant envoyé dans `src/renderer/workers/monte-carlo-worker.js` avec fallback automatique vers l'implémentation V206 si le Worker n'est pas disponible.

### Chart.js

Chart.js n'est plus chargé depuis un CDN au démarrage du journal. Le build copie la version npm 4.4.1 dans le renderer et désactive les animations de graphiques par défaut pour privilégier la réactivité.

### Bridge file:// historique

Le polling du bridge `file://` de compatibilité FXReplay a été ralenti. Le Desktop moderne utilise le bridge HTTP local et n'a pas besoin d'un polling très rapide sur ce canal historique.

## Points volontairement non réécrits dans 1.1

- Le modèle V206 conserve encore les screenshots sous forme de data URLs dans les objets métier. Une normalisation vers un store d'assets séparé pourrait réduire davantage le coût des `JSON.stringify`, mais nécessite une migration de données et mérite une version dédiée.
- Le moteur FXReplay V21 reste volontairement proche de la version validée. Son service worker contient encore un polling régulier vers le bridge desktop ; il pourra être rendu adaptatif après mesure sans toucher au parsing des trades.
- Les fonctions métier historiques du V206 ne sont pas toutes extraites en modules d'un coup. Elles seront déplacées progressivement quand une zone est modifiée, afin de ne pas créer une régression massive uniquement pour de l'esthétique de code.

## Règle de décision

Une optimisation est intégrée lorsqu'elle réduit du travail sur le thread UI, des écritures synchrones ou des réveils périodiques sans modifier le sens des données. Les refactorisations purement cosmétiques restent secondaires à la compatibilité et à la fluidité mesurable.
