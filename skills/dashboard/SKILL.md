---
name: dashboard
description: Ouvre le tableau de suivi an-forge dans le navigateur : tous les projets, les tickets qui restent, ce que chaque ticket va faire et le déroulé de /build-ticket étape par étape. Utilise quand l'utilisateur veut voir, suivre ou comprendre où en sont ses projets ou ses tickets, ou demande /dashboard.
---

# Dashboard

Le tableau de suivi de tous les projets an-forge, dans une page web qui tourne sur la machine de l'utilisateur. Il ne fait que lire : il ne modifie rien, ni sur GitHub, ni dans les projets.

Les scripts cités sont dans le dossier `scripts/` à côté de ce fichier.

## Ouvrir le tableau

Lance `scripts/start.sh` depuis le dossier où tu travailles.

- Il démarre le tableau s'il ne tourne pas déjà, puis l'ouvre dans le navigateur.
- Lancé dans un projet an-forge, il ajoute ce projet à la liste suivie (ligne `project=`). Les projets où `/build-ticket` a tourné y sont déjà.
- Il affiche l'adresse (`url=`) : donne-la à l'utilisateur, au cas où le navigateur ne s'ouvre pas.

S'il échoue, dis pourquoi en une phrase avec son message (Node.js ou `gh` manquant, port déjà pris) et ce qu'il faut faire.

Pour arrêter le tableau : `scripts/stop.sh`.

## Ce que montre le tableau

Explique-le en quelques lignes si l'utilisateur l'ouvre pour la première fois :

- **Projets** (à gauche) : chaque projet est un dossier, chaque spec un sous-dossier, chaque ticket une ligne avec une icône d'état : en construction (bleu), à relire (jaune), arrêté (rouge), prêt, bloqué, mergé (vert).
- **Un ticket** : ce qu'il faut construire, la liste de ce qui va être fait (les critères d'acceptation, cochés dès qu'un test les prouve), et le déroulé de `/build-ticket`, chaque étape avec ce à quoi elle sert et ce qui s'y est passé.
- **Pour toi** : ce qui attend une décision de l'utilisateur (une PR à relire, un ticket arrêté).
- **Activité** : les dernières étapes, tous projets confondus.

La page se met à jour toute seule toutes les 5 secondes. GitHub est relu toutes les 20 secondes, ou tout de suite avec le bouton de rafraîchissement.

## D'où viennent les données

- La liste des projets : `~/.an-forge/projects`, un chemin par ligne. Pour retirer un projet, enlève sa ligne.
- Les specs, tickets et pull requests : GitHub, avec le compte de `gh`.
- Le déroulé et les critères cochés : le journal écrit par `/build-ticket`, `~/.an-forge/journal/<projet>/<ticket>.jsonl`. Un ticket construit avant ce journal n'a pas de déroulé.

Il faut Node.js 18 ou plus et `gh` connecté (`gh auth login`).
