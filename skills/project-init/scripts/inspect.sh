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

[ -f docs/agents/issue-tracker.md ] && echo "skills_setup=yes" || echo "skills_setup=no"
if [ -n "$(git ls-files --cached --others --exclude-standard 2>/dev/null | grep -vE '^(AGENTS|CLAUDE|README)\.md$|^scripts/checks\.sh$|^docs/agents/|^\.gitignore$' | head -1)" ]; then
  echo "code=yes"
else
  echo "code=no"
fi

[ -f GLOSSARY.md ] && echo "glossary=yes" || echo "glossary=no"
