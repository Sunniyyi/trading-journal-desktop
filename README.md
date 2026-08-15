# Trading Journal Desktop V1

Application desktop **compatibility-first** construite à partir du **Trade Journal V206** et du moteur **FXReplay V21**.

## Ce qui est conservé

Le renderer est le V206 original : Journal, Backtesting, calendrier, simulations, Mistake Analytics, Decision Gate, Scan TA, Contexte Marché, pages Backtest, setup par page, Risk fixe, screenshots, zoom, exports/imports, IndexedDB, sauvegardes, etc.

La migration desktop n'essaie volontairement pas de réécrire ces fonctions dans cette V1.

## Installation Windows (source)

1. Installe Node.js si nécessaire.
2. Décompresse ce projet.
3. Lance `scripts/INSTALLER_DEPENDENCIES_WINDOWS.bat`.
4. Lance `scripts/START_WINDOWS.bat`.

Pour fabriquer un installateur Windows : `scripts/BUILD_WINDOWS.bat`.

Electron Forge génèrera les fichiers dans `out/make/`.

## FXReplay

Installe l'extension située dans :

`extension/fxreplay-v21-desktop/`

Dans Chrome :

1. `chrome://extensions`
2. Mode développeur
3. **Charger l'extension non empaquetée**
4. Choisis le dossier `fxreplay-v21-desktop`

L'application doit être ouverte. L'extension communique avec elle uniquement via `http://127.0.0.1:17841`.

## Données existantes

Lis `docs/MIGRATION_V206.md` avant de basculer définitivement. Chrome et Electron n'utilisent pas le même stockage IndexedDB.

## Versions de base

- Renderer : Trade Journal V206
- FXReplay : V21 FAST, adapté uniquement pour le bridge desktop
- Electron : 43.2.0
- Electron Forge : 7.11.2

## Mises à jour automatiques

Le dépôt officiel est `Sunniyyi/trading-journal-desktop`. Les builds Windows sont générés par GitHub Actions et publiés dans GitHub Releases. L’application installée utilise `update.electronjs.org` avec Squirrel.Windows.

Pour publier une future version : modifier le code, augmenter `version` dans `package.json`, puis pousser sur `main`. Le workflow crée automatiquement la release avec `Setup.exe`, `RELEASES` et `*-full.nupkg`.
