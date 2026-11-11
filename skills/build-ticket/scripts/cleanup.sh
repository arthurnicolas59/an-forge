#!/usr/bin/env bash
# Fait le ménage après les merges, sans rien demander :
#   - supprime le worktree et la branche (locale et sur GitHub) de chaque ticket dont la pull request est mergée ;
#     un worktree qui contient du travail non commité est gardé, et signalé ;
#   - ferme chaque spec dont tous les tickets sont fermés, avec un commentaire.
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
  wt=$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '/^worktree /{p=$2} $0=="branch "b{print p}')
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

# 2. Les specs terminées : toutes leurs sous-issues sont fermées.
for n in $(gh issue list --state open --limit 200 --json number --jq '.[].number'); do
  summary=$(gh api "repos/$REPO/issues/$n" --jq '"\(.sub_issues_summary.total // 0) \(.sub_issues_summary.completed // 0)"')
  read -r total done <<<"$summary"
  if [ "$total" != "0" ] && [ "$total" = "$done" ]; then
    gh issue close "$n" --comment "Tous les tickets de cette spec sont terminés." >/dev/null &&
      echo "Fermée : spec #$n (ses $total tickets sont terminés)"
  fi
done
exit 0
