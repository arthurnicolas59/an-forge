#!/usr/bin/env bash
# Lit l'état des tickets sur GitHub, toujours de la même façon. Ne modifie rien.
#
# Usage :
#   tickets.sh ready [spec]      liste les tickets libres, du plus petit numéro au plus grand : ouverts,
#                                ready-for-agent, sans sous-ticket (donc pas une spec), sans blocage ouvert,
#                                assignés à personne et sans branche ticket/<n>-… (ici ou sur GitHub),
#                                donc pas déjà pris par une autre session. Avec [spec], seulement ses tickets.
#                                Une ligne par ticket : <numéro><TAB><titre>
#   tickets.sh next [spec]       le premier ticket libre (même format), ou rien
#   tickets.sh check <n>         décrit le ticket <n> en lignes clé=valeur et termine par
#                                taille=petit|moyen|gros|inconnue (étiquette taille:… du ticket) puis
#                                verdict=ok|spec|closed|needs-info|human|not-ready|blocked|assigned
#                                (needs-info : une question attend l'utilisateur ; human : la construction
#                                s'est arrêtée et attend un humain)
#   tickets.sh last-of-spec <n>  affiche le numéro de la spec si <n> est son dernier ticket encore ouvert,
#                                sinon rien
set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# Nombre de blocages encore ouverts : dépendances natives de GitHub, sinon la ligne « Blocked by: #x, #y ».
open_blockers() {
  local n=$1 count body refs ref state
  count=$(gh api "repos/$REPO/issues/$n" --jq '.issue_dependencies_summary.blocked_by // 0')
  if [ "$count" = "0" ]; then
    body=$(gh api "repos/$REPO/issues/$n" --jq '.body // ""')
    refs=$(printf '%s\n' "$body" | grep -iE '^\**blocked by\**:?' | grep -oE '#[0-9]+' | tr -d '#' || true)
    for ref in $refs; do
      state=$(gh api "repos/$REPO/issues/$ref" --jq .state 2>/dev/null) || state=closed
      [ "$state" = "open" ] && count=$((count + 1))
    done
  fi
  echo "$count"
}

# Numéro du ticket parent (la spec), ou vide. GitHub répond 404 quand il n'y en a pas.
parent_of() {
  local out
  if out=$(gh api "repos/$REPO/issues/$1/parent" --jq .number 2>/dev/null); then
    echo "$out"
  fi
}

sub_total() {
  gh api "repos/$REPO/issues/$1" --jq '.sub_issues_summary.total // 0'
}

# Une branche ticket/<n>-… existe ici ou sur GitHub : une session a déjà pris ce ticket.
taken() {
  [ -n "$(git for-each-ref --format='%(refname)' "refs/heads/ticket/$1-*" "refs/remotes/origin/ticket/$1-*")" ]
}

ready() {
  local spec=${1:-} n title
  git fetch -q --prune origin 2>/dev/null || true
  gh issue list --state open --label ready-for-agent --limit 200 \
    --json number,title,assignees --jq '.[] | select(.assignees | length == 0) | "\(.number)\t\(.title)"' |
    sort -n |
    while IFS=$'\t' read -r n title; do
      [ "$(sub_total "$n")" = "0" ] || continue
      if [ -n "$spec" ] && [ "$(parent_of "$n")" != "$spec" ]; then continue; fi
      taken "$n" && continue
      [ "$(open_blockers "$n")" = "0" ] || continue
      printf '%s\t%s\n' "$n" "$title"
    done
}

case "${1:-}" in
  ready)
    ready "${2:-}"
    ;;

  next)
    ready "${2:-}" | sed -n 1p
    ;;

  check)
    n=${2:?Usage : tickets.sh check <n>}
    info=$(gh api "repos/$REPO/issues/$n" --jq '[.state, ([.labels[].name] | index("ready-for-agent") != null), (.assignees | length), (.sub_issues_summary.total // 0), (.pull_request != null), ([.labels[].name] | index("needs-info") != null), ([.labels[].name] | index("ready-for-human") != null)] | @tsv')
    IFS=$'\t' read -r state ready assignees subs is_pr needs_info human <<<"$info"
    parent=$(parent_of "$n")
    parent=${parent:-none}
    blockers=$(open_blockers "$n")
    echo "state=$state"
    echo "ready_for_agent=$ready"
    echo "sub_issues=$subs"
    echo "parent=$parent"
    echo "open_blockers=$blockers"
    echo "assignees=$assignees"
    taille=$(gh api "repos/$REPO/issues/$n" --jq '[.labels[].name | select(startswith("taille:")) | sub("taille:"; "")] | first // "inconnue"')
    case "$taille" in petit | moyen | gros) ;; *) taille=inconnue ;; esac
    echo "taille=$taille"
    if [ "$is_pr" = "true" ]; then
      echo "verdict=not-ready"
    elif [ "$subs" != "0" ]; then
      echo "verdict=spec"
    elif [ "$state" != "open" ]; then
      echo "verdict=closed"
    elif [ "$needs_info" = "true" ]; then
      echo "verdict=needs-info"
    elif [ "$human" = "true" ]; then
      echo "verdict=human"
    elif [ "$ready" != "true" ]; then
      echo "verdict=not-ready"
    elif [ "$blockers" != "0" ]; then
      echo "verdict=blocked"
    elif [ "$assignees" != "0" ]; then
      echo "verdict=assigned"
    else
      echo "verdict=ok"
    fi
    ;;

  last-of-spec)
    n=${2:?Usage : tickets.sh last-of-spec <n>}
    parent=$(parent_of "$n")
    [ -n "$parent" ] || exit 0
    others=$(gh api --paginate "repos/$REPO/issues/$parent/sub_issues" --jq ".[] | select(.state == \"open\" and .number != $n) | .number" | wc -l | tr -d ' ')
    [ "$others" = "0" ] && echo "$parent"
    exit 0
    ;;

  *)
    sed -n '3,18p' "$0" >&2
    exit 2
    ;;
esac
