#!/usr/bin/env bash
# Protège la branche principale sur GitHub : une pull request ne peut être mergée que si le job « checks »
# (.github/workflows/checks.yml) a passé sur une version qui contient le dernier main.
# Le propriétaire du repo peut toujours passer outre, mais GitHub lui demande de le confirmer.
#
# À lancer après le premier push : GitHub ne protège qu'une branche qui existe.
# Peut être relancé sans risque. Ne touche pas à une protection déjà en place.
#
# Usage : protect-main.sh
# Affiche une ligne protection=on|already|unavailable|no-branch|failed, puis une phrase d'explication.
# Code de sortie 0 sauf pour failed : une protection impossible n'empêche pas de continuer.
set -uo pipefail

if ! REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null); then
  echo "protection=failed"
  echo "Pas de repo GitHub, ou gh n'est pas connecté." >&2
  exit 1
fi
BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)
BRANCH=${BRANCH:-main}

if gh api "repos/$REPO/branches/$BRANCH/protection" >/dev/null 2>&1; then
  echo "protection=already"
  echo "La branche $BRANCH est déjà protégée : rien changé."
  exit 0
fi

out=$(gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" --input - 2>&1 <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["checks"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
)
code=$?

if [ $code -eq 0 ]; then
  echo "protection=on"
  echo "La branche $BRANCH est protégée : GitHub refuse de merger une pull request tant que ses checks ne sont pas verts."
  exit 0
fi

case "$out" in
  *"Upgrade to GitHub Pro"*)
    echo "protection=unavailable"
    echo "GitHub ne protège pas une branche d'un repo privé avec un compte gratuit. Les checks tourneront quand même sur chaque pull request, et merge-pr.sh les respecte. Seul le bouton « Merge » de GitHub reste sans garde-fou."
    exit 0 ;;
  *"Branch not found"*)
    echo "protection=no-branch"
    echo "La branche $BRANCH n'existe pas encore sur GitHub. Pousse-la, puis relance ce script."
    exit 0 ;;
esac

echo "protection=failed"
echo "$out" >&2
exit 1
