import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DB_TYPE = process.env.DB_TYPE || 'mysql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Persistent data directory ────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SMTP_CONFIG_FILE = path.join(DATA_DIR, 'smtp-config.json');
const USERS_FILE       = path.join(DATA_DIR, 'users.json');

// Admin secret – set ADMIN_SECRET in your .env
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'et-admin-2024';

// ── Helpers ──────────────────────────────────────────────────────────────────
const loadSmtpConfig = () => {
  try {
    if (fs.existsSync(SMTP_CONFIG_FILE))
      return JSON.parse(fs.readFileSync(SMTP_CONFIG_FILE, 'utf8'));
  } catch {}
  return null;
};
const saveSmtpConfig = (cfg) =>
  fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(cfg, null, 2));

const loadUsers = () => {
  try {
    if (fs.existsSync(USERS_FILE))
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {}
  return [];
};
const saveUsers = (users) =>
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

const hashPassword = (pw) => {
  const salt = process.env.PASSWORD_SALT || 'et-caffeine-salt-2024';
  return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
};

const createTransporter = (cfg) =>
  nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port,
    secure: cfg.secure,
    auth:   { user: cfg.auth.user, pass: cfg.auth.pass },
    tls:    { rejectUnauthorized: false },
  });

// ── Admin middleware ──────────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET)
    return res.status(401).json({ error: 'Nicht autorisiert.' });
  next();
};

const packageJsonPath = path.join(__dirname, 'package.json');
let appVersion = 'unknown';

try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  appVersion = pkg.version || 'unknown';
} catch (err) {
  console.error('Konnte package.json nicht lesen:', err);
}

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// Static Frontend
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// In-Memory Datenspeicher für lokalen Betrieb
let logsData = {};

// MySQL Pool - nur wenn MySQL genutzt wird
let pool = null;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'caffeine_tracker',
      port: Number(process.env.MYSQL_PORT || 3306),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
};

const initDb = async () => {
  if (DB_TYPE !== 'mysql') {
    console.log(`[DB] 📝 Betrieb im Speicher-Modus (DB_TYPE: ${DB_TYPE})`);
    return;
  }

  console.log(`[DB] 🗄️  Verbinde zu MySQL...`);
  
  const dbPool = getPool();

  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS caffeine_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        size INT NOT NULL,
        caffeine INT NOT NULL,
        caffeinePerMl FLOAT NULL,
        icon VARCHAR(16) NULL,
        isPreset BOOLEAN DEFAULT false,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date DATE NOT NULL
      )
    `;

    await dbPool.execute(createTableQuery);
    console.log('[DB] ✓ Verbindung erfolgreich');
  } catch (error) {
    console.error('[DB] ✗ Verbindung fehlgeschlagen:', error.message);
    throw error;
  }
};

app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', db_type: DB_TYPE });
});

app.get('/api/version', async (req, res) => {
  res.json({ version: appVersion });
});

app.get('/api/logs', async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }

    if (DB_TYPE === 'mysql') {
      const dbPool = getPool();
      const [rows] = await dbPool.execute(
        'SELECT * FROM caffeine_logs WHERE date = ? ORDER BY createdAt DESC',
        [date]
      );
      res.json(rows);
    } else {
      // Lokales Speicher-System
      res.json(logsData[date] || []);
    }
  } catch (err) {
    console.error('GET /api/logs error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/logs', async (req, res) => {
  try {
    const { name, size, caffeine, caffeinePerMl, icon, isPreset, date } = req.body || {};
    if (!name || !size || !caffeine) {
      return res.status(400).json({ error: 'name, size, caffeine are required' });
    }

    const safeDate = date || new Date().toISOString().split('T')[0];

    if (DB_TYPE === 'mysql') {
      const dbPool = getPool();
      const [result] = await dbPool.execute(
        `INSERT INTO caffeine_logs (name, size, caffeine, caffeinePerMl, icon, isPreset, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
        , [name, size, caffeine, caffeinePerMl ?? null, icon ?? null, !!isPreset, safeDate]
      );

      const insertedId = result.insertId;
      const [rows] = await dbPool.execute(
        'SELECT * FROM caffeine_logs WHERE id = ?',
        [insertedId]
      );

      res.status(201).json(rows[0]);
    } else {
      // Lokales Speicher-System
      if (!logsData[safeDate]) {
        logsData[safeDate] = [];
      }

      const newEntry = {
        id: Date.now(),
        name,
        size,
        caffeine,
        caffeinePerMl: caffeinePerMl ?? null,
        icon: icon ?? null,
        isPreset: !!isPreset,
        date: safeDate,
        createdAt: new Date().toISOString()
      };

      logsData[safeDate].push(newEntry);
      res.status(201).json(newEntry);
    }
  } catch (err) {
    console.error('POST /api/logs error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (DB_TYPE === 'mysql') {
      const dbPool = getPool();
      await dbPool.execute('DELETE FROM caffeine_logs WHERE id = ?', [id]);
    } else {
      // Lokales Speicher-System
      for (const date in logsData) {
        logsData[date] = logsData[date].filter(entry => entry.id !== Number(id));
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/logs error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── SMTP Admin Routes ─────────────────────────────────────────────────────────
app.get('/api/admin/smtp', requireAdmin, (req, res) => {
  const cfg = loadSmtpConfig();
  if (!cfg) return res.json(null);
  // Mask password before sending to client
  res.json({ ...cfg, auth: { ...cfg.auth, pass: cfg.auth.pass ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '' } });
});

app.post('/api/admin/smtp', requireAdmin, (req, res) => {
  const { host, port, secure, auth, fromName, fromEmail, baseUrl, registrationEnabled } = req.body || {};
  if (!host || !port || !auth?.user)
    return res.status(400).json({ error: 'Host, Port und Benutzername sind erforderlich.' });

  const prev = loadSmtpConfig();
  saveSmtpConfig({
    host,
    port: Number(port),
    secure: !!secure,
    auth: {
      user: auth.user,
      // Keep existing password when client sends the masked placeholder
      pass: auth.pass === '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' ? (prev?.auth?.pass || '') : auth.pass,
    },
    fromName:            fromName            || 'Koffein-Tracker',
    fromEmail:           fromEmail           || auth.user,
    baseUrl:             baseUrl             || '',
    registrationEnabled: registrationEnabled !== false,
  });
  res.json({ success: true });
});

app.post('/api/admin/smtp/test', requireAdmin, async (req, res) => {
  const { testEmail } = req.body || {};
  const cfg = loadSmtpConfig();
  if (!cfg)       return res.status(400).json({ error: 'Kein SMTP konfiguriert.' });
  if (!testEmail) return res.status(400).json({ error: 'Ziel-E-Mail fehlt.' });
  try {
    const t = createTransporter(cfg);
    await t.verify();
    await t.sendMail({
      from:    `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to:      testEmail,
      subject: 'Koffein-Tracker \u2013 SMTP Test \u2713',
      html:    '<p>SMTP-Server ist korrekt konfiguriert. Diese E-Mail best\u00e4tigt die Verbindung.</p>',
    });
    res.json({ success: true, message: `Test-E-Mail an ${testEmail} gesendet.` });
  } catch (err) {
    res.status(500).json({ error: `SMTP-Fehler: ${err.message}` });
  }
});

// ── User Management Routes ────────────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = loadUsers();
  res.json(users.map(({ passwordHash, verifyToken, verifyTokenExpiry, ...u }) => u));
});

app.post('/api/admin/users/:id/verify', requireAdmin, (req, res) => {
  const users = loadUsers();
  const user  = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  user.verified          = true;
  user.verifyToken       = null;
  user.verifyTokenExpiry = null;
  saveUsers(users);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  let users = loadUsers();
  const before = users.length;
  users = users.filter(u => u.id !== req.params.id);
  if (users.length === before) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  saveUsers(users);
  res.json({ success: true });
});

// ── Public Registration & Login ───────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const cfg = loadSmtpConfig();
  if (!cfg?.registrationEnabled)
    return res.status(403).json({ error: 'Registrierung ist aktuell deaktiviert. Bitte wende dich an den Administrator.' });

  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });

  const users    = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });

  const verifyToken  = crypto.randomBytes(32).toString('hex');
  const newUser = {
    id:                crypto.randomUUID(),
    name,
    email:             email.toLowerCase(),
    passwordHash:      hashPassword(password),
    role:              'user',
    verified:          false,
    verifyToken,
    verifyTokenExpiry: Date.now() + 24 * 60 * 60 * 1000,
    createdAt:         new Date().toISOString(),
    lastLogin:         null,
  };
  users.push(newUser);
  saveUsers(users);

  try {
    const t        = createTransporter(cfg);
    const base     = (cfg.baseUrl || `http://localhost:${PORT}`).replace(/\/$/, '');
    const link     = `${base}/api/verify/${verifyToken}`;
    await t.sendMail({
      from:    `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to:      email,
      subject: 'Koffein-Tracker \u2013 E-Mail-Adresse best\u00e4tigen',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#3B82F6">Willkommen, ${name}!</h2>
          <p>Bitte best\u00e4tige deine E-Mail-Adresse um dein Konto zu aktivieren:</p>
          <a href="${link}" style="display:inline-block;padding:12px 24px;background:#3B82F6;
            color:#fff;text-decoration:none;border-radius:8px;margin:16px 0;font-weight:bold">
            E-Mail best\u00e4tigen
          </a>
          <p style="color:#94a3b8;font-size:12px">Dieser Link ist 24 Stunden g\u00fcltig.<br>
          Falls du dich nicht registriert hast, ignoriere diese E-Mail.</p>
        </div>`,
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[Register] E-Mail konnte nicht gesendet werden:', err.message);
    res.status(201).json({ success: true, emailWarning: `Konto erstellt, Verifizierungs-E-Mail fehlgeschlagen: ${err.message}` });
  }
});

app.get('/api/verify/:token', (req, res) => {
  const users = loadUsers();
  const user  = users.find(u => u.verifyToken === req.params.token);
  if (!user)                       return res.redirect('/?verified=invalid');
  if (Date.now() > user.verifyTokenExpiry) return res.redirect('/?verified=expired');
  user.verified          = true;
  user.verifyToken       = null;
  user.verifyTokenExpiry = null;
  saveUsers(users);
  res.redirect('/?verified=1');
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' });

  const users = loadUsers();
  const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user)                return res.status(401).json({ error: 'Ung\u00fcltige Zugangsdaten.' });
  if (!user.verified)       return res.status(403).json({ error: 'E-Mail-Adresse noch nicht best\u00e4tigt. Bitte pr\u00fcfe dein Postfach.' });
  if (user.passwordHash !== hashPassword(password))
    return res.status(401).json({ error: 'Ung\u00fcltige Zugangsdaten.' });

  user.lastLogin = new Date().toISOString();
  saveUsers(users);
  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`);
      console.log(`📦 DB Type: ${DB_TYPE}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  });
