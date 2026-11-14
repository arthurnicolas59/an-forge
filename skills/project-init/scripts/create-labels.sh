#!/usr/bin/env bash
# Crée sur le repo GitHub courant les étiquettes utilisées par to-spec, to-tickets et la factory.
# Les étiquettes qui existent déjà ne sont pas modifiées.
set -euo pipefail

create() {
  if gh label create "$1" --color "$2" --description "$3" >/dev/null 2>&1; then
    echo "créée : $1"
  else
    echo "déjà là : $1"
  fi
}

create ready-for-agent "0E8A16" "Prêt à être construit par un agent"
create ready-for-human "1D76DB" "Demande une intervention humaine"
create needs-info      "FBCA04" "Il manque des informations"
create needs-triage    "D4C5F9" "À trier"
create "taille:petit" "C2E0C6" "Ticket petit : un seul endroit, peu de fichiers"
create "taille:moyen" "FEF2C0" "Ticket moyen : plusieurs fichiers ou couches"
create "taille:gros" "F9D0C4" "Ticket gros : données, accès, paiement ou changement large"
create wontfix         "CCCCCC" "Ne sera pas fait"
