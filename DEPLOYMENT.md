# Deployment Guide — Koffein-Tracker

## Voraussetzungen

- Docker + Docker Compose
- Linux Server (z.B. Debian/Ubuntu)

## Schritt 1: Repository klonen

```bash
cd /root
git clone https://github.com/DerMinecrafter2020/energytracker.git
cd energytracker
```

## Schritt 2: `.env.local` erstellen

```bash
cp .env.production.example /root/energytracker/.env.local
```

Wichtige Werte in `.env.local`:

- `DB_TYPE=file-json`
- `DB_FILE=/app/data/database.json`
- `ADMIN_SECRET=...`
- `PASSWORD_SALT=...`
- `CORS_ORIGIN=https://deine-domain.tld`

## Schritt 3: Container starten

```bash
docker compose up -d
```

Services:

- `app` (API + Frontend)
- `watchtower` (Auto-Updates aus Docker Hub)

## Logs prüfen

```bash
docker compose logs -f
docker compose logs -f app
docker compose logs -f watchtower
```

## Daten-Persistenz

Die Datei-Datenbank liegt in einem Docker Volume `app-data` unter `/app/data/database.json`.

## Backup

```bash
docker run --rm -v energytracker_app-data:/data -v $(pwd):/backup alpine sh -c "cp /data/database.json /backup/database-backup.json"
```

## Restore

```bash
docker run --rm -v energytracker_app-data:/data -v $(pwd):/backup alpine sh -c "cp /backup/database-backup.json /data/database.json"
docker compose restart app
```

## Manuelles Update

```bash
docker compose pull
docker compose up -d
```
