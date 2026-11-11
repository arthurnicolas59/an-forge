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

**1. Les règles** : copie `templates/AGENTS.md` à la racine du projet et remplis-le.
Pour Claude Code, ajoute un `CLAUDE.md` qui contient seulement `@AGENTS.md`.

**2. Les outils**, selon ton agent :

```bash
# Claude Code (mises à jour automatiques)
claude plugin marketplace add arthurnicolas59/an-forge
claude plugin install an-forge@an-forge

# Autres agents (copie les skills dans le projet)
npx skills@latest add arthurnicolas59/an-forge
```

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
