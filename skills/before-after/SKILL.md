---
name: before-after
description: Capture les mêmes écrans avant et après un changement visible, pour montrer l'évolution côte à côte. Utilise quand l'utilisateur veut des captures avant/après, une comparaison visuelle ou des preuves d'un changement d'interface, ou quand build-ticket l'appelle.
---

# Before / after

Capture les mêmes écrans, de la même façon, avant et après un changement. Les deux séries d'images se comparent ensuite côte à côte.

Le script cité est dans le dossier `scripts/` à côté de ce fichier : `scripts/capture.sh <url> <fichier.png> [--size LxH] [--mobile] [--full]`. Il a besoin de Node.js 20 ou plus. Sans Node, utilise l'outil de capture de ton navigateur, à la même taille pour l'avant et l'après.

## Entrées

- **Le changement** : ce qu'il modifie à l'écran (un ticket, une description).
- **Le dossier** où ranger les images. Par défaut, `docs/briefs/<ticket>-<titre-court>/`.

## 0. Décider s'il y a quelque chose à capturer

Ne capture que si le changement se voit : une page, un composant, un e-mail, un rapport. Pour une API, un calcul ou un script, dis « pas de changement visible » et arrête-toi : l'avant/après sera le test qui échoue puis passe, pas une image.

## 1. Choisir les écrans

Choisis **deux écrans au plus**, ceux où le changement se voit le mieux. Donne à chacun un nom court en kebab-case (`liste-calculs`, `page-accueil`). Note pour chacun l'URL, et `--mobile` si le changement concerne le téléphone.

Choisis aussi une taille de fenêtre (`--size`) qui cadre sur ce qui change : si l'écran utile n'occupe qu'un coin d'une fenêtre de 1280x800, réduis-la (par exemple `--size 900x560`). Garde la même taille pour l'avant et l'après.

Pour une nouvelle page qui n'existe pas encore, capture l'endroit où elle apparaîtra (le menu, la page d'où l'on y accède).

## 2. Capturer l'avant

**Avant toute modification du code**, lance l'application depuis le dossier de travail (la commande est dans `AGENTS.md` ou le README). Choisis un port libre : un autre worktree peut déjà utiliser le port habituel. Vérifie que c'est bien ton application qui répond.

Pour chaque écran : `scripts/capture.sh <url> <dossier>/avant-<nom>.png --size <taille>`.

Arrête l'application ensuite.

## 3. Capturer l'après

Une fois le changement fini et les checks passés, relance l'application de la même façon, avec les mêmes données.

Pour chaque écran : `scripts/capture.sh <url> <dossier>/apres-<nom>.png`, avec les mêmes options que pour l'avant.

## 4. Vérifier

Regarde chaque image. Recommence si une image montre une page d'erreur, un écran de connexion, un chargement en cours, ou un autre écran que celui voulu.

Aucune image ne doit montrer de secret ni de vraie donnée personnelle : utilise les données de développement.

## Règles

- Mêmes écrans, même taille et mêmes données avant et après : sinon la comparaison ne veut rien dire.
- N'envoie jamais les images vers un site extérieur. Elles restent dans le projet.
- Garde les images légères : pas de `--full` sauf si le changement est en bas de la page.
