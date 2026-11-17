# Format long

Ce que chaque niveau ajoute au format court quand l'utilisateur demande `--long` (ou une partie en détail). Les règles de `SKILL.md` (fiabilité, style, relecture, lecture seule) s'appliquent sans changement. Il n'y a pas de limite de lignes ; si une partie devient trop longue, résume-la et propose de l'approfondir.

## Niveau 1

Identique au format court.

## Niveau 2

Le parcours, les composants et leurs liens sans limite de nombre. En plus, pour chaque technologie importante (pas pour chaque dépendance) :

- son rôle général, en une demi-phrase ;
- son usage concret ici, avec le fichier ou la configuration qui le montre ;
- pourquoi elle est là : cite la source (ADR, `AGENTS.md`, `ARCHITECTURE.md`). Sans source, écris « raison non documentée » ;
- ce qu'impliquerait de la remplacer ou de la retirer, d'après les imports et la configuration que tu as lus. Les alternatives citées viennent des documents ou du code.

## Niveau 3

3 à 5 évolutions. Pour chacune :

1. **Ce que tu veux modifier**, en une phrase.
2. **Où intervenir** : le fichier ou dossier principal.
3. **Son rôle exact** et pourquoi c'est là qu'on agit.
4. **Autres fichiers concernés** : ceux qui devront probablement suivre (types, routes, tests, configuration).
5. **À réutiliser** : composants, fonctions ou modèles existants, avec leur nom et leur fichier.
6. **Vérifications** : les tests existants qui couvrent cette zone (nomme-les), la commande qui les lance si elle est déclarée, et ce qu'il faut contrôler à la main.
7. **Précautions** : ce qui peut casser ailleurs, les données ou la configuration sensibles.

Puis 5 à 10 fichiers importants.

## Niveau 4

Tous les points de la liste du niveau 4, et la synthèse de fiabilité en quatre lignes séparées.
