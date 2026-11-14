#!/usr/bin/env bash
# Lit le résultat des checks que GitHub a lancés sur une pull request. Ne modifie rien.
#
# Usage : pr-checks.sh <numéro de la PR> [--wait [minutes]]
#   --wait  attend la fin des checks, 9 minutes au plus par défaut. S'ils tournent encore à la fin,
#           répond pending : relance la commande.
#
# Affiche une ligne checks=ok|fail|pending|none :
#   ok       tous les checks ont passé
#   fail     au moins un check a échoué ; leurs noms et leurs liens sont affichés
#   pending  des checks tournent encore
#   none     GitHub ne lance aucun check sur ce projet (pas de .github/workflows)
# Codes : 0 ok ou none · 1 fail · 8 pending
set -uo pipefail

N=${1:?Usage : pr-checks.sh <numéro de la PR> [--wait [minutes]]}
WAIT=0
MINUTES=9
if [ "${2:-}" = "--wait" ]; then
  WAIT=1
  MINUTES=${3:-9}
fi

ROOT=$(git rev-parse --show-toplevel) || exit 2

# Le projet a-t-il des workflows ? Sinon, inutile d'attendre des checks qui ne viendront pas.
has_workflows() {
  ls "$ROOT"/.github/workflows/*.yml "$ROOT"/.github/workflows/*.yaml >/dev/null 2>&1
}

status() {
  gh pr view "$N" --json statusCheckRollup --jq '
    [ (.statusCheckRollup // [])[]
      | (.conclusion // .state // "") as $c
      | if (.status // "COMPLETED") != "COMPLETED" or $c == "" or $c == "PENDING" or $c == "EXPECTED" then "pending"
        elif ($c == "SUCCESS" or $c == "SKIPPED" or $c == "NEUTRAL") then "ok"
        else "fail" end ]
    | if length == 0 then "none"
      elif any(. == "fail") then "fail"
      elif any(. == "pending") then "pending"
      else "ok" end'
}

failed() {
  gh pr view "$N" --json statusCheckRollup --jq '
    (.statusCheckRollup // [])[]
    | (.conclusion // .state // "") as $c
    | select((.status // "COMPLETED") == "COMPLETED" and $c != "" and $c != "PENDING" and $c != "EXPECTED"
             and $c != "SUCCESS" and $c != "SKIPPED" and $c != "NEUTRAL")
    | "  \(.name // .context) : \(.detailsUrl // .targetUrl // "")"'
}

deadline=$(( $(date +%s) + MINUTES * 60 ))
# Juste après un push, GitHub met quelques secondes à inscrire les checks : on lui laisse 90 secondes.
appear=$(( $(date +%s) + 90 ))

while :; do
  s=$(status) || exit 2
  now=$(date +%s)
  if [ "$s" = "none" ] && [ "$WAIT" = 1 ] && has_workflows && [ "$now" -lt "$appear" ]; then
    s=pending
  fi
  if [ "$s" != "pending" ] || [ "$WAIT" = 0 ] || [ "$now" -ge "$deadline" ]; then
    break
  fi
  sleep 15
done

echo "checks=$s"
case "$s" in
  ok|none) exit 0 ;;
  fail)
    echo "Checks en échec sur la PR #$N :" >&2
    failed >&2
    echo "Pour lire l'erreur : gh run view <numéro à la fin du lien, après /runs/> --log-failed" >&2
    exit 1 ;;
  *) exit 8 ;;
esac
