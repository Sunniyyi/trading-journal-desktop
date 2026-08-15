# Architecture Desktop V1 — compatibilité d'abord

## Principe

Cette première transition évite de réécrire le cœur du journal :

- `src/renderer/trade-journal.html` = **V206 original**, inchangé fonctionnellement.
- Electron fournit la fenêtre desktop et une session persistante.
- FXReplay reste dans Chrome avec une variante **V21 Desktop Bridge**.
- L'ancien bridge `file://` est remplacé, dans l'application, par un serveur local limité à `127.0.0.1:17841`.

## Flux FXReplay

Chrome / FXReplay
→ extension V21 Desktop
→ HTTP localhost `127.0.0.1:17841`
→ process principal Electron
→ preload sécurisé
→ messages `FXR_IMPORT_TRADE`
→ logique V206 existante
→ ACK / erreur
→ extension

Cela conserve les fonctions éprouvées de V206/V21 tout en supprimant la dépendance à un onglet HTML `file://` ouvert dans Chrome.

## Sécurité Electron

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- bridge HTTP lié uniquement à `127.0.0.1`
- aucune API Node exposée directement au renderer

## Étape suivante (non appliquée en V1)

Une fois la parité fonctionnelle vérifiée, on pourra extraire progressivement le HTML monolithique en modules (`journal`, `backtest`, `mistakes`, `decision-gate`, `fxreplay`, etc.) sans modifier plusieurs systèmes à la fois.
