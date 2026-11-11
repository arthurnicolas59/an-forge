---
name: build-ticket
description: Construit un ticket ready-for-agent de bout en bout, sans s'arrêter, jusqu'à une pull request : branche isolée, code en TDD, checks, relecture par un agent indépendant, brief d'une page pour le dirigeant. Utilise quand l'utilisateur veut construire, réaliser ou traiter un ticket, ou demande /build-ticket.
---

# Build ticket

Le niveau feature du workflow an-forge : un ticket `ready-for-agent` entre, une pull request et un brief d'une page sortent.

```
Isoler → Avant → Construire → Tester → Relire → Après → Brief → PR
```

Tout se fait **sans s'arrêter** : l'utilisateur n'intervient qu'à la fin, en lisant le brief puis en décidant de merger. Lance ce skill dans une session neuve, un ticket par session.

Les scripts cités sont dans le dossier `scripts/` à côté de ce fichier. Pour lancer un skill depuis celui-ci, si ton outil ne sait pas le faire, lis son `SKILL.md` et suis-le.

## 0. Vérifier que le projet est prêt

Le projet doit avoir été préparé par `project-init` : un `AGENTS.md` sans « À REMPLIR », un `scripts/checks.sh` sans « À REMPLIR » et un fichier `docs/agents/issue-tracker.md`. S'il manque quelque chose, propose de lancer `project-init`, et arrête-toi là.

Lis `docs/agents/issue-tracker.md` : il dit comment lire un ticket et ses blocages. Si les tickets sont des fichiers locaux, tout se déroule de la même façon, mais sans push ni pull request (étape 9).

## 1. Choisir le ticket

**Avec un numéro** : lis le ticket. Il doit être ouvert, porter l'étiquette `ready-for-agent`, et aucun ticket qui le bloque ne doit être encore ouvert. Sinon, dis pourquoi et arrête-toi.

**Sans numéro** : liste les tickets ouverts `ready-for-agent` dont tous les blocages sont fermés et qui ne sont assignés à personne, et demande lequel prendre. C'est la seule question de tout le skill.

## 2. Lire

Lis le ticket en entier (commentaires compris), la spec dont il vient (son ticket parent, ou la ligne `Part of #…`), `AGENTS.md`, `GLOSSARY.md` et les ADR qui touchent la zone concernée.

Sur GitHub, assigne-toi le ticket (`gh issue edit <n> --add-assignee @me`) : une autre session ne le prendra pas en même temps.

## 3. Isoler

Lance `scripts/start-ticket.sh <n> "<titre court du ticket>"`. Il crée, depuis le dernier `main`, la branche `ticket/<n>-<titre>` et le worktree `.worktrees/ticket-<n>`, ou réutilise ceux du ticket s'ils existent. Note les valeurs `worktree`, `branch` et `base` qu'il affiche.

**À partir d'ici, tout se passe dans le worktree.** Commence chaque commande par `cd <worktree> &&`, donne des chemins absolus sous le worktree, et ne modifie jamais le checkout principal. Installe les dépendances dans le worktree si `AGENTS.md` le demande.

Le dossier du brief est `docs/briefs/<n>-<titre>/` dans le worktree, avec le même titre que la branche.

## 4. Capturer l'avant

Avant de toucher au code :

- **Changement visible** : suis les étapes 0 à 2 du skill `before-after`, avec le dossier du brief.
- **Bug** : suis le skill `diagnosing-bugs` jusqu'à avoir une commande qui reproduit le bug (sa phase 1). Sa sortie qui échoue est l'« avant ».
- **Autre changement** : l'« avant » sera le premier test qui échoue à l'étape 5.

Note l'« avant » en une phrase compréhensible par quelqu'un qui ne lit pas le code.

## 5. Construire

Suis le skill `tdd`, en respectant l'architecture existante et les règles d'`AGENTS.md`.

- Le skill `tdd` demande de valider avec l'utilisateur où placer les tests. Ici, **ne l'attends pas** : choisis toi-même les interfaces à tester, en suivant ses critères, et garde-en la liste pour la PR.
- Pour un bug, termine `diagnosing-bugs` : le test de régression fait partie du travail.
- Commit après chaque tranche qui passe, sur la branche du ticket, avec un message court qui commence par `#<n>`.
- Fais ce que demande le ticket, rien de plus. Ce qui manque ou semble faux dans le ticket va dans la PR, pas dans le code.

## 6. Tester

Lance `scripts/gate.sh <base>` depuis le worktree. Il refuse une branche qui modifie `scripts/checks.sh`, puis lance les checks du projet.

- `GATE: PASS` : continue.
- `GATE: FAIL` : corrige la cause, commit, relance. Si le même échec revient **trois fois**, arrête-toi : pas de PR. Résume l'échec, ce que tu as essayé, et laisse le worktree en place.

Ne passe jamais à la relecture avec un gate qui échoue, et ne contourne jamais un check (test désactivé, règle de lint coupée).

## 7. Relire

Lance le skill `code-review` avec `<base>` comme point fixe et le ticket comme spec. Il confie la relecture à deux agents neufs, qui ne voient que le diff, le ticket et les règles du projet, pas ton raisonnement : c'est ce qui rend la relecture indépendante.

Si ton outil ne sait pas lancer de sous-agent, arrête-toi avant la PR et demande à l'utilisateur de lancer `code-review` dans une nouvelle session, depuis le worktree.

Traite le rapport :

- **Spec** : tout ce qui manque ou est faux par rapport au ticket se corrige. Ce qui dépasse le ticket se retire.
- **Standards** : une règle d'`AGENTS.md` non respectée se corrige. Un avis (« possible … ») se corrige s'il est simple, sinon il va dans la PR.

Commit, puis relance `scripts/gate.sh <base>`. Si tu as corrigé quelque chose, relance `code-review` une seconde fois. **Deux tours au maximum** : ce qui reste après est listé dans la PR et dans le brief.

## 8. Capturer l'après et écrire le brief

- **Changement visible** : suis les étapes 3 et 4 du skill `before-after`.
- **Sinon** : l'« après » est la même commande ou le même test qu'à l'étape 4, qui passe maintenant.

Puis suis le skill `feature-brief` avec le dossier du brief, `<base>`, les résultats du dernier gate et de la relecture, et les choix que tu as faits en construisant. Commit le dossier du brief : `#<n>: brief`.

## 9. Livrer

Pousse la branche : `git push -u origin <branch>`.

Ouvre la pull request vers la branche de base, avec un titre court et un corps écrit selon le skill `pr`. Ajoute au corps :

- `Closes #<n>` en première ligne ;
- le chemin du brief (`docs/briefs/<n>-<titre>/index.html`) ;
- les interfaces testées (étape 5) ;
- ce que la relecture a laissé ouvert, s'il reste quelque chose.

**Ne merge jamais**, même si tout est vert. Si les tickets sont des fichiers locaux, arrête-toi après le commit du brief.

## 10. Conclure

Donne à l'utilisateur, en quelques lignes : le lien de la PR, le chemin du brief (ouvre-le si ton outil le permet), et ce qui reste ouvert.

Rappelle comment faire le ménage une fois la PR mergée, depuis le checkout principal :

```bash
git worktree remove .worktrees/ticket-<n>
git branch -D ticket/<n>-<titre>
```

## Règles

- Ne commit jamais sur `main`. Ne force-push que sur la branche du ticket, avec `--force-with-lease`.
- Ne merge jamais. La décision appartient à l'utilisateur, après lecture du brief.
- Ne modifie jamais `scripts/checks.sh` ni un test existant pour faire passer le gate, sauf si le ticket le demande explicitement.
- Si tu t'arrêtes avant la PR, dis à quelle étape, pourquoi, et ce qu'il faut pour reprendre : relancer `/build-ticket <n>` réutilise le worktree.
