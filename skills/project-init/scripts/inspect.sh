#!/usr/bin/env bash
# Décrit l'état du projet courant, une ligne clé=valeur par élément. Ne modifie rien.
set -uo pipefail

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "git=yes"
  cd "$(git rev-parse --show-toplevel)"
  echo "root=$(pwd)"
  echo "branch=$(git branch --show-current)"
else
  echo "git=no"
  echo "root=$(pwd)"
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "gh_auth=yes"
  repo=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
  echo "github=${repo:-none}"
  # Protection de la branche principale, en lecture seule : on, off, unavailable (repo privé et
  # compte gratuit) ou no-branch (rien de poussé).
  if [ -n "$repo" ]; then
    default=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)
    if p=$(gh api "repos/$repo/branches/${default:-main}/protection" 2>&1); then
      echo "protection=on"
    else
      case "$p" in
        *"Upgrade to GitHub Pro"*) echo "protection=unavailable" ;;
        *"Branch not found"*) echo "protection=no-branch" ;;
        *"not protected"*) echo "protection=off" ;;
        *) echo "protection=unknown" ;;
      esac
    fi
  fi
else
  echo "gh_auth=no"
  echo "github=unknown"
fi

if [ ! -f AGENTS.md ]; then
  echo "agents_md=absent"
elif grep -q "À REMPLIR" AGENTS.md; then
  echo "agents_md=to-fill"
elif grep -q "À DÉCIDER AVEC /project-launch" AGENTS.md; then
  echo "agents_md=launch-pending"
else
  echo "agents_md=filled"
fi

# Sections du modèle absentes d'AGENTS.md (titres « ## »), séparées par « | ».
TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/templates/AGENTS.md"
if [ -f AGENTS.md ]; then
  missing=$(grep '^## ' "$TEMPLATE" | while IFS= read -r h; do grep -qxF "$h" AGENTS.md || printf '%s|' "${h#\#\# }"; done)
  echo "missing_sections=${missing%|}"
fi

if [ ! -f CLAUDE.md ]; then
  echo "claude_md=absent"
elif [ "$(grep -v '^[[:space:]]*$' CLAUDE.md)" = "@AGENTS.md" ]; then
  echo "claude_md=import-only"
else
  echo "claude_md=custom"
fi

if [ ! -f scripts/checks.sh ]; then
  echo "checks=absent"
elif grep -q "À REMPLIR" scripts/checks.sh; then
  echo "checks=to-fill"
else
  echo "checks=filled"
fi

# Le workflow qui relance les checks sur GitHub, à chaque pull request.
if [ ! -f .github/workflows/checks.yml ]; then
  echo "ci=absent"
elif grep -q "À REMPLIR" .github/workflows/checks.yml; then
  echo "ci=to-fill"
else
  echo "ci=filled"
fi

[ -f docs/agents/issue-tracker.md ] && echo "skills_setup=yes" || echo "skills_setup=no"
if [ -n "$(git ls-files --cached --others --exclude-standard 2>/dev/null | grep -vE '^(AGENTS|CLAUDE|README)\.md$|^scripts/checks\.sh$|^\.github/workflows/checks\.yml$|^docs/agents/|^\.gitignore$' | head -1)" ]; then
  echo "code=yes"
else
  echo "code=no"
fi

[ -f GLOSSARY.md ] && echo "glossary=yes" || echo "glossary=no"
