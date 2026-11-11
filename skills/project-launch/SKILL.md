---
name: project-launch
description: Fait passer une idée de projet ou une grosse évolution jusqu'à des tickets prêts à construire, en enchaînant grill-with-docs, to-spec et to-tickets dans une seule conversation. Utilise quand l'utilisateur veut lancer un projet, cadrer une nouvelle idée ou une grosse évolution, ou demande /project-launch.
---

# Project launch

Enchaîne le niveau projet du workflow an-forge : de l'idée aux tickets `ready-for-agent`.
Les trois étapes se font **dans cette même conversation** : ne la vide pas et ne la résume pas avant la fin, la spec et les tickets s'appuient sur tout ce que l'interrogatoire a établi.

Pour lancer un skill depuis celui-ci, si ton outil ne sait pas le faire, lis son `SKILL.md` et suis-le.

## 0. Vérifier que le projet est prêt

Le projet doit avoir été préparé par `project-init` : un `AGENTS.md` sans « À REMPLIR », qui contient un bloc « Agent skills », et un fichier `docs/agents/issue-tracker.md`.
S'il manque quelque chose, propose de lancer `project-init` d'abord, et arrête-toi là.

Si l'utilisateur n'a pas encore décrit son idée, demande-lui de la raconter en quelques phrases.

## 1. Interroger

Lance le skill `grill-with-docs` sur l'idée.
Cette étape est finie quand il ne reste plus de question ouverte **et** que l'utilisateur confirme que vous êtes d'accord sur ce qu'il faut construire.

## 2. Écrire la spec

Demande : « Je publie la spec ? ». Attends un oui explicite.
Lance ensuite le skill `to-spec`. Donne à l'utilisateur le lien de l'issue créée.

## 3. Découper en tickets

Demande : « Je découpe la spec en tickets ? ». Attends un oui explicite.
Lance ensuite le skill `to-tickets` sur la spec qui vient d'être publiée.

## 4. Conclure

Liste les tickets créés, avec leur lien et ce qui les bloque, et indique ceux qui peuvent démarrer tout de suite.

Rappelle la suite : chaque ticket se construit **dans une session neuve**, un par un, jusqu'à une pull request.

## Règles

- Ne saute jamais un point d'arrêt : rien n'est publié sans le oui de l'utilisateur.
- Si l'utilisateur veut s'arrêter en route, résume où vous en êtes et ce qui reste à faire pour reprendre.
