---
name: build-ticket
description: Construit un ticket ready-for-agent de bout en bout, sans s'arrêter, jusqu'à une pull request : branche isolée, code en TDD, checks, relecture par un agent indépendant, brief d'une page pour le dirigeant. Utilise quand l'utilisateur veut construire, réaliser ou traiter un ticket, ou demande /build-ticket.
---

# Build ticket

Le niveau feature du workflow an-forge : un ticket `ready-for-agent` entre, une pull request et un brief d'une page sortent.

```
Isoler → Avant → Construire → Tester → Relire → Après → Brief → PR
```

Tout se fait **sans s'arrêter ni poser de question** : l'utilisateur n'intervient qu'à la fin, en lisant le brief puis en décidant de merger. Lance ce skill dans une session neuve, un ticket par session. Par défaut, un ticket à la fois : on construit le suivant une fois le précédent mergé. Le parallèle est possible (une session par ticket, chacune réserve un ticket différent), mais deux tickets corrects séparément peuvent se contredire, et des ressources comme une base de données de développement restent partagées.

Les scripts cités sont dans le dossier `scripts/` à côté de ce fichier. Pour lancer un skill depuis celui-ci, si ton outil ne sait pas le faire, lis son `SKILL.md` et suis-le.

## Le journal

L'utilisateur suit le ticket sur un tableau de suivi, pas dans cette conversation. Dès que le ticket est réservé (étape 1), note chaque étape **au moment où elle commence** avec `scripts/log-step.sh <n> <étape> "<phrase>"` :

| Étape du journal | Quand |
|---|---|
| `isoler` | juste après `start-ticket.sh` |
| `avant` | au début de l'étape 4 |
| `construire` | au début de l'étape 5 |
| `tester` | à chaque lancement de `gate.sh`, avec le numéro de l'essai |
| `relire` | à chaque tour de `code-review` |
| `apres` | au début de l'étape 8 |
| `brief` | quand tu écris le brief |
| `pr` | une fois la pull request ouverte, avec son lien |
| `arrete` | chaque fois que tu t'arrêtes avant la PR, avec la raison |

Coche aussi les critères d'acceptation du ticket, au fur et à mesure : dès qu'un critère est couvert par un test qui passe, lance `scripts/log-step.sh <n> critere <rang> "<preuve>"`. Le rang est sa place dans la liste « Acceptance criteria » du ticket (1 pour le premier). La preuve dit comment on le sait, en une phrase (« Un test vérifie que la photo s'affiche sur la fiche »). Ne coche jamais un critère sans preuve. Ne touche pas aux cases du ticket sur GitHub : un critère n'est acquis qu'au merge.

La phrase s'adresse à l'utilisateur : une ligne, sans jargon, qui dit ce qui se passe ou ce que l'étape a donné (« 3 tests écrits, puis le code qui les fait passer », « Les vérifications échouent sur l'affichage de la photo, 2e essai »). Respecte la section « L'utilisateur » d'`AGENTS.md`.

Le journal ne sert qu'au suivi : si `log-step.sh` échoue, continue le ticket.

## 0. Vérifier que le projet est prêt

Le projet doit avoir été préparé par `project-init` : un `AGENTS.md` sans « À REMPLIR », un `scripts/checks.sh` sans « À REMPLIR » et un fichier `docs/agents/issue-tracker.md`. S'il manque quelque chose, propose de lancer `project-init`, et arrête-toi là.

Lis `docs/agents/issue-tracker.md` : il dit comment lire un ticket et ses blocages. Si les tickets sont des fichiers locaux, tout se déroule de la même façon, mais sans push ni pull request (étape 9), et sans les scripts `tickets.sh` et `cleanup.sh`, qui lisent GitHub.

Sur GitHub, lance d'abord `scripts/cleanup.sh`. Il fait le ménage des tickets déjà mergés (worktree et branche) et ferme les specs dont tous les tickets sont terminés. Il garde tout dossier qui contient du travail non commité. Mentionne en une ligne ce qu'il a fait, s'il a fait quelque chose.

## 1. Choisir et réserver le ticket

**Ne pose aucune question** : prends toujours le premier ticket libre, celui qui a le plus petit numéro.

- **Sans numéro** : `scripts/tickets.sh next`.
- **Avec un numéro** : lance d'abord `scripts/tickets.sh check <n>` et lis le `verdict` :
  - `ok` : c'est ce ticket.
  - `spec` : ce numéro est une spec, pas un ticket. Prends `scripts/tickets.sh next <n>`, le premier ticket libre de cette spec, et dis-le en une ligne.
  - `assigned`, avec un dossier `.worktrees/ticket-<n>` déjà présent : c'est une reprise après un arrêt. Continue sur ce ticket.
  - `closed`, `not-ready`, `blocked` ou `assigned` sans dossier : dis en une phrase pourquoi ce ticket ne peut pas être construit maintenant (déjà terminé, pas encore prêt, en attente d'un autre ticket, déjà pris par une autre session), propose `/build-ticket` seul, et arrête-toi.

Si `next` ne renvoie rien, aucun ticket n'est libre. Dis pourquoi en une phrase (tout est terminé, les tickets restants attendent un ticket en cours, ou les autres sessions les ont déjà pris) et arrête-toi.

**Réserve-le aussitôt** avec `scripts/start-ticket.sh --new <n> "<titre court du ticket>"` (sans `--new` pour une reprise). Il crée, depuis le dernier `main`, la branche `ticket/<n>-<titre>` et le worktree `.worktrees/ticket-<n>`. La création de la branche est la réservation : deux sessions lancées en même temps ne peuvent pas prendre le même ticket. S'il répond avec le code 3, une autre session vient de le prendre : relance `scripts/tickets.sh next` et recommence, trois fois au plus. Note les valeurs `worktree`, `branch` et `base` qu'il affiche.

Sur GitHub, assigne-toi le ticket (`gh issue edit <n> --add-assignee @me`), pour que la réservation se voie aussi sur GitHub.

Note `isoler` dans le journal. Annonce en une ligne le ticket que tu construis, et continue sans attendre.

## 2. Lire

Lis le ticket en entier (commentaires compris), la spec dont il vient (son ticket parent, ou la ligne `Part of #…`), `AGENTS.md`, `GLOSSARY.md` et les ADR qui touchent la zone concernée.

Respecte la section « L'utilisateur » d'`AGENTS.md` dans tout ce que tu lui écris, jusqu'au brief.

## 3. Travailler dans le worktree

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

D'autres tickets ont peut-être été mergés pendant que tu travaillais. Intègre le dernier `main` : `git fetch origin && git rebase <base>`. En cas de conflit, résous-le en gardant le travail des deux côtés, puis relance `scripts/gate.sh <base>` : il doit passer de nouveau.

Pousse la branche : `git push -u origin <branch>` (après un rebase sur une branche déjà poussée : `git push --force-with-lease`).

Ouvre la pull request vers la branche de base, avec un titre court et un corps écrit selon le skill `pr`. Ajoute au corps :

- `Closes #<n>` en première ligne. Si `scripts/tickets.sh last-of-spec <n>` affiche un numéro, c'est le dernier ticket ouvert de sa spec : ajoute `Closes #<spec>`, pour que la spec se ferme avec ce merge ;
- le chemin du brief (`docs/briefs/<n>-<titre>/index.html`) ;
- les interfaces testées (étape 5) ;
- ce que la relecture a laissé ouvert, s'il reste quelque chose.

**Ne merge pas de toi-même**, même si tout est vert. Si les tickets sont des fichiers locaux, arrête-toi après le commit du brief.

## 10. Conclure

Donne à l'utilisateur, en quelques lignes : le lien de la PR, le chemin du brief, et ouvre-le dans le navigateur avec `scripts/open.sh` du skill `feature-brief` (jamais dans un aperçu : les images n'y apparaissent pas), et ce qui reste ouvert.

Puis dis-lui ce qu'il a à faire, et rien d'autre :

> Lisez le brief. Si l'évolution vous convient, dites-moi « merge la PR » : je vérifie d'abord qu'elle est à jour et que les checks passent, puis je la merge et je fais le ménage.

## 11. Merger, sur demande

Seulement quand l'utilisateur le demande, dans cette session ou une autre : lance `scripts/merge-pr.sh <numéro de la PR>`. Il ne merge que si c'est sans danger pour `main`, puis fait le ménage.

- Code 0 : c'est mergé. Dis-le en une ligne.
- Code 4, pas à jour : un autre ticket a été mergé entre-temps. Refais l'étape 9 (rebase, gate, push), puis relance `scripts/merge-pr.sh`.
- Code 5, gate à relancer : lance `scripts/gate.sh <base>` dans le worktree, corrige s'il échoue, pousse, puis relance `scripts/merge-pr.sh`.

Si l'utilisateur merge lui-même avec le bouton vert « Merge pull request » de GitHub, rien n'est vérifié : c'est sans risque quand un seul ticket est en cours, pas quand plusieurs avancent en parallèle.

## Règles

- Ne commit jamais sur `main`. Ne force-push que sur la branche du ticket, avec `--force-with-lease`.
- Ne merge que sur demande explicite de l'utilisateur, après lecture du brief.
- Ne modifie jamais `scripts/checks.sh` ni un test existant pour faire passer le gate, sauf si le ticket le demande explicitement.
- Si tu t'arrêtes avant la PR, note `arrete` dans le journal avec la raison, puis dis à quelle étape, pourquoi, et ce qu'il faut pour reprendre : relancer `/build-ticket <n>` réutilise le worktree.
