---
name: quick-ticket
description: Transforme une petite demande (un bug, une retouche, un petit ajout) en un seul ticket ready-for-agent, sans passer par une spec. Utilise quand l'utilisateur signale un bug, demande une petite modification ou un petit ajout sur un projet existant, ou demande /quick-ticket.
---

# Quick ticket

Le chemin court du workflow an-forge : une petite demande entre, **un seul ticket** `ready-for-agent` sort, prêt pour `/build-ticket`. Pour une nouvelle idée ou une grosse évolution, c'est `/project-launch` qu'il faut.

Ce skill n'écrit pas de code : il écrit le ticket.

Respecte la section « L'utilisateur » d'`AGENTS.md` : s'il n'est pas développeur, aucune question technique brute.

## 0. Vérifier que le projet est prêt

Le projet doit avoir été préparé par `project-init` : un `AGENTS.md` sans « À REMPLIR » et un fichier `docs/agents/issue-tracker.md`. S'il manque quelque chose, propose de lancer `project-init`, et arrête-toi là.

Lis `docs/agents/issue-tracker.md` : il dit comment publier un ticket.

## 1. Comprendre la demande

Lis d'abord : `AGENTS.md`, `GLOSSARY.md`, puis le code de la zone concernée. Beaucoup de questions trouvent leur réponse là, sans déranger l'utilisateur.

Pose ensuite seulement les questions dont la réponse change ce qui sera construit. **Trois au plus**, en une seule fois, chacune avec ta proposition de réponse.

- **Pour un bug** : ce que l'utilisateur a fait, ce qu'il a vu, ce qu'il attendait. Si tu peux le reproduire toi-même sans rien modifier, fais-le et note les étapes.
- **Pour une retouche ou un ajout** : ce que l'utilisateur doit pouvoir faire ou voir une fois le ticket terminé.

## 2. Vérifier que c'est bien une petite demande

Un ticket tient dans **une seule session** de travail et livre **un seul comportement**, vérifiable seul. Passe la main à `/project-launch`, en expliquant pourquoi en une phrase, si l'un de ces cas se présente :

- la demande contient plusieurs comportements indépendants ;
- elle demande un choix de fond (une nouvelle technologie, une nouvelle façon de ranger les données, un nouveau service extérieur) ;
- elle contredit un ADR ou la spec en cours ;
- tu ne sais pas dire en deux phrases ce qui sera livré.

Deux demandes indépendantes et petites : fais deux tickets, l'un après l'autre.

## 3. Écrire le ticket

Utilise le vocabulaire de `GLOSSARY.md`. Ne cite ni chemin de fichier ni extrait de code : ils vieillissent vite.

```markdown
## Ce qu'il faut construire

Le comportement attendu, vu par l'utilisateur. Deux à cinq phrases.

## Le problème (pour un bug)

Ce qu'on fait, ce qu'on voit, ce qu'on attendait. Les étapes pour le reproduire.

## Critères d'acceptation

- [ ] Critère 1
- [ ] Critère 2

## Hors du ticket

Ce qu'on pourrait croire inclus et qui ne l'est pas. Retire cette section si elle est vide.

## Blocked by

Les tickets qui doivent être terminés avant, ou « None (can start immediately) ».
```

Chaque critère se vérifie par un test ou par un geste : « Un montant à 0 € donne une facture avec la mention “gratuit” », pas « Les montants nuls sont bien gérés ». **Deux à cinq critères** : au-delà, le ticket est sans doute trop gros (étape 2).

Si un ticket ouvert touche la même zone, cite-le dans « Blocked by » : deux tickets construits en même temps au même endroit se contredisent.

## 4. Faire valider

Montre le titre et le ticket à l'utilisateur. S'il n'est pas développeur, ajoute une phrase qui dit ce qu'il verra de différent une fois le ticket construit. Demande : « Je publie ce ticket ? ». Attends un oui explicite.

## 5. Publier

Publie le ticket selon `docs/agents/issue-tracker.md`, avec l'étiquette `ready-for-agent`, et les blocages posés comme ce fichier le décrit. Un ticket de ce skill n'a pas de spec parente.

Donne-lui aussi une **taille**, qui choisira le modèle de `/build-ticket` : `taille:petit` (un seul endroit du code, peu de fichiers), `taille:moyen` (plusieurs fichiers ou couches, une seule fonctionnalité) ou `taille:gros` (données, accès, paiements, ou changement large). Un ticket de ce skill est le plus souvent petit. Si l'étiquette n'existe pas encore, relance `create-labels.sh` du skill `project-init`.

Si les tickets sont des fichiers locaux, écris-le dans `.scratch/quick/issues/<NN>-<titre-court>.md`, avec une ligne `**Status:** ready-for-agent` et une ligne `**Taille:** petit` (ou moyen, gros).

## 6. Conclure

Donne le numéro et le lien du ticket, puis la suite : `/build-ticket <numéro>`, dans une session neuve.

## Règles

- Un ticket, un comportement. Pas de code dans ce skill.
- Rien n'est publié sans le oui de l'utilisateur.
- N'invente ni étape de reproduction ni critère : ce que tu n'as pas vérifié, demande-le.
