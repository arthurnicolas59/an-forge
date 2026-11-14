---
name: project-init
description: Prépare un repo pour la software factory an-forge, qu'il soit neuf ou existant : AGENTS.md rempli, configuration des skills (issues GitHub, docs), étiquettes GitHub et CLAUDE.md. Utilise quand l'utilisateur veut initialiser, préparer ou configurer un projet pour an-forge, ou demande /project-init.
---

# Project init

Prépare le repo courant pour qu'il soit prêt à suivre le workflow an-forge. À la fin, le projet a :

- un `AGENTS.md` qui contient les règles, le workflow et la façon de parler à l'utilisateur ;
- un `scripts/checks.sh` : le gate que `build-ticket` lance avant toute relecture, rempli tout de suite si le projet a déjà du code, sinon par `/project-launch` ;
- un `.github/workflows/checks.yml` : il fait relancer `scripts/checks.sh` par GitHub sur chaque pull request, et la branche `main` est protégée quand GitHub le permet ;
- la configuration des skills (`docs/agents/`) et un bloc « Agent skills » dans `AGENTS.md` ;
- les étiquettes GitHub utilisées par les tickets ;
- un `CLAUDE.md` qui contient une seule ligne : `@AGENTS.md`.

Les scripts cités sont dans le dossier `scripts/` à côté de ce fichier. Lance-les depuis la racine du projet.

**L'ordre compte.** Le skill `setup-matt-pocock-skills` écrit sa configuration dans `CLAUDE.md` si ce fichier existe, sinon dans `AGENTS.md`. `CLAUDE.md` doit donc être absent pendant l'étape 4 et n'être créé qu'à l'étape 6.

## 1. Inspecter

Lance `scripts/inspect.sh` et lis son résultat. Règle chaque point avant de continuer :

- `git=no` : propose `git init -b main` et attends l'accord.
- `gh_auth=no` : demande à l'utilisateur de lancer lui-même `gh auth login`. Ne manipule jamais ses identifiants.
- `github=none` : demande s'il veut créer le repo GitHub (privé par défaut) avec `gh repo create <nom> --private --source . --remote origin`. S'il refuse, le projet utilisera des tickets en fichiers markdown locaux à l'étape 4, et l'étape 5 sera sautée.
- `claude_md=import-only` : lance `scripts/claude-md.sh remove-import`. Il sera recréé à l'étape 6.
- `claude_md=custom` : montre son contenu à l'utilisateur et propose de le déplacer dans `AGENTS.md` (à l'étape 3), puis de supprimer `CLAUDE.md`. Ne continue pas tant que `CLAUDE.md` existe.

Si tout est déjà en place (`agents_md` vaut `filled` ou `launch-pending`, `missing_sections` vide, `skills_setup=yes`, `claude_md=import-only`, `ci` différent de `absent`), dis-le, lance quand même `scripts/protect-main.sh` (étape 7) si le projet est sur GitHub, et arrête-toi. Sinon, ne refais que ce qui manque.

## 2. Poser le modèle

Lance `scripts/install-template.sh`. Il copie les modèles `AGENTS.md`, `scripts/checks.sh` et `.github/workflows/checks.yml`, sans jamais écraser un fichier existant. Si `AGENTS.md` existait déjà, garde son contenu et ajoute seulement les sections que `missing_sections` liste, à la même place que dans le modèle. N'ajoute pas une section qui existe déjà sous un autre nom (par exemple « Commandes » pour « Checks »). Une section ajoutée arrive avec son marqueur, rempli à l'étape 3 : pour « L'utilisateur », c'est la question « Êtes-vous développeur ? ».

## 3. Remplir AGENTS.md et checks.sh

**Ne pose aucune question sur le projet** : ce qu'il fera et sa stack se décident pendant `/project-launch`.

**L'utilisateur** : c'est la seule question de cette étape. Demande « Êtes-vous développeur ? » et remplace la section « L'utilisateur » par l'un de ces deux textes :

- Non : « L'utilisateur n'est pas développeur. Pour toute question technique (stack, tests, architecture, outils), ne pose pas la question brute : explique l'enjeu en une phrase simple, donne ta recommandation avec ses forces et ses faiblesses, résume les autres options en une ligne chacune, et demande seulement de valider. Explique chaque terme technique la première fois, avec une image de tous les jours. »
- Oui : « L'utilisateur est développeur : les questions techniques peuvent lui être posées directement, avec ta recommandation. »

Le reste dépend de `code` :

- **`code=yes`** (le projet a déjà du code) : déduis du repo (README, `package.json`, `pyproject.toml`, `Makefile`, CI, code) ce qu'il fait, pour qui, sa stack et ses conventions. Remplace les « À DÉCIDER AVEC /project-launch » de « Le projet » et de « Règles ». Remplis `scripts/checks.sh` : remplace ses deux dernières lignes par les commandes réelles de tests, lint, typecheck et build, dans cet ordre, retire celles qui n'existent pas et retire le commentaire « À REMPLIR ». Si le projet a déjà un script qui fait tout (`make check`…), appelle-le. Lance ensuite `scripts/checks.sh` une fois : s'il échoue, montre l'erreur à l'utilisateur. Remplis aussi `.github/workflows/checks.yml` si `ci=to-fill` : à l'endroit indiqué, ajoute l'installation des outils dont `scripts/checks.sh` a besoin (le langage et sa version, le cache des dépendances), puis retire le commentaire « À REMPLIR ». Ne renomme pas le job `checks`. Si le projet a déjà un workflow qui lance ses tests, garde-le tel quel. Ce que le repo ne dit pas reste « À DÉCIDER AVEC /project-launch ».
- **`code=no`** (projet neuf) : remplace seulement `<Nom du projet>` par le nom du dossier. Laisse « Le projet », « Règles », `scripts/checks.sh` et `.github/workflows/checks.yml` tels quels : `/project-launch` les remplira une fois l'idée et la stack choisies.

Il ne doit plus rester aucun « À REMPLIR » dans `AGENTS.md`. Montre en quelques lignes ce que tu as rempli.

## 4. Configurer les skills

Lance le skill `setup-matt-pocock-skills` (si ton outil ne sait pas lancer un skill depuis un autre, lis son `SKILL.md` et suis-le). Réponses par défaut à proposer :

- outil de tickets : GitHub si `github` est un repo, sinon markdown local ;
- docs : un seul contexte (`GLOSSARY.md` et `docs/adr/` à la racine).

Vérifie à la fin que son bloc « Agent skills » est bien dans `AGENTS.md`.

## 5. Créer les étiquettes

Si les tickets sont sur GitHub, lance `scripts/create-labels.sh`. Sans l'étiquette `ready-for-agent`, la publication des tickets échoue.

## 6. Créer CLAUDE.md

Lance `scripts/claude-md.sh write`.

## 7. Conclure

Résume ce qui a été créé ou modifié, puis relance `scripts/inspect.sh` pour vérifier : `agents_md` vaut `filled` ou `launch-pending`, `skills_setup=yes`, `claude_md=import-only`. Pour un projet neuf, `checks=to-fill` et `ci=to-fill` sont normaux à ce stade.

Propose de commiter ces fichiers sur `main` **et de les pousser**, sans le faire sans accord : chaque ticket part du `main` de GitHub, il doit donc avoir ces fichiers.

Une fois le push fait, si le projet est sur GitHub, lance `scripts/protect-main.sh` et lis sa première ligne :

- `protection=on` ou `already` : GitHub refuse de merger une pull request tant que ses checks ne sont pas verts. Dis-le en une phrase.
- `protection=unavailable` : GitHub ne protège pas un repo privé avec un compte gratuit. Explique-le simplement : les checks tournent quand même sur chaque pull request et `/build-ticket` les respecte, mais le bouton « Merge » de GitHub ne vérifie rien. Ne propose pas de rendre le repo public.
- `protection=no-branch` : le push n'a pas été fait. Dis qu'il suffira de relancer `/project-init` après le premier push.

Indique l'étape suivante : `/project-launch` pour passer de l'idée aux tickets.
