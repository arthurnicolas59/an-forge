#!/usr/bin/env bash
# Isole un ticket : une branche ticket/<n>-<titre> et un worktree .worktrees/ticket-<n>,
# créés depuis le dernier main. Si le worktree du ticket existe déjà, le réutilise.
#
# Usage : start-ticket.sh <numéro> <titre-court>
# Affiche des lignes clé=valeur : worktree, branch, base, status (created|reused).
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage : start-ticket.sh <numéro> <titre-court>" >&2
  exit 2
fi

NUM=$1
shift
if ! [[ "$NUM" =~ ^[0-9]+$ ]]; then
  echo "Le numéro du ticket doit être un nombre : $NUM" >&2
  exit 2
fi

# Titre en kebab-case : minuscules, sans accents, tirets, 40 caractères au plus.
SLUG=$(printf '%s' "$*" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || printf '%s' "$*")
SLUG=$(printf '%s' "$SLUG" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40 | sed -E 's/-+$//')
[ -n "$SLUG" ] || SLUG="ticket"

# Toujours partir du checkout principal, même si on est déjà dans un worktree.
COMMON=$(git rev-parse --path-format=absolute --git-common-dir)
ROOT=$(dirname "$COMMON")
cd "$ROOT"

WT="$ROOT/.worktrees/ticket-$NUM"
BRANCH="ticket/$NUM-$SLUG"

# Le dossier .worktrees ne doit jamais être commité : on l'exclut localement, sans toucher .gitignore.
EXCLUDE="$COMMON/info/exclude"
mkdir -p "$(dirname "$EXCLUDE")"
grep -qxF '/.worktrees/' "$EXCLUDE" 2>/dev/null || echo '/.worktrees/' >> "$EXCLUDE"

# Branche de base : main d'origin si possible, à jour.
if git remote get-url origin >/dev/null 2>&1; then
  git fetch -q origin
  DEFAULT=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)
  BASE=$DEFAULT
else
  BASE=main
fi
git rev-parse --verify -q "$BASE^{commit}" >/dev/null || { echo "Branche de base introuvable : $BASE" >&2; exit 1; }

# Déjà un worktree pour ce ticket : on le garde.
if [ -d "$WT" ]; then
  CURRENT=$(git -C "$WT" branch --show-current)
  case "$CURRENT" in
    "ticket/$NUM-"*) ;;
    *) echo "$WT existe mais est sur la branche « $CURRENT », pas sur un ticket $NUM. Regarde-le avant de continuer." >&2; exit 1 ;;
  esac
  echo "worktree=$WT"
  echo "branch=$CURRENT"
  echo "base=$BASE"
  echo "status=reused"
  exit 0
fi

# Une branche de ce ticket existe sans worktree : on ne devine pas, on s'arrête.
EXISTING=$(git for-each-ref --format='%(refname:short)' "refs/heads/ticket/$NUM-*")
if [ -n "$EXISTING" ]; then
  echo "La branche $EXISTING existe déjà sans worktree. Reprends-la avec : git worktree add $WT $EXISTING" >&2
  exit 1
fi

git worktree add -q -b "$BRANCH" "$WT" "$BASE"
# La branche ne suit pas origin/main : le premier push créera origin/$BRANCH.
git -C "$WT" branch -q --unset-upstream 2>/dev/null || true

if [ "$(git -C "$WT" branch --show-current)" != "$BRANCH" ]; then
  echo "Le worktree n'est pas sur $BRANCH : arrêt." >&2
  exit 1
fi

echo "worktree=$WT"
echo "branch=$BRANCH"
echo "base=$BASE"
echo "status=created"
