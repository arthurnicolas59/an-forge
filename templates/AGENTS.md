# <Nom du projet>

<!-- Modèle an-forge. Copie ce fichier à la racine du projet et remplis les sections À REMPLIR.
     Puis lance /setup-matt-pocock-skills AVANT de créer CLAUDE.md (il écrit dans CLAUDE.md s'il existe).
     Enfin, crée CLAUDE.md avec une seule ligne : @AGENTS.md -->

## Le projet

À REMPLIR : ce que fait le projet, pour qui, et sa stack en une ou deux phrases.

## Workflow

### Niveau projet : la direction

Pour une nouvelle idée ou une grosse évolution, dans une seule conversation :

1. `/grill-with-docs` : interroger l'idée jusqu'à ce qu'elle soit claire, en tenant `CONTEXT.md` et les ADR à jour.
2. `/to-spec` : publier la spec comme issue.
3. `/to-tickets` : la découper en tickets `ready-for-agent`.

### Niveau feature : la réalisation

Chaque ticket suit ces étapes, dans l'ordre, dans une session neuve.

1. **Lire** : lis le ticket, la spec dont il dépend, `CONTEXT.md` et les ADR concernés.
2. **Isoler** : travaille sur une branche dédiée (un worktree par tâche si plusieurs agents travaillent en parallèle). Jamais directement sur `main`.
3. **Construire** : en TDD, une petite tranche à la fois, en suivant l'architecture existante.
4. **Prouver** : lance les checks ci-dessous. Pour un changement visible, montre l'état avant et après.
5. **Relire** : relis le diff par rapport à la spec et aux règles de ce fichier.
6. **Livrer** : ouvre une pull request avec la preuve. Ne merge pas sans accord.

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
