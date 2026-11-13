---
name: feature-brief
description: Écrit le brief d'une évolution pour un dirigeant : une page de synthèse (objectif, changements, avant/après, fiabilité, choix effectués) et une annexe avec les fichiers touchés. Utilise quand l'utilisateur veut un résumé non technique d'une feature ou d'une branche, un brief pour le CEO, ou quand build-ticket l'appelle.
---

# Feature brief

Écrit le document qu'une équipe montrerait à son CEO pour présenter une évolution :

- **page 1, la synthèse** : la décision à prendre, l'objectif, l'avant/après, ce qui change, la fiabilité et les choix effectués ;
- **page 2, l'annexe** : les fichiers créés, modifiés, supprimés ou renommés, pour qui veut vérifier.

Le lecteur ne lit pas le code. Il veut savoir pourquoi on l'a fait, ce qui change pour les utilisateurs, si c'est fiable, pourquoi on s'y est pris ainsi, et ce qu'il doit décider.

Les scripts et le modèle cités sont dans les dossiers `scripts/` et `templates/` à côté de ce fichier. Tu n'écris que le contenu, dans `brief.json`. `scripts/render.py` le met en page avec le modèle fixe, pour que tous les briefs se ressemblent, et calcule lui-même la liste des fichiers avec git.

## Entrées

- Le ticket et la spec dont il vient.
- La branche de base (par exemple `origin/main`), les résultats des checks et de la relecture.
- Les captures avant/après s'il y en a (skill `before-after`), sinon le test qui échouait puis passe.
- Le dossier du brief. Par défaut, `docs/briefs/<ticket>-<titre-court>/`.

## 1. Écrire brief.json

Crée `<dossier>/brief.json` :

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
  "fichiers": {
    "src/history.ts": "Garde et relit les 20 derniers calculs",
    "src/Calculator.tsx": "Affiche l'historique à côté de la calculatrice"
  }
}
```

- **`objectif`** : le problème de départ et pour qui, puis ce qui est possible maintenant. Deux phrases. Reprends le « pourquoi » du ticket et de la spec, pas le « comment ».
- **`changements`** : 1 à 5 points, vus par l'utilisateur. Le plus important d'abord.
- **`avant_apres`** : soit `ecrans` (2 au plus, images rangées dans le dossier du brief), soit `texte` : `{ "avant": "…", "apres": "…" }` pour un changement qui ne se voit pas. Exemple : « Un montant à 0 € bloquait la facture » puis « La facture est générée, avec la mention “gratuit” ».
- **`fiabilite.tests`** : le nombre réel de tests qui passent, d'après la dernière exécution des checks. N'invente aucun chiffre.
- **`fiabilite.relecture`** : ce que la relecture a trouvé et ce qui a été fait.
- **`fiabilite.risque`** : `faible`, `moyen` ou `élevé`, et dans `risque_detail` pourquoi, en disant si c'est facile à annuler. Des données modifiées ou supprimées, un paiement ou un accès touché : au moins `moyen`.
- **`choix`** : un paragraphe qui explique les choix effectués (voir l'étape 3).
- **`a_decider`** : la décision attendue, en une phrase. S'il reste un point ouvert (une remarque de relecture non corrigée, un choix fait sans l'utilisateur), dis-le ici.
- **`fichiers`** (facultatif) : pour les fichiers importants, ce que fait le fichier, en une phrase simple. Ils doivent faire partie du diff. Les autres apparaissent dans l'annexe sans phrase.

## 2. Écrire simple et direct

Pour tout le brief :

- **Une idée par phrase.** Moins de 20 mots par phrase. Sujet, verbe, complément.
- **Des mots de tous les jours.** Aucun nom de fichier, de fonction ou de librairie dans la page 1, ni « refactor », « endpoint », « composant », « backend ». Parle de ce que voient et font les utilisateurs.
- **Du concret.** « 20 derniers calculs », pas « un historique enrichi ». Pas de formule creuse (« améliore l'expérience », « solution robuste », « de manière optimale »).
- **Le verbe à l'actif.** « L'historique garde les 20 derniers calculs », pas « Les calculs sont conservés par le système ».
- **Rien de plus que ce qui a été fait et vérifié.** Si une partie du ticket n'est pas faite, dis-le dans `a_decider`.

| À éviter | À écrire |
|----------|----------|
| Mise en place d'une solution de persistance côté client permettant d'améliorer l'expérience. | Les calculs restent après fermeture de la page. |
| Refactor du composant de saisie pour une meilleure maintenabilité. | (rien : ce n'est pas un changement que l'utilisateur voit) |
| Le risque est maîtrisé. | Rien d'existant ne change. Facile à retirer. |

## 3. Expliquer les choix avec pédagogie

Le paragraphe `choix` dit **pourquoi on s'y est pris ainsi**. Il s'adresse à quelqu'un d'intelligent qui ne connaît pas la technique. Pour le choix le plus important (deux au plus) :

1. **Ce qui a été choisi**, en une phrase.
2. **L'autre option**, celle qu'on a écartée.
3. **Pourquoi**, avec le bénéfice concret.
4. **La contrepartie**, honnêtement, et ce qu'on pourra faire si elle devient gênante.

Si une notion technique est indispensable, explique-la dans la même phrase, par une image de tous les jours. Exemple : « gardé dans le navigateur, comme un marque-page ». Pas de liste : un seul paragraphe, 700 caractères au plus.

Les choix viennent du travail réel : le ticket, la spec, les ADR, et ce que tu as décidé en construisant. N'invente pas d'option écartée pour remplir le paragraphe. S'il n'y a eu aucun vrai choix, dis-le simplement, par exemple : « Le ticket décrivait précisément la solution ; elle a été suivie telle quelle. »

## 4. Mettre en page

Lance `python3 scripts/render.py <dossier> --base <base>`. Il écrit `<dossier>/index.html` : la synthèse, puis l'annexe des fichiers touchés entre `<base>` et la branche, sans le dossier `docs/briefs/`. Commite le code avant de le lancer : l'annexe ne voit que ce qui est commité.

Il refuse un brief trop long ou incomplet, en disant quoi raccourcir. Corrige `brief.json` et relance jusqu'à ce qu'il passe.

Ouvre le brief avec `scripts/open.sh <dossier>` et vérifie que les images s'affichent. Les images sont des fichiers à côté de la page : un aperçu qui ouvre la page seule (par exemple le panneau d'aperçu d'un outil d'IA) ne les montre pas. Le script passe donc toujours par le navigateur de l'ordinateur. N'ouvre jamais le brief autrement.

Si l'utilisateur veut un PDF : `scripts/to-pdf.sh <dossier>`. Il écrit `brief.pdf` dans le dossier, la synthèse en page 1 et l'annexe en page 2. Sans Node, ouvre `index.html` dans un navigateur et imprime-le en PDF.

## Règles

- Le dossier du brief contient `brief.json`, `index.html` et les images. Ils sont commités avec la feature : `docs/briefs/` devient l'historique des évolutions du projet.
- Le PDF ne se commite pas : il se régénère à la demande.
