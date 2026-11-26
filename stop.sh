#!/usr/bin/env bash
# Stoppar backend. Data (databas, foton) ligger kvar i Docker-volymen.
#   ./stop.sh          stoppa
#   ./stop.sh --reset  stoppa OCH radera all data (ny tom databas nästa start)
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-}" = "--reset" ]; then
  read -rp "Radera ALL data (konton, barn, uppdrag, foton)? Skriv ja: " ok
  [ "$ok" = "ja" ] || { echo "Avbrutet."; exit 0; }
  docker compose down -v
  echo "Stoppat och raderat."
else
  docker compose down
  echo "Stoppat. Data finns kvar."
fi
