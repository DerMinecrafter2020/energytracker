#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

ENV_FILE="${ENV_FILE:-.env.local}"
APP_URL="${APP_URL:-http://localhost:3001}"

info() {
  printf '\033[1;34m==>\033[0m %s\n' "$1"
}

success() {
  printf '\033[1;32m✓\033[0m %s\n' "$1"
}

fail() {
  printf '\033[1;31mFehler:\033[0m %s\n' "$1" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker ist nicht installiert. Installiere Docker zuerst: https://docs.docker.com/engine/install/"
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  fail "Docker Compose fehlt. Installiere das Docker Compose Plugin oder docker-compose."
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker laeuft nicht oder dein Benutzer hat keinen Zugriff auf den Docker-Daemon."
fi

if [ ! -f "$ENV_FILE" ]; then
  info "Erstelle $ENV_FILE aus .env.example"
  cp .env.example "$ENV_FILE"
  success "$ENV_FILE erstellt"
else
  success "$ENV_FILE ist vorhanden"
fi

info "Baue und starte Docker Compose Services"
"${COMPOSE[@]}" --env-file "$ENV_FILE" up -d --build

info "Warte auf API Health-Check"
HEALTH_OK=0
for _ in $(seq 1 30); do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "$APP_URL/api/health" >/dev/null 2>&1; then
      HEALTH_OK=1
      break
    fi
  elif "${COMPOSE[@]}" exec -T app node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done

if [ "$HEALTH_OK" -ne 1 ]; then
  "${COMPOSE[@]}" logs --tail=120 app
  fail "Die API hat nicht rechtzeitig auf $APP_URL/api/health geantwortet."
fi

success "Installation abgeschlossen"
"${COMPOSE[@]}" ps

printf '\nApp:     %s\n' "$APP_URL"
printf 'Mailpit: http://localhost:8025\n'
