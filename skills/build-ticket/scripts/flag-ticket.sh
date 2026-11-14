#!/usr/bin/env bash
# Rend visible sur GitHub qu'un ticket attend quelqu'un, ou qu'il est de nouveau prêt.
#
# Usage :
#   flag-ticket.sh needs-info <n> "<message>"   le ticket ne peut pas être construit sans une réponse de l'utilisateur.
#                                               Écrit le message en commentaire, pose l'étiquette needs-info,
#                                               retire ready-for-agent et libère le ticket : plus d'assignation,
#                                               et son worktree et sa branche sont supprimés s'ils ne contiennent
#                                               aucun travail (sinon ils sont gardés, et c'est dit).
#   flag-ticket.sh human <n> "<message>"        la construction s'est arrêtée en route et attend un humain.
#                                               Écrit le message en commentaire et pose l'étiquette ready-for-human.
#                                               Le ticket reste réservé et son worktree reste en place, pour reprendre.
#   flag-ticket.sh ready <n>                    le ticket est de nouveau prêt : retire needs-info et ready-for-human,
#                                               remet ready-for-agent.
#
# Le message peut aussi arriver sur l'entrée standard, à la place du troisième argument.
set -uo pipefail

MODE=${1:-}
N=${2:-}
if ! [[ "$MODE" =~ ^(needs-info|human|ready)$ ]] || ! [[ "$N" =~ ^[0-9]+$ ]]; then
  sed -n '2,16p' "$0" >&2
  exit 2
fi

label() { gh issue edit "$N" "$@" >/dev/null 2>&1 || true; }

if [ "$MODE" = "ready" ]; then
  label --remove-label needs-info
  label --remove-label ready-for-human
  gh issue edit "$N" --add-label ready-for-agent >/dev/null || exit 1
  echo "Ticket #$N : de nouveau prêt (ready-for-agent)."
  exit 0
fi

MESSAGE=${3:-}
[ -n "$MESSAGE" ] || MESSAGE=$(cat)
if [ -z "$MESSAGE" ]; then
  echo "Il faut un message : ce qui bloque, et ce qu'il faut pour reprendre." >&2
  exit 2
fi

gh issue comment "$N" --body "$MESSAGE" >/dev/null || exit 1

if [ "$MODE" = "human" ]; then
  gh issue edit "$N" --add-label ready-for-human >/dev/null || exit 1
  echo "Ticket #$N : étiquette ready-for-human posée, message écrit en commentaire. Le worktree reste en place."
  exit 0
fi

# needs-info : le ticket n'est plus à construire tant que la réponse n'est pas là.
gh issue edit "$N" --add-label needs-info >/dev/null || exit 1
label --remove-label ready-for-agent
label --remove-assignee @me
echo "Ticket #$N : étiquette needs-info posée, question écrite en commentaire."

# Libérer la réservation, si rien n'a été construit.
COMMON=$(git rev-parse --path-format=absolute --git-common-dir) || exit 0
ROOT=$(dirname "$COMMON")
cd "$ROOT"
WT="$ROOT/.worktrees/ticket-$N"
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo main)
for branch in $(git for-each-ref --format='%(refname:short)' "refs/heads/ticket/$N-*"); do
  if [ -d "$WT" ] && [ -n "$(git -C "$WT" status --porcelain)" ]; then
    echo "Gardé : $WT contient du travail non commité."
    continue
  fi
  if [ "$(git rev-list --count "$BASE..$branch" 2>/dev/null || echo 1)" != "0" ]; then
    echo "Gardé : la branche $branch contient des commits."
    continue
  fi
  if [ -d "$WT" ]; then git worktree remove "$WT" && echo "Supprimé : worktree $WT"; fi
  git branch -D -q "$branch" && echo "Supprimé : branche $branch (rien n'avait été construit)"
done
exit 0
