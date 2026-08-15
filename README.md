# Trading Journal Desktop

Dépôt officiel de **Trading Journal Desktop**.

## Canal de mise à jour

- Interface de référence : **V206**
- Moteur FXReplay de référence : **V21**
- Plateforme : **Windows x64**
- Mises à jour : **GitHub Releases + Squirrel.Windows**

Le dépôt contient deux workflows GitHub Actions :

1. **Bootstrap desktop source** : sert une seule fois à extraire l’archive `desktop-source.zip` dans le dépôt.
2. **Build and publish Windows release** : vérifie le projet, construit `Setup.exe`, `RELEASES` et `*-full.nupkg`, puis crée automatiquement une GitHub Release.

Une fois le bootstrap terminé, les futures modifications peuvent être faites directement sur les fichiers du dépôt puis publiées sans demander de retélécharger manuellement tout le logiciel.

## Première initialisation

Déposer une seule fois à la racine du dépôt l’archive `desktop-source.zip` fournie pour la Desktop V1. Le workflow de bootstrap l’extrait, supprime l’archive du dépôt et pousse le projet. La publication Windows démarre ensuite automatiquement.

> Ne jamais publier ici de sauvegardes personnelles du journal, mots de passe, tokens, clés API ou autres données privées.
