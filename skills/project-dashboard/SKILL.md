---
name: project-dashboard
description: Fabrique et ouvre le tableau de bord du projet, une page visuelle recalculée à chaque fois : avancement des tickets spec par spec, ce qu'il faut faire maintenant, schéma de l'architecture, stack, décisions prises, vocabulaire et dernières livraisons. Utilise quand l'utilisateur veut voir où en est le projet, un tableau de bord, une vue d'ensemble, l'avancement, ou demande /project-dashboard.
---

# Project dashboard

Une page web qui montre d'un coup d'œil où en est le projet, pour quelqu'un qui ne lit pas le code.

**Les faits ne sont jamais écrits à la main.** Le script `scripts/dashboard.py` (à côté de ce fichier) lit à chaque fois les tickets (GitHub, ou les fichiers `.scratch/` d'un projet sans GitHub), les décisions (`docs/adr/`), le lexique (`GLOSSARY.md`) et les dernières livraisons, et en calcule l'avancement. Toi, tu n'écris que la **présentation du projet** : un résumé, le schéma de l'architecture et la stack, que le script ne peut pas deviner.

Tout est rangé dans `.an-forge/dashboard/` à la racine du projet, propre à cette machine et jamais commité : le script l'exclut de git lui-même. Ce skill ne modifie rien d'autre dans le projet.

## 0. Vérifier que le projet est prêt

Le projet doit avoir un `AGENTS.md` (posé par `project-init`). S'il n'en a pas, propose de lancer `project-init`, et arrête-toi là.

## 1. Voir où en est la présentation

Lance `python3 scripts/dashboard.py status` depuis le projet. Il répond :

- `description=ok` : la présentation est à jour, passe à l'étape 3.
- `description=missing` : elle n'existe pas encore, écris-la (étape 2).
- `description=stale` : `AGENTS.md` a changé depuis qu'elle a été écrite (une stack choisie, une règle ajoutée). Relis-la et corrige ce qui n'est plus vrai (étape 2). Si rien n'a changé pour elle, passe directement à `stamp`.

Il donne aussi `output=<dossier>` : c'est là que vit `description.json`.

## 2. Écrire la présentation

Lis `AGENTS.md`, la spec ouverte la plus récente s'il y en a une, et `GLOSSARY.md`. Écris `<output>/description.json` :

```json
{
  "nom": "Recettes du soir",
  "resume": "Une application web qui propose chaque soir trois idées de repas adaptées à tes goûts.",
  "pour_qui": "Les personnes qui cuisinent en semaine et manquent d'idées.",
  "architecture": [
    {"nom": "Toi", "detail": "Navigateur ou téléphone", "icone": "user"},
    {"nom": "L'application", "detail": "Les écrans (Next.js)", "icone": "screen"},
    {"nom": "Le serveur", "detail": "Calcule les idées", "icone": "server"},
    {"nom": "La base de données", "detail": "Recettes et profils (Supabase)", "icone": "database"}
  ],
  "liens": ["internet", "", ""],
  "stack": [
    {"couche": "Écrans", "techno": "Next.js, Tailwind CSS", "role": "Ce que tu vois et touches"}
  ]
}
```

- **`resume`** : une ou deux phrases, 320 caractères au plus : ce que fait le projet, pas comment.
- **`pour_qui`** (facultatif) : une phrase, 160 caractères au plus.
- **`architecture`** : de 2 à 6 boîtes, de gauche à droite, dans l'ordre où l'information circule, en partant de l'utilisateur. `nom` en mots de tous les jours (28 caractères au plus), la technologie dans `detail` (48 au plus). `icone` au choix : `user`, `screen`, `phone`, `server`, `database`, `cloud`, `lock`, `mail`, `card`, `box`, `gear`, `chart`.
- **`liens`** (facultatif) : le texte de chaque flèche (16 caractères au plus), un de moins que les boîtes ; `""` pour une flèche sans texte.
- **`stack`** : une ligne par partie du projet, 12 au plus. `role` dit à quoi elle sert, sans jargon.

Respecte la section « L'utilisateur » d'`AGENTS.md` : s'il n'est pas développeur, aucun mot technique sans explication, sauf le nom des technologies dans `detail` et `techno`.

N'invente rien : si la stack n'est pas encore choisie (projet neuf avant `/project-launch`), mets une seule boîte « Toi » et une boîte « Le projet » (« Stack pas encore choisie »), et laisse `stack` vide.

Lance ensuite `python3 scripts/dashboard.py stamp` : il note la version d'`AGENTS.md` que la présentation décrit.

## 3. Fabriquer et ouvrir la page

Lance `python3 scripts/dashboard.py render --open`. Il écrit `<output>/index.html` et l'ouvre dans le navigateur.

- S'il refuse `description.json` (code 1), il liste les erreurs : corrige-les et relance.
- Si ton outil ne peut pas ouvrir de navigateur, lance-le sans `--open` et donne le chemin du fichier à l'utilisateur.

## 4. Conclure

En deux lignes au plus : le chemin de la page, et la première ligne de « À faire maintenant », telle que la page l'affiche. Ne recopie pas le reste du tableau de bord : il est sur la page.

## Règles

- Ne recopie jamais dans `description.json` un chiffre, un état de ticket ou une date : tout ce qui change se calcule.
- Ne commite rien : le tableau de bord est propre à cette machine.
- Ne modifie ni les tickets, ni `AGENTS.md`, ni les décisions : ce skill ne fait que lire.
