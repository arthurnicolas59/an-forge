# <Nom du projet>

<!-- Modèle an-forge. Copie ce fichier à la racine du projet, puis remplis les sections marquées À REMPLIR.
     Pour Claude Code, ajoute un CLAUDE.md qui contient seulement : @AGENTS.md -->

## Le projet

À REMPLIR : ce que fait le projet, pour qui, et sa stack en une ou deux phrases.

## Workflow

Chaque changement suit ces étapes, dans l'ordre.

1. **Aligner** : avant de coder, pose des questions jusqu'à ce que la demande soit claire.
2. **Planifier** : écris une spec courte, puis découpe-la en tâches.
3. **Isoler** : travaille sur une branche dédiée (un worktree par tâche si plusieurs agents travaillent en parallèle). Jamais directement sur `main`.
4. **Construire** : en TDD, une petite tranche à la fois, en suivant l'architecture existante.
5. **Prouver** : lance les checks ci-dessous. Pour un changement visible, montre l'état avant et après.
6. **Relire** : relis le diff par rapport à la spec et aux règles de ce fichier.
7. **Livrer** : ouvre une pull request avec la preuve. Ne merge pas sans accord.

## Checks

À REMPLIR : les commandes qui doivent passer avant toute pull request.

```bash
# tests
# lint
# typecheck
# build
```

## Règles

- Ne commit jamais sur `main`. Ne force-push que sur ta propre branche, avec `--force-with-lease`.
- Ne merge pas sans demande explicite.
- Les textes destinés à des humains (commits, PR, docs) sont courts, précis et sans formules creuses.

À REMPLIR : les conventions propres au projet.
