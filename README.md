# Koffein-Tracker

Eine React/Express-Web-App zum Tracken von Koffein, Drinks und persönlichen Warnungen. Die App bringt Benutzerverwaltung, Admin-Panel, Redis-Persistenz, 2FA, Erinnerungen, Discord-Integration und einen KI-Assistenten mit synchronisiertem Chatverlauf mit.

![Version](https://img.shields.io/badge/version-3.0.6-blue)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

## Funktionen

- Tagesübersicht mit Fortschrittsbalken, Warnungen und Tageslimit
- Drink-Logs mit Name, Menge, Koffein, Icon, Datum, Bearbeiten und Löschen
- KI-Assistent für Fragen, Tagesanalyse und Drink-Aktionen
- Modusabhängige Startseite: KI-Chat mit Kontextspalte oder manuelle Eingabe mit KI-Widgets
- Täglicher Hydration-Spruch oben an der Datumsleiste, per KI erzeugt und pro Tag gespeichert
- KI-Tagescoach mit Risikolevel und nächsten sinnvollen Aktionen
- Persönliche Rekorde für Streaks, Top-Getränke und stärkste Tage
- Erweiterte Musteranalyse mit Risiko-Fokus
- Unbegrenzter KI-Chatverlauf ohne 40-Nachrichten-Limit
- Synchronisierter KI-Chat zwischen mehreren Geräten pro Benutzer
- Benutzerkonten mit Registrierung, E-Mail-Verifikation und Passwort-Reset
- Admin-Panel für Benutzer, Rollen, manuelle Verifizierung, Löschen und Impersonation
- Demo-Login optional aktivierbar/deaktivierbar
- Profil- und Sicherheitseinstellungen
- Bearer-Token-Sessions, Security-Header und Rate-Limits für API/Auth
- 2FA per TOTP und Passkey/YubiKey/WebAuthn
- Erinnerungen per E-Mail und optional Discord
- Discord-Webhook-Test und geplante KI-Discord-Nachrichten
- SMTP-Konfiguration im Admin-Panel
- Export auf der Startseite: CSV-Download und PDF-Versand per E-Mail
- OpenRouter-KI-Konfiguration und optional Brave Search API
- Redis-Health-Check im Admin-Panel
- Themes: Standard Dark, Light, OLED, Neon, Forest
- Docker-Compose-Setup mit Redis und Mailpit

## Tech-Stack

- Frontend: React 19, Vite 8, Tailwind CSS, Lucide Icons
- Backend: Node.js 20+, Express 5
- Persistenz: Redis über `ioredis`
- Auth/Security: lokale Benutzer, PBKDF2-Hashing, TOTP, WebAuthn/Passkeys
- Mail: Nodemailer, SMTP-Konfiguration im Admin-Panel
- KI: OpenRouter-kompatible Chat Completions API

## Schnellstart mit Docker Compose

Voraussetzungen:

- Docker
- Docker Compose oder `docker compose`

### Automatische Installation

1. Repository klonen:

```bash
mkdir koffein-tracker
cd koffein-tracker
wget https://gist.githubusercontent.com/DerMinecrafter2020/f5cfb952f6ec7b66111bad8544790697/raw/d8f77670a8495c38d5b1f1be6959b739c7304f18/tracker.sh
```

2. Installationsscript starten:

```bash
chmod +x tracker.sh
./tracker.sh
```

Das Script prüft Docker und Docker Compose, erstellt bei Bedarf `.env.local` aus der lokalen `.env.example`, lädt alternativ die aktuelle Vorlage von `https://raw.githubusercontent.com/DerMinecrafter2020/energytracker/refs/heads/main/.env.example` oder nutzt als letzte Rettung eingebaute Standardwerte. Danach fragt es die App-Domain ab, setzt `CORS_ORIGIN`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_ID` und `VITE_API_BASE_URL`, kann S3-Backups vorkonfigurieren, ein Verschlüsselungskennwort mit mindestens 32 Zeichen hinterlegen, baut die Container, startet App/Redis/Mailpit und führt einen Health-Check aus.

Update einer bestehenden Installation:

```bash
./install-docker.sh --update
```

Der Update-Modus behält `.env.local` bei, führt wenn möglich `git pull --ff-only` aus, aktualisiert Docker Images, baut das App-Image neu und startet die Container neu.

### Manuelle Installation

1. `.env.local` im Projekt anlegen:

```bash
cp .env.example .env.local
```

2. Werte in `.env.local` für Produktion anpassen:

```env
NODE_ENV=production
PORT=3001
CORS_ORIGIN=http://localhost:3001

SESSION_SECRET=bitte-ändern-langer-zufälliger-wert
PASSWORD_SALT=bitte-ändern
SECRET_ENCRYPTION_KEY=
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ein-sicheres-passwort
USER_EMAIL=user@example.com
USER_PASSWORD=ein-sicheres-passwort

REDIS_HOST=redis
REDIS_PORT=6379

WEBAUTHN_RP_NAME=Koffein-Tracker
WEBAUTHN_ORIGIN=http://localhost:3001

VITE_API_BASE_URL=http://localhost:3001
VITE_ADMIN_EMAIL=admin@example.com
VITE_USER_EMAIL=user@example.com
```

Wichtig: Nur `VITE_*` Variablen werden in das Frontend eingebaut. Secrets wie `SESSION_SECRET`, Demo-Passwörter und `PASSWORD_SALT` müssen serverseitig ohne `VITE_` gesetzt werden.

3. Container starten:

```bash
docker compose --env-file .env.local up -d --build
```

4. App öffnen:

```text
http://localhost:3001
```

Docker Compose startet:

- `app` auf Port `3001`
- `redis` mit persistentem Volume `redis-data`
- `mailpit` auf `http://localhost:8025` für lokale Mailtests

## Lokale Entwicklung

Voraussetzungen:

- Node.js 20+
- npm
- Redis 7+

1. Dependencies installieren:

```bash
npm install
```

2. Redis lokal starten:

```bash
docker run --name koffein-redis -p 6379:6379 -d redis:7-alpine
```

Alternativ einen vorhandenen Redis nutzen und `REDIS_URL`, `REDIS_HOST` oder `REDIS_PORT` setzen.

3. `.env.local` anlegen:

```env
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173

SESSION_SECRET=bitte-ändern-langer-zufälliger-wert
PASSWORD_SALT=et-caffeine-salt-2024
SECRET_ENCRYPTION_KEY=

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

WEBAUTHN_ORIGIN=http://localhost:5173
WEBAUTHN_RP_ID=localhost

VITE_API_BASE_URL=http://localhost:3001
VITE_ADMIN_EMAIL=admin@energytracker.de
VITE_USER_EMAIL=user@energytracker.de
```

4. Backend starten:

```bash
npm run server
```

5. Frontend in einem zweiten Terminal starten:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API: `http://localhost:3001`

## Erste Anmeldung

Solange Demo-Zugang aktiviert ist, stehen Standarddaten bereit:

| Rolle | E-Mail | Passwort |
|---|---|---|
| Admin | `admin@energytracker.de` | `Admin@2024!` |
| Benutzer | `user@energytracker.de` | `User@2024!` |

Die Demo-Zugangsdaten können per ENV angepasst werden:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ein-sicheres-passwort
USER_EMAIL=user@example.com
USER_PASSWORD=ein-sicheres-passwort
VITE_ADMIN_EMAIL=admin@example.com
VITE_USER_EMAIL=user@example.com
```

Für produktive Installationen:

- `SESSION_SECRET`, Demo-Passwörter und `PASSWORD_SALT` ändern
- Demo-Zugang im Admin-Panel deaktivieren
- SMTP konfigurieren, wenn Registrierung, Verifikation oder Passwort-Reset genutzt werden sollen
- Erste echte Admin-Benutzer im Admin-Panel anlegen

## Wichtige Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `PORT` | Express-Port, Standard `3001` |
| `CORS_ORIGIN` | erlaubte Frontend-Origin |
| `SESSION_SECRET` | Signatur-Secret für Login-Sessions |
| `SESSION_TTL_MS` | Lebensdauer eines Session-Tokens in Millisekunden |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | serverseitige Demo-Admin-Zugangsdaten |
| `USER_EMAIL` / `USER_PASSWORD` | serverseitige Demo-Benutzer-Zugangsdaten |
| `PASSWORD_SALT` | Salt für Passwort-Hashing |
| `SECRET_ENCRYPTION_KEY` | optionaler Server-Fallback für verschlüsselt gespeicherte Zugangsdaten; bevorzugt im Admin-Panel setzen |
| `REDIS_URL` | vollständige Redis-URL, z.B. `redis://127.0.0.1:6379` |
| `REDIS_HOST` / `REDIS_PORT` | Redis-Host und Port, falls keine `REDIS_URL` gesetzt ist |
| `S3_BUCKET` | optionaler Bucket für Cloud-Backups, alternativ im Admin-Panel setzbar |
| `S3_REGION` | S3-Region, Standard `eu-central-1`, alternativ im Admin-Panel setzbar |
| `S3_ENDPOINT` | optionaler Endpoint für S3-kompatible Anbieter, alternativ im Admin-Panel setzbar |
| `S3_PREFIX` | Ordner/Präfix für Backups, Standard `koffein-tracker/backups`, alternativ im Admin-Panel setzbar |
| `S3_FORCE_PATH_STYLE` | `true` für viele S3-kompatible Anbieter, alternativ im Admin-Panel setzbar |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Zugangsdaten für S3-Backup und Restore, alternativ im Admin-Panel setzbar |
| `WEBAUTHN_RP_NAME` | Anzeigename für Passkeys/TOTP-Issuer |
| `WEBAUTHN_ORIGIN` | Origin für WebAuthn, z.B. `https://deine-domain.de` |
| `WEBAUTHN_RP_ID` | Domain für WebAuthn, z.B. `deine-domain.de` |
| `VITE_API_BASE_URL` | API-URL für das Frontend |
| `VITE_ADMIN_EMAIL` / `VITE_USER_EMAIL` | optionale Demo-E-Mail-Hinweise im Login |

SMTP, Registrierung, Demo-Zugang, Discord-Webhook, KI-Keys und S3-Zugangsdaten können im Admin-Panel gespeichert werden.

## S3 Backup und Restore

Ein Admin kann unter **Einstellungen -> Redis Datenpersistenz** lokale `.db` Backups exportieren und importieren:

- vollständige Datenbank inklusive Benutzer, Logs, API-Keys und Einstellungen
- nur Benutzer
- nur Logs
- nur API-Keys und Integrations-Zugangsdaten

Unter **S3 Backup und Restore** können die `S3_*` Werte direkt im Admin-Panel gespeichert werden. Danach kann ein Admin:

- ein vollständiges oder bereichsbezogenes `.db` Backup in den S3-Bucket hochladen
- vorhandene S3-Backups anzeigen
- ein Backup auf einer neuen Instanz wiederherstellen

Für AWS S3 reicht normalerweise Bucket, Region, Access Key und Secret Key. Für MinIO, Hetzner, Wasabi oder andere kompatible Anbieter zusätzlich den Endpoint setzen und meistens Path-Style aktivieren. Der Endpoint kann als Service-Endpoint (`https://s3.example.com`) oder als Bucket-Endpoint (`https://mein-bucket.s3.example.com`) hinterlegt werden; die App erkennt den Bucket im Host und fügt ihn nicht doppelt ein.

S3 Access Key und Secret Key werden in Redis und in neuen `.db` Exporten verschlüsselt gespeichert. Lege unter **Einstellungen -> Verschlüsselungskennwort** ein Kennwort mit mindestens 32 Zeichen fest. Dieses Kennwort wird nach dem Speichern nicht erneut angezeigt, deshalb sicher notieren. `SECRET_ENCRYPTION_KEY` kann weiterhin als Server-Fallback genutzt werden.

## KI-Assistent

Der KI-Assistent nutzt die im Admin-Panel konfigurierte OpenRouter API.

Funktionen:

- Chat auf Deutsch
- Tagesanalyse
- Drinks per KI hinzufügen, bearbeiten und löschen
- geplante Discord-Nachrichten
- optional Brave Search API für bessere Drink-Recherche
- Chatverlauf wird in Redis pro Benutzer gespeichert
- mehrere Geräte synchronisieren den Chat automatisch
- kein 40-Nachrichten-Limit mehr

## Admin-Panel

Admins können:

- alle Logs der letzten 30 Tage ansehen, filtern, sortieren und als CSV exportieren
- Logs bearbeiten oder löschen
- Benutzer erstellen, verifizieren, löschen und Rollen ändern
- als Benutzer wechseln und wieder ins Admin-Panel zurückkehren
- SMTP speichern und testen
- Registrierung und Demo-Zugang umschalten
- Discord-Webhook testen
- OpenRouter- und Brave-Keys speichern
- Redis-Persistenz prüfen

## Sicherheit

Unter Einstellungen kann jeder Benutzer:

- Name, E-Mail und Passwort aktualisieren
- TOTP/Authenticator-App aktivieren oder deaktivieren
- Passkeys/YubiKey/WebAuthn registrieren oder entfernen
- Warn- und Discord-Benachrichtigungen konfigurieren
- Theme auswählen

## Erinnerungen und Benachrichtigungen

Benutzer können tägliche Reminder konfigurieren:

- Uhrzeit
- E-Mail-Versand
- Discord-Versand

Weitere Warnungen:

- Tageslimit überschritten
- spätes Koffein
- schnelle Folge mehrerer Drinks

## API-Endpunkte

Auszug der wichtigsten API-Bereiche:

- `GET /api/health`
- `GET /api/version`
- `GET/POST /api/logs`
- `PUT/DELETE /api/logs/:id`
- `POST /api/login`
- `POST /api/register`
- `GET/POST /api/settings/me`
- `GET/POST /api/reminders/me`
- `GET/POST/DELETE /api/favorites/me`
- `GET/POST/DELETE /api/custom-drinks/me`
- `GET/POST /api/ai/chat-history`
- `POST /api/ai/chat`
- `POST /api/ai/daily-summary`
- `POST /api/ai/recognize-drink`
- `GET /api/admin/users`
- `GET/POST /api/admin/smtp`
- `GET/POST /api/admin/ai`
- `GET /api/admin/redis/health`

Geschützte Endpunkte erwarten `Authorization: Bearer <token>`. Admin-Endpunkte erfordern zusätzlich eine Admin-Rolle.

## Projektstruktur

```text
.
├── server.js                  # Express API, Redis-Persistenz, Auth, KI, Reminder
├── install-docker.sh          # Docker-Compose-Installationsscript
├── docker-compose.yml         # App + Redis + Mailpit
├── Dockerfile                 # Production Image
├── src/
│   ├── App.jsx                # Haupt-App, Routing zwischen Login/Admin/User
│   ├── main.jsx               # React Entry Point
│   ├── components/
│   │   ├── AIAssistant.jsx    # KI-Chat und synchronisierte History
│   │   ├── AdminPanel.jsx     # Admin-Oberfläche
│   │   ├── LoginPage.jsx      # Login, Reset, 2FA
│   │   ├── RegisterPage.jsx   # Registrierung
│   │   ├── SettingsPanel.jsx  # Profil, Theme, 2FA, Passkeys
│   │   ├── ReminderSettings.jsx
│   │   ├── DrinkHistory.jsx
│   │   ├── ProgressBar.jsx
│   │   └── WarningAlert.jsx
│   ├── services/
│   │   ├── api.js             # App API Client
│   │   ├── adminApi.js        # Admin API Client
│   │   ├── aiApi.js           # KI API Client
│   │   └── auth.js            # Login, Session, Impersonation
│   └── utils/
│       └── caffeineUtils.js
├── tests/
│   ├── api.test.js
│   └── ai.test.js
└── scripts/
    ├── bump-version.mjs
    └── migrate-legacy-json-to-mysql.mjs
```

## Scripts

| Script | Beschreibung |
|---|---|
| `npm run dev` | startet Vite für lokale Entwicklung |
| `npm run server` | startet Express API |
| `npm run build` | baut das Frontend für Produktion |
| `npm run preview` | Vorschau des Production Builds |
| `npm run migrate:legacy:mysql` | Legacy-Migration für alte Daten |
| `./install-docker.sh` | interaktive Docker-Installation mit Domain-, S3- und Verschlüsselungskennwort-Konfiguration |
| `./install-docker.sh --update` | aktualisiert Code/Images und startet Docker Compose neu |

Hinweis: `npm run build` führt vorher `npm run version:auto` aus und erhöht die Version in `package.json` und `package-lock.json`.

## Tests

Die vorhandenen Tests nutzen Node Test Runner und erwarten eine laufende API:

```bash
npm run server
node --test tests/*.test.js
```

Optional kann die API-URL gesetzt werden:

```bash
TEST_API_URL=http://localhost:3001/api node --test tests/*.test.js
```

## Deployment-Hinweise

Empfohlener Produktionsbetrieb:

1. Docker Compose verwenden
2. Redis-Volume sichern
3. Reverse Proxy mit HTTPS davor setzen
4. `CORS_ORIGIN`, `WEBAUTHN_ORIGIN` und `WEBAUTHN_RP_ID` auf die echte Domain setzen
5. SMTP im Admin-Panel konfigurieren
6. Demo-Zugang deaktivieren

Beispiel für Reverse Proxy:

```nginx
server {
  listen 80;
  server_name deine-domain.de;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Koffein-Hinweis

Die App dient zur Orientierung und ersetzt keine medizinische Beratung. Das häufig genannte Tageslimit für gesunde Erwachsene liegt bei ca. 400 mg Koffein, individuelle Grenzen können aber abweichen.

## Lizenz

MIT License

---

Made by Cornelius
