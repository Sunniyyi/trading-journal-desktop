FXReplay → Trade Journal Sync v21 FAST

Objectif : enregistrement principal <10 secondes.

- Trade sauvegardé dès que les champs obligatoires sont complets.
- Screenshots ajoutés ensuite par upsert, sans bloquer le 100 %.
- Bridge : 800 ms -> 150 ms.
- Lecture Details : démarrage 80 ms, puis scans rapides toutes les 450 ms.
- Mutation DOM : 500 ms -> 90 ms.
- Progression monotone : un WebSocket à 8 % ne peut plus faire redescendre une
  progression déjà avancée.
- Chronomètre visible dans le site et le popup.

Attendu : souvent 1–3 s une fois Details disponible.
Le seul cas qui peut dépasser 10 s est si FX Replay ne fournit pas encore les
données de clôture nécessaires.
