# an-forge

Ce repo est la software factory d'Arthur. Il ne contient pas d'application, seulement des
skills, des agents, des scripts et des modèles destinés à être utilisés dans d'autres projets.

Ce fichier est la source unique des règles, quel que soit l'outil (Claude Code, Codex, Cursor,
Copilot, Gemini…). `CLAUDE.md` ne fait que l'importer.

## Structure

- `skills/<nom>/SKILL.md` : un skill, au format ouvert Agent Skills.
- `agents/<nom>.md` : un sous-agent.
- `scripts/` : scripts propres à an-forge (dont `sync-matt.sh`).
- `licenses/` : licences des skills venus d'ailleurs.
- `templates/` : fichiers copiés dans chaque nouveau projet (dont son `AGENTS.md`).
- `docs/factory.canvas` : la carte de la factory, au format JSON Canvas (s'ouvre dans Obsidian).
- `.claude-plugin/` : l'emballage pour Claude Code. Il ne contient aucune règle.

## Règles

- Écris la documentation en français. Les noms de fichiers, de skills et d'agents restent en anglais, en kebab-case.
- Un skill fait une seule chose. Son frontmatter ne contient que `name` et `description`, pour rester lisible par tous les outils.
- Le texte d'un skill ne dépend pas d'un outil précis. Si une étape a besoin d'une fonction propre à un outil, décris aussi comment faire sans.
- Ce qui doit donner le même résultat à chaque fois va dans un script, pas dans des instructions.
- Chaque skill ou agent ajouté reçoit sa carte dans `docs/factory.canvas`, et le README est mis à jour.
- Les skills venus de `mattpocock/skills` sont copiés dans `skills/` (liste et version dans `scripts/mattpocock.lock`). Modifie-les le moins possible pour faciliter les mises à jour, et reprends les changements de Matt avec `scripts/sync-matt.sh`.
