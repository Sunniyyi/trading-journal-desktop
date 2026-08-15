# Mises à jour automatiques — Desktop V1

Cette édition garde **le renderer V206** et **le moteur FXReplay V21**. Elle ajoute uniquement l'infrastructure de distribution.

## Application

L'application utilise `electron.autoUpdater` quand elle est installée via le maker Squirrel.Windows.

Deux sources sont acceptées dans `%APPDATA%\Trading Journal\update-config.json` :

### Option recommandée : GitHub public

```json
{
  "enabled": true,
  "githubRepo": "Sunniyyi/trading-journal-desktop",
  "feedUrl": "",
  "checkIntervalMinutes": 10,
  "checkOnStartup": true
}
```

Le feed utilisé devient automatiquement :

`https://update.electronjs.org/OWNER/REPO/win32-x64/<version>`

Les builds Windows doivent être publiés dans **GitHub Releases**.

### Option alternative : stockage statique

Renseigne `feedUrl` avec un dossier HTTP(S) Squirrel contenant au minimum `RELEASES` et les `.nupkg`.

## Extension FXReplay

L'application copie automatiquement l'extension embarquée vers un dossier stable :

`%APPDATA%\Trading Journal\FXReplay Extension`

**Une seule fois**, charge ce dossier dans `chrome://extensions` avec **Charger l'extension non empaquetée**.

Ensuite :

1. une mise à jour de Trading Journal contient aussi la nouvelle extension ;
2. au démarrage, l'application remplace les fichiers dans le dossier stable ;
3. l'ancienne extension voit via `127.0.0.1:17841` qu'une version plus récente est prête ;
4. elle appelle `chrome.runtime.reload()` ;
5. Chrome recharge les nouveaux fichiers sans réinstallation manuelle.

Le moteur `fxreplay-content.js` et `fxreplay-runtime-hook.js` restent ceux de V21 dans cette première version auto-update.

## Limite importante

L'application ne peut pas recevoir de nouvelles versions depuis ChatGPT sans **une source permanente de releases**. Le dépôt officiel est maintenant préconfiguré sur `Sunniyyi/trading-journal-desktop` et les releases sont publiées automatiquement par GitHub Actions.

Après cette configuration initiale, l'utilisateur n'a plus à télécharger manuellement chaque ZIP/EXE de mise à jour.
