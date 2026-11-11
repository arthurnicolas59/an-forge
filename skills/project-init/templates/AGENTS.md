# <Nom du projet>

<!-- Posé par /project-init (an-forge). Les sections À REMPLIR sont complétées pendant /project-init. -->

## Le projet

À REMPLIR : ce que fait le projet, pour qui, et sa stack en une ou deux phrases.

## Workflow

### Niveau projet : la direction

Pour une nouvelle idée ou une grosse évolution, lance `/project-launch`. Il enchaîne, dans une seule conversation :

1. `grill-with-docs` : interroger l'idée jusqu'à ce qu'elle soit claire, en tenant `GLOSSARY.md` et les ADR à jour.
2. `to-spec` : publier la spec comme issue.
3. `to-tickets` : la découper en tickets `ready-for-agent`.

### Niveau feature : la réalisation

Pour construire un ticket `ready-for-agent`, lance `/build-ticket <numéro>` dans une session neuve. Il enchaîne, sans s'arrêter :

1. **Isoler** : une branche et un worktree à part, depuis le dernier `main`.
2. **Construire** : en TDD (`diagnosing-bugs` d'abord pour un bug), en suivant l'architecture existante.
3. **Tester** : `scripts/checks.sh` doit passer. Rien n'avance tant qu'il échoue.
4. **Relire** : un agent neuf relit le diff par rapport au ticket et aux règles de ce fichier.
5. **Résumer** : un brief d'une page, avec l'objectif, les changements et l'avant/après, dans `docs/briefs/`.
6. **Livrer** : une pull request. Ne merge pas sans accord.

## Checks

`scripts/checks.sh` lance les tests, le lint, le typecheck et le build. Il doit passer avant toute pull request. Ne le modifie pas pour faire passer une branche.

## Règles

- Ne commit jamais sur `main`. Ne force-push que sur ta propre branche, avec `--force-with-lease`.
- Ne merge pas sans demande explicite.
- Les textes destinés à des humains (commits, PR, docs) sont courts, précis et sans formules creuses.

À REMPLIR : les conventions propres au projet.
