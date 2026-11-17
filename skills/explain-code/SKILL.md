---
name: explain-code
description: Explique un morceau précis du code dans la conversation, en lecture seule : un fichier, une fonction, un composant, une classe ou un module, ou une fonctionnalité et son parcours à travers plusieurs fichiers. Utilise quand l'utilisateur veut comprendre comment marche une partie du code, ou demande /explain-code.
---

# Explain code

Une explication d'un morceau précis du code, donnée dans la conversation à un développeur qui veut le comprendre sans tout lire. Pour le projet entier, c'est `explain-project`.

Ce skill est en **lecture seule** : il liste, lit et cherche dans les fichiers, et consulte l'historique git. Il laisse le projet tel quel, sans lancer le code ni les tests.

## 1. Trouver la cible

La **cible** est le code à expliquer. Trouve-la d'après la forme de la demande :

- **Un chemin** (`src/data/charger-moments.ts`) : ouvre ce fichier.
- **Un nom** (fonction, composant, classe, module : `chargerMoments`, `UserCard`) : cherche sa définition dans le code.
- **Une fonctionnalité ou un mécanisme** (« comment fonctionnent les compteurs du palmarès ») : cherche les mots de la demande dans le code, sous leurs formes probables (`palmares`, `compteur`, `count`…), et trouve où le **parcours** commence : l'écran, la commande ou l'appel qui déclenche tout.

La cible est trouvée quand tu peux la nommer : un fichier, un symbole et son fichier, ou le point de départ d'un parcours.

Si la demande ne mène à aucune cible, ou à plusieurs aussi probables, pose **une seule question** et attends la réponse. Propose les candidats trouvés, avec leur fichier : « Tu parles de `compterVictoires` (`src/palmares.ts`) ou de `CompteurBadge` (`src/components/CompteurBadge.tsx`) ? ». Si la recherche ne trouve rien, dis ce que tu as cherché et demande un nom de fichier ou de fonction.

## 2. Lire autour de la cible

1. La cible elle-même, en entier.
2. Ce qu'elle appelle : les fonctions, modules et données dont elle dépend.
3. Ce qui l'appelle : cherche son nom dans le code pour trouver qui l'utilise.
4. Ses tests, s'il y en a.

Pour une fonctionnalité ou un mécanisme, **suis le parcours** du déclencheur jusqu'au résultat (affichage, donnée écrite, réponse renvoyée).

La lecture est finie quand chaque étape de ton explication a son fichier et sa fonction, ouverts pendant cette lecture. Note ce que tu as laissé de côté : ça ira dans « Inspecté ».

## 3. Expliquer

Dans la conversation, sous ces titres, dans cet ordre :

- **En bref** : ce que fait la cible et pourquoi elle existe, en deux ou trois phrases.
- **Comment ça marche** : les étapes, une par ligne, chacune avec son fichier et sa fonction. Pour un parcours, de l'entrée jusqu'au résultat, en disant où les données sont lues, transformées ou stockées. Un schéma Mermaid seulement si le parcours traverse plus de quatre fichiers et qu'il le rend plus clair qu'une liste.
- **Les liens** : qui utilise la cible, et ce qu'elle utilise.
- **Points de vigilance** : les cas limites, ce qui casse facilement, les comportements surprenants.
- **Pour le modifier** : où intervenir pour les changements probables, et les tests qui couvrent la zone.
- **Inspecté** : les fichiers lus, puis ce qui ne l'a pas été, en une ou deux lignes.

Un titre sans contenu utile pour cette cible se retire ; la cible simple garde au moins « En bref », « Comment ça marche » et « Inspecté ».

**Longueur**, selon la cible :

- une fonction, un composant ou une classe : 20 lignes environ ;
- un fichier ou un module : 30 lignes environ ;
- une fonctionnalité ou un mécanisme sur plusieurs fichiers : 40 lignes au plus.

Termine par : « Je peux détailler une étape ou un fichier. »

## Fiabilité

Chaque explication s'appuie sur du code ouvert pendant la lecture :

- cite le **chemin** du fichier et la **fonction, le composant ou la clé** concernée ;
- ajoute un **numéro de ligne** (`src/palmares.ts:42`) seulement si tu l'as vu en lisant le fichier à l'instant ;
- marque comme **déduction** une conclusion tirée de faits cités, et comme **à confirmer** ce que tu n'as pas vérifié, avec le moyen de le vérifier.

Tu as lu le code sans l'exécuter : décris ce qu'un test vérifie, et ce que le code est écrit pour faire. Le comportement réel à l'exécution reste à confirmer.

## Style

Écris comme on explique à un collègue développeur : direct et concret.

- Phrases courtes et complètes, une idée par phrase.
- Un terme propre au projet ou peu courant s'explique en une demi-phrase, la première fois.
- Exemples tirés du code : un vrai nom, une vraie valeur, un vrai cas.
- Pour un fichier ou une fonction qui compte, dis ce qui change ou casse s'il bouge.

Le ton visé : « `chargerMoments` lit les fichiers du dossier `moments/` et les trie par date (`src/data/charger-moments.ts`). Un fichier sans date est écarté sans message d'erreur : c'est un point de vigilance. »

Avant d'envoyer, relis : chaque chemin cité a été ouvert ou listé, chaque phrase est complète, et la longueur respecte le budget de la cible.
