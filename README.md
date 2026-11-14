# an-forge

Ma software factory : la base que j'installe dans tous mes projets.

Une demande entre d'un côté, une pull request prête à merger sort de l'autre.
Entre les deux, une chaîne fixe où des **agents** font le travail qui demande du
jugement et des **scripts** font le travail qui doit être exact.

**Les cartes** ([docs/index.html](docs/index.html)) montrent tout le chemin :

- [an-forge par phase](docs/skill-map/index.html) : le départ (`/project-init`), puis deux chemins (`/project-launch` ou `/quick-ticket`) et chaque phase (cadrer, construire, vérifier, livrer) ; un double-clic sur un skill ouvre son détail, jusqu'aux scripts ;
- [la carte de Matt Pocock](docs/mattpocock/index.html) : tous ses skills, dont an-forge reprend une partie.

## Les 5 phases

| # | Phase | Qui | Rôle |
|---|-------|-----|------|
| 1 | Cadrer | skills (`/project-launch`, `/quick-ticket`) | Transformer une idée ou une petite demande en tickets `ready-for-agent` |
| 2 | Construire | skill `/build-ticket` | Une branche isolée, le code en TDD, un ticket par session |
| 3 | Vérifier | scripts + agents neufs | `gate.sh` et les checks GitHub : rien n'avance s'ils échouent. `code-review` et `risk-review` relisent le diff |
| 4 | Résumer | skills (`before-after`, `feature-brief`) | Captures avant/après et brief d'une page pour le CEO |
| 5 | Livrer | GitHub + `merge-pr.sh` | Une pull request que je merge |

L'état d'un ticket vit sur GitHub (étiquettes, commentaires, sous-issues), pas dans des fichiers locaux.

## Le workflow : deux niveaux, et un chemin court

### Niveau projet : la direction

Sert à décider quoi construire et comment. On le refait à chaque nouveau projet ou grosse évolution.

**`/project-launch`** enchaîne, dans une seule conversation :

1. `grill-with-docs` : un interrogatoire serré sur l'idée, qui tient à jour `GLOSSARY.md` (le vocabulaire du projet) et les ADR (les décisions).
2. **Le cadre** : pour un projet neuf, le choix de la stack (deux ou trois options, leurs forces et faiblesses, une recommandation à valider), puis `AGENTS.md`, `scripts/checks.sh` et `.github/workflows/checks.yml` remplis et poussés sur GitHub.
3. `to-spec` : transforme la conversation en spec et la publie comme issue GitHub. La spec est le document de référence : elle ne se construit pas, et se ferme toute seule avec son dernier ticket.
4. `to-tickets` : découpe la spec en tickets, des tranches complètes qui tiennent chacune dans une session, avec leurs dépendances. Chaque ticket devient une sous-issue `ready-for-agent` de la spec. Pour un projet neuf, le premier est le socle.

Il s'arrête pour te demander ton accord avant de pousser le cadre, de publier la spec, puis de créer les tickets.

Si tu n'es pas développeur (`/project-init` te le demande), aucune question technique ne t'est posée brute : tu reçois une recommandation expliquée simplement, à valider.

### Le chemin court : une petite demande

Pour un bug, une retouche ou un petit ajout, pas besoin de spec : **`/quick-ticket`** pose trois questions au plus, écrit un seul ticket `ready-for-agent` avec ses critères d'acceptation, et le publie avec ton accord. Si la demande est trop grosse pour un ticket, il te renvoie vers `/project-launch`.

### Niveau feature : la réalisation

Sert à construire un ticket `ready-for-agent`, dans une session neuve, un ticket par session.

**`/build-ticket <n>`** enchaîne, **sans s'arrêter** :

1. **Isoler** : `start-ticket.sh` crée la branche `ticket/<n>-…` et un worktree dans `.worktrees/`, depuis le dernier `main`.
2. **Construire** : `tdd`, test d'abord. Pour un bug, `diagnosing-bugs` le reproduit avant de le corriger.
3. **Tester** : `gate.sh` lance `scripts/checks.sh`. Rien n'avance tant qu'il échoue, et une branche qui modifie les checks est refusée.
4. **Relire** : des agents neufs, qui ne voient que le diff, le ticket et les règles du projet. `code-review` vérifie les règles et la fidélité au ticket ; `risk-review` cherche les bugs, les failles de sécurité et les risques pour les données, et donne le niveau de risque. Deux tours au maximum.
5. **Résumer** : `before-after` capture les écrans avant et après, `feature-brief` écrit le brief pour le CEO dans `docs/briefs/` : une page de synthèse (décision, objectif, avant/après, fiabilité, choix effectués, comment l'essayer), puis une annexe avec les critères du ticket, chacun avec sa preuve, et les fichiers touchés.
6. **Livrer** : une pull request avec `Closes #<n>` et le lien du brief. GitHub relance alors les checks de son côté, sur une machine neutre, et l'agent corrige s'ils échouent. L'agent ne merge pas de lui-même : tu lis le brief, puis tu dis « merge la PR ». `merge-pr.sh` ne merge que si la PR contient le dernier `main`, que les checks ont passé sur exactement cette version, et que ceux de GitHub sont verts.

**Ce que l'agent ne peut pas embellir.** Dans le brief, trois informations ne viennent pas de l'agent qui a codé : le niveau de risque (donné par le relecteur indépendant), le résultat des checks et la liste des tests existants supprimés ou modifiés (calculés par les scripts).

**Après le brief**, tu as deux réponses possibles : « merge la PR », ou dire ce qui ne te convient pas. Dans ce cas l'agent corrige, relance les checks et les relectures, et te redonne un brief à jour. Une demande qui sort du ticket devient un nouveau ticket (`/quick-ticket`).

**Quand ça coince, ça se voit sur GitHub.** Un ticket qu'on ne peut pas construire sans deviner n'est pas construit : l'agent écrit sa question sur le ticket, avec l'étiquette `needs-info`, et passe au suivant. Une construction qui s'arrête en route (checks en échec trois fois, par exemple) laisse un commentaire sur le ticket, avec l'étiquette `ready-for-human`.

Au début de chaque `/build-ticket`, `cleanup.sh` fait le ménage des tickets déjà mergés et ferme les specs terminées : aucune commande à taper.

`/build-ticket` ne pose aucune question : sans numéro (ou avec celui d'une spec), il prend le premier ticket libre, celui qui a le plus petit numéro. **Par défaut, un ticket à la fois** : on lance le suivant une fois le précédent mergé. Le parallèle est possible, avec une session par ticket : chaque session réserve un ticket différent en créant sa branche. Mais deux changements corrects séparément peuvent se contredire une fois réunis, et une base de données de développement reste partagée. Choisir quels tickets peuvent avancer ensemble serait le rôle d'un futur orchestrateur `/factory`, qui n'existe pas encore.

Les captures et le PDF du brief utilisent Playwright : il faut Node.js 20 ou plus. La première fois, Playwright télécharge Chromium (environ 150 Mo).

## Démarrer un nouveau projet

Une seule fois par projet, neuf ou existant : **`/project-init`**. À la fin, le repo est prêt.

1. Inspecte le projet (git, GitHub, fichiers existants).
2. Pose les modèles `AGENTS.md`, `scripts/checks.sh` et `.github/workflows/checks.yml`, sans jamais écraser un fichier existant.
3. Te demande seulement si tu es développeur. Aucune question sur le projet : s'il a déjà du code, il en déduit les règles et les checks ; s'il est neuf, c'est `/project-launch` qui les fixera.
4. Lance `setup-matt-pocock-skills` (outil de tickets, emplacement des docs).
5. Crée les étiquettes GitHub (`ready-for-agent`…), sans lesquelles la publication des tickets échoue.
6. Crée `CLAUDE.md` avec `@AGENTS.md`.
7. Après le premier push, protège `main` : GitHub refuse de merger une pull request tant que ses checks ne sont pas verts.

**Les checks tournent deux fois.** Une fois chez l'agent (`gate.sh`), une fois chez GitHub (`.github/workflows/checks.yml`), comme un contrôle technique fait par un garage indépendant plutôt que par le vendeur. Avec un compte GitHub gratuit, la protection de `main` n'existe que sur un repo public : sur un repo privé, les checks tournent quand même et `merge-pr.sh` les respecte, mais le bouton « Merge » de GitHub ne vérifie rien.

`CLAUDE.md` est créé en dernier exprès : le setup écrit sa configuration dans `CLAUDE.md` si ce fichier existe,
sinon dans `AGENTS.md`. Ainsi, toute la configuration reste dans `AGENTS.md`, lisible par tous les outils.

## Les skills

| Skill | Rôle | Origine |
|-------|------|---------|
| `project-init` | Prépare un repo pour la factory | an-forge |
| `project-launch` | De l'idée aux tickets : grill, spec, tickets | an-forge |
| `quick-ticket` | D'une petite demande (bug, retouche) à un seul ticket | an-forge |
| `setup-matt-pocock-skills` | Configure un projet (tickets, étiquettes, docs) | Matt Pocock |
| `grill-with-docs` | Interrogatoire + glossaire et ADR | Matt Pocock |
| `grilling` | L'interrogatoire, utilisé par `grill-with-docs` | Matt Pocock |
| `domain-modeling` | Glossaire et ADR, utilisé par `grill-with-docs` | Matt Pocock |
| `to-spec` | Conversation → spec publiée en issue | Matt Pocock |
| `to-tickets` | Spec → tickets `ready-for-agent` | Matt Pocock |
| `build-ticket` | D'un ticket à une PR : isoler, construire, tester, relire, résumer ; puis reprendre sur demande | an-forge |
| `before-after` | Captures des mêmes écrans avant et après un changement | an-forge |
| `feature-brief` | Brief pour le CEO : une page de synthèse et une annexe des fichiers | an-forge |
| `tdd` | Construire test d'abord, une tranche à la fois | Matt Pocock |
| `diagnosing-bugs` | Reproduire un bug avant de le corriger | Matt Pocock |
| `codebase-design` | Vocabulaire de conception, utilisé par `tdd` | Matt Pocock |
| `code-review` | Relire le diff selon les règles et la spec | Matt Pocock |
| `risk-review` | Chercher les bugs, les failles et les risques pour les données ; donner le niveau de risque | an-forge |
| `pr` | Rédiger le corps d'une pull request | Matt Pocock |
| `visual` | Une page HTML : le résumé d'une branche, un plan, ou une carte de skills | Eric Tech (super-board) |

### Skills venus de Matt Pocock

Ils sont **copiés** depuis [mattpocock/skills](https://github.com/mattpocock/skills) (licence MIT, voir
[licenses/mattpocock-skills.txt](licenses/mattpocock-skills.txt)), pour qu'an-forge soit complet à lui seul
et que ses skills puissent s'enchaîner.

Modifications par rapport à l'original :
- `setup-matt-pocock-skills`, `grill-with-docs`, `to-spec` et `to-tickets` ne sont plus réservés au lancement
  manuel, pour qu'un skill an-forge puisse les appeler. Leur description demande de ne jamais les lancer de
  sa propre initiative.
- Les métadonnées de `pr` ont été retirées de l'en-tête ; les crédits restent dans `skills/pr/CREDITS.md`.

### Venu de super-board (Eric Tech)

Copiés depuis [EricTechPro/super-board](https://github.com/EricTechPro/super-board) (licence MIT, voir
[licenses/super-board.txt](licenses/super-board.txt)) : le skill `visual`, le moteur de la carte de Matt
(`docs/_shared/`) et la carte de Matt Pocock. Le skill `visual` est repris tel quel, sauf une retouche : le panneau de détail coupe aussi ses puces avant une majuscule accentuée. Dans le moteur,
seuls la barre du haut, la liste des cartes, la comparaison entre packs et la reconnaissance des noms de skills dans un texte accentué ont été adaptés.

### Le choix du modèle

Chaque ticket a une taille (`taille:petit`, `taille:moyen`, `taille:gros`), posée par `/quick-ticket` et `/to-tickets` ;
sans étiquette, un agent Haiku la décide. `/build-ticket` en tire le modèle de l'agent qui construit :
Sonnet pour un petit ticket, Opus pour un moyen ou un gros (`scripts/pick-model.sh`). Les relectures restent
toujours sur le plus capable. `/build-ticket --eco` force Sonnet, `/build-ticket --max` force Opus.
Pour un projet déjà préparé, relance `create-labels.sh` du skill `project-init` pour créer les trois étiquettes.
Les tests : `bash tests/test-pick-model.sh`.

### Mises à jour

Pour voir ce qui a changé chez Matt ou chez Eric depuis la dernière copie :

```bash
scripts/sync-upstream.sh                     # toutes les sources, résumé
scripts/sync-upstream.sh mattpocock --full   # une source, diff complet
```

### Les cartes

On ne modifie que les données (`docs/skill-map/map.json`), puis :

```bash
scripts/build-maps.sh            # reconstruit les pages et vérifie que chaque skill figure sur la carte
scripts/build-maps.sh --thumbs   # refait aussi les vignettes de la page d'accueil
```

La vérification de la carte (flèches qui se croisent, étiquettes qui se chevauchent) utilise Google Chrome.
Sans Chrome, les pages se construisent quand même, sans cette vérification.

## Structure du repo

```
AGENTS.md         les règles de la factory (source unique, lisible par tous les outils)
CLAUDE.md         importe AGENTS.md pour Claude Code
skills/           un dossier par skill (SKILL.md, format ouvert Agent Skills)
agents/           un fichier par sous-agent (vide pour l'instant)
tests/            tests des scripts (tests/test-pick-model.sh)
scripts/          scripts d'an-forge (sync-upstream.sh, build-maps.sh, un .lock par source copiée)
licenses/         licences des skills venus d'ailleurs
docs/             les cartes de la factory (données en map.json, pages générées par scripts/build-maps.sh)
.claude-plugin/   l'emballage pour Claude Code
```

## Portabilité

| Élément | Claude Code | Autres outils (Codex, Cursor, Copilot, Gemini…) |
|---------|-------------|--------------------------------------------------|
| Règles et workflow | `AGENTS.md` via `CLAUDE.md` | `AGENTS.md` lu directement |
| Skills | plugin | `npx skills add` |
| Sous-agents | plugin | à adapter selon l'outil |

## Installation

**1. Les outils**, une seule fois par machine, selon ton agent. an-forge contient tout ce dont il a besoin.

```bash
# Claude Code (mises à jour automatiques)
claude plugin marketplace add arthurnicolas59/an-forge
claude plugin install an-forge@an-forge

# Autres agents (copie les skills dans le projet)
npx skills@latest add arthurnicolas59/an-forge
```

N'installe pas en plus le plugin de Matt Pocock : chaque skill apparaîtrait en double.

**2. Le projet** : lance `/project-init` dedans (voir [Démarrer un nouveau projet](#démarrer-un-nouveau-projet)).

## Avancement

Fait :
- [x] Squelette et skills de Matt Pocock intégrés
- [x] `/project-init`, `/project-launch`, `/quick-ticket`
- [x] `/build-ticket` : isolation, TDD, checks, relectures, brief, PR, merge contrôlé
- [x] Checks relancés par GitHub, étiquettes `needs-info` / `ready-for-human`
- [x] Choix du modèle par taille de ticket
- [x] Cartes interactives de la factory (`docs/`)

À faire :
- [ ] Test sur un vrai projet (Recipe) : plusieurs tickets à la main
- [ ] Sous-agents dédiés (`agents/` est vide : les relectures passent par des skills)
- [ ] Tests automatiques des scripts et contrôle du bump de version
- [ ] Aperçu de déploiement par PR dans le ticket socle
- [ ] Orchestrateur `/factory` et parallèle, seulement après 10 à 20 tickets faits à la main

## Inspirations

- [mattpocock/skills](https://github.com/mattpocock/skills)
- [EricTechPro/super-board](https://github.com/EricTechPro/super-board)
- [michaelshimeles/rstack](https://github.com/michaelshimeles/rstack)
- [zazencodes software factory v2](https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code-v2)
