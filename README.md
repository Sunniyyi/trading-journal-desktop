# Trading Journal Desktop

**Version actuelle : 2.1.1**

Application Windows construite à partir de **Trade Journal V206** et du moteur **FXReplay V21 FAST**, avec une architecture Electron dédiée aux évolutions desktop.

## Nouveautés 2.1.1

La version 2.1.1 est une mise à jour de stabilité graphique du workbench Desktop 2.1 :

- correction du scroll et de la zone utile de l'inspecteur ;
- correction du comportement de l'inspecteur en mode overlay sous 1280 px ;
- repositionnement fiable du menu Outils après resize/maximisation ;
- correction de la palette de commandes au clavier et maintien de la sélection visible ;
- suppression des micro-déplacements visuels provoqués par les hover globaux ;
- protection contre les débordements horizontaux sur les fenêtres étroites ;
- focus clavier visible et prise en charge de `prefers-reduced-motion` ;
- adaptation à la hauteur réelle de la fenêtre Electron ;
- ajout de garde-fous de tests pour les couches de stabilité 2.1.

## Principe de compatibilité

Le V206 original reste conservé comme base immuable dans `src/renderer-parts/`. Au build, `scripts/reconstruct-renderer.js` le reconstruit et vérifie son SHA-256 avant d'appliquer les transformations desktop définies dans `scripts/renderer-transform.js`.

Le fichier `src/renderer/trade-journal.html` est généré : **il ne doit pas être modifié directement**.

## Architecture

- `src/main.js` : fenêtre Electron, menus, IPC et bridge local FXReplay.
- `src/app-updater.js` : mises à jour Windows GitHub/Squirrel avec progression.
- `src/preload/` : bridge sécurisé et HUD de mise à jour, séparés en modules.
- `src/renderer/desktop-performance.js` : optimisations desktop sans changer le format des données.
- `src/renderer/ui/stability.css` : correctifs de stabilité visuelle Desktop 2.1.x.
- `src/renderer/ui/stability-runtime.js` : correctifs runtime de viewport, popovers et interactions UI.
- `src/renderer/workers/` : calculs lourds hors du thread de l'interface.
- `extension/fxreplay-v21-desktop/` : extension Chrome gérée par l'application.
- `docs/ENGINEERING.md` : règles pour les futures modifications.

## Performance desktop

La couche desktop privilégie IndexedDB pour les gros blocs de données, évite les écritures synchrones massives dans `localStorage`, reporte les analyses hors écran, utilise Chart.js localement et exécute Monte-Carlo dans un Web Worker.

## Développement Windows

```text
scripts\INSTALLER_DEPENDENCIES_WINDOWS.bat
scripts\START_WINDOWS.bat
```

Pour fabriquer l'installateur :

```text
scripts\BUILD_WINDOWS.bat
```

Les artefacts sont produits dans `out/make/`.

## FXReplay

L'application copie automatiquement l'extension embarquée dans un dossier stable sous `%APPDATA%\Trading Journal\FXReplay Extension`. Chrome charge ce dossier une seule fois ; les mises à jour suivantes de l'application peuvent remplacer les fichiers de l'extension et provoquer son rechargement automatique.

Le bridge application/extension écoute uniquement sur `127.0.0.1:17841`.

## Mises à jour

Les releases Windows sont générées automatiquement par GitHub Actions et publiées dans GitHub Releases avec `Setup.exe`, `RELEASES` et `*-full.nupkg`.

L'application interroge directement la release GitHub la plus récente, puis utilise Squirrel.Windows pour télécharger et installer la nouvelle version. La progression reste visible dans l'application pendant le téléchargement.

## Validation avant release

Le pipeline vérifie notamment :

- la syntaxe des modules Electron et de l'extension ;
- le bridge local ;
- le gestionnaire d'extension ;
- l'intégrité exacte de la base V206 ;
- les transformations desktop du renderer ;
- la présence des couches de stabilité graphique 2.1.x.

Une release n'est publiée que si ces contrôles réussissent.
