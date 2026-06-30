#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

ENV_FILE="${ENV_FILE:-.env.local}"
REPO_URL="${REPO_URL:-https://github.com/DerMinecrafter2020/energytracker.git}"
REPO_ARCHIVE_URL="${REPO_ARCHIVE_URL:-https://github.com/DerMinecrafter2020/energytracker/archive/refs/heads/main.tar.gz}"
ENV_EXAMPLE_URL="${ENV_EXAMPLE_URL:-https://raw.githubusercontent.com/DerMinecrafter2020/energytracker/refs/heads/main/.env.example}"
APP_URL="${APP_URL:-}"
MODE="${1:-}"

info() {
  printf '\033[1;34m==>\033[0m %s\n' "$1"
}

success() {
  printf '\033[1;32m✓\033[0m %s\n' "$1"
}

warn() {
  printf '\033[1;33m!\033[0m %s\n' "$1"
}

fail() {
  printf '\033[1;31mFehler:\033[0m %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Koffein-Tracker Docker Installer

Aufruf:
  ./install-docker.sh          Interaktive Installation/Konfiguration
  ./install-docker.sh --update Update: Git Pull, Images bauen, Container neu starten
  ./install-docker.sh --help   Hilfe anzeigen

Optionale Umgebungsvariablen:
  ENV_FILE=.env.local
  REPO_URL=https://github.com/DerMinecrafter2020/energytracker.git
  ENV_EXAMPLE_URL=https://raw.githubusercontent.com/DerMinecrafter2020/energytracker/refs/heads/main/.env.example
  APP_URL=https://deine-domain.de
EOF
}

if [[ "$MODE" == "--help" || "$MODE" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "$MODE" != "" && "$MODE" != "--update" && "$MODE" != "-u" ]]; then
  usage
  fail "Unbekannter Parameter: $MODE"
fi

project_files_present() {
  [ -f docker-compose.yml ] && [ -f package.json ] && [ -f server.js ]
}

bootstrap_repository() {
  if project_files_present; then
    return
  fi

  info "Projektdateien wurden nicht gefunden. Lade Repository nach $PROJECT_DIR ..."

  if ! command -v tar >/dev/null 2>&1; then
    fail "tar fehlt. Bitte tar installieren oder das Repository manuell klonen."
  fi

  local tmp_dir repo_dir archive_file
  tmp_dir="$(mktemp -d)"
  repo_dir="$tmp_dir/repo"
  archive_file="$tmp_dir/repo.tar.gz"
  trap 'rm -rf "$tmp_dir"' RETURN

  if command -v git >/dev/null 2>&1; then
    git clone --depth 1 "$REPO_URL" "$repo_dir"
  elif command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --connect-timeout 15 "$REPO_ARCHIVE_URL" -o "$archive_file"
    mkdir -p "$repo_dir"
    tar -xzf "$archive_file" -C "$tmp_dir"
    repo_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d -name 'energytracker-*' | head -n 1)"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$archive_file" "$REPO_ARCHIVE_URL"
    mkdir -p "$repo_dir"
    tar -xzf "$archive_file" -C "$tmp_dir"
    repo_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d -name 'energytracker-*' | head -n 1)"
  else
    fail "Weder git noch curl/wget gefunden. Bitte eines davon installieren oder das Repository manuell klonen."
  fi

  if [ -z "${repo_dir:-}" ] || [ ! -d "$repo_dir" ]; then
    fail "Repository konnte nicht vorbereitet werden."
  fi

  info "Kopiere Repository-Dateien in $PROJECT_DIR"
  (cd "$repo_dir" && tar cf - .) | (cd "$PROJECT_DIR" && tar xpf -)
  chmod +x "$PROJECT_DIR/install-docker.sh" 2>/dev/null || true

  if ! project_files_present; then
    fail "Repository wurde geladen, aber docker-compose.yml/package.json/server.js fehlen weiterhin."
  fi

  success "Repository wurde geladen"
  if [ -x "$PROJECT_DIR/install-docker.sh" ]; then
    exec "$PROJECT_DIR/install-docker.sh" "$@"
  fi
}

bootstrap_repository "$@"

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
  fail "Docker läuft nicht oder dein Benutzer hat keinen Zugriff auf den Docker-Daemon."
fi

write_default_env_file() {
  cat > "$ENV_FILE" <<'EOF'
# ===== APPLICATION =====
DB_TYPE=redis
NODE_ENV=production
PORT=3001
CORS_ORIGIN=http://localhost:3001

# ===== REDIS =====
REDIS_HOST=redis
REDIS_PORT=6379

# ===== AUTH / SECURITY =====
SESSION_SECRET=bitte-ändern-langer-zufälliger-wert
SESSION_TTL_MS=604800000
PASSWORD_SALT=et-caffeine-salt-2024
# Optionaler Fallback. Das Installscript kann ein Verschlüsselungskennwort direkt setzen.
SECRET_ENCRYPTION_KEY=

# Demo-Zugänge sind serverseitig und werden nicht ins Frontend gebaut.
ADMIN_EMAIL=admin@energytracker.de
ADMIN_PASSWORD=Admin@2024!
USER_EMAIL=user@energytracker.de
USER_PASSWORD=User@2024!

# ===== WEBAUTHN / PASSKEYS =====
WEBAUTHN_RP_NAME=Koffein-Tracker
WEBAUTHN_ORIGIN=http://localhost:3001
WEBAUTHN_RP_ID=localhost

# ===== FRONTEND (Vite) =====
VITE_API_BASE_URL=http://localhost:3001
VITE_ADMIN_EMAIL=admin@energytracker.de
VITE_USER_EMAIL=user@energytracker.de

# ===== OPTIONAL: S3 BACKUPS =====
S3_BUCKET=
S3_REGION=eu-central-1
S3_ENDPOINT=
S3_PREFIX=koffein-tracker/backups
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
EOF
}

download_env_example() {
  local target="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --connect-timeout 10 "$ENV_EXAMPLE_URL" -o "$target"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$target" "$ENV_EXAMPLE_URL"
  else
    return 1
  fi
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    if [ -f .env.example ]; then
      info "Erstelle $ENV_FILE aus .env.example"
      cp .env.example "$ENV_FILE"
    elif download_env_example "$ENV_FILE"; then
      success "$ENV_FILE aus GitHub-Vorlage erstellt"
    else
      warn ".env.example wurde nicht gefunden und konnte nicht von GitHub geladen werden. Erstelle $ENV_FILE mit Standardwerten."
      write_default_env_file
    fi
    success "$ENV_FILE erstellt"
  else
    success "$ENV_FILE ist vorhanden"
  fi
}

get_env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- || true
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    awk -v key="$key" -v value="$value" '
      BEGIN { done = 0 }
      $0 ~ "^" key "=" { print key "=" value; done = 1; next }
      { print }
      END { if (!done) print key "=" value }
    ' "$ENV_FILE" > "$tmp"
  else
    cp "$ENV_FILE" "$tmp"
    printf '\n%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  mv "$tmp" "$ENV_FILE"
}

prompt_value() {
  local label="$1"
  local default_value="$2"
  local answer
  if [ -n "$default_value" ]; then
    read -r -p "$label [$default_value]: " answer
    printf '%s' "${answer:-$default_value}"
  else
    read -r -p "$label: " answer
    printf '%s' "$answer"
  fi
}

prompt_secret() {
  local label="$1"
  local answer
  read -r -s -p "$label: " answer
  printf '\n' >&2
  printf '%s' "$answer"
}

normalize_url() {
  local value="$1"
  value="${value%/}"
  if [ -z "$value" ]; then
    printf 'http://localhost:3001'
  elif [[ "$value" =~ ^https?:// ]]; then
    printf '%s' "$value"
  else
    printf 'https://%s' "$value"
  fi
}

host_from_url() {
  local value="$1"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  value="${value%%:*}"
  printf '%s' "${value:-localhost}"
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n'
  else
    date +%s%N | sha256sum | awk '{print $1}'
  fi
}

configure_domain() {
  local current_url domain_url rp_id
  current_url="${APP_URL:-$(get_env_value CORS_ORIGIN)}"
  current_url="${current_url:-http://localhost:3001}"

  info "Domain für die App konfigurieren"
  domain_url="$(prompt_value "App-URL oder Domain" "$current_url")"
  domain_url="$(normalize_url "$domain_url")"
  rp_id="$(host_from_url "$domain_url")"

  set_env_value CORS_ORIGIN "$domain_url"
  set_env_value WEBAUTHN_ORIGIN "$domain_url"
  set_env_value WEBAUTHN_RP_ID "$rp_id"
  set_env_value VITE_API_BASE_URL "$domain_url"
  APP_URL="$domain_url"

  success "Domain gesetzt: $domain_url"
}

configure_encryption_secret() {
  local current_secret secret confirm
  current_secret="$(get_env_value SECRET_ENCRYPTION_KEY)"

  info "Verschlüsselungskennwort hinterlegen"
  warn "Dieses Kennwort schützt gespeicherte Zugangsdaten wie S3 Keys. Schreibe es sicher auf; es wird später nicht erneut angezeigt."

  if [ -n "$current_secret" ]; then
    read -r -p "Vorhandenes Kennwort ersetzen? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[YyJj]$ ]]; then
      success "Vorhandenes Verschlüsselungskennwort bleibt erhalten"
      return
    fi
  fi

  while true; do
    secret="$(prompt_secret "Verschlüsselungskennwort eingeben (min. 32 Zeichen, leer = zufällig generieren)")"
    if [ -z "$secret" ]; then
      secret="$(generate_secret)"
      printf 'Generiertes Kennwort: %s\n' "$secret"
      warn "Bitte dieses Kennwort jetzt sicher notieren. Es wird nicht erneut angezeigt."
    fi
    if [ "${#secret}" -ge 32 ]; then
      set_env_value SECRET_ENCRYPTION_KEY "$secret"
      success "Verschlüsselungskennwort in $ENV_FILE hinterlegt"
      break
    fi
    warn "Das Kennwort muss mindestens 32 Zeichen lang sein."
  done
}

configure_s3() {
  local current_bucket configure_s3 bucket region endpoint prefix path_style access_key secret_key
  current_bucket="$(get_env_value S3_BUCKET)"

  info "S3 Backup konfigurieren"
  read -r -p "S3 jetzt konfigurieren? ${current_bucket:+[Y/n]}${current_bucket:-[y/N]}: " configure_s3
  if [ -z "$configure_s3" ] && [ -n "$current_bucket" ]; then
    configure_s3="y"
  fi
  if [[ ! "$configure_s3" =~ ^[YyJj]$ ]]; then
    success "S3-Konfiguration übersprungen"
    return
  fi

  bucket="$(prompt_value "S3 Bucket" "$(get_env_value S3_BUCKET)")"
  region="$(prompt_value "S3 Region" "$(get_env_value S3_REGION)")"
  region="${region:-eu-central-1}"
  endpoint="$(prompt_value "S3 Endpoint optional" "$(get_env_value S3_ENDPOINT)")"
  prefix="$(prompt_value "S3 Backup-Ordner/Prefix" "$(get_env_value S3_PREFIX)")"
  prefix="${prefix:-koffein-tracker/backups}"
  path_style="$(prompt_value "Path-Style aktivieren? true/false" "$(get_env_value S3_FORCE_PATH_STYLE)")"
  path_style="${path_style:-false}"
  access_key="$(prompt_value "S3 Access Key ID" "$(get_env_value S3_ACCESS_KEY_ID)")"

  if [ -n "$(get_env_value S3_SECRET_ACCESS_KEY)" ]; then
    secret_key="$(prompt_secret "S3 Secret Access Key (leer = vorhandenen Wert behalten)")"
    secret_key="${secret_key:-$(get_env_value S3_SECRET_ACCESS_KEY)}"
  else
    secret_key="$(prompt_secret "S3 Secret Access Key")"
  fi

  set_env_value S3_BUCKET "$bucket"
  set_env_value S3_REGION "$region"
  set_env_value S3_ENDPOINT "$endpoint"
  set_env_value S3_PREFIX "$prefix"
  set_env_value S3_FORCE_PATH_STYLE "$path_style"
  set_env_value S3_ACCESS_KEY_ID "$access_key"
  set_env_value S3_SECRET_ACCESS_KEY "$secret_key"

  success "S3-Konfiguration in $ENV_FILE gespeichert"
}

run_update() {
  ensure_env_file

  info "Update wird ausgeführt"
  if [ -d .git ] && command -v git >/dev/null 2>&1; then
    if git remote >/dev/null 2>&1 && [ -n "$(git remote)" ]; then
      info "Hole aktuelle Git-Änderungen"
      git pull --ff-only || warn "Git Pull konnte nicht automatisch ausgeführt werden. Lokale Änderungen bitte prüfen."
    else
      warn "Kein Git Remote gefunden, überspringe Git Pull."
    fi
  else
    warn "Kein Git Repository oder Git nicht installiert, überspringe Git Pull."
  fi

  info "Aktualisiere Docker Images und starte Container neu"
  "${COMPOSE[@]}" --env-file "$ENV_FILE" pull || warn "Docker Pull konnte nicht alle Images aktualisieren; baue lokale Images weiter."
  "${COMPOSE[@]}" --env-file "$ENV_FILE" up -d --build
}

run_install() {
  ensure_env_file
  configure_domain
  configure_encryption_secret
  configure_s3

  info "Baue und starte Docker Compose Services"
  "${COMPOSE[@]}" --env-file "$ENV_FILE" up -d --build
}

run_health_check() {
  APP_URL="${APP_URL:-$(get_env_value CORS_ORIGIN)}"
  APP_URL="${APP_URL:-http://localhost:3001}"
  local local_health_url="http://127.0.0.1:3001"

  info "Warte auf API Health-Check"
  local health_ok=0
  for _ in $(seq 1 30); do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS "$APP_URL/api/health" >/dev/null 2>&1 || curl -fsS "$local_health_url/api/health" >/dev/null 2>&1; then
        health_ok=1
        break
      fi
    elif "${COMPOSE[@]}" exec -T app node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      health_ok=1
      break
    fi
    sleep 2
  done

  if [ "$health_ok" -ne 1 ]; then
    "${COMPOSE[@]}" logs --tail=120 app
    fail "Die API hat nicht rechtzeitig auf $APP_URL/api/health geantwortet."
  fi
}

if [[ "$MODE" == "--update" || "$MODE" == "-u" ]]; then
  run_update
else
  run_install
fi

run_health_check

success "Vorgang abgeschlossen"
"${COMPOSE[@]}" ps

printf '\nApp:     %s\n' "${APP_URL:-http://localhost:3001}"
printf 'Mailpit: http://localhost:8025\n'
