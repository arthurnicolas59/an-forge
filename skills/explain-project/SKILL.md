---
name: explain-project
description: Explique un projet existant dans la conversation, en lecture seule : à quoi il sert, comment il fonctionne, où intervenir pour le modifier. Utilise quand l'utilisateur veut comprendre un projet, ce que Claude a construit, ou demande /explain-project.
---

# Explain project

Une explication du projet, donnée dans la conversation, pour quelqu'un qui a quelques bases en développement et veut comprendre sans tout lire.

**La priorité est la compréhension, pas l'exhaustivité.** Après la lecture, l'utilisateur sait ce que fait son application, comment elle fonctionne, pourquoi ces technologies, et où intervenir pour modifier une fonctionnalité. Explique clairement ce que tu as lu plutôt que de chercher à tout couvrir.

Ce skill est en **lecture seule** (voir la section du même nom).

## Deux formats

- **Court (par défaut)** : `/explain-project` seul. Deux ou trois minutes de lecture, 50 lignes au plus, en suivant le budget *Court* de chaque niveau.
- **Long** : l'utilisateur ajoute `--long` ou demande la version détaillée. Lis [`LONG.md`](LONG.md) avant d'écrire : il dit ce que chaque niveau ajoute.

Si l'utilisateur nomme une partie (« détaille les technologies »), donne la version longue de cette partie seulement.

Les règles de fiabilité et de style sont les mêmes dans les deux formats : court ne veut pas dire moins vérifié, ni plus sec. On raccourcit en retirant des détails ; les explications qui font comprendre restent.

Si l'utilisateur n'est pas développeur (il le dit, ou `AGENTS.md` l'indique), lis aussi [`NON-DEVELOPER.md`](NON-DEVELOPER.md) avant d'écrire.

## Ce que les autres skills font déjà

Lis ce qu'ils ont produit plutôt que de refaire leur travail :

- `AGENTS.md` : le but du projet, sa stack, ses règles.
- `ARCHITECTURE.md` : vue d'ensemble, technologies et dossiers, déjà expliqués (fiche écrite par `project-architecture`).
- `docs/adr/` : les décisions prises et leurs raisons. `GLOSSARY.md` : le vocabulaire du projet.

Ces fichiers peuvent être en retard sur le code : confirme-les d'un coup d'œil au code avant de les reprendre.

## 1. Inspecter

Lis dans cet ordre :

1. Les fichiers de la section précédente, s'ils existent.
2. `README`, puis le fichier qui déclare les dépendances et les commandes (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`…).
3. L'arbre des dossiers sur deux niveaux, sans les dossiers générés (`node_modules`, `dist`, `.git`…).
4. Les points d'entrée : là où le programme démarre, où les adresses ou commandes sont déclarées.
5. **Le parcours** : choisis une fonctionnalité simple et suis-la à travers le code, de l'entrée jusqu'au résultat. C'est la source de tes exemples.
6. Les endroits où les données sont lues, écrites ou stockées.
7. Les fichiers de test et leur configuration : ils disent comment le projet se vérifie.

L'inspection est finie quand tu as suivi le parcours de bout en bout en sachant quel fichier gère chaque étape, et que tu as vu les points d'entrée, le stockage des données et les tests. Dans un gros projet, limite-toi aux dossiers principaux et note ceux que tu n'as pas ouverts : ils iront dans « Non inspecté ».

## 2. Écrire l'explication

Dans la conversation, en quatre niveaux de lecture, dans cet ordre, chacun sous son titre. Chaque information reste à son niveau : les détails techniques vont au niveau 4.

### Niveau 1 : comprendre en deux minutes

Compréhensible sans connaissances techniques avancées. Quatre points, en phrases courtes :

- **Le but** : à quoi sert le projet et quel problème il résout.
- **Ce qu'on peut faire avec** : les actions possibles pour la personne qui l'utilise.
- **Les grandes technologies** : une ligne par technologie importante (cinq au plus), avec ce qu'elle fait **ici**, pas ce qu'elle est en général.
- **Le fonctionnement général** : deux ou trois phrases, de ce que la personne fait jusqu'à ce qu'elle voit.

L'utilisateur doit pouvoir s'arrêter là.

### Niveau 2 : comprendre le fonctionnement

- **Le parcours des données** : la fonctionnalité suivie à l'inspection, une étape par ligne, en disant où les données sont lues, transformées ou stockées.
- **Le rôle des composants** : chaque grande partie du projet (dossier ou bloc), la technologie sur laquelle elle s'appuie, et ce qui casserait si elle disparaissait.
- **Les relations entre les technologies** : comment elles se passent le travail (« les textes sont vérifiés par Zod, puis assemblés par Astro »). C'est la partie la plus utile : décris les liens.
- **Un schéma** (texte ou Mermaid), seulement s'il rend le parcours plus clair qu'une phrase.

*Court* : le parcours en quatre à six étapes, les composants regroupés (cinq au plus, une ligne chacun), les liens dits dans les phrases.

### Niveau 3 : savoir intervenir

Des évolutions réalistes pour ce projet, tirées de ce que tu as lu : modifier un contenu, ajouter une fonctionnalité, modifier l'apparence, corriger un problème, quand le projet s'y prête. Puis les **fichiers importants** à connaître en priorité, chacun avec une phrase : son rôle, et ce qui change ou casse s'il bouge.

*Court* : 3 évolutions, deux lignes chacune : *ce que tu veux modifier → où (fichier, fonction) et pourquoi là*, puis *autres fichiers à suivre, tests existants qui couvrent la zone, précaution*. Puis 3 fichiers importants.

Dans les deux formats :

- Chaque chemin vient du code que tu as réellement ouvert ou listé. Si le changement demande un fichier qui n'existe pas encore, écris-le « **à créer** » et dis dans quel dossier il irait, d'après les habitudes du projet.
- N'invente pas d'architecture pour remplir la section. Si le projet n'offre que deux évolutions claires, donne-en deux et dis pourquoi.
- Une évolution trop vaste pour tenir ici (une fonctionnalité complète) se prépare avec `quick-ticket` ou `project-launch` : indique-le.
- Renvoie aux niveaux 1 et 2 pour ce qu'ils ont déjà expliqué.

Exemple de forme (les noms sont fictifs, les tiens viennent du projet) :

> **Ajouter un champ « ville » au profil.** Interviens dans `src/models/user.ts` (`UserSchema`, le schéma qui décrit un utilisateur : tout le reste s'appuie dessus). Touchent aussi : `src/api/users.ts` (validation), `src/components/ProfileForm.tsx` (le formulaire, réutilise `TextField`). Vérifie : `tests/users.test.ts` couvre déjà le schéma ; à confirmer en le lançant, ce que je n'ai pas fait. Précaution : les profils déjà stockés n'ont pas ce champ.

### Niveau 4 : approfondir

Ce que le lecteur n'a pas besoin de savoir pour agir, mais qui sert ensuite :

- les détails techniques (mécanismes particuliers, configuration) ;
- les tests : lesquels existent et ce qu'ils vérifient ;
- les règles métier écrites dans le code ou dans les documents ;
- les **points de vigilance** : parties complexes, dépendances importantes, zones où une erreur coûte cher ;
- par où commencer à lire le code, pour aller plus loin ;
- la synthèse de fiabilité (section suivante).

*Court* : deux ou trois lignes de vigilance, puis la synthèse en trois lignes. Termine par : « Je peux détailler une partie, ou tout en `--long`. »

## Fiabilité des références

**N'invente jamais** le fonctionnement d'une partie que tu n'as pas ouverte. Pour chaque explication technique importante :

- cite le **chemin** du fichier, puis la **fonction, le composant ou la clé de configuration** concernée ;
- ajoute un **numéro de ligne** (`src/api/users.ts:42`) seulement si tu l'as vu en lisant le fichier à l'instant. Une ligne devinée ou venue d'un document non relu est pire que pas de ligne ;
- marque le statut de chaque affirmation non triviale : **fait** (lu dans le code, fichier cité), **déduction** (conclusion tirée de faits cités, dis lesquels) ou **à confirmer** (non vérifié, avec le moyen de le vérifier).

Tu as lu le code sans le lancer. N'affirme jamais qu'un test passe, qu'une commande marche ou qu'un comportement a lieu à l'exécution : dis qu'un test existe et ce qu'il vérifie.

La synthèse finale tient en quatre points (en format court, les deux derniers se regroupent sur une ligne « Hypothèses et limites ») :

- **Inspecté** : les fichiers et dossiers réellement lus ;
- **Non inspecté** : les parties ignorées ;
- **Hypothèses restantes** : ce qui reste à confirmer ;
- **Limites** : ce que cette analyse ne peut pas dire (comportement à l'exécution, état des tests, données réelles).

## Style d'écriture

Écris comme on explique à un collègue qui a quelques bases : naturel, direct, pédagogique.

- **Phrases courtes et complètes**, avec leurs verbes. Une idée par phrase : quand deux concepts techniques se suivent, fais-en deux phrases.
- **Métaphores rares.** Une analogie sert à faire passer un concept difficile, une fois ; explique ensuite le mécanisme réel. Lâche-la dès qu'elle devient fausse.
- **Termes techniques expliqués** en une demi-phrase, la première fois qu'ils comptent pour comprendre. Un terme qui n'aide pas à comprendre se retire.
- **Exemples concrets tirés du projet** : un vrai fichier, une vraie fonction, une vraie valeur.
- **Au niveau du lecteur** : va droit à ce qui aide à décider où agir, en partant de ce qu'il sait déjà (un fichier, un dossier, une dépendance).
- **Pourquoi un fichier compte** : ce qui casse ou change s'il bouge, en plus de ce qu'il contient.
- **La précision ne se sacrifie pas à la simplicité** : simplifier le langage ne change ni les chemins, ni les noms exacts, ni le statut fait / déduction / à confirmer.

Le ton visé : « Zod vérifie que chaque texte a tous ses champs (`src/content.config.ts`). S'il en manque un, la construction du site s'arrête : rien d'incomplet n'est publié. »

## Relecture avant de répondre

Relis l'explication une fois avant de l'envoyer et corrige ce qui ne passe pas. Elle est prête quand :

- les quatre titres de niveau sont présents, dans l'ordre, chacun suivi de son contenu, et chaque information est à son niveau ;
- chaque phrase est complète : aucune phrase coupée, aucune phrase fusionnée avec la suivante ;
- les listes sont bien formées : un élément par ligne ;
- aucun chemin de fichier n'est tronqué, et chaque chemin cité a été ouvert ou listé ;
- chaque affirmation non triviale a son statut, et aucun fait ne dépasse les fichiers listés dans « Inspecté » ;
- les termes techniques importants sont expliqués, avec une ou deux analogies au plus ;
- la longueur et les budgets du format choisi sont respectés. Sinon, coupe les détails et propose d'approfondir.

## Lecture seule

Ce skill ne fait jamais :

- modifier, créer ou supprimer un fichier du projet ;
- réorganiser les dossiers ;
- installer ou mettre à jour une dépendance ;
- modifier la configuration ;
- écrire de la documentation dans le projet.

Il se contente de lire : liste des fichiers, lecture, recherche de texte, historique git. Le projet et ses tests ne sont pas lancés.

Si l'utilisateur veut garder une trace écrite, propose `/project-architecture` (la structure du projet, dans `ARCHITECTURE.md`) ; pour l'avancement des tickets, `/project-dashboard`.
