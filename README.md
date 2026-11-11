# an-forge

Ma software factory : la base que j'installe dans tous mes projets.

Une demande entre d'un côté, une pull request prête à merger sort de l'autre.
Entre les deux, une chaîne fixe où des **agents** font le travail qui demande du
jugement et des **scripts** font le travail qui doit être exact.

![Lancer un projet avec an-forge](docs/lancement-projet.svg)

## Les 6 parties

| # | Partie | Qui | Rôle |
|---|--------|-----|------|
| 1 | Intake | agent | Décide si une demande vaut la peine d'être construite, et à quelle échelle |
| 2 | Orchestrateur | skill `/factory` | Lance les jobs et passe chaque étape au bon agent |
| 3 | Agents | agents | Un par rôle : spec, build, review, approbation |
| 4 | Gates | script | Tests, lint, build : rien n'avance si ça échoue |
| 5 | État | fichiers | Où en est chaque job, pour pouvoir reprendre après un arrêt |
| 6 | Sortie | GitHub | Une pull request que je merge |

## Le workflow : deux niveaux

### Niveau projet : la direction

Sert à décider quoi construire et comment. On le refait à chaque nouveau projet ou grosse évolution.

**`/project-launch`** enchaîne, dans une seule conversation :

1. `grill-with-docs` : un interrogatoire serré sur l'idée, qui tient à jour `GLOSSARY.md` (le vocabulaire du projet) et les ADR (les décisions).
2. `to-spec` : transforme la conversation en spec et la publie comme issue GitHub.
3. `to-tickets` : découpe la spec en tickets, des tranches complètes qui tiennent chacune dans une session, avec leurs dépendances. Chaque ticket devient une issue `ready-for-agent`.

Il s'arrête pour te demander ton accord avant de publier la spec, puis avant de créer les tickets.

### Niveau feature : la réalisation

Reprend les tickets `ready-for-agent` un par un, chacun dans une session neuve, jusqu'à une pull request :
lire, isoler sur une branche, construire en TDD, prouver, relire, livrer.
*Le skill `/build-ticket` qui enchaîne ces étapes est en cours de construction.*

## Démarrer un nouveau projet

Une seule fois par projet, neuf ou existant : **`/project-init`**. À la fin, le repo est prêt.

1. Inspecte le projet (git, GitHub, fichiers existants).
2. Pose le modèle `AGENTS.md`, sans jamais écraser un fichier existant.
3. Remplit ses sections à partir du code, et te demande le reste.
4. Lance `setup-matt-pocock-skills` (outil de tickets, emplacement des docs).
5. Crée les étiquettes GitHub (`ready-for-agent`…), sans lesquelles la publication des tickets échoue.
6. Crée `CLAUDE.md` avec `@AGENTS.md`.

`CLAUDE.md` est créé en dernier exprès : le setup écrit sa configuration dans `CLAUDE.md` si ce fichier existe,
sinon dans `AGENTS.md`. Ainsi, toute la configuration reste dans `AGENTS.md`, lisible par tous les outils.

## Les skills

| Skill | Rôle | Origine |
|-------|------|---------|
| `project-init` | Prépare un repo pour la factory | an-forge |
| `project-launch` | De l'idée aux tickets : grill, spec, tickets | an-forge |
| `setup-matt-pocock-skills` | Configure un projet (tickets, étiquettes, docs) | Matt Pocock |
| `grill-with-docs` | Interrogatoire + glossaire et ADR | Matt Pocock |
| `grilling` | L'interrogatoire, utilisé par `grill-with-docs` | Matt Pocock |
| `domain-modeling` | Glossaire et ADR, utilisé par `grill-with-docs` | Matt Pocock |
| `to-spec` | Conversation → spec publiée en issue | Matt Pocock |
| `to-tickets` | Spec → tickets `ready-for-agent` | Matt Pocock |
| `tdd` | Construire test d'abord, une tranche à la fois | Matt Pocock |
| `codebase-design` | Vocabulaire de conception, utilisé par `tdd` | Matt Pocock |
| `code-review` | Relire le diff selon les règles et la spec | Matt Pocock |
| `pr` | Rédiger le corps d'une pull request | Matt Pocock |

### Skills venus de Matt Pocock

Ils sont **copiés** depuis [mattpocock/skills](https://github.com/mattpocock/skills) (licence MIT, voir
[licenses/mattpocock-skills.txt](licenses/mattpocock-skills.txt)), pour qu'an-forge soit complet à lui seul
et que ses skills puissent s'enchaîner.

Modifications par rapport à l'original :
- `setup-matt-pocock-skills`, `grill-with-docs`, `to-spec` et `to-tickets` ne sont plus réservés au lancement
  manuel, pour qu'un skill an-forge puisse les appeler. Leur description demande de ne jamais les lancer de
  sa propre initiative.
- Les métadonnées de `pr` ont été retirées de l'en-tête ; les crédits restent dans `skills/pr/CREDITS.md`.

Pour voir ce qui a changé chez Matt depuis la dernière copie :

```bash
scripts/sync-matt.sh          # résumé
scripts/sync-matt.sh --full   # diff complet
```

## Structure du repo

```
AGENTS.md         les règles de la factory (source unique, lisible par tous les outils)
CLAUDE.md         importe AGENTS.md pour Claude Code
skills/           un dossier par skill (SKILL.md, format ouvert Agent Skills)
agents/           un fichier par sous-agent
scripts/          scripts d'an-forge (sync-matt.sh, mattpocock.lock)
licenses/         licences des skills venus d'ailleurs
docs/             la carte de la factory (factory.canvas pour Obsidian, lancement-projet.svg pour tous)
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

- [x] Étape 1 : squelette
- [x] Niveau projet : skills de Matt Pocock intégrés
- [x] `/project-init` et `/project-launch`
- [ ] Étape 2 : niveau feature (`/build-ticket`)
- [ ] Étape 3 : agents
- [ ] Étape 4 : gates et état
- [ ] Étape 5 : orchestrateur `/factory`
- [x] Image du lancement d'un projet (docs/lancement-projet.svg)
- [ ] Étape 6 : test sur un vrai projet

## Inspirations

- [mattpocock/skills](https://github.com/mattpocock/skills)
- [michaelshimeles/rstack](https://github.com/michaelshimeles/rstack)
- [zazencodes software factory v2](https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code-v2)
