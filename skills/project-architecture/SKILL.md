---
name: project-architecture
description: Écrit ou met à jour ARCHITECTURE.md, la fiche qui explique à un non-initié comment le projet est construit : vue d'ensemble avec un schéma en boîtes de couleur, les technologies et à quoi sert chacune, et chaque dossier du projet expliqué. Utilise quand l'utilisateur veut comprendre ou documenter l'architecture du projet, demande une fiche architecture, ou demande /project-architecture ; ou quand project-init, project-launch ou build-ticket l'appelle.
---

# Project architecture

`ARCHITECTURE.md`, à la racine du projet, explique comment il est construit, pour quelqu'un qui ne lit pas le code. Il a trois parties :

1. **Vue d'ensemble** : une ou deux phrases, et un schéma en boîtes de couleur, de l'utilisateur jusqu'aux données.
2. **Les technologies** : un tableau, une ligne par partie du projet, avec à quoi elle sert.
3. **Les dossiers du projet** : l'arbre des dossiers, chacun avec une explication d'une ligne.

**Toi, tu écris le texte. Le script `scripts/architecture.py` (à côté de ce fichier) s'occupe de ce qui doit être exact** : il dessine l'arbre d'après les dossiers qui existent vraiment, garde les explications déjà écrites, marque « À EXPLIQUER » les nouveaux dossiers, et dit si la fiche est à jour. Ne dessine jamais l'arbre à la main.

Les agents lisent aussi cette fiche : une explication juste aide le prochain ticket à ranger son code au bon endroit.

## 0. Vérifier que le projet est prêt

Le projet doit avoir un `AGENTS.md` (posé par `project-init`). S'il n'en a pas, propose de lancer `project-init`, et arrête-toi là.

Travaille dans la branche où tu es appelé : celle du ticket depuis `build-ticket`, `main` depuis `project-init` ou `project-launch` (qui commitent la fiche avec le reste, après l'accord de l'utilisateur). Lancé seul par l'utilisateur, voir l'étape 5.

## 1. Voir où en est la fiche

Lance `python3 scripts/architecture.py check` depuis le projet :

- `architecture=missing` (code 3) : lance `python3 scripts/architecture.py init`, qui pose le modèle. Puis passe à l'étape 2.
- `architecture=stale` (code 1) : il liste ce qui manque. Traite seulement ces points (étapes 2 et 3).
- `architecture=ok` (code 0) : la fiche suit les dossiers. Vérifie seulement que la vue d'ensemble et les technologies disent encore vrai, si ton travail a ajouté une technologie ou une partie au projet. Sinon, rien à faire.

## 2. Écrire la vue d'ensemble et les technologies

Lis `AGENTS.md` (« Le projet » et sa stack), les ADR de `docs/adr/` et le code. Remplace chaque « À REMPLIR ».

**Vue d'ensemble.** Une ou deux phrases qui racontent ce qui se passe quand quelqu'un utilise le projet, puis le schéma, dans le bloc `mermaid` du modèle :

- De 2 à 6 boîtes, de gauche à droite, dans l'ordre où l'information circule, en partant de l'utilisateur.
- Chaque boîte : un emoji, un nom en mots de tous les jours en gras, puis ce qu'elle fait et sa technologie : `app["🖥️ <b>L'application</b><br/>Les écrans · Next.js"]`. Emojis utiles : 👤 utilisateur, 📱 téléphone, 🖥️ écrans, ⚙️ serveur, 🗄️ base de données, 🔐 connexion, ☁️ hébergement ou service extérieur, ✉️ e-mails, 💳 paiement.
- Les flèches : `<-->` quand l'information va et vient, avec un mot sur la flèche seulement s'il aide (`|"internet"|`).
- Une couleur par boîte, dans l'ordre : `class <id> c1`, puis `c2`, `c3`… Garde les lignes `classDef` du modèle.

**Les technologies.** Une ligne par partie : `Partie` en mots simples (Écrans, Serveur, Données, Connexion, Hébergement…), `Technologie` par son nom, `À quoi ça sert` en une phrase sans jargon.

Respecte la section « L'utilisateur » d'`AGENTS.md` : s'il n'est pas développeur, aucun terme technique sans explication, à part le nom des technologies.

N'invente rien. Si la stack n'est pas encore choisie, une boîte « 👤 Toi » et une boîte « 🧩 Le projet » (« Technologies pas encore choisies »), et une ligne de tableau qui le dit.

## 3. Expliquer les dossiers

Lance `python3 scripts/architecture.py tree`. Il redessine l'arbre et liste les dossiers nouveaux (`à expliquer`) et retirés.

Remplace chaque « À EXPLIQUER » par **ce qu'on range dans ce dossier**, en une ligne courte, en mots simples : « Les pages : une par adresse du site », « Les morceaux d'écran réutilisés partout (boutons, cartes…) ». Ne change rien d'autre dans l'arbre : ni les traits, ni les espaces, ni l'ordre. Une explication déjà écrite et toujours juste reste telle quelle.

Pour montrer un niveau de dossiers de plus (par exemple tout `src/`), change `profondeur=2` dans le marqueur, puis relance `tree`.

## 4. Vérifier

Relance `python3 scripts/architecture.py check` : il doit répondre `architecture=ok`. Sinon, traite ce qu'il liste.

## 5. Lancé seul par l'utilisateur

Sur `main`, ne commite pas directement. Crée une branche `docs/architecture`, commite `ARCHITECTURE.md`, pousse, et ouvre une pull request (sans ticket) avec ce que la fiche explique, en trois lignes. Dis à l'utilisateur de la lire sur GitHub, où le schéma s'affiche, puis de dire « merge la PR ». Pour merger, suis l'étape 11 du skill `build-ticket` (`merge-pr.sh`).

## Règles

- Ne dessine jamais l'arbre à la main : seul `tree` le dessine.
- Pas de chiffre, de date ni d'état d'avancement dans la fiche : elle décrit comment le projet est construit, pas où il en est (c'est le rôle de `/project-dashboard`).
- Une explication par dossier, une ligne, ce qu'on y range. Pas de liste de fichiers.
