---
name: explain-project
description: Explique un projet existant à quelqu'un qui a quelques bases mais ne veut pas lire tout le code, en lecture seule et dans la conversation : à quoi il sert, son architecture, comment une demande le traverse, ses technologies, ses fichiers importants, ses points de vigilance et par où commencer. Utilise quand l'utilisateur demande /explain-project, veut comprendre ce que Claude a construit ou un projet qu'il ne connaît pas.
---

# Explain project

Une explication du projet, donnée dans la conversation, pour quelqu'un qui a quelques bases en développement et veut comprendre sans tout lire.

**La priorité est la compréhension, pas l'exhaustivité.** Après la lecture, l'utilisateur doit savoir : ce que fait son application, comment elle fonctionne, pourquoi ces technologies, et où intervenir pour modifier une fonctionnalité. Ce n'est pas un audit technique : ne cherche pas à tout dire, et ne collecte pas plus d'informations pour faire plus long. Mieux vaut expliquer clairement ce que tu as lu.

**Ce skill ne modifie rien.** C'est sa règle principale (voir « Lecture seule »).

## Deux formats

- **Court (par défaut)** : une lecture de deux ou trois minutes, 50 lignes au plus. Les quatre niveaux de lecture (voir plus bas) sont là, mais le niveau 4 se réduit à la synthèse de fiabilité. C'est ce que l'utilisateur obtient s'il tape seulement `/explain-project`.
- **Long** : l'utilisateur ajoute `--long` (ou demande « en détail », « version longue »). Les quatre niveaux sont développés, avec les détails marqués « Long » plus bas.

Les règles de fiabilité (faits, hypothèses, lecture seule) **et de style** (section « Style d'écriture ») sont **les mêmes dans les deux formats** : court ne veut pas dire moins vérifié, ni plus sec. On raccourcit en retirant des détails, jamais les explications qui font comprendre : chaque terme technique important reste défini la première fois. À la fin d'une version courte, propose : « Je peux détailler une partie, ou tout en `--long`. » Si l'utilisateur nomme une partie (« détaille les technologies »), donne la version longue de cette partie seulement.

Si la réponse devient trop longue, fais une synthèse et propose d'approfondir, plutôt que de tout écrire.

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

Dans la conversation, en quatre niveaux de lecture, dans cet ordre. Chaque niveau a un titre, et les informations secondaires restent au niveau 4 : elles n'encombrent pas les premiers.

### Niveau 1 : comprendre en deux minutes

Compréhensible sans connaissances techniques avancées. Quatre points, en phrases courtes :

- **Le but** : à quoi sert le projet et quel problème il résout.
- **Ce qu'on peut faire avec** : les actions possibles pour la personne qui l'utilise.
- **Les grandes technologies** : une ligne par technologie importante (cinq au plus), avec ce qu'elle fait **ici**, pas ce qu'elle est en général.
- **Le fonctionnement général** : deux ou trois phrases, de ce que la personne fait jusqu'à ce qu'elle voit.

L'utilisateur doit pouvoir s'arrêter là.

### Niveau 2 : comprendre le fonctionnement

- **Le parcours des données** : suis une fonctionnalité réelle, étape par étape (une étape par ligne), de l'entrée jusqu'au résultat, en disant où les données sont lues, transformées ou stockées.
- **Le rôle des composants** : chaque grande partie du projet (dossier ou bloc), la technologie sur laquelle elle s'appuie, et ce qui casserait si elle disparaissait.
- **Les relations entre les technologies** : comment elles se passent le travail (« les textes sont vérifiés par Zod, puis assemblés par Astro »). C'est la partie la plus utile : décris les liens, pas une liste de noms.
- **Un schéma** (texte ou Mermaid) seulement s'il rend le parcours plus clair qu'une phrase. Sinon, pas de schéma.

*Court* : le parcours en quatre à six étapes, les composants regroupés (cinq au plus), les liens dits dans les phrases.

*Long* : en plus, pour chaque technologie importante (pas pour chaque dépendance) :
- son rôle général, en une demi-phrase ;
- son usage concret ici, avec le fichier ou la configuration qui le montre ;
- pourquoi elle est là : cite la source (ADR, `AGENTS.md`, `ARCHITECTURE.md`). Sans source, dis « raison non documentée » et ne la devine pas ;
- ce qu'impliquerait de la remplacer ou de la retirer, d'après les imports et la configuration que tu as lus. Ne propose pas d'alternative absente des documents ou du code.

### Niveau 3 : savoir intervenir

Des cas concrets, avec les vrais fichiers et leur rôle. Voir la sous-section « Où intervenir selon ce que je veux modifier ? » plus bas. Couvre, si le projet s'y prête : modifier un contenu, ajouter une fonctionnalité, modifier l'apparence, corriger un problème.

Ajoute ici les **fichiers importants** à connaître en priorité (cinq à dix au plus), chacun avec une phrase : son rôle, et ce qui change ou casse s'il bouge.

### Niveau 4 : approfondir

Ce que le lecteur n'a pas besoin de savoir pour agir, mais qui sert ensuite :

- les détails techniques (mécanismes particuliers, configuration) ;
- les tests : lesquels existent et ce qu'ils vérifient ;
- les règles métier : celles qui sont écrites dans le code ou dans les documents ;
- les risques et **points de vigilance** : parties complexes, dépendances importantes, zones où une erreur coûte cher ;
- les fichiers non inspectés ;
- par où commencer à lire le code, si l'utilisateur veut aller plus loin.

*Court* : deux ou trois lignes de vigilance, puis la synthèse de fiabilité. *Long* : tout ce qui précède.

### Où intervenir selon ce que je veux modifier ?

Ces cas forment le niveau 3.

**Court** : 3 évolutions, chacune en deux lignes au plus : *ce que tu veux modifier → où (fichier, fonction) et pourquoi là*, *autres fichiers à suivre*, *vérification et précaution* (en nommant les tests existants sans dire qu'ils passent). Pas de détail de réutilisation sauf s'il évite de réécrire quelque chose d'important.

**Long** : choisis 3 à 5 évolutions réalistes pour ce projet, tirées de ce que tu as lu (modifier un contenu, ajouter une fonctionnalité, modifier l'apparence, corriger un problème, quand le projet s'y prête). Pour chacune :

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

## Style d'écriture

Écris comme on explique à un collègue qui a quelques bases : naturel, direct, pédagogique.

- **Phrases courtes et complètes.** Une idée par phrase. N'empile pas plusieurs concepts techniques dans la même phrase : coupe-la.
- **Pas de style artificiel.** Pas de formules d'introduction vides, pas de phrases qui sonnent comme un slogan, pas de télégraphe qui supprime les verbes.
- **Métaphores rares.** Une analogie sert à faire passer **un** concept difficile, une fois, puis tu expliques le mécanisme réel. Pas d'image pour chaque technologie, pas la même famille d'images répétée. Abandonne l'analogie dès qu'elle devient fausse.
- **Termes techniques expliqués** quand ils comptent pour comprendre, en une demi-phrase, la première fois. Un terme secondaire qui n'aide pas à comprendre se supprime plutôt que de s'expliquer.
- **Exemples concrets tirés du projet** : un vrai fichier, une vraie fonction, une vraie valeur. Pas d'exemple inventé.
- **Pas d'infantilisation** : pas de « c'est simple », pas de définition de ce qu'est un fichier. Va droit à ce qui aide à décider où agir.
- **Dis pourquoi un fichier compte** (ce qui casse ou change s'il bouge), pas seulement ce qu'il contient.
- **La précision ne se sacrifie pas à la simplicité** : simplifier le langage ne change ni les chemins, ni les noms exacts, ni la distinction entre faits et déductions.
- La section « Où intervenir » ne répète pas les niveaux précédents, elle y renvoie.

Exemple. À éviter : « Zod est le videur du club : il vérifie que chaque invité a un badge valide avant d'entrer dans le build Astro. » Préférer : « Zod vérifie que chaque texte a tous ses champs (`src/content.config.ts`). S'il en manque un, la construction du site s'arrête : rien d'incomplet n'est publié. »

Si l'utilisateur est identifié comme non développeur (dans `AGENTS.md`, ou parce qu'il le dit), passe en langage courant :

- une image du quotidien pour **une ou deux idées clés** (pas toutes), **puis le mécanisme réel en une ou deux phrases** : l'image ouvre la porte, elle ne remplace pas l'explication ;
- pour chaque technologie, au moins une **raison technique** vérifiable dans le code (ce qu'elle rend possible ou empêche) ;
- chaque fichier est présenté par son rôle d'abord (« le fichier des textes des Moments »), puis son chemin entre parenthèses ;
- les noms de fonctions et les numéros de ligne passent en fin de phrase ou dans la synthèse, jamais au milieu d'une explication ;
- pas de sigle ni d'anglicisme sans définition d'une demi-phrase ;
- dans « Où intervenir », formule chaque évolution comme une envie (« corriger le texte d'un moment ») et dis ce qu'il faut demander à l'assistant de code, en une phrase, plutôt que de lister des fichiers à ouvrir.

Les références restent exactes et vérifiées : seule la présentation change.

## Relecture avant de répondre

Avant d'envoyer l'explication, relis-la une fois et corrige ce qui ne passe pas. Vérifie :

- les quatre titres de niveau sont présents, dans l'ordre, et chaque titre est suivi de son contenu ;
- chaque phrase est complète : aucune phrase coupée, aucune phrase fusionnée avec la suivante ;
- aucun chemin de fichier n'est tronqué ; chaque chemin cité existe (tu l'as ouvert ou listé) ;
- les listes sont bien formées : un élément par ligne, pas de puce collée à un paragraphe ;
- un paragraphe ne mélange pas deux niveaux : les détails techniques sont au niveau 4, pas au niveau 1 ;
- les termes techniques importants sont expliqués, et il n'y a pas plus d'une ou deux analogies ;
- chaque affirmation est cohérente avec les fichiers listés dans « Inspecté », et rien n'est présenté comme fait sans avoir été lu ;
- la longueur respecte le format choisi. Sinon, coupe les détails et propose d'approfondir.

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
