# <Nom du projet>

<!-- Posé par /project-init (an-forge). « À REMPLIR » est complété par /project-init, « À DÉCIDER AVEC /project-launch » par /project-launch. -->

## Le projet

À DÉCIDER AVEC /project-launch : ce que fait le projet, pour qui, et sa stack en une ou deux phrases.

## L'utilisateur

À REMPLIR : développeur ou non, et comment lui parler.

## Workflow

<!-- an-forge:workflow : section gérée par an-forge. Ne la modifie pas : /project-init la remet à jour. -->
Ce projet suit an-forge. Le détail de chaque étape est dans les skills, pas ici.

- Une nouvelle idée ou une grosse évolution : `/project-launch`.
- Un bug, une retouche, un petit ajout : `/quick-ticket`.
- Construire un ticket `ready-for-agent` : `/build-ticket <numéro>`, dans une session neuve.
- Après le brief : l'utilisateur merge, ou demande un changement et `/build-ticket <numéro>` reprend la même pull request.
- Voir où en est le projet : `/project-dashboard`.
<!-- /an-forge:workflow -->

## Checks

`scripts/checks.sh` lance les tests, le lint, le typecheck et le build. Il doit passer avant toute pull request. GitHub le relance sur chaque pull request (`.github/workflows/checks.yml`). Ne modifie ni l'un ni l'autre pour faire passer une branche.

## Règles

- Ne commit jamais sur `main`. Ne force-push que sur ta propre branche, avec `--force-with-lease`.
- Ne merge pas sans demande explicite.
- Les textes destinés à des humains (commits, PR, docs) sont courts, précis et sans formules creuses.

À DÉCIDER AVEC /project-launch : les conventions propres au projet.
