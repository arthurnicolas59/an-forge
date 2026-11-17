#!/usr/bin/env bash
# Fait le ménage après les merges, sans rien demander :
#   - supprime le worktree et la branche (locale et sur GitHub) de chaque ticket dont la pull request est mergée ;
#     un worktree qui contient du travail non commité est gardé, et signalé ;
#   - ferme chaque spec dont tous les tickets sont fermés, avec un commentaire ;
#   - retire l'étiquette ready-for-agent de ce qui n'est pas un ticket à construire :
#     les issues fermées et les specs ; et ready-for-human et needs-info des issues fermées ;
#   - remet le dossier principal à jour avec GitHub, s'il est sur la branche principale et sans travail en cours.
#
# Usage : cleanup.sh        (depuis n'importe où dans le repo)
set -uo pipefail

COMMON=$(git rev-parse --path-format=absolute --git-common-dir) || exit 2
ROOT=$(dirname "$COMMON")
cd "$ROOT"

if ! REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null); then
  echo "Pas de repo GitHub : rien à nettoyer."
  exit 0
fi

merged() {
  [ "$(gh pr list --head "$1" --state merged --json number --jq length 2>/dev/null)" != "0" ]
}

# 1. Les tickets mergés.
for branch in $(git for-each-ref --format='%(refname:short)' 'refs/heads/ticket/*'); do
  merged "$branch" || continue
  wt=$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '/^worktree /{p=substr($0,10)} $0=="branch "b{print p}')
  if [ -n "$wt" ]; then
    if [ -n "$(git -C "$wt" status --porcelain)" ]; then
      echo "Gardé : $wt contient du travail non commité (branche $branch déjà mergée)."
      continue
    fi
    git worktree remove "$wt" && echo "Supprimé : worktree $wt"
  fi
  git branch -D -q "$branch" && echo "Supprimé : branche $branch (mergée)"
  if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    git push -q origin --delete "$branch" && echo "Supprimé : branche $branch sur GitHub"
  fi
done
git worktree prune

# Le dossier des worktrees, à côté du projet : supprimé quand il ne contient plus aucun ticket, avec
# son autorisation dans les réglages locaux de Claude Code. start-ticket.sh recrée les deux au besoin.
WTS="$(dirname "$ROOT")/$(basename "$ROOT").worktrees"
if [ -d "$WTS" ]; then
  rm -f "$WTS/.DS_Store"
  if rmdir "$WTS" 2>/dev/null; then
    echo "Supprimé : dossier vide $WTS"
    settings="$ROOT/.claude/settings.local.json"
    if [ -f "$settings" ] && command -v python3 >/dev/null 2>&1; then
      python3 - "$settings" "$WTS" <<'PY' || true
import json, sys
path, folder = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
perms = data.get("permissions", {})
dirs = perms.get("additionalDirectories", [])
if folder in dirs:
    dirs.remove(folder)
    if not dirs:
        del perms["additionalDirectories"]
    if not perms:
        data.pop("permissions", None)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
PY
    fi
  fi
fi

# 1 bis. Le dossier principal : les merges se font sur GitHub, il faut les ramener ici.
# Seulement en avance rapide, sur la branche principale et sans travail en cours : rien n'est écrasé.
default=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)
default=${default:-main}
if [ "$(git branch --show-current)" = "$default" ] && git fetch -q origin "$default" 2>/dev/null; then
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$default")" ]; then
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
      echo "Pas mis à jour : le dossier principal a des modifications en cours ($ROOT)."
    elif git merge -q --ff-only "origin/$default" 2>/dev/null; then
      echo "Mis à jour : le dossier principal est au niveau de GitHub ($default)."
    else
      echo "Pas mis à jour : le dossier principal a des commits que GitHub n'a pas ($ROOT)."
    fi
  fi
fi

# 2. Les specs : une spec n'est pas un ticket à construire, et elle se ferme quand tous ses tickets sont fermés.
for n in $(gh issue list --state open --limit 200 --json number --jq '.[].number'); do
  summary=$(gh api "repos/$REPO/issues/$n" --jq '"\(.sub_issues_summary.total // 0) \(.sub_issues_summary.completed // 0) \([.labels[].name] | index("ready-for-agent") != null)"')
  read -r total done labelled <<<"$summary"
  [ "$total" != "0" ] || continue
  if [ "$labelled" = "true" ]; then
    gh issue edit "$n" --remove-label ready-for-agent >/dev/null &&
      echo "Étiquette retirée : spec #$n (une spec n'est pas un ticket)"
  fi
  if [ "$total" = "$done" ]; then
    gh issue close "$n" --comment "Tous les tickets de cette spec sont terminés." >/dev/null &&
      echo "Fermée : spec #$n (ses $total tickets sont terminés)"
  fi
done

# 3. Les issues fermées n'ont plus rien à construire, et n'attendent plus personne.
for l in ready-for-agent ready-for-human needs-info; do
  for n in $(gh issue list --state closed --label "$l" --limit 200 --json number --jq '.[].number'); do
    gh issue edit "$n" --remove-label "$l" >/dev/null &&
      echo "Étiquette $l retirée : #$n (fermé)"
  done
done
exit 0
