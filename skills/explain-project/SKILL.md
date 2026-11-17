---
name: explain-project
description: Explique un projet existant à quelqu'un qui a quelques bases mais ne veut pas lire tout le code, en lecture seule et dans la conversation : à quoi il sert, son architecture, comment une demande le traverse, ses technologies, ses fichiers importants, ses points de vigilance et par où commencer. Utilise quand l'utilisateur demande /explain-project, veut comprendre ce que Claude a construit ou un projet qu'il ne connaît pas.
---

# Explain project

Une explication pédagogique du projet, donnée dans la conversation, pour quelqu'un qui a quelques bases en développement et veut comprendre sans tout lire. Elle ne s'arrête pas à « comment ça marche » : elle montre aussi **où intervenir** pour faire évoluer le projet.

**Ce skill ne modifie rien.** C'est sa règle principale (voir « Lecture seule »).

## Deux formats

- **Court (par défaut)** : une lecture de deux ou trois minutes, 45 lignes au plus. Les sept parties sont là, mais chacune va à l'essentiel : si une phrase ne change pas la compréhension, coupe-la. C'est ce que l'utilisateur obtient s'il tape seulement `/explain-project`.
- **Long** : l'utilisateur ajoute `--long` (ou demande « en détail », « version longue »). Les sept parties sont développées, avec les détails marqués « Long » plus bas.

Les règles de fiabilité (faits, hypothèses, lecture seule) **et de pédagogie** (section « Niveau d'explication ») sont **les mêmes dans les deux formats** : court ne veut pas dire moins vérifié, ni plus sec. On raccourcit en retirant des détails, jamais les explications qui font comprendre : chaque terme technique reste défini la première fois, et les idées clés gardent leur image du quotidien. À la fin d'une version courte, propose : « Je peux détailler une partie, ou tout en `--long`. » Si l'utilisateur nomme une partie (« détaille les technologies »), donne la version longue de cette partie seulement.

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
7. Les fichiers de test et la configuration des tests : ils disent comment le projet se vérifie (sans les lancer).

Dans un gros projet, ne lis pas tout : prends les dossiers principaux et dis lesquels tu n'as pas ouverts.

## 2. Écrire l'explication

Dans la conversation, avec ces sept parties, dans cet ordre. Chacune tient en quelques lignes ou une courte liste.

1. **Présentation** : à quoi sert le projet, quel problème il résout, qui l'utilise.
2. **Architecture** : les dossiers principaux et leur rôle, et comment les parties se parlent. Un petit schéma en texte ou en Mermaid si cela aide.
3. **Fonctionnement** : le trajet d'une demande, d'un clic ou d'une commande jusqu'au résultat, où les données sont traitées, où elles sont stockées.
4. **Technologies** : *Court* : une à deux lignes par technologie, cinq au plus (regroupe celles qui vont ensemble) : l'image et le mécanisme en une phrase, la raison technique en une demi-phrase, le fichier qui le montre. Les liens entre technologies se disent dans ces phrases (« lit les YAML », « bloque le build »), sans point à part. *Long* : pour chaque technologie importante (pas pour chaque dépendance), cinq points courts :
   - son rôle général (ce qu'elle fait en dehors du projet) ;
   - son usage concret ici, avec le fichier ou la configuration qui le montre ;
   - avec quelles autres technologies du projet elle travaille (c'est la partie la plus utile : décris les liens, pas une liste de noms) ;
   - pourquoi elle est là : cite la source (ADR, `AGENTS.md`, `ARCHITECTURE.md`). Sans source, dis « raison non documentée » et ne la devine pas ;
   - ce qu'impliquerait de la remplacer ou de la retirer : ce qui casserait, quels fichiers changeraient, d'après les imports et la configuration que tu as lus. Ne propose pas d'alternative technique absente des documents ou du code.
5. **Fichiers importants** : cinq à dix fichiers à connaître en priorité, chacun avec une phrase sur son rôle et pourquoi il compte.
6. **Points de vigilance** : les parties complexes, les dépendances importantes, les zones où une erreur coûte cher.
7. **Pour aller plus loin** : par où commencer à lire le code, quelles fonctionnalités étudier en premier, dans quel ordre. Elle se termine par la sous-section « Où intervenir selon ce que je veux modifier ? » (voir plus bas), puis par la synthèse de fiabilité.

Pour les parties 1, 2, 3, 5 et 6, le format court tient en deux à quatre lignes ou puces chacune ; le format long en ajoute les exemples, le schéma complet et les cas particuliers.

Commence par un résumé de deux ou trois phrases : l'utilisateur doit pouvoir s'arrêter là.

### Où intervenir selon ce que je veux modifier ?

**Court** : 3 évolutions, chacune en deux lignes au plus : *ce que tu veux modifier → où (fichier, fonction) et pourquoi là*, *autres fichiers à suivre*, *vérification et précaution* (en nommant les tests existants sans dire qu'ils passent). Pas de détail de réutilisation sauf s'il évite de réécrire quelque chose d'important.

**Long** : choisis 3 à 5 évolutions réalistes pour ce projet, tirées de ce que tu as lu (fonctionnalités existantes à étendre, configuration, textes ou données qui changent souvent). Pour chacune :

1. **Ce que tu veux modifier**, en une phrase.
2. **Où intervenir** : le fichier ou dossier principal.
3. **Son rôle exact** et pourquoi c'est là qu'on agit.
4. **Autres fichiers concernés** : ceux qui devront probablement suivre (types, routes, tests, configuration).
5. **À réutiliser** : composants, fonctions ou modèles existants, avec leur nom et leur fichier, pour ne pas réécrire ce qui existe.
6. **Vérifications** : les tests existants qui couvrent cette zone (nomme-les), la commande qui les lance si elle est déclarée, et ce qu'il faut contrôler à la main. Ne dis pas qu'ils passent : tu ne les as pas lancés.
7. **Précautions** : ce qui peut casser ailleurs, les données ou la configuration sensibles.

Règles :

- Chaque chemin vient du code que tu as réellement ouvert ou listé. Si le changement demande un fichier qui n'existe pas encore, écris-le « **à créer** » et dis dans quel dossier il irait, d'après les habitudes du projet.
- N'invente pas d'architecture pour remplir la section. Si le projet n'offre que deux évolutions claires, donne-en deux et dis pourquoi.
- Une évolution trop vaste pour tenir ici (nouvelle fonctionnalité complète) se prépare avec `feature-brief` ou `quick-ticket` : indique-le au lieu de refaire leur travail.

Exemple de forme (les noms sont fictifs, les tiens viennent du projet) :

> **Ajouter un champ « ville » au profil.** Interviens dans `src/models/user.ts` (`UserSchema`, le schéma qui décrit un utilisateur : tout le reste s'appuie dessus). Touchent aussi : `src/api/users.ts` (validation), `src/components/ProfileForm.tsx` (le formulaire, réutilise `TextField`). Vérifie : `tests/users.test.ts` couvre déjà le schéma ; à confirmer en le lançant, ce que je n'ai pas fait. Précaution : les profils déjà stockés n'ont pas ce champ.

## Fiabilité des références

Pour chaque explication technique importante :

- cite le **chemin** du fichier, puis la **fonction, le composant ou la clé de configuration** concernée ;
- ajoute un **numéro de ligne** (`src/api/users.ts:42`) seulement si tu l'as vu en lisant le fichier à l'instant. Une ligne devinée ou venue d'un document non relu est pire que pas de ligne ;
- marque le statut de chaque affirmation non triviale : **fait** (lu dans le code), **déduction** (conclusion que tu tires de faits cités, dis lesquels) ou **à confirmer** (non vérifié, avec le moyen de le vérifier).

Termine par une synthèse (*court* : trois lignes, « Inspecté », « Non inspecté », « Hypothèses et limites » ; *long* : les quatre points ci-dessous) :

- **Inspecté** : les fichiers et dossiers réellement lus ;
- **Non inspecté** : les parties ignorées ;
- **Hypothèses restantes** : ce qui reste à confirmer ;
- **Limites** : ce que cette analyse ne peut pas dire (comportement à l'exécution, état des tests, données réelles).

N'affirme jamais qu'un test passe, qu'une commande marche ou qu'un comportement a lieu à l'exécution : tu as lu le code, tu ne l'as pas lancé. Dis seulement qu'un test existe et ce qu'il vérifie.

## Niveau d'explication

- Explique chaque terme technique la première fois qu'il apparaît, en une demi-phrase.
- Utilise une analogie simple quand elle aide (une base de données comme un classeur, une API comme un guichet), et abandonne-la dès qu'elle devient fausse.
- Appuie chaque point sur le code réel : cite le fichier, et un nom de fonction ou un extrait court. Pas d'exemple inventé.
- Ne noie pas le lecteur : un point par idée, pas de liste de tous les fichiers, pas de détail qui ne change pas la compréhension.
- Pour qui lit : quelqu'un qui a des bases et construit ses logiciels avec un assistant de code. Ne l'infantilise pas : pas de « c'est simple » ni de définition de ce qu'est un fichier. Va droit à ce qui l'aide à décider où agir.
- Dis pourquoi un fichier compte (ce qui casse ou change s'il bouge), pas seulement ce qu'il contient.
- Reste court : une idée par point, et la section « Où intervenir » ne répète pas ce que les parties précédentes ont déjà dit, elle y renvoie. En format court, coupe tout ce qui n'aide pas à décider où agir.
- Si l'utilisateur est identifié comme non développeur (dans `AGENTS.md`, ou parce qu'il le dit), la version courte reste pédagogique et passe en langage courant :
  - une image du quotidien pour chaque idée clé (le site statique comme un livre imprimé plutôt qu'écrit à la demande, un schéma de validation comme un contrôle à l'entrée), **puis le mécanisme réel en une ou deux phrases** : l'image ouvre la porte, elle ne remplace pas l'explication. L'objectif est que quelqu'un qui ne code pas comprenne comment la technologie fonctionne, pas seulement à quoi elle ressemble ;
  - pour chaque technologie, au moins une **raison technique** vérifiable dans le code (ce qu'elle rend possible ou empêche, par exemple « le build s'arrête si un texte est incomplet, donc rien d'invalide n'est publié ») ;
  - chaque fichier est présenté par son rôle d'abord (« le fichier des textes des Moments »), puis son chemin entre parenthèses ;
  - les noms de fonctions et les numéros de ligne passent en fin de phrase ou dans la synthèse, jamais au milieu d'une explication ;
  - pas de sigle ni d'anglicisme sans définition d'une demi-phrase ;
  - dans « Où intervenir », formule chaque évolution comme une envie (« corriger le texte d'un moment ») et dis ce qu'il faut demander à l'assistant de code, en une phrase, plutôt que de lister des fichiers à ouvrir.
  Les références restent exactes et vérifiées : seule la présentation change.

## Faits et hypothèses

N'invente jamais le fonctionnement d'une partie que tu n'as pas ouverte.

- Un **fait** s'appuie sur un fichier que tu as lu : cite-le (`src/api/users.ts`).
- Une **hypothèse** est marquée comme telle (« probablement… », « à vérifier dans… ») et dit ce qui permettrait de la confirmer.
- À la fin, la synthèse de la section « Fiabilité des références » liste ce qui a été inspecté, ignoré, supposé, et les limites.

## Lecture seule

Ce skill ne fait jamais :

- modifier, créer ou supprimer un fichier du projet ;
- réorganiser les dossiers ;
- installer ou mettre à jour une dépendance ;
- modifier la configuration ;
- écrire de la documentation dans le projet (pas de `ARCHITECTURE.md`, pas de fichier d'explication).

Tu ne lis que : liste des fichiers, lecture, recherche de texte, historique git en lecture. Lancer le projet ou ses tests n'est pas nécessaire : ne le fais pas, et n'écris donc rien qui laisse croire que tu l'as fait.

Si l'explication mérite d'être gardée, propose-le à la fin, sans le faire : « Veux-tu que je l'écrive dans une intervention séparée ? » Pour la structure du projet, c'est `/project-architecture` ; pour l'avancement, `/project-dashboard`.
