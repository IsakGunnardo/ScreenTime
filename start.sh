#!/usr/bin/env bash
# Startar ScreenTime på hemnätet:
#   1. Backend i Docker (port 5080)
#   2. Expo-servern för appen (skanna QR-koden med Expo Go)
#
#   ./start.sh                 allt
#   ./start.sh --backend-only  bara backend
set -euo pipefail
cd "$(dirname "$0")"

say()  { printf '\033[1;35m▸\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- Docker ----------
command -v docker >/dev/null 2>&1 || fail "Docker saknas. Installera Docker Desktop: https://www.docker.com/products/docker-desktop/"
docker info >/dev/null 2>&1 || fail "Docker är inte igång. Starta Docker Desktop och kör skriptet igen."

# ---------- API-nyckel (frågas bara första gången) ----------
if [ ! -f .env ]; then
  say "Första start. Klistra in din Anthropic API-nyckel för AI-kollen (eller tryck Enter för att hoppa över):"
  read -rs KEY || KEY=""
  echo
  umask 077
  printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" > .env
  say "Sparad i .env (ignoreras av git). Ta bort filen för att byta nyckel."
fi

# ---------- Backend ----------
say "Bygger och startar backend (första gången tar det ett par minuter)…"
docker compose up -d --build

say "Väntar på att backend ska svara…"
for _ in $(seq 1 60); do
  if curl -fsS http://localhost:5080/api/config >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://localhost:5080/api/config >/dev/null 2>&1 \
  || fail "Backend svarar inte. Se loggen: docker compose logs api"

# ---------- Nätverksadress ----------
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)"
[ -n "$IP" ] || IP="localhost"
API_URL="http://$IP:5080"

AI="$(curl -fsS http://localhost:5080/api/config | grep -q '"aiEnabled":true' && echo på || echo av)"
echo
say "Backend kör på  $API_URL   (AI-koll: $AI)"
say "Loggar:          docker compose logs -f api"
say "Stoppa:          ./stop.sh"
echo

[ "${1:-}" = "--backend-only" ] && exit 0

# ---------- App ----------
command -v npm >/dev/null 2>&1 || fail "Node.js saknas. Installera från https://nodejs.org och kör igen."
cd app
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  say "Installerar appens paket…"
  npm install
fi
say "Startar Expo. Skanna QR-koden med Expo Go (telefonen måste vara på samma wifi)."
EXPO_PUBLIC_API_URL="$API_URL" exec npx expo start
