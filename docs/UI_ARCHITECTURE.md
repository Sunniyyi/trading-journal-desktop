# Interface Desktop 2.1 — architecture UI

## Objectif

L'interface doit ressembler à un **logiciel de trading**, pas à une longue page web. Le code visuel reste séparé du moteur métier V206 : on peut déplacer, redessiner ou remplacer un workspace sans modifier les calculs, les imports ou le format des sauvegardes.

## Structure

`src/renderer/ui/` contient uniquement la couche Desktop.

- `tokens.css` — couleurs, rayons, espacements, dimensions et typographie. Modifier la DA commence ici.
- `shell.css` — navigation, barre de commandes, zone de travail, inspecteur et barre d'état.
- `components.css` — cartes, KPI, tableaux, boutons, formulaires, modales et palette de commandes.
- `workspaces.css` — dispositions propres aux écrans Journal, Backtesting, Scan, Contexte, Gate et Discipline.
- `config.js` — liste centrale des workspaces et leurs titres.
- `shell.js` — assemble l'application Desktop et route les vues historiques.
- `layout-controller.js` — préférences de disposition : sidebar réduite, inspecteur, largeur de l'inspecteur, densité et mode Focus.
- `inspector.js` — panneau contextuel droit, indépendant des workspaces.
- `command-palette.js` — palette `Ctrl+K`, navigation et commandes de disposition.
- `workspaces/*.js` — transformations DOM propres à un écran. Elles déplacent les nœuds existants sans changer leurs IDs.
- `lib/dom.js` — petites fonctions DOM communes.

## Workbench 2.1

Le shell peut maintenant changer de forme sans toucher aux données ou aux workspaces :

- `Ctrl+B` réduit / développe la navigation ;
- `Ctrl+Shift+E` affiche / masque l'inspecteur contextuel ;
- `Ctrl+Shift+F` active le mode Focus ;
- l'inspecteur est redimensionnable entre 286 et 480 px ;
- le choix de densité et la disposition sont persistés dans un petit objet `localStorage` dédié à l'UI ;
- sous les résolutions étroites, l'inspecteur devient un panneau superposé afin de ne pas écraser le workspace principal.

## Règles de modification

1. **Ne pas mettre de CSS de page dans `shell.js`.** Le visuel reste dans les feuilles CSS.
2. **Ne pas copier la logique métier V206 dans l'UI.** Une carte reflète une valeur existante ou appelle une fonction existante.
3. **Conserver les IDs historiques** quand un nœud est déplacé.
4. **Un workspace = un module** quand il nécessite du JavaScript spécifique.
5. Une nouvelle couleur, taille ou marge récurrente devient un token dans `tokens.css`.
6. Les grands tableaux et simulations défilent dans leur panneau ; on évite d'allonger toute l'application.
7. Les préférences visuelles restent dans `layout-controller.js`, pas dans les modules métier.
8. Aucun module UI ne doit grossir au-delà d'environ 40 Ko : `ui-architecture.test.js` bloque la dérive vers un nouveau monolithe.

## Compatibilité

Le renderer V206 reste reconstruit et vérifié par SHA-256. `renderer-transform.js` injecte ensuite les feuilles de style et `ui/bootstrap.js`. Les données IndexedDB/localStorage métier, les imports FX Replay et les fonctions historiques restent compatibles avec l'existant. Le stockage `tj-desktop-layout-v3` ne contient que des préférences d'affichage.
