---
name: project-init
description: Prépare un repo pour la software factory an-forge, qu'il soit neuf ou existant : AGENTS.md rempli, configuration des skills (issues GitHub, docs), étiquettes GitHub et CLAUDE.md. Utilise quand l'utilisateur veut initialiser, préparer ou configurer un projet pour an-forge, ou demande /project-init.
---

# Project init

Prépare le repo courant pour qu'il soit prêt à suivre le workflow an-forge. À la fin, le projet a :

- un `AGENTS.md` rempli, qui contient les règles et le workflow ;
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

Si tout est déjà en place (`agents_md=filled`, `skills_setup=yes`, `claude_md=import-only`), dis-le et ne refais que ce qui manque.

## 2. Poser le modèle

Lance `scripts/install-template.sh`. Il copie le modèle `AGENTS.md` sans jamais écraser un fichier existant. Si `AGENTS.md` existait déjà, garde son contenu et ajoute seulement les sections du modèle qui lui manquent, avec l'accord de l'utilisateur.

## 3. Remplir AGENTS.md

Remplace chaque « À REMPLIR » :

- **Le projet** : ce qu'il fait, pour qui, sa stack.
- **Checks** : les commandes réelles de tests, lint, typecheck et build. Retire celles qui n'existent pas.
- **Règles** : les conventions propres au projet.

Déduis tout ce que tu peux du repo (README, `package.json`, `pyproject.toml`, `Makefile`, CI, code). Ne demande à l'utilisateur que ce que le repo ne dit pas, en une seule série de questions. Pour un repo vide, demande ce que sera le projet et sa stack prévue.

Montre les sections remplies et attends l'accord. Il ne doit plus rester aucun « À REMPLIR ».

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

Résume ce qui a été créé ou modifié, puis relance `scripts/inspect.sh` pour vérifier : `agents_md=filled`, `skills_setup=yes`, `claude_md=import-only`.

Propose de commiter ces fichiers, sans le faire sans accord. Indique l'étape suivante : `/project-launch` pour passer de l'idée aux tickets.
