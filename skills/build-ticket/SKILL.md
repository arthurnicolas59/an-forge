---
name: build-ticket
description: Construit un ticket ready-for-agent de bout en bout, sans s'arrêter, jusqu'à une pull request : branche isolée, code en TDD, checks, relectures par des agents indépendants, brief d'une page pour le dirigeant. Reprend aussi une pull request après une demande de changement. Utilise quand l'utilisateur veut construire, réaliser, traiter ou corriger un ticket, ou demande /build-ticket.
---

# Build ticket

Le niveau feature du workflow an-forge : un ticket `ready-for-agent` entre, une pull request et un brief d'une page sortent.

```
Isoler → Avant → Construire → Tester → Relire → Après → Brief → PR → Checks GitHub
```

Tout se fait **sans s'arrêter ni poser de question** : l'utilisateur n'intervient qu'à la fin, en lisant le brief puis en décidant de merger ou de demander un changement (étape 12). Une seule exception : un ticket qu'on ne peut pas construire sans deviner (étape 2). Lance ce skill dans une session neuve, un ticket par session. Par défaut, un ticket à la fois : on construit le suivant une fois le précédent mergé. Le parallèle est possible (une session par ticket, chacune réserve un ticket différent), mais deux tickets corrects séparément peuvent se contredire, et des ressources comme une base de données de développement restent partagées.

**Options** : `/build-ticket --eco` construit toujours sur le modèle moyen (Sonnet), `/build-ticket --max` toujours sur le plus capable (Opus), quelle que soit la taille du ticket. Elles se combinent avec un numéro (`/build-ticket --eco 12`). Les relectures restent sur le plus capable dans tous les cas (étape 2, « Choisir les modèles »).

Les scripts cités sont dans le dossier `scripts/` à côté de ce fichier. Pour lancer un skill depuis celui-ci, si ton outil ne sait pas le faire, lis son `SKILL.md` et suis-le.

## 0. Vérifier que le projet est prêt

Le projet doit avoir été préparé par `project-init` : un `AGENTS.md` sans « À REMPLIR », un `scripts/checks.sh` sans « À REMPLIR » et un fichier `docs/agents/issue-tracker.md`. S'il manque quelque chose, propose de lancer `project-init`, et arrête-toi là.

Lis `docs/agents/issue-tracker.md` : il dit comment lire un ticket et ses blocages. Si les tickets sont des fichiers locaux, tout se déroule de la même façon, mais sans push ni pull request (étape 9), et sans les scripts `tickets.sh`, `cleanup.sh` et `flag-ticket.sh`, qui lisent GitHub : là où ce skill demande `flag-ticket.sh`, change la ligne `Status` du fichier du ticket et écris le message dessous.

Sur GitHub, lance d'abord `scripts/cleanup.sh`. Il fait le ménage des tickets déjà mergés (worktree et branche) et ferme les specs dont tous les tickets sont terminés. Il garde tout dossier qui contient du travail non commité. Mentionne en une ligne ce qu'il a fait, s'il a fait quelque chose.

## 1. Choisir et réserver le ticket

**Ne pose aucune question** : prends toujours le premier ticket libre, celui qui a le plus petit numéro.

- **Sans numéro** : `scripts/tickets.sh next`.
- **Avec un numéro** : lance d'abord `scripts/tickets.sh check <n>` et lis le `verdict` :
  - `ok` : c'est ce ticket.
  - `spec` : ce numéro est une spec, pas un ticket. Prends `scripts/tickets.sh next <n>`, le premier ticket libre de cette spec, et dis-le en une ligne.
  - `assigned` ou `human`, avec un dossier `.worktrees/ticket-<n>` déjà présent : c'est une reprise. Si sa pull request est déjà ouverte (`gh pr list --head <branche>`), le ticket est construit : va à l'étape 12 si l'utilisateur demande un changement, sinon rappelle-lui que la PR attend sa décision et arrête-toi. Sinon, c'est une reprise après un arrêt : lance `scripts/flag-ticket.sh ready <n>` et continue sur ce ticket.
  - `needs-info` : une question attend l'utilisateur sur ce ticket. Lis ses commentaires. Si la réponse y est, ou si l'utilisateur vient de la donner (écris-la alors en commentaire du ticket), lance `scripts/flag-ticket.sh ready <n>` et prends ce ticket. Sinon, redonne la question à l'utilisateur et arrête-toi.
  - `closed`, `not-ready`, `blocked`, ou `assigned` / `human` sans dossier : dis en une phrase pourquoi ce ticket ne peut pas être construit maintenant (déjà terminé, pas encore prêt, en attente d'un autre ticket, déjà pris par une autre session), propose `/build-ticket` seul, et arrête-toi.

Si `next` ne renvoie rien, aucun ticket n'est libre. Dis pourquoi en une phrase (tout est terminé, les tickets restants attendent un ticket en cours, ou les autres sessions les ont déjà pris) et arrête-toi.

**Réserve-le aussitôt** avec `scripts/start-ticket.sh --new <n> "<titre court du ticket>"` (sans `--new` pour une reprise). Il crée, depuis le dernier `main`, la branche `ticket/<n>-<titre>` et le worktree `.worktrees/ticket-<n>`. La création de la branche est la réservation : deux sessions lancées en même temps ne peuvent pas prendre le même ticket. S'il répond avec le code 3, une autre session vient de le prendre : relance `scripts/tickets.sh next` et recommence, trois fois au plus. Note les valeurs `worktree`, `branch` et `base` qu'il affiche.

Sur GitHub, assigne-toi le ticket (`gh issue edit <n> --add-assignee @me`), pour que la réservation se voie aussi sur GitHub.

Annonce en une ligne le ticket que tu construis, et continue sans attendre.

## 2. Lire

Lis le ticket en entier (commentaires compris), la spec dont il vient (son ticket parent, ou la ligne `Part of #…`), `AGENTS.md`, `GLOSSARY.md` et les ADR qui touchent la zone concernée.

Respecte la section « L'utilisateur » d'`AGENTS.md` dans tout ce que tu lui écris, jusqu'au brief.

Note les **critères d'acceptation** du ticket, mot pour mot : chacun devra avoir sa preuve à la fin (étape 8).

**Le ticket peut-il être construit sans deviner ?** Un détail qui manque se décide : choisis la lecture la plus simple, et note-la pour la section « choix » du brief. Mais arrête-toi tout de suite, avant d'écrire du code, si une mauvaise supposition ferait construire la mauvaise chose :

- le ticket contredit sa spec, un ADR ou un autre critère ;
- deux lectures possibles donnent deux résultats différents pour l'utilisateur ;
- il n'y a aucun critère d'acceptation, ou aucun n'est vérifiable ;
- le ticket dépend de quelque chose qui n'existe pas (un écran, une donnée, un accès).

Dans ce cas, lance `scripts/flag-ticket.sh needs-info <n> "<message>"`. Le message pose **une question précise**, avec les réponses possibles et celle que tu recommandes, écrite pour l'utilisateur décrit dans `AGENTS.md`. Le script écrit la question sur le ticket, pose l'étiquette `needs-info` et libère le ticket. Donne la même question à l'utilisateur, dis-lui que le ticket reprendra avec `/build-ticket <n>` une fois sa réponse donnée, et arrête-toi. Si le ticket avait été choisi sans numéro, dis aussi que `/build-ticket` seul prendra le ticket suivant.

### Choisir les modèles

Le ticket a une **taille** : `taille=` dans la sortie de `scripts/tickets.sh check <n>` (étiquette `taille:petit`, `taille:moyen` ou `taille:gros` sur GitHub ; ligne `**Taille:**` du fichier pour un ticket local).

- **Petit** : un seul endroit du code, peu de fichiers, rien de nouveau à inventer.
- **Moyen** : plusieurs fichiers ou plusieurs couches, mais une seule fonctionnalité.
- **Gros** : touche aux données (schéma, migration), aux accès, aux paiements, ou change beaucoup de fichiers d'un coup.

Si le ticket n'a pas de taille (`inconnue`) et que tu n'as reçu ni `--eco` ni `--max`, fais-la décider par **un sous-agent sur le plus petit modèle (Haiku)** : donne-lui le ticket et les trois définitions ci-dessus, et demande un seul mot : `petit`, `moyen` ou `gros`. Pose-la ensuite sur le ticket (`gh issue edit <n> --add-label taille:<taille>`, ou la ligne `**Taille:**` d'un fichier local) pour que la décision se voie. Si l'étiquette n'existe pas encore, relance `create-labels.sh` du skill `project-init`, ou continue sans la poser.

Lance ensuite `scripts/pick-model.sh <taille> [--eco|--max]` : il donne `build=` (le modèle de la construction, Sonnet pour un petit ticket, Opus pour un moyen ou un gros) et `review=` (toujours Opus). Annonce-les en une ligne avec la taille.

Dans Claude Code, passe ces noms en paramètre `model` du sous-agent. Dans un autre outil, prends le modèle équivalent (moyen / le plus capable). Si ton outil ne sait pas choisir le modèle d'un sous-agent, saute ce choix : construis toi-même, sur le modèle de la session, et dis-le dans la PR.

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

Confie la construction (étapes 5 et 6) à **un sous-agent** sur le modèle `build=`, lancé dans le worktree, et orchestre toi-même le reste. Donne-lui, copiés en entier parce qu'il ne voit rien d'autre : le ticket et ses critères, la spec, les règles d'`AGENTS.md`, le chemin du worktree et de la base, et les consignes de cette étape et de la suivante. Demande-lui de rendre : les commits faits, le résultat du gate, la liste des interfaces testées, les choix faits là où le ticket ne disait rien, et ce qui semble faux dans le ticket. Si ton outil ne sait pas lancer de sous-agent, construis toi-même.

Le constructeur suit le skill `tdd`, en respectant l'architecture existante et les règles d'`AGENTS.md`.

- Le skill `tdd` demande de valider avec l'utilisateur où placer les tests. Ici, **ne l'attends pas** : choisis toi-même les interfaces à tester, en suivant ses critères, et garde-en la liste pour la PR.
- Pour un bug, termine `diagnosing-bugs` : le test de régression fait partie du travail.
- Commit après chaque tranche qui passe, sur la branche du ticket, avec un message court qui commence par `#<n>`.
- Fais ce que demande le ticket, rien de plus. Ce qui manque ou semble faux dans le ticket va dans la PR, pas dans le code.

## 6. Tester

Lance `scripts/gate.sh <base>` depuis le worktree, même si le constructeur l'a déjà lancé : le résultat qui compte est le tien. Il refuse une branche qui modifie `scripts/checks.sh` ou `.github/workflows/checks.yml`, puis lance les checks du projet.

- `GATE: PASS` : continue.
- `GATE: FAIL` : corrige la cause, commit, relance. Si le même échec revient **trois fois**, arrête-toi : pas de PR. Résume l'échec, ce que tu as essayé, et laisse le worktree en place (voir « S'arrêter en route »).
- `TESTS EXISTANTS TOUCHÉS` : le gate liste les tests qui existaient avant et que la branche a supprimés ou raccourcis. Remets chacun en l'état, sauf si le ticket demande ce changement de comportement. Ceux qui restent touchés apparaîtront dans le brief : garde pour chacun la raison, pour la PR.

Ne passe jamais à la relecture avec un gate qui échoue, et ne contourne jamais un check (test désactivé, règle de lint coupée).

## 7. Relire

Lance, avec `<base>` comme point fixe et le ticket comme spec, les deux skills de relecture, en même temps si ton outil le permet :

- `code-review` : le code suit-il les règles du projet, et fait-il ce que le ticket demande ?
- `risk-review` : qu'est-ce qui peut mal se passer (bugs, sécurité, données, tests) ? Il donne aussi le **niveau de risque**.

Lance-les sur le modèle `review=` (toujours le plus capable, même avec `--eco`). Ils confient la relecture à des agents neufs, qui ne voient que le diff, le ticket et les règles du projet, pas ton raisonnement : c'est ce qui rend la relecture indépendante.

Si ton outil ne sait pas lancer de sous-agent, arrête-toi avant la PR et demande à l'utilisateur de lancer `code-review` puis `risk-review` dans une nouvelle session, depuis le worktree.

Traite les rapports :

- **Spec** : tout ce qui manque ou est faux par rapport au ticket se corrige. Ce qui dépasse le ticket se retire.
- **Standards** : une règle d'`AGENTS.md` non respectée se corrige. Un avis (« possible … ») se corrige s'il est simple, sinon il va dans la PR.
- **Risques** : un constat `bloquant` ou `à corriger` se corrige, avec un test qui reproduit le scénario décrit. Un constat `à noter` se corrige s'il est simple, sinon il va dans la PR. Si tu penses qu'un constat est faux, ne l'écarte pas en silence : écris pourquoi dans la PR.

Commit, puis relance `scripts/gate.sh <base>`. Si tu as corrigé quelque chose, relance les deux relectures une seconde fois. **Deux tours au maximum** : ce qui reste après est listé dans la PR et dans le brief.

Garde du dernier `risk-review` le niveau de risque, sa phrase d'explication et la partie « À vérifier soi-même » : ils vont dans le brief tels quels. Tu ne baisses jamais ce niveau toi-même. Si un constat `bloquant` reste après deux tours, n'ouvre pas la PR comme si de rien n'était : dis-le en première ligne de la PR et dans `a_decider` du brief.

## 8. Capturer l'après et écrire le brief

- **Changement visible** : suis les étapes 3 et 4 du skill `before-after`.
- **Sinon** : l'« après » est la même commande ou le même test qu'à l'étape 4, qui passe maintenant.

Puis suis le skill `feature-brief` avec le dossier du brief, `<base>`, les résultats du dernier gate et des relectures, et les choix que tu as faits en construisant. En plus de ce qu'il demande :

- **`criteres`** : un par critère d'acceptation du ticket (étape 2), avec le test ou la capture qui le prouve. Un critère sans preuve reste « non prouvé » : ajoute le test qui manque si c'est possible, sinon dis-le dans `a_decider`.
- **`fiabilite.risque`** et **`risque_detail`** : ceux de `risk-review`.
- **`essayer`** : comment l'utilisateur peut essayer lui-même, en reprenant « À vérifier soi-même » de `risk-review` quand il s'applique.

Le script du brief calcule lui-même si les checks ont passé sur cette version et quels tests existants ont été touchés : lance-le après le dernier gate, sans rien modifier au code entre les deux. Commit le dossier du brief : `#<n>: brief`.

## 9. Livrer

D'autres tickets ont peut-être été mergés pendant que tu travaillais. Intègre le dernier `main` : `git fetch origin && git rebase <base>`. En cas de conflit, résous-le en gardant le travail des deux côtés, puis relance `scripts/gate.sh <base>` : il doit passer de nouveau.

Pousse la branche : `git push -u origin <branch>` (après un rebase sur une branche déjà poussée : `git push --force-with-lease`).

Ouvre la pull request vers la branche de base, avec un titre court et un corps écrit selon le skill `pr`. Ajoute au corps :

- `Closes #<n>` en première ligne. Si `scripts/tickets.sh last-of-spec <n>` affiche un numéro, c'est le dernier ticket ouvert de sa spec : ajoute `Closes #<spec>`, pour que la spec se ferme avec ce merge ;
- le chemin du brief (`docs/briefs/<n>-<titre>/index.html`) ;
- les captures « après » du brief, affichées dans le texte et pas seulement citées : `![<nom de l'écran>](https://github.com/<owner>/<repo>/raw/<sha>/docs/briefs/<n>-<titre>/<image>.png)`, avec le SHA du dernier commit poussé, pour que l'image reste visible après le merge et la suppression de la branche ;
- les interfaces testées (étape 5) ;
- les tests existants supprimés ou modifiés, avec la raison de chacun, s'il y en a ;
- ce que les relectures ont laissé ouvert, s'il reste quelque chose.

**Attends ensuite le verdict de GitHub**, qui relance les checks de son côté, sur une machine neutre : `scripts/pr-checks.sh <numéro de la PR> --wait`. La commande peut durer plusieurs minutes : donne-lui un délai long.

- `checks=ok` : continue.
- `checks=pending` : les checks tournent encore. Relance la même commande.
- `checks=fail` : le gate a passé chez toi mais pas chez GitHub. Lis l'erreur (la commande est affichée), corrige la cause, commit, relance `scripts/gate.sh <base>`, pousse, puis attends de nouveau. La cause est souvent une différence entre ta machine et celle de GitHub : un outil non installé, un fichier non commité, une variable d'environnement. Si le même échec revient **trois fois**, arrête-toi : laisse la PR ouverte et dis dans ta conclusion que GitHub la refuse, et pourquoi (voir « S'arrêter en route »).
- `checks=none` : ce projet n'a pas de `.github/workflows/checks.yml`. Continue, et dis dans ta conclusion que GitHub ne revérifie rien tant que `/project-init` n'a pas été relancé.

**Ne merge pas de toi-même**, même si tout est vert. Si les tickets sont des fichiers locaux, arrête-toi après le commit du brief.

## 10. Conclure

Donne à l'utilisateur, en quelques lignes : le lien de la PR, le chemin du brief, et ouvre-le dans le navigateur avec `scripts/open.sh` du skill `feature-brief` (jamais dans un aperçu : les images n'y apparaissent pas), et ce qui reste ouvert.

Puis dis-lui ce qu'il a à faire, et rien d'autre :

> Lisez le brief. Si l'évolution vous convient, dites-moi « merge la PR » : je vérifie d'abord qu'elle est à jour et que les checks passent, puis je la merge et je fais le ménage. Si quelque chose ne vous convient pas, dites-moi quoi changer : je corrige et je vous redonne un brief à jour.

## 11. Merger, sur demande

Seulement quand l'utilisateur le demande, dans cette session ou une autre : lance `scripts/merge-pr.sh <numéro de la PR>`. Il ne merge que si c'est sans danger pour `main`, puis fait le ménage.

- Code 0 : c'est mergé. Dis-le en une ligne.
- Code 4, pas à jour : un autre ticket a été mergé entre-temps. Refais l'étape 9 (rebase, gate, push), puis relance `scripts/merge-pr.sh`.
- Code 5, gate à relancer : lance `scripts/gate.sh <base>` dans le worktree, corrige s'il échoue, pousse, puis relance `scripts/merge-pr.sh`.
- Code 6, checks GitHub en échec : corrige comme à l'étape 9, puis relance `scripts/merge-pr.sh`.
- Code 7, checks GitHub en cours : attends avec `scripts/pr-checks.sh <numéro de la PR> --wait`, puis relance `scripts/merge-pr.sh`.

Si l'utilisateur merge lui-même avec le bouton vert « Merge pull request » de GitHub : quand `main` est protégée, GitHub refuse tant que ses checks ne sont pas verts, sauf si le propriétaire confirme qu'il passe outre. Quand elle ne l'est pas (repo privé avec un compte gratuit), rien n'est vérifié.

## 12. Reprendre après le brief, sur demande

Quand l'utilisateur demande un changement sur une PR ouverte, dans cette session ou dans une autre (`/build-ticket <n>` avec sa demande) :

1. **Reformule** la demande en une phrase, et vérifie qu'elle reste dans le ticket. Si elle demande autre chose (un nouveau comportement, une autre zone), ne l'ajoute pas à cette PR : propose `/quick-ticket` pour en faire un ticket à part, et laisse la PR telle quelle.
2. **Corrige** dans le worktree du ticket, comme à l'étape 5 : le test d'abord, un commit par tranche.
3. **Revérifie** : `scripts/gate.sh <base>`, puis un tour des deux relectures (étape 7), sur tout le diff.
4. **Mets le brief à jour** (étape 8) : refais les captures « après » si l'écran a changé, corrige ce qui n'est plus vrai dans `brief.json`, et remplis `revision` avec ce qui a changé depuis la version précédente, en une phrase. Commit.
5. **Pousse** comme à l'étape 9 (rebase, gate, push), attends le verdict de GitHub, et écris un commentaire sur la PR : la demande, et ce qui a été fait.
6. **Conclus** comme à l'étape 10.

Une question de l'utilisateur sur le brief n'est pas une demande de changement : réponds-y sans toucher au code.

## S'arrêter en route

Si tu dois t'arrêter avant la fin (le gate échoue trois fois, GitHub refuse trois fois la PR, une relecture est impossible, un outil manque), l'arrêt doit se voir ailleurs que dans cette conversation. Lance `scripts/flag-ticket.sh human <n> "<message>"`, avec dans le message : l'étape où tu t'es arrêté, ce qui bloque, ce que tu as essayé, et ce qu'il faut pour reprendre. Le script l'écrit sur le ticket et pose l'étiquette `ready-for-human`. Le ticket reste réservé et son worktree reste en place : relancer `/build-ticket <n>` reprend le travail.

## Règles

- Les relectures ne descendent jamais sous le modèle `review=`, même avec `--eco`.
- Ne commit jamais sur `main`. Ne force-push que sur la branche du ticket, avec `--force-with-lease`.
- Ne merge que sur demande explicite de l'utilisateur, après lecture du brief.
- Ne modifie jamais `scripts/checks.sh`, `.github/workflows/checks.yml` ni un test existant pour faire passer le gate, sauf si le ticket le demande explicitement.
- Le niveau de risque, le résultat des checks et la liste des tests touchés ne sont pas ton avis : ils viennent de la relecture indépendante et des scripts.
- Si tu t'arrêtes avant la PR, dis à quelle étape, pourquoi, et ce qu'il faut pour reprendre, à l'utilisateur et sur le ticket (« S'arrêter en route ») : relancer `/build-ticket <n>` réutilise le worktree.
