# Interface Desktop 2.0 — architecture UI

## Objectif

L'interface 2.0 doit ressembler à un **logiciel de trading**, pas à une longue page web. Le code visuel est donc séparé du moteur métier V206 : on peut déplacer, redessiner ou remplacer un workspace sans modifier les calculs, les imports ou le format des sauvegardes.

## Structure

`src/renderer/ui/` contient uniquement la nouvelle couche d'interface.

- `tokens.css` — couleurs, rayons, espacements, dimensions et typographie. Modifier la DA commence ici.
- `shell.css` — fenêtre logique : navigation gauche, barre de commandes, zone de travail et barre d'état.
- `components.css` — cartes, KPI, tableaux, boutons, formulaires, modales et palette de commandes.
- `workspaces.css` — dispositions propres aux écrans Journal, Backtesting, Scan, Contexte, Gate et Discipline.
- `config.js` — liste centrale des workspaces et leurs titres. Ajouter une entrée de navigation ne doit pas nécessiter d'éditer plusieurs fichiers.
- `shell.js` — assemble l'application Desktop et route les anciennes vues V206.
- `command-palette.js` — palette `Ctrl+K`.
- `workspaces/*.js` — transformations DOM propres à un écran. Elles déplacent les nœuds existants sans changer leurs IDs, afin que les fonctions V206 continuent de fonctionner.
- `lib/dom.js` — petites fonctions DOM communes.

## Règles de modification

1. **Ne pas mettre de CSS de page dans `shell.js`.** Le visuel reste dans les feuilles CSS.
2. **Ne pas copier la logique métier V206 dans l'UI.** Une carte doit refléter une valeur existante ou appeler une fonction existante.
3. **Conserver les IDs historiques** quand un nœud est déplacé : les fonctions V206 le retrouvent ainsi sans adaptation.
4. **Un workspace = un module** quand il nécessite du JavaScript spécifique.
5. Une nouvelle couleur, taille ou marge récurrente doit devenir un token dans `tokens.css`.
6. Les grands tableaux et simulations défilent dans leur panneau ; on évite d'allonger toute l'application.
7. Aucun module UI ne doit grossir au-delà d'environ 40 Ko : le test `ui-architecture.test.js` bloque la dérive vers un nouveau monolithe.

## Compatibilité

Le renderer V206 reste reconstruit et vérifié par SHA-256. `renderer-transform.js` injecte ensuite les feuilles de style et `ui/bootstrap.js`. Les données IndexedDB/localStorage, les imports FX Replay et les fonctions métier restent donc compatibles avec l'existant.
