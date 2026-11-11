---
name: project-launch
description: Fait passer une idée de projet ou une grosse évolution jusqu'à des tickets prêts à construire, en enchaînant grill-with-docs, le choix de la stack, to-spec et to-tickets dans une seule conversation. Utilise quand l'utilisateur veut lancer un projet, cadrer une nouvelle idée ou une grosse évolution, ou demande /project-launch.
---

# Project launch

Enchaîne le niveau projet du workflow an-forge : de l'idée aux tickets `ready-for-agent`.
Toutes les étapes se font **dans cette même conversation** : ne la vide pas et ne la résume pas avant la fin, la spec et les tickets s'appuient sur tout ce que l'interrogatoire a établi.

Pour lancer un skill depuis celui-ci, si ton outil ne sait pas le faire, lis son `SKILL.md` et suis-le.

Respecte tout du long la section « L'utilisateur » d'`AGENTS.md`, y compris dans les skills lancés d'ici : si l'utilisateur n'est pas développeur, aucune question technique brute, mais une recommandation expliquée simplement, à valider.

## 0. Vérifier que le projet est prêt

Le projet doit avoir été préparé par `project-init` : un `AGENTS.md` sans « À REMPLIR », qui contient un bloc « Agent skills », et un fichier `docs/agents/issue-tracker.md`. Des « À DÉCIDER AVEC /project-launch » sont normaux : ce skill les remplit à l'étape 2.
S'il manque quelque chose, propose de lancer `project-init` d'abord, et arrête-toi là.

Si l'utilisateur n'a pas encore décrit son idée, demande-lui de la raconter en quelques phrases.

## 1. Interroger

Lance le skill `grill-with-docs` sur l'idée.
Cette étape est finie quand il ne reste plus de question ouverte **et** que l'utilisateur confirme que vous êtes d'accord sur ce qu'il faut construire.

## 2. Fixer le cadre du projet

Seulement s'il reste des « À DÉCIDER AVEC /project-launch » dans `AGENTS.md`, ou si `scripts/checks.sh` contient encore « À REMPLIR ».

1. **La stack**, si l'interrogatoire ne l'a pas déjà fixée. Choisis-la à partir de ce que l'utilisateur veut faire, pas l'inverse. Présente deux ou trois options, chacune avec ses forces et ses faiblesses en une ligne, en mots simples (coût, simplicité, hébergement, ce qu'elle permet plus tard). Puis donne ta recommandation et pourquoi. Attends la validation. Note le choix dans un ADR.
2. **`AGENTS.md`** : remplace les « À DÉCIDER AVEC /project-launch ». Dans « Le projet », mets ce qu'il fait, pour qui, et sa stack. Dans « Règles », mets les conventions qui découlent de la stack, sans en inventer d'autres.
3. **`scripts/checks.sh`** : remplace ses deux dernières lignes par les commandes de tests, lint, typecheck et build prévues pour cette stack, et retire le commentaire « À REMPLIR ». Elles n'existent peut-être pas encore : le premier ticket les mettra en place (étape 4).

Montre en quelques lignes ce que tu as rempli. Puis demande : « Je commite et je pousse ces fichiers sur main ? » (`AGENTS.md`, `scripts/checks.sh`, `GLOSSARY.md`, les ADR). Attends un oui explicite. Chaque ticket part du `main` de GitHub : sans ce push, il ne verrait ni la stack, ni les checks, ni le glossaire.

## 3. Écrire la spec

Demande : « Je publie la spec ? ». Attends un oui explicite.
Lance ensuite le skill `to-spec`. Si l'utilisateur n'est pas développeur, les points de test se présentent comme une recommandation à valider, en disant ce que chaque test vérifie du point de vue de l'utilisateur.

La spec n'est pas un ticket : elle ne doit pas porter l'étiquette `ready-for-agent`. Si elle l'a, retire-la.

## 4. Découper en tickets

Demande : « Je découpe la spec en tickets ? ». Attends un oui explicite.
Lance ensuite le skill `to-tickets` sur la spec qui vient d'être publiée. Chaque ticket doit être une sous-issue de la spec.

Pour un projet neuf, le premier ticket est le **socle** : il crée le projet avec sa stack et rend `scripts/checks.sh` vert. Tous les autres tickets en dépendent.

## 5. Conclure

Présente le résultat en séparant clairement la spec et les tickets, par exemple :

> **La spec : #1.** C'est le document de référence. Elle ne se construit pas : elle se fermera toute seule quand son dernier ticket sera mergé.
>
> **Les tickets, à construire :**
> - #2 Socle : peut démarrer tout de suite
> - #3 Profil de goûts : attend #2
> - #4 Idées du soir : attend #2 et #3

Rappelle la suite : chaque ticket se construit **dans une session neuve**, un par un, avec `/build-ticket <numéro>`, ou `/build-ticket` seul pour qu'il propose le prochain ticket prêt.

## Règles

- Ne saute jamais un point d'arrêt : rien n'est publié ni poussé sans le oui de l'utilisateur.
- Si l'utilisateur veut s'arrêter en route, résume où vous en êtes et ce qui reste à faire pour reprendre.
