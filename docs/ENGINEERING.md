# Architecture de développement — Trading Journal Desktop

## Principe

Le projet ne modifie pas directement le gros fichier HTML généré. La base fonctionnelle **Trade Journal V206** reste conservée comme source immuable dans `src/renderer-parts/`.

Au build :

1. `scripts/reconstruct-renderer.js` reconstruit le V206 original ;
2. son SHA-256 est vérifié contre `6d988e41e5c1b94848ae67d4c88a2fedaa499cf04603b12164d6ace80540cff6` ;
3. `scripts/renderer-transform.js` applique uniquement des transformations desktop explicites et testables ;
4. le résultat généré devient `src/renderer/trade-journal.html` ;
5. les optimisations desktop additionnelles vivent dans des fichiers JS séparés et lisibles.

Cette organisation permet de garder la compatibilité avec les données V206 tout en rendant les évolutions desktop beaucoup plus simples à relire et à annuler.

## Modules principaux

### `src/main.js`

Process Electron principal : fenêtre, menu, IPC, bridge FXReplay et démarrage des services. Il ne contient pas la logique métier du journal.

### `src/app-updater.js`

Moteur de mise à jour Windows : recherche GitHub, téléchargement Squirrel avec progression, état de la mise à jour et redémarrage.

### `src/preload.js`

Petit orchestrateur sécurisé entre Electron et la page. La logique est séparée dans :

- `src/preload/page-bridge.js` : communication V206 / FXReplay / Electron ;
- `src/preload/update-hud.js` : interface de progression des mises à jour.

### `src/renderer/desktop-performance.js`

Couche d'optimisation chargée après le V206. Elle ne change pas le format des sauvegardes.

Elle apporte notamment :

- IndexedDB prioritaire pour les gros blocs JSON ;
- suppression des écritures synchrones géantes dans `localStorage` ;
- fusion des écritures IndexedDB successives sur une même clé ;
- calcul des analyses lourdes uniquement lorsqu'elles approchent de la zone visible ;
- désactivation des animations Chart.js coûteuses ;
- Monte-Carlo exécuté dans un Web Worker.

### `src/renderer/workers/monte-carlo-worker.js`

Exécute la simulation et les tris de percentiles hors du thread UI afin que l'application reste interactive pendant les gros calculs.

### `extension/fxreplay-v21-desktop/`

Extension Chrome gérée automatiquement par l'application. Le moteur de capture V21 reste conservé ; les adaptations desktop doivent rester isolées et minimales.

## Règles pour les futures modifications

1. Ne jamais éditer manuellement `src/renderer/trade-journal.html` : il est généré.
2. Pour une petite adaptation du V206, ajouter une transformation déterministe dans `scripts/renderer-transform.js` ou une couche séparée.
3. Pour une nouvelle fonction desktop, préférer un module dédié plutôt qu'ajouter du code dans `preload.js` ou `main.js`.
4. Les calculs pouvant dépasser quelques dizaines de millisecondes doivent être déportés dans un Worker quand c'est possible.
5. Éviter les intervalles rapides permanents ; préférer événements, debounce, `requestIdleCallback` ou polling adaptatif.
6. Ne jamais faire de gros `JSON.stringify` + `localStorage.setItem` dans une interaction utilisateur.
7. Toute transformation de la base V206 doit être couverte par `tests/renderer-transform.test.js`.
8. Le build doit échouer si le hash V206 change sans décision explicite.

## Objectif

Le V206 devient une **base de compatibilité**, pas une contrainte d'architecture. Les évolutions desktop sont lisibles, modulaires et peuvent progressivement remplacer les zones anciennes sans casser les sauvegardes existantes.
