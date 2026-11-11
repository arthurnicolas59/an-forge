# an-forge

Ma software factory : la base que j'installe dans tous mes projets.

Une demande entre d'un côté, une pull request prête à merger sort de l'autre.
Entre les deux, une chaîne fixe où des **agents** font le travail qui demande du
jugement et des **scripts** font le travail qui doit être exact.

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
Il repose sur les skills de [Matt Pocock](https://github.com/mattpocock/skills), qu'an-forge ne réécrit pas.

1. `/grill-with-docs` : un interrogatoire serré sur l'idée, qui tient à jour `CONTEXT.md` (le vocabulaire du projet) et les ADR (les décisions).
2. `/to-spec` : transforme la conversation en spec et la publie comme issue GitHub.
3. `/to-tickets` : découpe la spec en tickets, des tranches complètes qui tiennent chacune dans une session, avec leurs dépendances. Chaque ticket devient une issue `ready-for-agent`.

Fais les trois dans **la même conversation**, sans la vider entre les étapes : la spec et les tickets s'appuient sur ce que l'interrogatoire a établi.

### Niveau feature : la réalisation

Reprend les tickets `ready-for-agent` un par un, chacun dans une session neuve, jusqu'à une pull request.
*Le détail de ce niveau reste à définir.*

## Démarrer un nouveau projet

À faire une seule fois par projet, **dans cet ordre** :

1. Copier `templates/AGENTS.md` à la racine du projet et remplir les sections « À REMPLIR ». **Ne crée pas encore `CLAUDE.md`.**
2. Lancer `/setup-matt-pocock-skills` : il configure l'outil de tickets (GitHub), les étiquettes et l'emplacement des docs.
3. Créer `CLAUDE.md` avec une seule ligne : `@AGENTS.md`.

Pourquoi cet ordre : le setup écrit sa configuration dans `CLAUDE.md` si ce fichier existe, sinon dans `AGENTS.md`.
En le lançant avant de créer `CLAUDE.md`, toute la configuration reste dans `AGENTS.md`, lisible par tous les outils.

## Structure du repo

```
AGENTS.md         les règles de la factory (source unique, lisible par tous les outils)
CLAUDE.md         importe AGENTS.md pour Claude Code
skills/           un dossier par skill (SKILL.md, format ouvert Agent Skills)
agents/           un fichier par sous-agent
templates/        fichiers copiés dans chaque projet, dont son AGENTS.md
docs/             la carte de la factory (factory.canvas, s'ouvre dans Obsidian)
.claude-plugin/   l'emballage pour Claude Code
```

## Portabilité

| Élément | Claude Code | Autres outils (Codex, Cursor, Copilot, Gemini…) |
|---------|-------------|--------------------------------------------------|
| Règles et workflow | `AGENTS.md` via `CLAUDE.md` | `AGENTS.md` lu directement |
| Skills | plugin | `npx skills add` |
| Sous-agents | plugin | à adapter selon l'outil |

## Installation dans un projet

**1. Les outils**, une seule fois par machine, selon ton agent. an-forge a besoin des skills de Matt Pocock.

```bash
# Claude Code (mises à jour automatiques)
claude plugin install mattpocock-skills@claude-plugins-official
claude plugin marketplace add arthurnicolas59/an-forge
claude plugin install an-forge@an-forge

# Autres agents (copie les skills dans le projet)
npx skills@latest add mattpocock/skills
npx skills@latest add arthurnicolas59/an-forge
```

**2. Le projet** : suis [Démarrer un nouveau projet](#démarrer-un-nouveau-projet).

## Avancement

- [x] Étape 1 : squelette
- [ ] Étape 2 : premiers skills (aligner, planifier)
- [ ] Étape 3 : agents
- [ ] Étape 4 : gates et état
- [ ] Étape 5 : orchestrateur `/factory`
- [ ] Étape 6 : rendu HTML du canvas et test sur un vrai projet

## Inspirations

- [mattpocock/skills](https://github.com/mattpocock/skills)
- [michaelshimeles/rstack](https://github.com/michaelshimeles/rstack)
- [zazencodes software factory v2](https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code-v2)
