---
name: feature-brief
description: Écrit le brief d'une évolution : une synthèse pour décider, une page pour comprendre le code construit et y intervenir soi-même, et une annexe des fichiers touchés. Utilise quand l'utilisateur veut un brief ou un résumé d'une feature ou d'une branche, ou quand build-ticket l'appelle.
---

# Feature brief

Le brief d'une évolution, en trois parties :

- **page 1, la synthèse**, pour décider sans lire le code : ce qu'il faut décider, l'objectif, l'avant/après, ce qui change, la fiabilité et les choix effectués ;
- **page 2, Comprendre et intervenir**, pour le développeur qui veut comprendre ce qui a été construit, apprendre quelque chose, et modifier lui-même ;
- **l'annexe**, pour vérifier : chaque critère du ticket avec sa preuve, puis les fichiers touchés, leur rôle et la raison du changement.

Tu écris le contenu dans `brief.json`. `scripts/render.py` le met en page avec le modèle fixe de `templates/`, pour que tous les briefs se ressemblent. Il calcule lui-même, avec git, ce qui doit être exact : la liste des fichiers, les tests existants supprimés ou modifiés, et si les checks ont passé sur cette version. Il refuse un brief incomplet ou trop long, en disant quoi raccourcir.

## Vérifié

Chaque fait du brief est **vérifié** : tu l'as vu toi-même pendant ce travail, dans la sortie des checks, un test, une capture, un rapport de relecture ou le code ouvert.

- Un nombre de tests vient de la dernière exécution des checks ; le nombre de nouveaux tests, du diff. Un test que tu n'as pas lancé est « à lancer », jamais « passé ».
- Ce que le code contient (une fonction, une constante, ce qu'un test attend) est vérifié quand tu l'as ouvert.
- Ce que le code fera en tournant, sans test ni capture qui le montre, est une **déduction** : en page 2, marque-la `"deduit": true`, et la page l'affiche comme telle.
- Ce qui reste incertain, non fait ou non prouvé va dans `a_decider`.

## Entrées

- Le ticket et la spec dont il vient.
- La branche de base (par exemple `origin/main`), les résultats des checks et des relectures (`code-review`, `risk-review`).
- Les captures avant/après s'il y en a (skill `before-after`), sinon le test qui échouait puis passe.
- Le dossier du brief. Par défaut, `docs/briefs/<ticket>-<titre-court>/`.

## 1. Rassembler les faits

Ouvre ce dont le brief parlera : la sortie du dernier passage des checks, les rapports de relecture, les critères du ticket, les captures, et le diff (`git diff <base>...HEAD`). Lis aussi, s'ils existent, `AGENTS.md` (il peut dire le niveau du lecteur), `GLOSSARY.md` et `ARCHITECTURE.md`.

Cette étape est finie quand chaque champ du brief a sa source sous la main.

## 2. Écrire brief.json

Crée `<dossier>/brief.json`, en suivant la référence des champs plus bas :

```json
{
  "titre": "Historique des calculs",
  "ticket": 12,
  "ticket_url": "https://github.com/<owner>/<repo>/issues/12",
  "date": "2026-11-11",
  "branche": "ticket/12-historique-calculs",
  "objectif": "Les utilisateurs refaisaient sans cesse les mêmes calculs. Ils retrouvent maintenant leurs 20 derniers résultats en un clic.",
  "changements": [
    "Un historique s'affiche à côté de la calculatrice",
    "Les 20 derniers calculs restent, même après fermeture de la page",
    "Un clic sur un résultat le remet dans la calculatrice"
  ],
  "avant_apres": {
    "ecrans": [
      { "nom": "Calculatrice", "avant": "avant-calculatrice.png", "apres": "apres-calculatrice.png" }
    ]
  },
  "fiabilite": {
    "tests": "42 tests passent, dont 6 nouveaux sur l'historique",
    "relecture": "Relu par un agent indépendant : 2 remarques, corrigées",
    "risque": "faible",
    "risque_detail": "Ajout isolé : rien d'existant ne change. Facile à retirer."
  },
  "choix": "L'historique est gardé dans le navigateur de chaque utilisateur, pas sur nos serveurs. C'est la solution la plus simple : rien à stocker de notre côté, et aucune donnée ne quitte l'ordinateur de l'utilisateur. La contrepartie : l'historique ne suit pas l'utilisateur d'un appareil à l'autre. Si ce besoin apparaît, on pourra le déplacer sur les serveurs sans changer ce que voit l'utilisateur.",
  "a_decider": "Merger la pull request pour mettre l'historique en ligne.",
  "essayer": "Lancez « npm run dev », ouvrez localhost:3000, faites deux calculs puis rechargez la page : ils sont toujours là.",
  "fonctionnement": [
    { "etape": "Le bouton « = » calcule le résultat, puis le passe à enregistrerCalcul()", "fichier": "src/Calculator.tsx" },
    { "etape": "enregistrerCalcul() place le calcul en tête et garde les 20 premiers", "fichier": "src/history.ts" },
    { "etape": "Au chargement de la page, lireHistorique() relit la liste enregistrée", "fichier": "src/history.ts" }
  ],
  "notions": [
    { "nom": "localStorage", "explication": "Un petit carnet que le navigateur garde pour chaque site. Il survit à la fermeture de la page, mais reste sur cet ordinateur.", "exemple": "la liste des calculs y est écrite sous la clé « historique »", "fichier": "src/history.ts" },
    { "nom": "Test d'un cas limite", "explication": "Un test qui vise la frontière d'une règle, là où les erreurs se cachent : ici, le 21e calcul.", "exemple": "le test vérifie que le plus ancien disparaît", "fichier": "src/history.test.ts" }
  ],
  "intervenir": [
    { "pour": "Garder plus ou moins de calculs", "fichier": "src/history.ts", "ou": "la constante MAX_CALCULS", "precaution": "Le test du 21e calcul suppose 20 : changez-le en même temps.", "verifier": "npm test -- history" }
  ],
  "criteres": [
    { "critere": "Les 20 derniers calculs s'affichent", "preuve": "Test : le 21e calcul fait disparaître le plus ancien" },
    { "critere": "L'historique reste après fermeture de la page", "preuve": "Test : les calculs reviennent après rechargement" },
    { "critere": "L'historique se vide en un clic", "preuve": "" }
  ],
  "fichiers": {
    "src/history.ts": { "role": "Garde et relit les 20 derniers calculs", "pourquoi": "Créé : il fallait un endroit unique pour la règle des 20 calculs" },
    "src/Calculator.tsx": { "role": "Affiche la calculatrice et son historique", "pourquoi": "Modifié pour afficher la liste et envoyer chaque résultat à l'historique" }
  }
}
```

`python3 scripts/render.py --limites` affiche la longueur maximale de chaque champ.

Cette étape est finie quand chaque champ suit sa référence et que chaque fait est **vérifié**.

## 3. Mettre en page

Commite le code d'abord : l'annexe ne voit que ce qui est commité. Puis lance `python3 scripts/render.py <dossier> --base <base>`. Il écrit `<dossier>/index.html` et ajoute à la section « Fiabilité » les lignes qu'il calcule : les checks, les critères prouvés, les tests existants touchés. S'il refuse le brief, corrige `brief.json` et relance jusqu'à ce qu'il passe.

Lis ensuite les lignes calculées. Si l'une n'est pas bonne (checks non relancés, un test supprimé, un critère non prouvé), corrige la cause si tu le peux. Sinon, dis-le dans `a_decider` : le lecteur doit le savoir avant de décider.

## 4. Relire et ouvrir

Relis `brief.json` :

- la page 1 suffit pour décider, sans ouvrir le code ;
- la page 2 permet de retrouver chaque étape et chaque exemple dans le fichier cité ;
- un seul registre partout : celui qu'indique `AGENTS.md`, sinon le vouvoiement.

Puis ouvre le brief avec `scripts/open.sh <dossier>`, sauf si le skill qui t'a appelé l'ouvre lui-même à la fin. Le script passe par le navigateur de l'ordinateur, le seul endroit où les images, rangées à côté de la page, s'affichent. Vérifie que les images et les schémas s'affichent. Sans navigateur, le script dit comment servir le dossier.

Le brief est fini quand ces points sont vrais.

Si l'utilisateur veut un PDF : `scripts/to-pdf.sh <dossier>`. Il écrit `brief.pdf` dans le dossier, une partie par page. Sans Node, ouvre `index.html` dans un navigateur et imprime-le en PDF.

## Référence des champs

### Page 1 : la synthèse

- **`objectif`** : le problème de départ et pour qui, puis ce qui est possible maintenant. Deux phrases. Reprends le « pourquoi » du ticket et de la spec, pas le « comment ».
- **`changements`** : 1 à 5 points, vus par l'utilisateur. Le plus important d'abord.
- **`avant_apres`** : montre toujours une image quand c'est possible. Une seule de ces trois formes, dans cet ordre de préférence :
  - `ecrans` : les captures, pour un changement qui se voit (2 écrans au plus, images rangées dans le dossier du brief). Pour un écran qui n'existait pas encore, omets `avant` : la page affiche « Cet écran n'existait pas » à sa place.
  - `schemas` : `{ "avant": "…", "apres": "…" }`, deux petits schémas Mermaid pour un changement qui ne se voit pas (un calcul, un envoi, un enchaînement d'étapes). Chacun commence par `flowchart LR`, a 5 boîtes au plus, et nomme les boîtes avec des mots de tous les jours. Omets `avant` si rien n'existait. Exemple : `"flowchart LR\n  A[Inscription] --> B[Compte créé] --> C[E-mail de bienvenue]"`.
  - `texte` : `{ "avant": "…", "apres": "…" }`, seulement s'il n'y a rien à dessiner (une faute corrigée, une valeur changée). Exemple : « Un montant à 0 € bloquait la facture » puis « La facture est générée, avec la mention “gratuit” ».
- **`fiabilite.tests`** : le nombre de tests qui passent, d'après la dernière exécution des checks.
- **`fiabilite.relecture`** : ce que la relecture a trouvé et ce qui a été fait.
- **`fiabilite.risque`** : `faible`, `moyen` ou `élevé`, et dans `risque_detail` pourquoi, en disant si c'est facile à annuler. Reprends le niveau donné par la relecture indépendante (`risk-review`), tel quel ou plus haut. Sans relecture indépendante, estime-le toi-même et écris-le dans `risque_detail` : « Estimé par l'auteur du code, sans relecture indépendante. » Des données modifiées ou supprimées, un paiement ou un accès touché : au moins `moyen`.
- **`essayer`** (facultatif, attendu pour un changement visible) : comment essayer soi-même, en une ou deux phrases : l'adresse à ouvrir, puis le geste à faire et ce qu'on doit voir. Une adresse en ligne (la version de test de la pull request) passe avant une commande à lancer, que seul un développeur sait utiliser. Seulement ce que tu as fait toi-même.
- **`revision`** (facultatif) : si le brief est mis à jour après une demande de l'utilisateur, ce qui a changé depuis la première version, en une phrase.
- **`choix`** : un paragraphe qui explique les choix effectués (voir « Expliquer les choix »).
- **`a_decider`** : la décision attendue, en une phrase. S'il reste un point ouvert (une remarque de relecture non corrigée, un choix fait sans l'utilisateur), dis-le ici.

### Page 2 : Comprendre et intervenir

Elle parle du **code de cette branche**, avec ses vrais noms de fichiers et de fonctions. Ce que voit l'utilisateur reste en page 1. Le lecteur a quelques bases en développement, sauf si `AGENTS.md` dit autre chose. Les trois champs sont facultatifs pour le script, mais attendus dès que la branche change du code.

- **`fonctionnement`** : 2 à 6 étapes, dans l'ordre où le code s'exécute, du déclencheur (un clic, une commande, un appel) jusqu'au résultat. S'il y a plusieurs déclencheurs, mets leurs parcours à la suite, chacun commençant par son déclencheur. Chaque étape nomme la fonction ou le composant qui agit, et son `fichier` : celui où cette fonction est écrite, en chemin exact depuis la racine du projet, sans numéro de ligne (il bouge à chaque correction). `"deduit": true` pour une étape que ni un test ni une exécution n'a montrée.
- **`notions`** : 2 ou 3 notions techniques utilisées par ce code et utiles ailleurs, au niveau du lecteur. `explication` : ce que c'est, avec une image du quotidien. `exemple` : où elle sert ici, dans un `fichier` créé ou modifié par la branche. Choisis des notions que la page 1, `GLOSSARY.md` et `ARCHITECTURE.md` n'expliquent pas déjà.
- **`intervenir`** : 1 à 3 changements que le lecteur voudra probablement faire lui-même. `pour` : le changement ; `fichier` et `ou` (la fonction, la constante, le composant) : où le faire ; `precaution` : ce qui casse ou doit changer en même temps ; `verifier` : la commande ou le test à lancer pour vérifier. `"deduit": true` si la précaution n'a pas été vérifiée.

La page renvoie d'elle-même vers `/explain-code` pour aller plus loin, sur le fichier le plus cité en page 2 : la page 2 reste courte.

### Annexe

- **`criteres`** (facultatif, attendu quand le ticket a des critères d'acceptation) : un par critère du ticket, dans le même ordre, avec ses mots. `preuve` dit ce qui le prouve, en mots simples : un test (« Test : … », avec ce qu'il vérifie) ou une capture. Un critère sans test ni capture a une `preuve` vide : il s'affiche « Non prouvé ».
- **`fichiers`** (facultatif, attendu dès que la branche change du code) : pour chaque fichier important du diff, `role` (ce que fait le fichier, en une phrase) et `pourquoi` (pourquoi cette branche l'a créé ou modifié). Une simple phrase à la place de l'objet reste acceptée : c'est le rôle. Les autres fichiers apparaissent dans l'annexe sans phrase.

## Écrire simple et direct

Pour tout le brief :

- **Une idée par phrase.** Moins de 20 mots par phrase. Sujet, verbe, complément.
- **En page 1, des mots de tous les jours.** Parle de ce que voient et font les utilisateurs ; les noms de fichiers, de fonctions et de librairies vont en page 2 et dans l'annexe.
- **En page 2, le mot technique juste, expliqué.** Un terme technique s'explique en une demi-phrase la première fois qu'il apparaît.
- **Du concret.** « 20 derniers calculs », plutôt qu'« un historique enrichi ». Chaque phrase dit un fait précis.
- **Le verbe à l'actif.** « L'historique garde les 20 derniers calculs », plutôt que « Les calculs sont conservés par le système ».

| À éviter | À écrire |
|----------|----------|
| Mise en place d'une solution de persistance côté client permettant d'améliorer l'expérience. | Les calculs restent après fermeture de la page. |
| Refactor du composant de saisie pour une meilleure maintenabilité. | (rien en page 1 : ce n'est pas un changement que l'utilisateur voit) |
| Le risque est maîtrisé. | Rien d'existant ne change. Facile à retirer. |

## Expliquer les choix

Le paragraphe `choix` dit **pourquoi on s'y est pris ainsi**. Il s'adresse à quelqu'un d'intelligent qui ne connaît pas la technique. Pour le choix le plus important (deux au plus) :

1. **Ce qui a été choisi**, en une phrase.
2. **L'autre option**, celle qu'on a écartée.
3. **Pourquoi**, avec le bénéfice concret.
4. **La contrepartie**, honnêtement, et ce qu'on pourra faire si elle devient gênante.

Si une notion technique est indispensable, explique-la dans la même phrase, par une image de tous les jours. Exemple : « gardé dans le navigateur, comme un marque-page ». Un seul paragraphe, sans liste.

Les choix viennent du travail réel : le ticket, la spec, les ADR, et ce que tu as décidé en construisant. S'il n'y a eu aucun vrai choix, dis-le simplement, par exemple : « Le ticket décrivait précisément la solution ; elle a été suivie telle quelle. »

## Règles

- Le dossier du brief contient `brief.json`, `index.html` et les images. Ils sont commités avec la feature : `docs/briefs/` devient l'historique des évolutions du projet.
- Le PDF ne se commite pas : il se régénère à la demande.
