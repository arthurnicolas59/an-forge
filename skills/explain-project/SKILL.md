---
name: explain-project
description: Explique un projet existant à quelqu'un qui a quelques bases mais ne veut pas lire tout le code, en lecture seule et dans la conversation : à quoi il sert, son architecture, comment une demande le traverse, ses technologies, ses fichiers importants, ses points de vigilance et par où commencer. Utilise quand l'utilisateur demande /explain-project, veut comprendre ce que Claude a construit ou un projet qu'il ne connaît pas.
---

# Explain project

Une explication pédagogique du projet, donnée dans la conversation, pour quelqu'un qui a quelques bases en développement et veut comprendre sans tout lire.

**Ce skill ne modifie rien.** C'est sa règle principale (voir « Lecture seule »).

## Ce que les autres skills font déjà

Ne refais pas leur travail, lis ce qu'ils ont produit :

- `AGENTS.md` : le but du projet, sa stack, ses règles.
- `ARCHITECTURE.md` : vue d'ensemble, technologies et dossiers, déjà expliqués (fiche écrite par `project-architecture`).
- `docs/adr/` : les décisions prises et leurs raisons. `GLOSSARY.md` : le vocabulaire du projet.
- L'avancement des tickets : c'est le rôle de `project-dashboard`, pas d'ici.

Ces fichiers comptent comme des faits déjà vérifiés, mais ils peuvent être en retard sur le code : confirme-les par un coup d'œil au code avant de les reprendre.

## 1. Inspecter

Lis dans cet ordre, et arrête-toi quand tu as de quoi répondre :

1. Les fichiers de la section précédente, s'ils existent.
2. `README`, puis le fichier qui déclare les dépendances et les commandes (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`…).
3. L'arbre des dossiers sur deux niveaux, sans les dossiers générés (`node_modules`, `dist`, `.git`…).
4. Les points d'entrée : là où le programme démarre, où les adresses ou commandes sont déclarées.
5. Un parcours complet, du début à la fin : choisis une fonctionnalité simple et suis-la à travers le code. C'est la source de tes exemples.
6. Les endroits où les données sont lues, écrites ou stockées.

Dans un gros projet, ne lis pas tout : prends les dossiers principaux et dis lesquels tu n'as pas ouverts.

## 2. Écrire l'explication

Dans la conversation, avec ces sept parties, dans cet ordre. Chacune tient en quelques lignes ou une courte liste.

1. **Présentation** : à quoi sert le projet, quel problème il résout, qui l'utilise.
2. **Architecture** : les dossiers principaux et leur rôle, et comment les parties se parlent. Un petit schéma en texte ou en Mermaid si cela aide.
3. **Fonctionnement** : le trajet d'une demande, d'un clic ou d'une commande jusqu'au résultat, où les données sont traitées, où elles sont stockées.
4. **Technologies** : pour chacune, son nom, pourquoi elle est là, son rôle concret dans ce projet.
5. **Fichiers importants** : cinq à dix fichiers à connaître en priorité, chacun avec une phrase sur son rôle et pourquoi il compte.
6. **Points de vigilance** : les parties complexes, les dépendances importantes, les zones où une erreur coûte cher.
7. **Pour aller plus loin** : par où commencer à lire le code, quelles fonctionnalités étudier en premier, dans quel ordre.

Commence par un résumé de deux ou trois phrases : l'utilisateur doit pouvoir s'arrêter là.

## Niveau d'explication

- Explique chaque terme technique la première fois qu'il apparaît, en une demi-phrase.
- Utilise une analogie simple quand elle aide (une base de données comme un classeur, une API comme un guichet), et abandonne-la dès qu'elle devient fausse.
- Appuie chaque point sur le code réel : cite le fichier, et un nom de fonction ou un extrait court. Pas d'exemple inventé.
- Ne noie pas le lecteur : un point par idée, pas de liste de tous les fichiers, pas de détail qui ne change pas la compréhension.
- Si l'utilisateur est identifié comme non développeur dans `AGENTS.md`, évite le jargon et ne garde que les noms des technologies.

## Faits et hypothèses

N'invente jamais le fonctionnement d'une partie que tu n'as pas ouverte.

- Un **fait** s'appuie sur un fichier que tu as lu : cite-le (`src/api/users.ts`).
- Une **hypothèse** est marquée comme telle (« probablement… », « à vérifier dans… ») et dit ce qui permettrait de la confirmer.
- À la fin, une courte ligne « Ce que je n'ai pas regardé » liste les parties ignorées.

## Lecture seule

Ce skill ne fait jamais :

- modifier, créer ou supprimer un fichier du projet ;
- réorganiser les dossiers ;
- installer ou mettre à jour une dépendance ;
- modifier la configuration ;
- écrire de la documentation dans le projet (pas de `ARCHITECTURE.md`, pas de fichier d'explication).

Tu ne lis que : liste des fichiers, lecture, recherche de texte, historique git en lecture. Lancer le projet ou ses tests n'est pas nécessaire : ne le fais pas.

Si l'explication mérite d'être gardée, propose-le à la fin, sans le faire : « Veux-tu que je l'écrive dans une intervention séparée ? » Pour la structure du projet, c'est `/project-architecture` ; pour l'avancement, `/project-dashboard`.
