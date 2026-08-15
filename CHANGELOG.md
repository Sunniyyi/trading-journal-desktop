# Changelog

## 2.1.1 — 2026-08-15

### Corrigé
- Scroll de l'inspecteur : le contenu et les raccourcis du bas restent accessibles.
- Inspecteur overlay : suppression de la zone invisible pouvant intercepter des clics sous 1280 px.
- Menu Outils : positionnement dynamique par rapport au bouton, y compris après resize/maximisation.
- Palette de commandes : remise à zéro de la sélection et maintien de l'élément actif dans la zone visible.
- Boutons : suppression des micro-sauts graphiques causés par l'animation hover globale.
- Responsive : réduction des risques d'overflow horizontal sur les fenêtres étroites.
- Fenêtre Electron : synchronisation avec la hauteur réellement disponible.
- Accessibilité : focus clavier visible et prise en charge de `prefers-reduced-motion`.

### Maintenance
- Ajout de `stability.css` et `stability-runtime.js` pour isoler les correctifs Desktop 2.1.x.
- Ajout de tests anti-régression vérifiant l'injection et la présence de ces couches.

## 2.1.0 — 2026-08-15

- Nouveau workbench Desktop modulaire.
- Inspecteur contextuel redimensionnable.
- Navigation, densité compacte et mode Focus.
- Palette de commandes et nouveaux contrôles desktop.
- Intégration conservant la compatibilité avec la base Trade Journal V206 et FXReplay V21.
