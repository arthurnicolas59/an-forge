# forge-progress

Un mod Claude Code qui suit en direct le workflow [an-forge](https://github.com/arthurnicolas59/an-forge), inspiré de savvy-progress.

- **Barre au-dessus du prompt** : le ticket (`#12 Titre`), une barre des étapes, l'étape en cours (`Tester · essai 2`, `Relire · tour 1`, `Ta décision`), le temps écoulé et les agents qui tournent. `Détails` ouvre le panneau, `✕` masque la barre.
- **Panneau Ticket statut (`/ticket-statut`)**, deux fenêtres en onglets : « Tickets du projet » et « Ticket en cours ». Il s'ouvre sur le ticket en cours s'il y en a un, sinon sur les tickets du projet, et passe tout seul sur « Ticket en cours » quand un `/build-ticket` démarre. `/ticket-statut projet` et `/ticket-statut en-cours` ouvrent directement l'une ou l'autre.
- **Ticket en cours** : les étapes de `/build-ticket` (Isoler → Captures avant → Construire → Tester → Relire → Captures après → Brief → PR → Checks GitHub → Ta décision) avec leur détail (branche, modèles, résultat du gate, tour de relecture, n° de PR, checks), les sous-agents (constructeur, relecteurs) avec modèle, durée et coût estimé, et un journal horodaté. `/ticket-statut reset` efface le suivi.
- **Tickets du projet** : ce qu'il reste à faire sur le projet, une fois la spec découpée. En haut, « À faire maintenant » : les PR qui attendent ta décision, les questions qui t'attendent, puis les tickets libres avec la commande à lancer (`/build-ticket 4`). Dessous, chaque spec avec sa barre (`2/8 faits`) et ses tickets : fait, en construction, PR à décider, prêt, ou « attend #4, #5 ». Un clic sur un ticket affiche dessous son objectif en une phrase simple (écrite par Haiku à partir de « Ce qu'il faut construire », gardée pour la session ; à défaut, la première phrase du ticket) ; un second clic la replie. Quand aucun ticket ne tourne, la barre au-dessus du prompt rappelle l'avancement et la prochaine commande. Lit GitHub (une requête, blocages natifs ou ligne « Blocked by ») ou les fichiers `.scratch/<spec>/issues/*.md`, selon `docs/agents/issue-tracker.md` ; se relit au démarrage, après un merge, une PR, un ticket créé ou modifié, et avec « Actualiser ». S'ouvre tout seul à la fin d'un `/project-launch`.
- Suit aussi `/project-launch` (Interrogatoire → Spec → Tickets → Prêt) et `/quick-ticket`.

Rien à changer dans an-forge : le mod reconnaît les skills lancés et les sorties des scripts (`start-ticket.sh`, `pick-model.sh`, `gate.sh`, `pr-checks.sh`, `merge-pr.sh`, `flag-ticket.sh`, `gh pr create`, `gh issue create`).

**Cartes d'agents** : dans le panneau, chaque sous-agent a sa carte avec son Clawd en couleur (il marche tant que l'agent tourne), son modèle, ses tokens, sa durée, l'étape en cours et ses deux dernières actions (« Lit research.md », « Écrit thumbnails.md »…), plus une barre de progression. En haut, trois cases : coût total, tokens des agents, temps. `/ticket-statut demo` fait défiler un faux ticket pour essayer, sans toucher à GitHub.

**Clawd** : la mascotte de Claude Code s'anime en haut du panneau (et en mini dans la barre) selon l'avancement : il tape sur l'enclume pendant la construction, transpire quand le gate échoue, attend ta décision avec un « ? », saute de joie au merge et dort si le ticket est arrêté. Réglage `clawd` (`oui` par défaut) pour le couper.

Réglage `autoOpen` (`oui` par défaut) : ouvre le panneau Ticket statut au début d'un `/build-ticket`.

Le coût est une estimation à partir des tokens et des prix catalogue, pas une facture.

## Installation

forge-progress est le deuxième plugin du marketplace an-forge (dépôt privé : il faut un accès GitHub au dépôt et `gh auth login` puis `gh auth setup-git` sur la machine).

```
claude plugin marketplace add arthurnicolas59/an-forge
claude plugin install forge-progress@an-forge
```

Ou, au prompt d'une session Claude Code : `/plugin install forge-progress --marketplace arthurnicolas59/an-forge`.

Ensuite : `/ticket-statut` (ou `/an-forge ticket status`) dans un projet préparé par `/project-init`.

Pour le développer, lance Claude Code avec `claude --plugin-dir plugins/forge-progress` ; `claude plugin test plugins/forge-progress` lance les tests.
