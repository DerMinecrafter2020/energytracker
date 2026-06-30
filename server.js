import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import Redis from 'ioredis';
import { OTP } from 'otplib';
const authenticator = new OTP({ window: 1 });
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

dotenv.config({ path: '.env.local' });
dotenv.config();
if (!process.env.TZ) process.env.TZ = 'Europe/Berlin';

const app = express();
const PORT = process.env.PORT || 3001;
const DB_TYPE = 'redis';
const APP_TIME_ZONE = process.env.TZ || 'Europe/Berlin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readEnvValue = (value) => String(value || '').trim().replace(/^['\"]|['\"]$/g, '');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
if (!process.env.SESSION_SECRET) {
  console.warn('[Security] SESSION_SECRET fehlt. Tokens werden bei jedem Serverstart invalidiert.');
}
const DEMO_ADMIN_EMAIL = readEnvValue(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL) || 'admin@energytracker.de';
const DEMO_ADMIN_PASSWORD = readEnvValue(process.env.ADMIN_PASSWORD) || 'Admin@2024!';
const DEMO_USER_EMAIL = readEnvValue(process.env.USER_EMAIL || process.env.VITE_USER_EMAIL) || 'user@energytracker.de';
const DEMO_USER_PASSWORD = readEnvValue(process.env.USER_PASSWORD) || 'User@2024!';

// ── Helpers ──────────────────────────────────────────────────────────────────
const hashPassword = (pw) => {
  const salt = process.env.PASSWORD_SALT || 'et-caffeine-salt-2024';
  return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
};

const createTransporter = (cfg) => {
  const transport = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    tls: { rejectUnauthorized: false },
  };

  const authUser = String(cfg?.auth?.user || '').trim();
  const authPass = String(cfg?.auth?.pass || '');
  if (authUser) {
    transport.auth = { user: authUser, pass: authPass };
  }

  return nodemailer.createTransport(transport);
};

// ── Auth helpers ─────────────────────────────────────────────────────────────
const encodeTokenPart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decodeTokenPart = (value) => JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
const signTokenValue = (value) => crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const createSessionToken = (user) => {
  const now = Date.now();
  const payload = {
    sub: String(user.id),
    email: String(user.email || '').toLowerCase(),
    role: user.role === 'admin' ? 'admin' : 'user',
    name: user.name || '',
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const body = encodeTokenPart(payload);
  return `${body}.${signTokenValue(body)}`;
};

const verifySessionToken = (token) => {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature || !safeEqual(signTokenValue(body), signature)) return null;
  const payload = decodeTokenPart(body);
  if (!payload?.sub || !payload?.email || Date.now() > Number(payload.exp || 0)) return null;
  return payload;
};

const getBearerToken = (req) => {
  const value = String(req.headers.authorization || '').trim();
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const buildSessionUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role === 'admin' ? 'admin' : 'user',
  token: createSessionToken(user),
});

const demoUserForCredentials = (email, password) => {
  const safeEmail = String(email || '').toLowerCase().trim();
  if (safeEmail === DEMO_ADMIN_EMAIL.toLowerCase() && password === DEMO_ADMIN_PASSWORD) {
    return { id: 'demo-admin', name: 'Administrator', email: DEMO_ADMIN_EMAIL.toLowerCase(), role: 'admin', verified: true };
  }
  if (safeEmail === DEMO_USER_EMAIL.toLowerCase() && password === DEMO_USER_PASSWORD) {
    return { id: 'demo-user', name: 'Benutzer', email: DEMO_USER_EMAIL.toLowerCase(), role: 'user', verified: true };
  }
  return null;
};

const requireAuth = (req, res, next) => {
  try {
    const payload = verifySessionToken(getBearerToken(req));
    if (!payload) return res.status(401).json({ error: 'Nicht angemeldet.' });

    const user = getUserByIdentity({ userId: payload.sub, email: payload.email });
    const fallbackUser = String(payload.sub).startsWith('demo-')
      ? { id: payload.sub, name: payload.name, email: payload.email, role: payload.role }
      : null;
    const effectiveUser = user || fallbackUser;
    if (!effectiveUser) return res.status(401).json({ error: 'Sitzung ist ungültig.' });

    req.user = effectiveUser;
    req.auth = {
      userId: String(effectiveUser.id),
      email: String(effectiveUser.email || '').toLowerCase(),
      role: effectiveUser.role === 'admin' ? 'admin' : 'user',
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Sitzung ist ungültig.' });
  }
};

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.auth?.role !== 'admin') return res.status(403).json({ error: 'Admin-Rechte erforderlich.' });
    next();
  });
};

const authIdentity = (req) => ({ userId: req.auth.userId, email: req.auth.email });
const canAccessLog = (req, log) => req.auth?.role === 'admin' || logMatchesUser(log, authIdentity(req));

const CONTAINER_START = new Date(Date.now() - process.uptime() * 1000);

const packageJsonPath = path.join(__dirname, 'package.json');
let appVersion = 'unknown';

try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  appVersion = pkg.version || 'unknown';
} catch (err) {
  console.error('Konnte package.json nicht lesen:', err);
}

const apiTestFileCandidates = [
  path.join(__dirname, 'tests', 'api.test.js'),
  path.join(process.cwd(), 'tests', 'api.test.js'),
];

const normalizeTestName = (value) => String(value || '')
  .replace(/\\(['"`])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const apiTestCategory = (name) => {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('admin-api') || lower.includes('secret-header')) return 'Admin-Sicherheit';
  if (lower.includes('exportieren') || lower.includes('importieren') || lower.includes('backup')) return 'Backup & Import';
  if (lower.includes('theme')) return 'Benutzer-Einstellungen';
  if (lower.includes('discord') || lower.includes('ai scheduling')) return 'Discord & KI';
  if (lower.includes('fremde')) return 'Benutzer-Isolation';
  if (lower.includes('log-api') || lower.includes('logs')) return 'Logs';
  return 'API';
};

const readApiTestOverview = () => {
  const testFile = apiTestFileCandidates.find((candidate) => fs.existsSync(candidate));
  if (!testFile) {
    return {
      exists: false,
      file: 'tests/api.test.js',
      total: 0,
      tests: [],
      warning: 'tests/api.test.js wurde im Container nicht gefunden.',
      command: 'docker compose exec -T app node --test tests/api.test.js',
    };
  }

  const source = fs.readFileSync(testFile, 'utf8');
  const stat = fs.statSync(testFile);
  const tests = [];
  const matcher = /\btest\s*\(\s*(['"`])([\s\S]*?)\1\s*,/g;
  let match;

  while ((match = matcher.exec(source)) !== null) {
    const name = normalizeTestName(match[2]);
    if (!name) continue;
    tests.push({
      id: tests.length + 1,
      name,
      category: apiTestCategory(name),
    });
  }

  return {
    exists: true,
    file: path.relative(__dirname, testFile) || 'tests/api.test.js',
    updatedAt: stat.mtime.toISOString(),
    size: stat.size,
    hash: crypto.createHash('sha256').update(source).digest('hex').slice(0, 12),
    total: tests.length,
    tests,
    command: 'docker compose exec -T app node --test tests/api.test.js',
  };
};

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const WEBAUTHN_RP_NAME = process.env.WEBAUTHN_RP_NAME || 'Koffein-Tracker';

const getWebAuthnConfig = (req) => {
  const protocol = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http';
  const reqOrigin = req?.headers?.origin || (req?.headers?.host ? `${protocol}://${req.headers.host}` : ALLOWED_ORIGIN);
  const origin = process.env.WEBAUTHN_ORIGIN || reqOrigin;
  let rpID;
  try {
    rpID = process.env.WEBAUTHN_RP_ID || new URL(origin).hostname;
  } catch (e) {
    rpID = 'localhost';
  }
  return { origin, rpID };
};

const AUTH_MODE = 'local';



const pendingSecondFactor = new Map();
const pendingWebAuthn = new Map();
const pendingOidcStates = new Map();
const pendingOidcSessions = new Map();
const AUTH_CHALLENGE_TTL_MS = 5 * 60 * 1000;

const toBase64Url = (buffer) => Buffer.from(buffer).toString('base64url');
const fromBase64Url = (input) => Buffer.from(String(input || ''), 'base64url');

const cleanupAuthChallenges = () => {
  const now = Date.now();
  for (const [token, data] of pendingSecondFactor.entries()) {
    if (now > Number(data?.expiresAt || 0)) pendingSecondFactor.delete(token);
  }
  for (const [token, data] of pendingWebAuthn.entries()) {
    if (now > Number(data?.expiresAt || 0)) pendingWebAuthn.delete(token);
  }
  for (const [token, data] of pendingOidcStates.entries()) {
    if (now > Number(data?.expiresAt || 0)) pendingOidcStates.delete(token);
  }
  for (const [token, data] of pendingOidcSessions.entries()) {
    if (now > Number(data?.expiresAt || 0)) pendingOidcSessions.delete(token);
  }
};

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ALLOWED_ORIGIN, 'https:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(hpp());
app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte spaeter erneut versuchen.' },
});

app.use('/api', apiLimiter);
app.use(['/api/login', '/api/register', '/api/auth/forgot-password', '/api/auth/reset-password'], authLimiter);

// Static Frontend
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// ── Redis DB ──────────────────────────────────────────────────────────────────
const isDockerRuntime = fs.existsSync('/.dockerenv');
const cleanEnvValue = (value) => String(value || '').trim().replace(/^['\"]|['\"]$/g, '');

const resolveRedisUrl = () => {
  const envRedisUrl = cleanEnvValue(process.env.REDIS_URL);
  if (envRedisUrl) return envRedisUrl;

  const envRedisHost = cleanEnvValue(process.env.REDIS_HOST);
  const envRedisPort = cleanEnvValue(process.env.REDIS_PORT) || '6379';

  if (envRedisHost) return `redis://${envRedisHost}:${envRedisPort}`;
  if (isDockerRuntime) return 'redis://redis:6379';
  return 'redis://127.0.0.1:6379';
};

const redisUrl = resolveRedisUrl();
let redisHost = '';
try {
  redisHost = new URL(redisUrl).hostname;
} catch {
  redisHost = '';
}

const isLocalRedisTarget = !isDockerRuntime && ['redis', 'koffein-redis'].includes(redisHost.toLowerCase());
const REDIS_LOG_THROTTLE_MS = Number(process.env.REDIS_LOG_THROTTLE_MS || 15000);
let lastRedisErrorLogAt = 0;
let localRedisHintShown = false;

const redis = new Redis(redisUrl, {
  retryStrategy: (times) => Math.min(times * 100, 3000),
  enableReadyCheck: true,
});
redis.on('error', (err) => {
  const now = Date.now();
  if (now - lastRedisErrorLogAt >= REDIS_LOG_THROTTLE_MS) {
    console.error('[Redis] Verbindungsfehler:', err.message);
    lastRedisErrorLogAt = now;
  }

  const isLocalConnRefused = !isDockerRuntime
    && (err?.code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(String(err?.message || '')));

  const isLocalNameResolution = isLocalRedisTarget
    && (err?.code === 'ENOTFOUND' || /ENOTFOUND/i.test(String(err?.message || '')));

  if ((isLocalConnRefused || isLocalNameResolution) && !localRedisHintShown) {
    console.error('[Redis] Hinweis: Lokaler Start erkannt. Nutze REDIS_HOST=127.0.0.1 und REDIS_PORT=6379 (oder REDIS_URL=redis://127.0.0.1:6379).');
    localRedisHintShown = true;
  }
});
redis.on('connect', () => console.log('[Redis] ✓ Verbunden'));

const REDIS_KEYS = {
  caffeine_logs: 'koffein:caffeine_logs',
  users:         'koffein:users',
  smtp_settings: 'koffein:smtp_settings',
  auth_config:   'koffein:auth_config',
  reminders:     'koffein:reminders',
  favorites:     'koffein:favorites',
  ai_config:     'koffein:ai_config',
  s3_settings:   'koffein:s3_settings',
  user_settings: 'koffein:user_settings',
  custom_drinks: 'koffein:custom_drinks',
  ai_chat_messages: 'koffein:ai_chat_messages',
  app_name:      'koffein:app_name',
  app_settings:  'koffein:app_settings',
  discord_schedules: 'koffein:discord_schedules',
};

const DB_EXPORT_VERSION = 2;
const BACKUP_SCOPES = new Set(['full', 'users', 'logs', 'api-keys']);

const sanitizeAppSettings = (settings = {}) => ({
  entryMode: settings.entryMode === 'manual' ? 'manual' : 'ai',
  secretEncryptionKeyEncrypted: cleanEnvValue(settings.secretEncryptionKeyEncrypted),
  secretEncryptionKeyUpdatedAt: cleanEnvValue(settings.secretEncryptionKeyUpdatedAt),
  hydrationQuotes: settings.hydrationQuotes && typeof settings.hydrationQuotes === 'object' && !Array.isArray(settings.hydrationQuotes)
    ? settings.hydrationQuotes
    : {},
});

const ENCRYPTED_SECRET_PREFIX = 'enc:v1:';
const keyFromSecret = (secret) => crypto.createHash('sha256').update(cleanEnvValue(secret) || 'et-caffeine-salt-2024').digest();
const secretStorageKey = keyFromSecret(process.env.SECRET_KEY_STORAGE_KEY || process.env.SESSION_SECRET || process.env.PASSWORD_SALT);

if (!process.env.SECRET_ENCRYPTION_KEY && !process.env.DATA_ENCRYPTION_KEY && !process.env.SESSION_SECRET) {
  console.warn('[Security] SECRET_ENCRYPTION_KEY und SESSION_SECRET fehlen. Nutze PASSWORD_SALT als schwachen Fallback fuer verschluesselte gespeicherte Secrets.');
}

const isEncryptedSecret = (value) => String(value || '').startsWith(ENCRYPTED_SECRET_PREFIX);

const encryptSecretWithKey = (value, key) => {
  const plain = cleanEnvValue(value);
  if (!plain || isEncryptedSecret(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_SECRET_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
};

const decryptSecretWithKey = (value, key) => {
  const safe = cleanEnvValue(value);
  if (!safe || !isEncryptedSecret(safe)) return safe;
  try {
    const [ivRaw, tagRaw, encryptedRaw] = safe.slice(ENCRYPTED_SECRET_PREFIX.length).split(':');
    if (!ivRaw || !tagRaw || !encryptedRaw) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    console.error('[Security] Gespeichertes Secret konnte nicht entschluesselt werden:', err.message);
    return '';
  }
};

const adminSecretEncryptionPassword = () => {
  const stored = cleanEnvValue(dbState?.app_settings?.secretEncryptionKeyEncrypted);
  if (!stored) return '';
  return decryptSecretWithKey(stored, secretStorageKey);
};

const activeSecretEncryptionPassword = () =>
  adminSecretEncryptionPassword()
  || cleanEnvValue(process.env.SECRET_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY)
  || cleanEnvValue(process.env.SESSION_SECRET || process.env.PASSWORD_SALT)
  || 'et-caffeine-salt-2024';

const activeSecretEncryptionKey = () => keyFromSecret(activeSecretEncryptionPassword());
const encryptSecret = (value) => encryptSecretWithKey(value, activeSecretEncryptionKey());
const decryptSecret = (value) => decryptSecretWithKey(value, activeSecretEncryptionKey());

const sanitizeS3Settings = (settings = {}) => ({
  bucket: cleanEnvValue(settings.bucket),
  region: cleanEnvValue(settings.region) || 'eu-central-1',
  endpoint: cleanEnvValue(settings.endpoint),
  prefix: cleanEnvValue(settings.prefix || 'koffein-tracker/backups').replace(/^\/+|\/+$/g, ''),
  forcePathStyle: settings.forcePathStyle === true || settings.forcePathStyle === 'true',
  accessKeyId: cleanEnvValue(settings.accessKeyId),
  secretAccessKey: cleanEnvValue(settings.secretAccessKey),
});

const decryptS3Settings = (settings = {}) => {
  const safe = sanitizeS3Settings(settings);
  return {
    ...safe,
    accessKeyId: decryptSecret(safe.accessKeyId),
    secretAccessKey: decryptSecret(safe.secretAccessKey),
  };
};

const encryptS3SettingsForStorage = (settings = {}) => {
  const safe = sanitizeS3Settings(settings);
  return {
    ...safe,
    accessKeyId: encryptSecret(safe.accessKeyId),
    secretAccessKey: encryptSecret(safe.secretAccessKey),
  };
};

const hasPlainS3Secrets = (settings = {}) => {
  const safe = sanitizeS3Settings(settings);
  return (!!safe.accessKeyId && !isEncryptedSecret(safe.accessKeyId))
    || (!!safe.secretAccessKey && !isEncryptedSecret(safe.secretAccessKey));
};

const createEmptyDbState = () => ({
  appName: 'Drink-Tracker',
  app_settings: sanitizeAppSettings(),
  caffeine_logs: [],
  users: [],
  smtp_settings: null,
  auth_config: null,
  reminders: [],
  favorites: [],
  ai_config: { apiKey: '', model: 'deepseek/deepseek-v3', braveSearchKey: '' },
  s3_settings: sanitizeS3Settings(),
  user_settings: [], // [{userId/email, dailyLimit, notifyAtLimit, notifyLate, notifyRapid}]
  custom_drinks: [], // [{id, ownerKey, name, size, caffeine, icon}]
  ai_chat_messages: [], // [{ownerKey, userId/email, messages, updatedAt}]
  discord_schedules: [], // [{id, time, message, sent, date}]
});

let dbState = createEmptyDbState();

const safeParse = (s, fallback) => {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};

const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const asArray = (value) => Array.isArray(value) ? value : [];
const asObjectOrNull = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const normalizeDbState = (value = {}) => {
  const source = value?.database || value?.dbState || value?.data || value;
  const fallback = createEmptyDbState();
  const parsedAi = asObjectOrNull(source.ai_config) || {};
  const parsedAppSettings = asObjectOrNull(source.app_settings) || asObjectOrNull(source.appSettings) || {};
  const parsedS3 = asObjectOrNull(source.s3_settings) || asObjectOrNull(source.s3Settings) || {};

  return {
    appName: typeof source.appName === 'string' && source.appName.trim() ? source.appName.trim() : fallback.appName,
    app_settings: sanitizeAppSettings(parsedAppSettings),
    caffeine_logs: asArray(source.caffeine_logs),
    users: asArray(source.users),
    smtp_settings: asObjectOrNull(source.smtp_settings),
    auth_config: asObjectOrNull(source.auth_config),
    reminders: asArray(source.reminders),
    favorites: asArray(source.favorites),
    ai_config: {
      apiKey: String(parsedAi.apiKey || ''),
      model: String(parsedAi.model || fallback.ai_config.model),
      braveSearchKey: String(parsedAi.braveSearchKey || ''),
    },
    s3_settings: sanitizeS3Settings(parsedS3),
    user_settings: asArray(source.user_settings),
    custom_drinks: asArray(source.custom_drinks),
    ai_chat_messages: asArray(source.ai_chat_messages),
    discord_schedules: asArray(source.discord_schedules),
  };
};

const dbStateForStorage = (state = dbState) => {
  const next = normalizeDbState(state);
  return {
    ...next,
    s3_settings: encryptS3SettingsForStorage(next.s3_settings),
  };
};

const encryptionPasswordStatus = () => {
  const settings = sanitizeAppSettings(dbState.app_settings || {});
  const adminKeySet = !!settings.secretEncryptionKeyEncrypted && !!adminSecretEncryptionPassword();
  const envKeySet = !!cleanEnvValue(process.env.SECRET_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY);
  return {
    minLength: 32,
    keySet: adminKeySet || envKeySet || !!cleanEnvValue(process.env.SESSION_SECRET),
    adminKeySet,
    envKeySet,
    source: adminKeySet ? 'admin-panel' : (envKeySet ? 'env' : 'session-secret'),
    updatedAt: settings.secretEncryptionKeyUpdatedAt || '',
  };
};

const appSettingsForAdmin = () => ({
  entryMode: sanitizeAppSettings(dbState.app_settings || {}).entryMode,
  secretEncryption: encryptionPasswordStatus(),
});

const saveAppSettings = (settings = {}) => {
  const current = sanitizeAppSettings(dbState.app_settings || {});
  const next = { ...current };

  if (Object.prototype.hasOwnProperty.call(settings, 'entryMode')) {
    next.entryMode = settings.entryMode === 'manual' ? 'manual' : 'ai';
  }

  if (Object.prototype.hasOwnProperty.call(settings, 'secretEncryptionPassword')) {
    const password = cleanEnvValue(settings.secretEncryptionPassword);
    if (!password) {
      const err = new Error('Verschlüsselungskennwort darf nicht leer sein.');
      err.status = 400;
      throw err;
    }
    if (password.length < 32) {
      const err = new Error('Verschlüsselungskennwort muss mindestens 32 Zeichen lang sein.');
      err.status = 400;
      throw err;
    }

    const currentS3Settings = decryptS3Settings(dbState.s3_settings || {});
    next.secretEncryptionKeyEncrypted = encryptSecretWithKey(password, secretStorageKey);
    next.secretEncryptionKeyUpdatedAt = new Date().toISOString();
    dbState.app_settings = next;
    dbState.s3_settings = currentS3Settings;
    return next;
  }

  dbState.app_settings = next;
  return next;
};

const hasDatabaseShape = (value = {}) => {
  const source = value?.database || value?.dbState || value?.data || value;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
  return [
    'caffeine_logs',
    'users',
    'smtp_settings',
    'reminders',
    'favorites',
    'ai_config',
    's3_settings',
    'user_settings',
    'custom_drinks',
    'ai_chat_messages',
    'app_settings',
    'discord_schedules',
  ].some((key) => Object.prototype.hasOwnProperty.call(source, key));
};

const databaseForScope = (scope = 'full') => {
  const normalized = normalizeDbState(dbState);
  if (scope === 'users') return { users: cloneJson(normalized.users) };
  if (scope === 'logs') return { caffeine_logs: cloneJson(normalized.caffeine_logs) };
  if (scope === 'api-keys') {
    return {
      ai_config: cloneJson(normalized.ai_config),
      s3_settings: cloneJson(normalized.s3_settings),
      smtp_settings: normalized.smtp_settings ? {
        discord_webhook: normalized.smtp_settings.discord_webhook || '',
      } : null,
    };
  }
  return cloneJson(normalized);
};

const buildDatabaseExport = ({ scope = 'full' } = {}) => ({
  type: 'koffein-tracker-db-export',
  version: DB_EXPORT_VERSION,
  scope,
  exportedAt: new Date().toISOString(),
  appVersion,
  database: databaseForScope(scope),
});

const databaseImportSummary = (nextState) => ({
  logs: nextState.caffeine_logs.length,
  users: nextState.users.length,
  reminders: nextState.reminders.length,
  favorites: nextState.favorites.length,
  aiChatMessages: nextState.ai_chat_messages.length,
  customDrinks: nextState.custom_drinks.length,
  apiKeys: {
    aiApiKey: !!nextState.ai_config?.apiKey,
    braveSearchKey: !!nextState.ai_config?.braveSearchKey,
    s3AccessKey: !!nextState.s3_settings?.accessKeyId,
  },
});

const mergeImportedState = (payload) => {
  const scope = BACKUP_SCOPES.has(payload?.scope) ? payload.scope : 'full';
  if (scope === 'full') return normalizeDbState(payload);

  const source = payload?.database || payload?.dbState || payload?.data || payload;
  const current = normalizeDbState(dbState);

  if (scope === 'users') return normalizeDbState({ ...current, users: asArray(source.users) });
  if (scope === 'logs') return normalizeDbState({ ...current, caffeine_logs: asArray(source.caffeine_logs) });
  if (scope === 'api-keys') {
    const nextAi = asObjectOrNull(source.ai_config) || current.ai_config;
    const nextS3 = asObjectOrNull(source.s3_settings) || current.s3_settings;
    const nextSmtp = asObjectOrNull(source.smtp_settings) || null;
    return normalizeDbState({
      ...current,
      ai_config: {
        apiKey: String(nextAi.apiKey || ''),
        model: String(nextAi.model || current.ai_config.model || 'deepseek/deepseek-v3'),
        braveSearchKey: String(nextAi.braveSearchKey || ''),
      },
      s3_settings: nextS3,
      smtp_settings: nextSmtp?.discord_webhook
        ? { ...(current.smtp_settings || {}), discord_webhook: nextSmtp.discord_webhook }
        : current.smtp_settings,
    });
  }

  return current;
};

const importDatabasePayload = async (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const err = new Error('Ungültige Backup-Datei.');
    err.status = 400;
    throw err;
  }
  if (!hasDatabaseShape(payload)) {
    const err = new Error('Backup enthält keine erkennbaren Datenbankfelder.');
    err.status = 400;
    throw err;
  }

  const nextState = mergeImportedState(payload);
  dbState = nextState;
  await persistDbState();
  return {
    importedAt: new Date().toISOString(),
    scope: BACKUP_SCOPES.has(payload?.scope) ? payload.scope : 'full',
    summary: databaseImportSummary(nextState),
  };
};

const s3Config = () => {
  const stored = decryptS3Settings(dbState.s3_settings || {});
  const envEndpoint = cleanEnvValue(process.env.S3_ENDPOINT);
  const region = stored.region || cleanEnvValue(process.env.S3_REGION) || 'eu-central-1';
  const endpoint = stored.endpoint || envEndpoint || `https://s3.${region}.amazonaws.com`;
  const prefix = cleanEnvValue(stored.prefix || process.env.S3_PREFIX || 'koffein-tracker/backups').replace(/^\/+|\/+$/g, '');
  const hasStoredForcePathStyle = dbState.s3_settings?.forcePathStyle !== undefined;
  const forcePathStyle = hasStoredForcePathStyle
    ? stored.forcePathStyle
    : cleanEnvValue(process.env.S3_FORCE_PATH_STYLE || (envEndpoint ? 'true' : 'false')).toLowerCase() !== 'false';

  return {
    bucket: stored.bucket || cleanEnvValue(process.env.S3_BUCKET),
    region,
    endpoint,
    accessKeyId: stored.accessKeyId || cleanEnvValue(process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: stored.secretAccessKey || cleanEnvValue(process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY),
    prefix,
    forcePathStyle,
  };
};

const maskBackupSecret = (value, visible = 4) => {
  const safe = cleanEnvValue(value);
  if (!safe) return '';
  if (safe.length <= visible * 2) return '••••••••';
  return `${safe.slice(0, visible)}••••••••${safe.slice(-visible)}`;
};

const s3Status = () => {
  const cfg = s3Config();
  return {
    configured: !!(cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey),
    bucket: cfg.bucket || '',
    region: cfg.region,
    endpoint: cfg.endpoint,
    prefix: cfg.prefix,
    forcePathStyle: cfg.forcePathStyle,
    accessKeyIdMasked: maskBackupSecret(cfg.accessKeyId),
    secretAccessKeySet: !!cfg.secretAccessKey,
  };
};

const s3ConfigForAdmin = () => {
  const cfg = s3Config();
  return {
    ...s3Status(),
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey ? '••••••••' : '',
  };
};

const saveS3Settings = (settings = {}) => {
  const current = s3Config();
  const incomingSecret = cleanEnvValue(settings.secretAccessKey);
  const secretAccessKey = incomingSecret && !/^[•*]{4,}$/.test(incomingSecret)
    ? incomingSecret
    : (settings.clearSecretAccessKey ? '' : current.secretAccessKey);
  const incomingAccessKey = cleanEnvValue(settings.accessKeyId);
  const accessKeyId = incomingAccessKey && !/^[•*]{4,}$/.test(incomingAccessKey)
    ? incomingAccessKey
    : current.accessKeyId;

  dbState.s3_settings = sanitizeS3Settings({
    bucket: settings.bucket,
    region: settings.region,
    endpoint: settings.endpoint,
    prefix: settings.prefix,
    forcePathStyle: settings.forcePathStyle,
    accessKeyId,
    secretAccessKey,
  });
  return dbState.s3_settings;
};

const ensureS3Configured = () => {
  const cfg = s3Config();
  if (!cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    const err = new Error('S3 ist nicht vollständig konfiguriert. Bitte S3_BUCKET, S3_ACCESS_KEY_ID und S3_SECRET_ACCESS_KEY setzen.');
    err.status = 400;
    throw err;
  }
  return cfg;
};

const s3Encode = (value) => encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const s3HashHex = (value) => crypto.createHash('sha256').update(value || '').digest('hex');
const s3Hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding);
const s3DateParts = (now = new Date()) => {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
};

const s3ObjectKey = (filename) => [s3Config().prefix, filename].filter(Boolean).join('/');
const canonicalS3Path = (pathname) => pathname.split('/').map((part) => s3Encode(decodeURIComponent(part))).join('/');

const s3EndpointHostHasBucket = (hostname, bucket) => {
  const safeHost = String(hostname || '').trim().toLowerCase();
  const safeBucket = String(bucket || '').trim().toLowerCase();
  return !!safeHost && !!safeBucket && (safeHost === safeBucket || safeHost.startsWith(`${safeBucket}.`));
};

const s3EndpointHostWithoutBucket = (hostname, bucket) => {
  const safeHost = String(hostname || '').trim();
  const safeBucket = String(bucket || '').trim();
  if (!safeHost || !safeBucket || safeHost.toLowerCase() === safeBucket.toLowerCase()) return safeHost;
  return safeHost.toLowerCase().startsWith(`${safeBucket.toLowerCase()}.`)
    ? safeHost.slice(safeBucket.length + 1)
    : safeHost;
};

const s3UrlFor = (cfg, key = '', query = {}) => {
  const endpoint = new URL(cfg.endpoint);
  const safeKey = String(key || '').split('/').map(s3Encode).join('/');
  const basePath = endpoint.pathname.replace(/\/+$/g, '');
  const endpointAlreadyIncludesBucket = s3EndpointHostHasBucket(endpoint.hostname, cfg.bucket);

  if (cfg.forcePathStyle) {
    if (endpointAlreadyIncludesBucket) {
      endpoint.hostname = s3EndpointHostWithoutBucket(endpoint.hostname, cfg.bucket);
    }
    endpoint.pathname = [basePath, s3Encode(cfg.bucket), safeKey].filter(Boolean).join('/');
  } else {
    if (!endpointAlreadyIncludesBucket) {
      endpoint.hostname = `${cfg.bucket}.${endpoint.hostname}`;
    }
    endpoint.pathname = [basePath, safeKey].filter(Boolean).join('/');
  }

  Object.entries(query).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') endpoint.searchParams.set(name, value);
  });
  return endpoint;
};

const signS3Request = ({ cfg, method, url, body = '', contentType = '' }) => {
  const { amzDate, dateStamp } = s3DateParts();
  const payloadHash = s3HashHex(body);
  const headers = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) headers['content-type'] = contentType;

  const canonicalHeaders = Object.keys(headers).sort().map((key) => `${key}:${headers[key]}\n`).join('');
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${s3Encode(key)}=${s3Encode(value)}`)
    .join('&');
  const canonicalRequest = [
    method,
    canonicalS3Path(url.pathname || '/'),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    s3HashHex(canonicalRequest),
  ].join('\n');

  const kDate = s3Hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = s3Hmac(kDate, cfg.region);
  const kService = s3Hmac(kRegion, 's3');
  const kSigning = s3Hmac(kService, 'aws4_request');
  const signature = s3Hmac(kSigning, stringToSign, 'hex');

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
};

const s3FetchErrorMessage = (err, url) => {
  const cause = err?.cause || err;
  const code = cause?.code || err?.code;
  const host = cause?.hostname || cause?.host || url.hostname;
  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return `S3 TLS-Zertifikat passt nicht zum Host ${host}. Prüfe den Endpoint und ob Path-Style fuer deinen Anbieter korrekt gesetzt ist.`;
  }
  if (['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(code)) {
    return `S3 Verbindung fehlgeschlagen (${code}) fuer ${host}. Bitte Endpoint, DNS und Netzwerkverbindung pruefen.`;
  }
  return `S3 Verbindung fehlgeschlagen: ${err?.message || 'Unbekannter Fehler'}`;
};

const s3Request = async ({ method, key = '', query = {}, body = '', contentType = '' }) => {
  const cfg = ensureS3Configured();
  const url = s3UrlFor(cfg, key, query);
  const headers = signS3Request({ cfg, method, url, body, contentType });
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(method === 'GET' || method === 'HEAD' ? {} : { body }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    const wrapped = new Error(s3FetchErrorMessage(err, url));
    wrapped.status = 502;
    wrapped.cause = err;
    throw wrapped;
  }
  const text = await response.text();
  if (!response.ok) {
    const err = new Error(`S3 Fehler (${response.status}): ${text.slice(0, 300) || response.statusText}`);
    err.status = response.status;
    throw err;
  }
  return { text, headers: response.headers };
};

const xmlDecode = (value) => String(value || '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const listS3Backups = async () => {
  const cfg = ensureS3Configured();
  const prefix = cfg.prefix ? `${cfg.prefix}/` : '';
  const { text } = await s3Request({
    method: 'GET',
    query: { 'list-type': '2', prefix, 'max-keys': '100' },
  });

  return [...text.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)]
    .map((match) => {
      const block = match[1];
      const key = xmlDecode(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] || '');
      const lastModified = xmlDecode(block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] || '');
      const size = Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] || 0);
      return { key, filename: key.split('/').pop(), lastModified, size };
    })
    .filter((item) => item.key.endsWith('.db'))
    .sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified)));
};

const loadDbState = async () => {
  try {
    // Avoid command retry noise when Redis is currently unreachable.
    const pingResult = await redis.ping().catch(() => null);
    if (pingResult !== 'PONG') {
      console.warn('[DB] Redis aktuell nicht erreichbar. Starte mit leerem In-Memory-Stand und versuche spaeter erneut.');
      return;
    }

    const [logs, users, smtp, authCfg, reminders, favorites, ai, s3Settings, settings, drinks, chatMessages, appName, appSettings, discordSchedules] = await redis.mget(
      REDIS_KEYS.caffeine_logs,
      REDIS_KEYS.users,
      REDIS_KEYS.smtp_settings,
      REDIS_KEYS.auth_config,
      REDIS_KEYS.reminders,
      REDIS_KEYS.favorites,
      REDIS_KEYS.ai_config,
      REDIS_KEYS.s3_settings,
      REDIS_KEYS.user_settings,
      REDIS_KEYS.custom_drinks,
      REDIS_KEYS.ai_chat_messages,
      REDIS_KEYS.app_name,
      REDIS_KEYS.app_settings,
      REDIS_KEYS.discord_schedules,
    );
    const parsedAi = safeParse(ai, {});
    const loadedState = normalizeDbState({
      caffeine_logs: safeParse(logs, []),
      users:         safeParse(users, []),
      smtp_settings: safeParse(smtp, null),
      auth_config:   safeParse(authCfg, null),
      reminders:     safeParse(reminders, []),
      favorites:     safeParse(favorites, []),
      ai_config: {
        apiKey:         parsedAi.apiKey         || '',
        model:          parsedAi.model          || 'deepseek/deepseek-v3',
        braveSearchKey: parsedAi.braveSearchKey || '',
      },
      s3_settings: safeParse(s3Settings, {}),
      user_settings: safeParse(settings, []),
      custom_drinks: safeParse(drinks, []),
      ai_chat_messages: safeParse(chatMessages, []),
      app_settings: safeParse(appSettings, {}),
      discord_schedules: safeParse(discordSchedules, []),
      appName: appName || 'Drink-Tracker',
    });
    const shouldEncryptS3Secrets = hasPlainS3Secrets(loadedState.s3_settings);
    dbState = loadedState;
    if (shouldEncryptS3Secrets) {
      console.log('[Security] Migriere gespeicherte S3-Zugangsdaten in verschluesselte Ablage.');
      await persistDbState();
    }
  } catch (err) {
    console.error('[DB] Redis Ladefehler:', err.message);
  }
};

const persistDbState = () => {
  const next = dbStateForStorage(dbState);
  dbState = next;
  return redis.mset(
    REDIS_KEYS.app_name,      next.appName || 'Drink-Tracker',
    REDIS_KEYS.caffeine_logs,  JSON.stringify(next.caffeine_logs),
    REDIS_KEYS.users,          JSON.stringify(next.users),
    REDIS_KEYS.smtp_settings,  JSON.stringify(next.smtp_settings),
    REDIS_KEYS.auth_config,    JSON.stringify(next.auth_config),
    REDIS_KEYS.reminders,      JSON.stringify(next.reminders),
    REDIS_KEYS.favorites,      JSON.stringify(next.favorites),
    REDIS_KEYS.ai_config,      JSON.stringify(next.ai_config),
    REDIS_KEYS.s3_settings,    JSON.stringify(next.s3_settings),
    REDIS_KEYS.user_settings,  JSON.stringify(next.user_settings),
    REDIS_KEYS.custom_drinks,  JSON.stringify(next.custom_drinks),
    REDIS_KEYS.ai_chat_messages, JSON.stringify(next.ai_chat_messages),
    REDIS_KEYS.app_settings,   JSON.stringify(next.app_settings),
    REDIS_KEYS.discord_schedules, JSON.stringify(next.discord_schedules),
  ).catch((err) => console.error('[DB] Redis Speicherfehler:', err.message));
};

const makeResult = (affectedRows = 0, insertId = undefined) => {
  const result = { affectedRows };
  if (insertId !== undefined) result.insertId = insertId;
  return result;
};

class FileDbAdapter {
  async execute(sql, params = []) {
    const q = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();

    if (q.startsWith('create table if not exists')) {
      return [makeResult(0)];
    }

    if (q.startsWith('select * from smtp_settings where id = 1')) {
      return [dbState.smtp_settings ? [dbState.smtp_settings] : []];
    }

    if (q.startsWith('insert into smtp_settings')) {
      dbState.smtp_settings = {
        id: 1,
        host: params[0],
        port: Number(params[1]) || 587,
        secure: params[2] ? 1 : 0,
        auth_user: params[3] || '',
        auth_pass: params[4] || '',
        from_name: params[5] || 'Koffein-Tracker',
        from_email: params[6] || params[3] || '',
        base_url: params[7] || '',
        registration_enabled: params[8] ? 1 : 0,
        demo_enabled: params[9] ? 1 : 0,
        discord_webhook: params[10] || '',
        updated_at: new Date().toISOString(),
      };
      persistDbState();
      return [makeResult(1, 1)];
    }

    if (q.startsWith('select * from caffeine_logs where date = ?')) {
      const date = params[0];
      const rows = dbState.caffeine_logs
        .filter((r) => r.date === date)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return [rows];
    }

    if (q.startsWith('insert into caffeine_logs')) {
      const nextId = (dbState.caffeine_logs.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) || 0) + 1;
      const row = {
        id: nextId,
        name: params[0],
        size: Number(params[1]),
        caffeine: Number(params[2]),
        caffeinePerMl: params[3] ?? null,
        icon: params[4] ?? null,
        isPreset: !!params[5],
        date: params[6],
        userId: params[7] ?? null,
        email: params[8] ?? null,
        createdAt: new Date().toISOString(),
      };
      dbState.caffeine_logs.push(row);
      persistDbState();
      return [makeResult(1, nextId)];
    }

    if (q.startsWith('select * from caffeine_logs where id = ?')) {
      const id = Number(params[0]);
      const rows = dbState.caffeine_logs.filter((r) => Number(r.id) === id);
      return [rows];
    }

    if (q.startsWith('delete from caffeine_logs where id = ?')) {
      const id = Number(params[0]);
      const before = dbState.caffeine_logs.length;
      dbState.caffeine_logs = dbState.caffeine_logs.filter((r) => Number(r.id) !== id);
      const affectedRows = before - dbState.caffeine_logs.length;
      if (affectedRows > 0) persistDbState();
      return [makeResult(affectedRows)];
    }

    if (q.startsWith('update caffeine_logs set name = ?, size = ?, caffeine = ?, icon = ? where id = ?')) {
      const name = params[0];
      const size = params[1];
      const caffeine = params[2];
      const icon = params[3];
      const id = Number(params[4]);
      
      const log = dbState.caffeine_logs.find((r) => Number(r.id) === id);
      if (!log) return [makeResult(0)];
      
      if (name !== undefined) log.name = name;
      if (size !== undefined) log.size = Number(size);
      if (caffeine !== undefined) log.caffeine = Number(caffeine);
      if (icon !== undefined) log.icon = icon;
      
      persistDbState();
      return [makeResult(1)];
    }

    if (q.includes('from users') && q.includes('order by created_at desc')) {
      const rows = [...dbState.users]
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          verified: !!u.verified,
          createdAt: u.created_at,
          lastLogin: u.last_login || null,
        }));
      return [rows];
    }

    if (q.startsWith('update users set verified = true')) {
      const id = params[0];
      const user = dbState.users.find((u) => u.id === id);
      if (!user) return [makeResult(0)];
      user.verified = true;
      user.verify_token = null;
      user.verify_token_expiry = null;
      persistDbState();
      return [makeResult(1)];
    }

    if (q.startsWith('update users set reset_token = ?')) {
      const resetToken = params[0];
      const resetExpiry = params[1];
      const id = params[2];
      const user = dbState.users.find((u) => u.id === id);
      if (!user) return [makeResult(0)];
      user.reset_token = resetToken;
      user.reset_token_expiry = resetExpiry;
      persistDbState();
      return [makeResult(1)];
    }

    if (q.startsWith('update users set password_hash = ?')) {
      const hash = params[0];
      const id = params[1];
      const user = dbState.users.find((u) => u.id === id);
      if (!user) return [makeResult(0)];
      user.password_hash = hash;
      user.reset_token = null;
      user.reset_token_expiry = null;
      persistDbState();
      return [makeResult(1)];
    }

    if (q.startsWith('update users set name = ?, email = ?, password_hash = ? where id = ?')) {
      const name = params[0];
      const email = params[1];
      const hash = params[2];
      const id = params[3];
      const user = dbState.users.find((u) => u.id === id);
      if (!user) return [makeResult(0)];
      user.name = name;
      user.email = email;
      if (hash) {
        user.password_hash = hash;
      }
      persistDbState();
      return [makeResult(1)];
    }

    if (q.startsWith('delete from users where id = ?')) {
      const id = params[0];
      const before = dbState.users.length;
      dbState.users = dbState.users.filter((u) => u.id !== id);
      const affectedRows = before - dbState.users.length;
      if (affectedRows > 0) persistDbState();
      return [makeResult(affectedRows)];
    }

    if (q.startsWith('update users set role = ? where id = ?')) {
      const role = params[0];
      const id = params[1];
      const user = dbState.users.find((u) => u.id === id);
      if (!user) return [makeResult(0)];
      user.role = role;
      persistDbState();
      return [makeResult(1)];
    }

    if (q.startsWith('select id from users where email = ? limit 1')) {
      const email = String(params[0] || '').toLowerCase();
      const user = dbState.users.find((u) => u.email === email);
      return [user ? [{ id: user.id }] : []];
    }

    if (q.startsWith('insert into users')) {
      const row = {
        id: params[0],
        name: params[1],
        email: String(params[2] || '').toLowerCase(),
        password_hash: params[3],
        role: 'user',
        verified: false,
        verify_token: params[4],
        verify_token_expiry: params[5],
        totp_enabled: false,
        totp_secret: null,
        totp_temp_secret: null,
        webauthn_user_id: toBase64Url(crypto.randomBytes(32)),
        passkeys: [],
        created_at: new Date().toISOString(),
        last_login: null,
      };
      dbState.users.push(row);
      persistDbState();
      return [makeResult(1)];
    }

    if (q.includes('from users') && q.includes('where verify_token = ?')) {
      const token = params[0];
      const user = dbState.users.find((u) => u.verify_token === token);
      if (!user) return [[]];
      return [[{ id: user.id, verifyTokenExpiry: user.verify_token_expiry }]];
    }

    if (q.includes('from users') && q.includes('password_hash as passwordhash') && q.includes('where email = ?')) {
      const email = String(params[0] || '').toLowerCase();
      const user = dbState.users.find((u) => u.email === email);
      if (!user) return [[]];
      return [[{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: !!user.verified,
        passwordHash: user.password_hash,
      }]];
    }

    if (q.startsWith('update users set last_login = now() where id = ?')) {
      const id = params[0];
      const user = dbState.users.find((u) => u.id === id);
      if (!user) return [makeResult(0)];
      user.last_login = new Date().toISOString();
      persistDbState();
      return [makeResult(1)];
    }

    throw new Error(`Unsupported query in file DB adapter: ${sql}`);
  }
}

let pool = null;

const getPool = () => {
  if (!pool) {
    pool = new FileDbAdapter();
  }
  return pool;
};

const mapSmtpRowToConfig = (row) => {
  // Default config wenn keine Row existiert
  const defaults = {
    host: '',
    port: 587,
    secure: false,
    auth: { user: '', pass: '' },
    fromName: 'Koffein-Tracker',
    fromEmail: 'admin@fra03.de',
    baseUrl: '',
    registrationEnabled: true, // ✓ Default: Registrierung ENABLED
    demoEnabled: true,
    discordWebhook: '',
  };
  
  if (!row) return defaults;
  
  return {
    host: row.host || defaults.host,
    port: Number(row.port || defaults.port),
    secure: !!row.secure,
    auth: {
      user: row.auth_user || defaults.auth.user,
      pass: row.auth_pass || defaults.auth.pass,
    },
    fromName: row.from_name || defaults.fromName,
    fromEmail: row.from_email || defaults.fromEmail,
    baseUrl: row.base_url || defaults.baseUrl,
    registrationEnabled: row.registration_enabled !== 0,
    demoEnabled: row.demo_enabled !== 0,
    discordWebhook: row.discord_webhook || '',
  };
};

const loadSmtpConfig = async () => {
  const dbPool = getPool();
  const [rows] = await dbPool.execute(
    'SELECT * FROM smtp_settings WHERE id = 1 LIMIT 1'
  );
  return mapSmtpRowToConfig(rows[0] || null);
};

const isMaskedSecret = (value) => /^[•*]{4,}$/.test(String(value || '').trim());
const isValidDiscordWebhookUrl = (value) =>
  /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/.+/i.test(String(value || '').trim());

const saveSmtpConfig = async (cfg) => {
  const dbPool = getPool();
  const current = await loadSmtpConfig().catch(() => null);
  const incomingPass = String(cfg.auth?.pass || '');
  const authPass = incomingPass && !isMaskedSecret(incomingPass)
    ? incomingPass
    : (current?.auth?.pass || '');
  const hasDiscordWebhook = Object.prototype.hasOwnProperty.call(cfg, 'discordWebhook');
  const discordWebhook = hasDiscordWebhook ? String(cfg.discordWebhook || '').trim() : (current?.discordWebhook || '');

  if (discordWebhook && !isValidDiscordWebhookUrl(discordWebhook)) {
    throw new Error('Ungültige Discord Webhook URL.');
  }

  await dbPool.execute(
    `INSERT INTO smtp_settings
      (id, host, port, secure, auth_user, auth_pass, from_name, from_email, base_url, registration_enabled, demo_enabled, discord_webhook)
     VALUES
      (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      host = VALUES(host),
      port = VALUES(port),
      secure = VALUES(secure),
      auth_user = VALUES(auth_user),
      auth_pass = VALUES(auth_pass),
      from_name = VALUES(from_name),
      from_email = VALUES(from_email),
      base_url = VALUES(base_url),
      registration_enabled = VALUES(registration_enabled),
      demo_enabled = VALUES(demo_enabled),
      discord_webhook = VALUES(discord_webhook)`
    , [
      cfg.host,
      Number(cfg.port),
      !!cfg.secure,
      cfg.auth?.user || '',
      authPass,
      cfg.fromName || 'Koffein-Tracker',
      cfg.fromEmail || cfg.auth?.user || '',
      cfg.baseUrl || '',
      !!cfg.registrationEnabled,
      !!cfg.demoEnabled,
      discordWebhook
    ]
  );
};

const initDb = async () => {
  console.log('[DB] Starte Redis-Datenbank...');
  getPool();
  await loadDbState();
  console.log(`[DB] ✓ Redis bereit: ${redisUrl}`);
};



// ── AI / OpenRouter helpers ───────────────────────────────────────────────────
const loadAiConfig = () => {
  return dbState.ai_config || { apiKey: '', model: 'deepseek/deepseek-v3', braveSearchKey: '' };
};

const saveAiConfig = (cfg) => {
  dbState.ai_config = {
    apiKey: String(cfg.apiKey || '').trim(),
    model: String(cfg.model || 'deepseek/deepseek-v3').trim(),
    braveSearchKey: String(cfg.braveSearchKey || '').trim(),
  };
  persistDbState();
};

const callOpenRouter = async (messages, { model, apiKey, tools } = {}) => {
  const cfg = loadAiConfig();
  const key = apiKey || cfg.apiKey;
  const mdl = model || cfg.model || 'deepseek/deepseek-v3';

  if (!key) throw new Error('Kein OpenRouter API-Key konfiguriert. Bitte im Admin-Panel eintragen.');

  const payload = { model: mdl, messages };
  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/DerMinecrafter2020/energytracker',
      'X-Title': 'Koffein-Tracker',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `OpenRouter Fehler: HTTP ${response.status}`);
  }

  const data = await response.json();
  const msg = data.choices?.[0]?.message;
  const legacyFunctionCall = msg?.function_call
    ? [{ type: 'function', function: msg.function_call }]
    : [];
  return { content: msg?.content || '', tool_calls: msg?.tool_calls || legacyFunctionCall };
};

const OFF_SEARCH_URL     = 'https://world.openfoodfacts.org/cgi/search.pl';
const BRAVE_SEARCH_URL   = 'https://api.search.brave.com/res/v1/web/search';

const fetchDrinkWebContextBrave = async (description, apiKey) => {
  const query = `${String(description || '').trim()} Koffeingehalt mg Getränk Nährwerte`;
  try {
    const url = new URL(BRAVE_SEARCH_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('count', '5');
    url.searchParams.set('search_lang', 'de');

    const resp = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const results = Array.isArray(data?.web?.results) ? data.web.results : [];
    if (results.length === 0) return null;

    return results.slice(0, 5).map((r, idx) => {
      const snippet = (r.description || r.extra_snippets?.[0] || '').slice(0, 300);
      return `${idx + 1}. ${r.title || ''}\n   ${snippet}`;
    }).join('\n\n');
  } catch {
    return null;
  }
};

const parseMlFromText = (value) => {
  if (!value) return null;
  const match = String(value).toLowerCase().match(/(\d+(?:[\.,]\d+)?)\s*ml/);
  if (!match) return null;
  return Math.round(parseFloat(match[1].replace(',', '.')));
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getOffCaffeinePer100ml = (product) => {
  const nutriments = product?.nutriments || {};

  const direct100 = toNumber(nutriments.caffeine_100g);
  if (direct100 !== null) return Math.round(direct100);

  const direct = toNumber(nutriments.caffeine);
  if (direct !== null) return Math.round(direct);

  const serving = toNumber(nutriments.caffeine_serving);
  if (serving !== null) {
    const servingMl = parseMlFromText(product?.serving_size || product?.quantity);
    if (servingMl) return Math.round((serving / servingMl) * 100);
  }

  return null;
};

const fetchDrinkWebContext = async (description) => {
  const query = String(description || '').trim();
  if (!query) return [];

  try {
    const url = new URL(OFF_SEARCH_URL);
    url.searchParams.set('search_terms', query);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '5');
    url.searchParams.set('fields', 'product_name,brands,quantity,serving_size,nutriments');

    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    const products = Array.isArray(data?.products) ? data.products : [];

    return products
      .map((p) => {
        const name = p?.product_name || '';
        const brand = p?.brands || '';
        const sizeMl = parseMlFromText(p?.quantity || p?.serving_size);
        const caffeinePer100ml = getOffCaffeinePer100ml(p);
        return { name, brand, sizeMl, caffeinePer100ml };
      })
      .filter((p) => p.name)
      .slice(0, 5);
  } catch {
    return [];
  }
};

const formatDrinkWebContext = (hits) => {
  if (!Array.isArray(hits) || hits.length === 0) {
    return 'Keine verifizierten Online-Treffer gefunden. Nutze konservative Standardschaetzungen.';
  }

  return hits.map((hit, idx) => {
    const brand = hit.brand ? `, Marke: ${hit.brand}` : '';
    const size = hit.sizeMl ? `, Groesse: ${hit.sizeMl}ml` : '';
    const caffeine = hit.caffeinePer100ml !== null && hit.caffeinePer100ml !== undefined
      ? `, Koffein/100ml: ${hit.caffeinePer100ml}mg`
      : ', Koffein/100ml: unbekannt';
    return `${idx + 1}. ${hit.name}${brand}${size}${caffeine}`;
  }).join('\n');
};

const getReminderOwnerKey = ({ userId, email }) => {
  if (userId) return `user:${userId}`;
  return `email:${String(email || '').toLowerCase().trim()}`;
};

const isValidReminderTime = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(time || ''));

const sanitizeReminder = (reminder) => ({
  enabled: reminder.enabled !== false && reminder.enabled !== 'false',
  time: isValidReminderTime(reminder.time) ? reminder.time : '18:00',
  mailEnabled: reminder.mailEnabled !== false && reminder.mailEnabled !== 'false',
  discordEnabled: !!reminder.discordEnabled,
  lastTriggeredDate: reminder.lastTriggeredDate || null,
});

const getReminderForUser = ({ userId, email }) => {
  const ownerKey = getReminderOwnerKey({ userId, email });
  const found = dbState.reminders.find((r) => r.ownerKey === ownerKey);
  if (!found) {
    return {
      ownerKey,
      userId: userId || null,
      email: String(email || '').toLowerCase().trim(),
      ...sanitizeReminder({}),
    };
  }
  return {
    ...found,
    ...sanitizeReminder(found),
  };
};

const upsertReminderForUser = ({ userId, email, settings }) => {
  const ownerKey = getReminderOwnerKey({ userId, email });
  const idx = dbState.reminders.findIndex((r) => r.ownerKey === ownerKey);
  const base = idx >= 0 ? dbState.reminders[idx] : { ownerKey, userId: userId || null, email: String(email || '').toLowerCase().trim() };
  const updated = {
    ...base,
    userId: userId || null,
    email: String(email || '').toLowerCase().trim(),
    ...sanitizeReminder({ ...base, ...settings }),
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) dbState.reminders[idx] = updated;
  else dbState.reminders.push(updated);

  persistDbState();
  return updated;
};

const getFavoritesOwnerKey = ({ userId, email }) => {
  if (userId) return `user:${userId}`;
  return `email:${String(email || '').toLowerCase().trim()}`;
};

const favoriteDrinkKey = (drink) => {
  const name = String(drink?.name || '').toLowerCase().trim();
  const size = Number(drink?.size || 0);
  const caffeine = Number(drink?.caffeine || 0);
  const icon = String(drink?.icon || '').trim();
  return `${name}|${size}|${caffeine}|${icon}`;
};

const getFavoritesForUser = ({ userId, email }) => {
  const ownerKey = getFavoritesOwnerKey({ userId, email });
  const found = dbState.favorites.find((f) => f.ownerKey === ownerKey);
  if (!found) {
    return {
      ownerKey,
      userId: userId || null,
      email: String(email || '').toLowerCase().trim(),
      items: [],
    };
  }
  return {
    ...found,
    items: Array.isArray(found.items) ? found.items : [],
  };
};

const upsertFavoriteForUser = ({ userId, email, drink }) => {
  const ownerKey = getFavoritesOwnerKey({ userId, email });
  const idx = dbState.favorites.findIndex((f) => f.ownerKey === ownerKey);
  const base = idx >= 0 ? dbState.favorites[idx] : {
    ownerKey,
    userId: userId || null,
    email: String(email || '').toLowerCase().trim(),
    items: [],
  };

  const items = Array.isArray(base.items) ? [...base.items] : [];
  const key = favoriteDrinkKey(drink);
  const existingIdx = items.findIndex((item) => favoriteDrinkKey(item) === key);

  const item = {
    id: existingIdx >= 0 ? items[existingIdx].id : crypto.randomUUID(),
    name: String(drink.name || '').trim(),
    size: Number(drink.size || 0),
    caffeine: Number(drink.caffeine || 0),
    caffeinePerMl: drink.caffeinePerMl !== undefined && drink.caffeinePerMl !== null
      ? Number(drink.caffeinePerMl)
      : null,
    icon: String(drink.icon || '🥤'),
    updatedAt: new Date().toISOString(),
    createdAt: existingIdx >= 0 ? items[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) items[existingIdx] = item;
  else items.unshift(item);

  const updated = {
    ...base,
    userId: userId || null,
    email: String(email || '').toLowerCase().trim(),
    items,
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) dbState.favorites[idx] = updated;
  else dbState.favorites.push(updated);

  persistDbState();
  return item;
};

const removeFavoriteForUser = ({ userId, email, favoriteId }) => {
  const ownerKey = getFavoritesOwnerKey({ userId, email });
  const idx = dbState.favorites.findIndex((f) => f.ownerKey === ownerKey);
  if (idx < 0) return false;

  const before = dbState.favorites[idx].items.length;
  dbState.favorites[idx].items = dbState.favorites[idx].items.filter((item) => item.id !== favoriteId);
  const removed = before !== dbState.favorites[idx].items.length;
  if (removed) {
    dbState.favorites[idx].updatedAt = new Date().toISOString();
    persistDbState();
  }
  return removed;
};

// ── USER SETTINGS HELPERS ────────────────────────────────────────────────────
const getSettingsOwnerKey = ({ userId, email }) => {
  if (userId) return `user:${userId}`;
  if (email) return `email:${email}`;
  throw new Error('userId oder email erforderlich');
};

const ALLOWED_THEMES = new Set([
  'system',
  'light',
  'oled',
  'neon',
  'forest',
  'ocean',
  'sunrise',
  'berry',
  'cyber',
  'mint',
  'contrast',
]);

const getUserSettings = ({ userId, email }) => {
  const ownerKey = getSettingsOwnerKey({ userId, email });
  const settings = dbState.user_settings.find((s) => s.ownerKey === ownerKey);
  const defaults = {
    ownerKey,
    dailyLimit: 400,
    sleepTime: '23:00',
    notifyAtLimit: true,
    notifyLate: true,
    notifyRapid: true,
    discordNotifyAtLimit: false,
    discordNotifyLate: false,
    discordNotifyRapid: false,
    theme: 'system',
    createdAt: new Date().toISOString(),
  };
  const merged = settings ? { ...defaults, ...settings } : defaults;
  merged.theme = ALLOWED_THEMES.has(merged.theme) ? merged.theme : defaults.theme;
  return merged;
};

const isValidTime = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(time || ''));

const updateUserSettings = ({ userId, email, dailyLimit, sleepTime, notifyAtLimit, notifyLate, notifyRapid, discordNotifyAtLimit, discordNotifyLate, discordNotifyRapid, theme }) => {
  const ownerKey = getSettingsOwnerKey({ userId, email });
  let settings = dbState.user_settings.find((s) => s.ownerKey === ownerKey);
  if (!settings) {
    settings = { ownerKey, createdAt: new Date().toISOString() };
    dbState.user_settings.push(settings);
  }
  if (dailyLimit !== undefined) settings.dailyLimit = dailyLimit;
  if (sleepTime !== undefined) settings.sleepTime = sleepTime;
  if (notifyAtLimit !== undefined) settings.notifyAtLimit = notifyAtLimit;
  if (notifyLate !== undefined) settings.notifyLate = notifyLate;
  if (notifyRapid !== undefined) settings.notifyRapid = notifyRapid;
  if (discordNotifyAtLimit !== undefined) settings.discordNotifyAtLimit = discordNotifyAtLimit;
  if (discordNotifyLate !== undefined) settings.discordNotifyLate = discordNotifyLate;
  if (discordNotifyRapid !== undefined) settings.discordNotifyRapid = discordNotifyRapid;
  if (theme !== undefined) settings.theme = ALLOWED_THEMES.has(theme) ? theme : 'system';
  
  settings.updatedAt = new Date().toISOString();
  persistDbState();
  return settings;
};

// ── CUSTOM DRINKS HELPERS ────────────────────────────────────────────────────
const getCustomDrinksForUser = ({ userId, email }) => {
  const ownerKey = getSettingsOwnerKey({ userId, email });
  return dbState.custom_drinks.filter((d) => d.ownerKey === ownerKey);
};

const addCustomDrink = ({ userId, email, name, size, caffeine, icon }) => {
  const ownerKey = getSettingsOwnerKey({ userId, email });
  const id = crypto.randomBytes(8).toString('hex');
  const drink = { id, ownerKey, name, size, caffeine: Number(caffeine) || 0, icon: icon || '🥤', createdAt: new Date().toISOString() };
  dbState.custom_drinks.push(drink);
  persistDbState();
  return drink;
};

const removeCustomDrink = ({ userId, email, drinkId }) => {
  const ownerKey = getSettingsOwnerKey({ userId, email });
  const idx = dbState.custom_drinks.findIndex((d) => d.ownerKey === ownerKey && d.id === drinkId);
  if (idx < 0) return false;
  dbState.custom_drinks.splice(idx, 1);
  persistDbState();
  return true;
};

const sanitizeAiChatMessage = (message) => {
  const role = ['user', 'assistant', 'system'].includes(message?.role) ? message.role : 'assistant';
  const type = typeof message?.type === 'string' && message.type.trim() ? message.type.trim() : 'text';
  const safe = { role, type };

  if (message?.content !== undefined) safe.content = String(message.content);
  if (message?.summary !== undefined) safe.summary = typeof message.summary === 'string' ? message.summary : message.summary;
  if (message?.time !== undefined) safe.time = String(message.time);
  if (message?.message !== undefined) safe.message = String(message.message);
  if (message?.drink && typeof message.drink === 'object') {
    safe.drink = {
      id: message.drink.id,
      name: String(message.drink.name || ''),
      size: Number(message.drink.size) || 0,
      caffeine: Number(message.drink.caffeine) || 0,
      icon: String(message.drink.icon || '🥤'),
    };
  }

  return safe;
};

const getAiChatHistory = ({ userId, email }) => {
  const ownerKey = getSettingsOwnerKey({ userId, email });
  const found = dbState.ai_chat_messages.find((entry) => entry.ownerKey === ownerKey);
  return found || {
    ownerKey,
    userId: userId || null,
    email: String(email || '').toLowerCase().trim(),
    messages: [],
    updatedAt: null,
  };
};

const upsertAiChatHistory = ({ userId, email, messages }) => {
  const ownerKey = getSettingsOwnerKey({ userId, email });
  const idx = dbState.ai_chat_messages.findIndex((entry) => entry.ownerKey === ownerKey);
  const updated = {
    ownerKey,
    userId: userId || null,
    email: String(email || '').toLowerCase().trim(),
    messages: Array.isArray(messages) ? messages.map(sanitizeAiChatMessage) : [],
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) dbState.ai_chat_messages[idx] = updated;
  else dbState.ai_chat_messages.push(updated);
  persistDbState();
  return updated;
};

const getUserByIdentity = ({ userId, email }) => {
  const safeUserId = String(userId || '').trim();
  const safeEmail = String(email || '').toLowerCase().trim();
  return dbState.users.find((u) =>
    (safeUserId && String(u.id) === safeUserId)
    || (safeEmail && String(u.email || '').toLowerCase() === safeEmail)
  ) || null;
};

const ensureUserSecurityFields = (user) => {
  if (!user) return;
  if (!Array.isArray(user.passkeys)) user.passkeys = [];
  if (typeof user.totp_enabled !== 'boolean') user.totp_enabled = false;
  if (!user.totp_secret) user.totp_secret = null;
  if (!user.totp_temp_secret) user.totp_temp_secret = null;
  if (!user.webauthn_user_id) user.webauthn_user_id = null;
};

const createSecondFactorToken = (user) => {
  const token = crypto.randomBytes(24).toString('hex');
  pendingSecondFactor.set(token, {
    userId: user.id,
    email: user.email,
    expiresAt: Date.now() + AUTH_CHALLENGE_TTL_MS,
  });
  return token;
};

const consumeSecondFactorToken = (token) => {
  cleanupAuthChallenges();
  const key = String(token || '').trim();
  const payload = pendingSecondFactor.get(key);
  if (!payload) return null;
  pendingSecondFactor.delete(key);
  return payload;
};

const peekSecondFactorToken = (token) => {
  cleanupAuthChallenges();
  const key = String(token || '').trim();
  return pendingSecondFactor.get(key) || null;
};

const sanitizeSecurityOverview = (user) => {
  ensureUserSecurityFields(user);
  return {
    totpEnabled: !!user.totp_enabled,
    passkeys: user.passkeys.map((k) => ({
      id: k.id,
      name: k.name || 'Sicherheitsschluessel',
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null,
      transports: Array.isArray(k.transports) ? k.transports : [],
    })),
  };
};

const completeLoginForUser = async (user) => {
  const dbPool = getPool();
  await dbPool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
  return buildSessionUser(user);
};


// ── STATISTICS HELPERS ───────────────────────────────────────────────────────
const getWeeklyStats = ({ userId, email }) => {
  const ownerKey = getSettingsOwnerKey({ userId, email });
  const today = new Date();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    week.push(toDateKey(d));
  }

  const stats = week.map((dateStr) => {
    const logsForDay = dbState.caffeine_logs.filter((log) => {
      const matchId = userId && String(log.userId) === String(userId);
      const matchEmail = email && String(log.email).toLowerCase() === String(email).toLowerCase();
      return (matchId || matchEmail) && log.date === dateStr;
    });
    const totalCaffeine = logsForDay.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0);
    const count = logsForDay.length;
    return { date: dateStr, totalCaffeine, count, logs: logsForDay };
  });
  return stats;
};

const getDailyStats = (date) => {
  // Aggregiert statistiken für einen Tag (für Admin-Übersicht)
  const logsForDay = dbState.caffeine_logs.filter((log) => log.date === date);
  const users = new Set();
  let totalCaffeine = 0;
  const byUser = {};

  logsForDay.forEach((log) => {
    const user = log.email || log.userId || 'unknown';
    users.add(user);
    totalCaffeine += Number(log.caffeine) || 0;
    byUser[user] = (byUser[user] || 0) + (Number(log.caffeine) || 0);
  });

  return { date, totalUsers: users.size, totalCaffeine, byUser, logCount: logsForDay.length };
};

const getTodayStats = ({ userId, email }) => {
  const today = getTodayKey();
  const logsForToday = dbState.caffeine_logs.filter((log) => {
    const matchId = userId && String(log.userId) === String(userId);
    const matchEmail = email && String(log.email).toLowerCase() === String(email).toLowerCase();
    return (matchId || matchEmail) && log.date === today;
  });
  const totalCaffeine = logsForToday.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0);
  const settings = getUserSettings({ userId, email });
  const limit = settings.dailyLimit || 400;
  const remainingCaffeine = Math.max(0, limit - totalCaffeine);
  const isOverLimit = totalCaffeine > limit;

  return {
    date: today,
    totalCaffeine,
    dailyLimit: limit,
    remainingCaffeine,
    isOverLimit,
    logCount: logsForToday.length,
    logs: logsForToday,
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const isValidDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const parseDateKey = (value) => {
  if (!isValidDateKey(value)) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const toDateKey = (date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const getTodayKey = () => toDateKey(new Date());

const startOfWeek = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
};

const endOfWeek = (date) => addDays(startOfWeek(date), 6);

const startOfMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

const eachDateKey = (startKey, endKey) => {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (!start || !end || start > end) return [];
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(toDateKey(d));
  return days;
};

const getLogDateTime = (log) => {
  const value = log?.createdAt || log?.timestamp || log?.date;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const logMatchesUser = (log, { userId, email } = {}) => {
  const safeEmail = String(email || '').toLowerCase().trim();
  const matchId = userId && String(log.userId) === String(userId);
  const matchEmail = safeEmail && String(log.email || '').toLowerCase() === safeEmail;
  return !!(matchId || matchEmail);
};

const userHasLogForDate = ({ userId, email, date }) =>
  dbState.caffeine_logs.some((log) =>
    String(log.date || '') === String(date || '')
    && logMatchesUser(log, { userId, email })
  );

const getLogsForUser = ({ userId, email, start, end }) =>
  dbState.caffeine_logs
    .filter((log) => logMatchesUser(log, { userId, email }))
    .filter((log) => (!start || String(log.date || '') >= start) && (!end || String(log.date || '') <= end))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

const getRangeFromQuery = (query, defaultDays = 30) => {
  const end = isValidDateKey(query.end) ? String(query.end) : getTodayKey();
  const defaultStart = toDateKey(addDays(parseDateKey(end), -(defaultDays - 1)));
  const start = isValidDateKey(query.start) ? String(query.start) : defaultStart;

  const startDate = parseDateKey(start);
  const endDate = parseDateKey(end);
  if (!startDate || !endDate || startDate > endDate) {
    const err = new Error('start und end muessen gueltige Datumswerte im Format YYYY-MM-DD sein.');
    err.status = 400;
    throw err;
  }
  if ((endDate - startDate) / DAY_MS > 366) {
    const err = new Error('Der Exportzeitraum darf maximal 366 Tage umfassen.');
    err.status = 400;
    throw err;
  }

  return { start, end };
};

const summarizePeriod = ({ logs, start, end, dailyLimit }) => {
  const days = eachDateKey(start, end);
  const daily = days.map((date) => {
    const dayLogs = logs.filter((log) => log.date === date);
    const totalCaffeine = dayLogs.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0);
    return { date, totalCaffeine, count: dayLogs.length, isOverLimit: totalCaffeine > dailyLimit };
  });
  const totalCaffeine = daily.reduce((sum, day) => sum + day.totalCaffeine, 0);
  const target = dailyLimit * Math.max(1, days.length);
  return {
    start,
    end,
    days: days.length,
    totalCaffeine,
    target,
    percent: target > 0 ? Math.round((totalCaffeine / target) * 100) : 0,
    averagePerDay: days.length ? Math.round(totalCaffeine / days.length) : 0,
    loggedDays: daily.filter((day) => day.count > 0).length,
    daysOverLimit: daily.filter((day) => day.isOverLimit).length,
    logCount: logs.length,
    daily,
  };
};

const getStatsOverview = ({ userId, email }) => {
  const settings = getUserSettings({ userId, email });
  const dailyLimit = Number(settings.dailyLimit) || 400;
  const today = parseDateKey(getTodayKey());
  const weekStart = toDateKey(startOfWeek(today));
  const weekEnd = toDateKey(endOfWeek(today));
  const monthStart = toDateKey(startOfMonth(today));
  const monthEnd = toDateKey(endOfMonth(today));

  return {
    dailyLimit,
    week: summarizePeriod({
      logs: getLogsForUser({ userId, email, start: weekStart, end: weekEnd }),
      start: weekStart,
      end: weekEnd,
      dailyLimit,
    }),
    month: summarizePeriod({
      logs: getLogsForUser({ userId, email, start: monthStart, end: monthEnd }),
      start: monthStart,
      end: monthEnd,
      dailyLimit,
    }),
  };
};

const getPersonalRecords = ({ userId, email }) => {
  const settings = getUserSettings({ userId, email });
  const dailyLimit = Number(settings.dailyLimit) || 400;
  const today = parseDateKey(getTodayKey());
  const start = toDateKey(addDays(today, -89));
  const end = getTodayKey();
  const logs = getLogsForUser({ userId, email, start, end });
  const daily = summarizePeriod({ logs, start, end, dailyLimit }).daily;

  const activeDays = daily.filter((day) => day.count > 0);
  const bestLowDay = [...activeDays]
    .filter((day) => day.totalCaffeine <= dailyLimit)
    .sort((a, b) => a.totalCaffeine - b.totalCaffeine || b.count - a.count)[0] || null;
  const maxCaffeineDay = [...activeDays].sort((a, b) => b.totalCaffeine - a.totalCaffeine)[0] || null;
  const maxLoggedDay = [...activeDays].sort((a, b) => b.count - a.count || b.totalCaffeine - a.totalCaffeine)[0] || null;

  let currentUnderLimitStreak = 0;
  let longestUnderLimitStreak = 0;
  let runningStreak = 0;
  [...daily].reverse().forEach((day, index) => {
    const qualifies = day.count > 0 && day.totalCaffeine <= dailyLimit;
    if (qualifies) {
      runningStreak += 1;
      if (index === currentUnderLimitStreak) currentUnderLimitStreak += 1;
      longestUnderLimitStreak = Math.max(longestUnderLimitStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  });

  const drinkStats = new Map();
  logs.forEach((log) => {
    const key = String(log.name || 'Unbekannt').toLowerCase().trim();
    const entry = drinkStats.get(key) || { name: log.name || 'Unbekannt', count: 0, totalCaffeine: 0, totalSize: 0 };
    entry.count += 1;
    entry.totalCaffeine += Number(log.caffeine) || 0;
    entry.totalSize += Number(log.size) || 0;
    drinkStats.set(key, entry);
  });
  const favoriteDrink = [...drinkStats.values()].sort((a, b) => b.count - a.count || b.totalCaffeine - a.totalCaffeine)[0] || null;

  return {
    range: { start, end },
    dailyLimit,
    trackedDays: activeDays.length,
    currentUnderLimitStreak,
    longestUnderLimitStreak,
    maxCaffeineDay,
    maxLoggedDay,
    bestLowDay,
    favoriteDrink,
  };
};

const buildAchievements = ({ logs, dailyLimit }) => {
  const today = parseDateKey(getTodayKey());
  const last30Start = toDateKey(addDays(today, -29));
  const weekStart = toDateKey(startOfWeek(today));
  const weekEnd = toDateKey(endOfWeek(today));
  const last30Days = summarizePeriod({ logs: logs.filter((log) => log.date >= last30Start), start: last30Start, end: getTodayKey(), dailyLimit }).daily;
  const weekLogs = logs.filter((log) => log.date >= weekStart && log.date <= weekEnd);
  const weekTotal = weekLogs.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0);
  const lateWeek = weekLogs.some((log) => {
    const logTime = getLogDateTime(log);
    return logTime && logTime.getHours() >= 18;
  });
  let underLimitStreak = 0;
  for (let i = 0; i < 14; i += 1) {
    const date = toDateKey(addDays(today, -i));
    const day = last30Days.find((entry) => entry.date === date);
    if (!day || day.count === 0 || day.totalCaffeine > dailyLimit) break;
    underLimitStreak += 1;
  }
  const trackedDays = last30Days.filter((day) => day.count > 0).length;

  return [
    {
      id: 'under-limit-3',
      title: '3 Tage unter Limit',
      description: 'Drei getrackte Tage in Folge unter deinem Tageslimit.',
      progress: Math.min(underLimitStreak, 3),
      target: 3,
      unlocked: underLimitStreak >= 3,
    },
    {
      id: 'no-late-week',
      title: 'Keine spaeten Drinks',
      description: 'Diese Woche kein Koffein nach 18:00 Uhr.',
      progress: lateWeek ? 0 : 1,
      target: 1,
      unlocked: weekLogs.length > 0 && !lateWeek,
    },
    {
      id: 'tracked-7',
      title: '7 Tage getrackt',
      description: 'Sieben verschiedene Tage mit Einträgen im letzten Monat.',
      progress: Math.min(trackedDays, 7),
      target: 7,
      unlocked: trackedDays >= 7,
    },
    {
      id: 'week-under-limit',
      title: 'Woche im Rahmen',
      description: 'Aktuelle Woche bleibt unter dem Wochenziel.',
      progress: Math.min(weekTotal, dailyLimit * 7),
      target: dailyLimit * 7,
      unlocked: weekLogs.length > 0 && weekTotal <= dailyLimit * 7,
      unit: 'mg',
    },
  ];
};

const getUserInsights = ({ userId, email }) => {
  const settings = getUserSettings({ userId, email });
  const dailyLimit = Number(settings.dailyLimit) || 400;
  const today = parseDateKey(getTodayKey());
  const start = toDateKey(addDays(today, -29));
  const end = getTodayKey();
  const logs = getLogsForUser({ userId, email, start, end });
  const days = summarizePeriod({ logs, start, end, dailyLimit }).daily;
  const weekdayStats = Array.from({ length: 7 }, (_, index) => ({ index, label: WEEKDAY_LABELS[index], total: 0, count: 0, activeDays: 0 }));
  const drinkStats = new Map();

  days.forEach((day) => {
    const parsed = parseDateKey(day.date);
    const weekday = parsed.getUTCDay();
    weekdayStats[weekday].total += day.totalCaffeine;
    weekdayStats[weekday].count += day.count;
    if (day.count > 0) weekdayStats[weekday].activeDays += 1;
  });

  logs.forEach((log) => {
    const key = String(log.name || 'Unbekannt').toLowerCase().trim();
    const entry = drinkStats.get(key) || { name: log.name || 'Unbekannt', count: 0, totalCaffeine: 0 };
    entry.count += 1;
    entry.totalCaffeine += Number(log.caffeine) || 0;
    drinkStats.set(key, entry);
  });

  const topWeekday = weekdayStats
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total)[0] || null;
  const lateDrinks = logs.filter((log) => {
    const logTime = getLogDateTime(log);
    return logTime && logTime.getHours() >= 18;
  });
  const topDrink = [...drinkStats.values()].sort((a, b) => b.count - a.count || b.totalCaffeine - a.totalCaffeine)[0] || null;
  const overLimitDays = days.filter((day) => day.isOverLimit);
  const riskScore = Math.min(100, Math.round((overLimitDays.length * 14) + (lateDrinks.length * 4) + ((topDrink?.count || 0) > 8 ? 10 : 0)));
  const riskLevel = riskScore >= 60 ? 'high' : (riskScore >= 30 ? 'medium' : 'low');

  const messages = [];
  if (topWeekday) messages.push(`Du trinkst an ${topWeekday.label}en besonders viel Koffein (${topWeekday.total} mg in 30 Tagen).`);
  if (lateDrinks.length > 0) messages.push(`${lateDrinks.length} Einträge lagen nach 18:00 Uhr. Deine Schlaf-Warnung ist hier besonders sinnvoll.`);
  if (topDrink) messages.push(`${topDrink.name} ist dein häufigstes Getränk (${topDrink.count}x).`);
  if (overLimitDays.length > 0) messages.push(`${overLimitDays.length} Tage lagen im letzten Monat über deinem Limit.`);
  if (messages.length === 0) messages.push('Noch zu wenig Daten für robuste Muster. Tracke ein paar Tage weiter.');

  return {
    range: { start, end },
    messages,
    riskScore,
    riskLevel,
    focus: riskLevel === 'high'
      ? 'Diese Woche besonders auf späte Drinks und Limit-Tage achten.'
      : (riskLevel === 'medium' ? 'Ein fester Koffein-Stopp am Nachmittag würde deine Kurve stabilisieren.' : 'Deine Muster wirken ruhig. Bleib bei kleinen, bewussten Einträgen.'),
    topWeekday,
    lateDrinkCount: lateDrinks.length,
    overLimitDays: overLimitDays.length,
    topDrinks: [...drinkStats.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    achievements: buildAchievements({ logs, dailyLimit }),
  };
};

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const buildLogsCsv = (logs) => {
  const header = ['ID', 'Name', 'Koffein (mg)', 'Groesse (ml)', 'Datum', 'E-Mail', 'Erstellt'];
  const rows = logs.map((log) => [
    log.id,
    log.name,
    log.caffeine,
    log.size,
    log.date,
    log.email || '',
    log.createdAt || '',
  ].map(csvValue).join(','));
  return [header.map(csvValue).join(','), ...rows].join('\n');
};

const getExportSummary = (logs, start, end) => ({
  start,
  end,
  logCount: logs.length,
  totalCaffeine: logs.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0),
  totalSize: logs.reduce((sum, log) => sum + (Number(log.size) || 0), 0),
});

const pdfSafeText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/[\\()]/g, (char) => `\\${char}`);

const wrapPdfLine = (value, maxLength = 96) => {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const buildLogsPdfBuffer = ({ logs, summary }) => {
  const lines = [
    'Koffein Export',
    `${summary.start} bis ${summary.end}`,
    '',
    `Eintraege: ${summary.logCount}`,
    `Koffein gesamt: ${summary.totalCaffeine} mg`,
    `Getraenke gesamt: ${summary.totalSize} ml`,
    '',
    'Datum       Koffein  Groesse  Getraenk',
    '------------------------------------------------------------',
  ];

  if (logs.length === 0) {
    lines.push('Keine Eintraege im gewaehlten Zeitraum.');
  } else {
    logs.forEach((log) => {
      const row = `${String(log.date || '').padEnd(10)} ${String(Number(log.caffeine) || 0).padStart(6)}mg ${String(Number(log.size) || 0).padStart(6)}ml  ${log.name || 'Unbekannt'}`;
      lines.push(...wrapPdfLine(row));
    });
  }

  const pageLines = [];
  for (let i = 0; i < lines.length; i += 44) pageLines.push(lines.slice(i, i + 44));

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };
  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];

  pageLines.forEach((page, index) => {
    const escapedLines = [
      `(${pdfSafeText(`Koffein-Tracker Export - Seite ${index + 1}/${pageLines.length}`)}) Tj T*`,
      ...page.map((line) => `(${pdfSafeText(line)}) Tj T*`),
    ].join('\n');
    const content = `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${escapedLines}\nET`;
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(chunks.join(''), 'utf8'));
    chunks.push(`${index + 1} 0 obj\n${content}\nendobj\n`);
  });
  const xrefOffset = Buffer.byteLength(chunks.join(''), 'utf8');
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(''), 'utf8');
};

const sendExportPdfEmail = async ({ to, logs, summary }) => {
  const cfg = await loadSmtpConfig();
  if (!cfg?.host) {
    const err = new Error('SMTP ist nicht vollständig konfiguriert.');
    err.status = 400;
    throw err;
  }
  const recipient = String(to || '').toLowerCase().trim();
  if (!recipient) {
    const err = new Error('Für diesen Benutzer ist keine E-Mail-Adresse hinterlegt.');
    err.status = 400;
    throw err;
  }

  const filename = `koffein-export-${summary.start}-bis-${summary.end}.pdf`;
  const pdf = buildLogsPdfBuffer({ logs, summary });
  const transporter = createTransporter(cfg);
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail || 'admin@fra03.de'}>`,
    to: recipient,
    subject: `Koffein-Tracker Export ${summary.start} bis ${summary.end}`,
    html: buildModernEmail({
      icon: '📄',
      headerText: 'Dein Koffein-Export',
      contentHtml: `
        <p style="text-align: center; margin-top: 0;">Dein Export fuer den Zeitraum <strong>${summary.start}</strong> bis <strong>${summary.end}</strong> haengt als PDF an.</p>
        <p style="text-align: center; margin: 0;">${summary.logCount} Eintraege, ${summary.totalCaffeine} mg Koffein, ${summary.totalSize} ml Getraenke.</p>
      `,
      footerText: 'Diese E-Mail wurde ueber die Exportfunktion deiner Startseite verschickt.',
    }),
    attachments: [{
      filename,
      content: pdf,
      contentType: 'application/pdf',
    }],
  });
  return { filename, size: pdf.length };
};

const getOwnerLabelForLog = (log) => {
  const email = String(log.email || '').toLowerCase();
  const user = dbState.users.find((entry) =>
    (log.userId && String(entry.id) === String(log.userId))
    || (email && String(entry.email || '').toLowerCase() === email)
  );
  return {
    ownerKey: log.userId ? `user:${log.userId}` : email ? `email:${email}` : 'unknown',
    userId: user?.id || log.userId || null,
    name: user?.name || (email ? email.split('@')[0] : 'Unbekannt'),
    email: user?.email || email || '',
    role: user?.role || 'user',
  };
};

const getAdminActivity = () => {
  const today = getTodayKey();
  const todayDate = parseDateKey(today);
  const sevenDaysAgo = toDateKey(addDays(todayDate, -6));
  const thirtyDaysAgo = toDateKey(addDays(todayDate, -29));
  const logsToday = dbState.caffeine_logs.filter((log) => log.date === today);
  const logsLast7 = dbState.caffeine_logs.filter((log) => log.date >= sevenDaysAgo);
  const logsLast30 = dbState.caffeine_logs.filter((log) => log.date >= thirtyDaysAgo);

  const activeOwnerKeys = new Set(logsLast7.map((log) => getOwnerLabelForLog(log).ownerKey));
  dbState.users.forEach((user) => {
    if (user.last_login && user.last_login >= `${sevenDaysAgo}T00:00:00`) activeOwnerKeys.add(`user:${user.id}`);
  });

  const drinkMap = new Map();
  logsLast30.forEach((log) => {
    const key = String(log.name || 'Unbekannt').toLowerCase().trim();
    const entry = drinkMap.get(key) || { name: log.name || 'Unbekannt', count: 0, totalCaffeine: 0 };
    entry.count += 1;
    entry.totalCaffeine += Number(log.caffeine) || 0;
    drinkMap.set(key, entry);
  });

  const byOwnerToday = new Map();
  logsToday.forEach((log) => {
    const owner = getOwnerLabelForLog(log);
    const entry = byOwnerToday.get(owner.ownerKey) || { ...owner, totalCaffeine: 0, logCount: 0 };
    entry.totalCaffeine += Number(log.caffeine) || 0;
    entry.logCount += 1;
    byOwnerToday.set(owner.ownerKey, entry);
  });

  const usersOverLimit = [...byOwnerToday.values()]
    .map((entry) => {
      const settings = getUserSettings({ userId: entry.userId, email: entry.email || `${entry.ownerKey}@unknown.local` });
      const dailyLimit = Number(settings.dailyLimit) || 400;
      return { ...entry, dailyLimit, overBy: entry.totalCaffeine - dailyLimit };
    })
    .filter((entry) => entry.overBy > 0)
    .sort((a, b) => b.overBy - a.overBy);

  return {
    totals: {
      registeredUsers: dbState.users.length,
      activeUsers7Days: activeOwnerKeys.size,
      logsToday: logsToday.length,
      caffeineToday: logsToday.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0),
      usersOverLimit: usersOverLimit.length,
    },
    recentLogins: [...dbState.users]
      .filter((user) => user.last_login)
      .sort((a, b) => String(b.last_login).localeCompare(String(a.last_login)))
      .slice(0, 8)
      .map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, lastLogin: user.last_login })),
    topDrinks: [...drinkMap.values()].sort((a, b) => b.count - a.count || b.totalCaffeine - a.totalCaffeine).slice(0, 8),
    usersOverLimit,
    recentLogs: [...dbState.caffeine_logs]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 12)
      .map((log) => ({ ...log, owner: getOwnerLabelForLog(log) })),
  };
};

const buildModernEmail = ({ icon, headerText, contentHtml, footerText }) => `
  <div style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #02040A; color: #f1f5f9; padding: 40px 20px; text-align: center;">
    <div style="max-width: 500px; margin: 0 auto; background-color: #0d1117; border: 1px solid #1f2937; border-radius: 24px; padding: 40px 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #3b82f6, #60a5fa, #fbbf24); margin: 0 auto 20px auto; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(96,165,250,0.4);">
        <span style="font-size: 28px; line-height: 56px; color: white;">${icon || '⚡'}</span>
      </div>
      <h1 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 800; color: #60a5fa;">${headerText || 'Koffein-Tracker'}</h1>
      <div style="font-size: 16px; color: #94a3b8; line-height: 1.6; margin-bottom: 35px; text-align: left;">
        ${contentHtml}
      </div>
    </div>
    <p style="font-size: 12px; color: #475569; margin-top: 30px;">
      Koffein-Tracker &copy; ${new Date().getFullYear()}<br/>
      ${footerText || ''}
    </p>
  </div>
`;

const HYDRATION_FALLBACK_QUOTES = [
  'Ein Glas Wasser macht den Kopf klarer als der naechste Reflex-Kaffee.',
  'Heute kurz trinken, bevor der Akku auf Reserve laeuft.',
  'Hydration zuerst, Koffein danach mit besserem Gewissen.',
  'Kleine Wasserpause, grosser Unterschied fuer den Tag.',
  'Dein Tagesziel startet mit einem Schluck, nicht mit Perfektion.',
  'Wasser ist der stille Co-Pilot fuer Fokus und Energie.',
  'Erst auffuellen, dann beschleunigen.',
];

const parseJsonObject = (value) => {
  try {
    const cleaned = String(value || '').replace(/^```(?:json)?|```$/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

const fallbackHydrationQuote = (date) => {
  const hash = crypto.createHash('sha256').update(String(date || getTodayKey())).digest()[0] || 0;
  return HYDRATION_FALLBACK_QUOTES[hash % HYDRATION_FALLBACK_QUOTES.length];
};

const sanitizeHydrationQuote = (value, date) => {
  const cleaned = String(value || '')
    .replace(/^["'„“”]+|["'„“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallbackHydrationQuote(date);
  return cleaned.length > 130 ? `${cleaned.slice(0, 127).trim()}...` : cleaned;
};

const getDailyHydrationQuote = async (date = getTodayKey()) => {
  const safeDate = isValidDateKey(date) ? date : getTodayKey();
  const settings = sanitizeAppSettings(dbState.app_settings || {});
  const quotes = settings.hydrationQuotes || {};
  if (quotes[safeDate]) return { date: safeDate, quote: quotes[safeDate], source: 'cache' };

  let quote = '';
  let source = 'fallback';
  try {
    const result = await callOpenRouter([
      {
        role: 'system',
        content: 'Du schreibst kurze, alltagstaugliche deutsche Motivationssaetze fuer eine Koffein-Tracker-App. Keine Emojis, keine Hashtags, maximal 16 Woerter.',
      },
      {
        role: 'user',
        content: `Erstelle fuer ${safeDate} einen neuen Tagesziel-Spruch zum Thema Hydration im Blick behalten. Nur den Satz ausgeben.`,
      },
    ]);
    quote = sanitizeHydrationQuote(result.content, safeDate);
    source = 'ai';
  } catch (err) {
    quote = fallbackHydrationQuote(safeDate);
    source = 'fallback';
  }

  const nextQuotes = {
    ...quotes,
    [safeDate]: quote,
  };
  const sortedDates = Object.keys(nextQuotes).sort();
  while (sortedDates.length > 45) delete nextQuotes[sortedDates.shift()];
  dbState.app_settings = { ...settings, hydrationQuotes: nextQuotes };
  await persistDbState();
  return { date: safeDate, quote, source };
};

const fallbackDailyCoach = ({ date, logs, totalCaffeine, dailyLimit, remaining, settings }) => {
  const percent = dailyLimit > 0 ? Math.round((totalCaffeine / dailyLimit) * 100) : 0;
  const lateLogs = logs.filter((log) => {
    const time = getLogDateTime(log);
    return time && time.getHours() >= 18;
  });
  const risk = percent >= 100 || lateLogs.length > 0 ? 'high' : (percent >= 70 ? 'medium' : 'low');
  const headline = risk === 'high'
    ? 'Heute vorsichtig bleiben'
    : (risk === 'medium' ? 'Guter Moment zum Bremsen' : 'Du hast noch Spielraum');
  const advice = risk === 'high'
    ? `Du liegst bei ${totalCaffeine} mg. Plane den Rest des Tages lieber koffeinfrei.`
    : (risk === 'medium'
      ? `Du hast noch etwa ${remaining} mg bis zum Limit. Ein Wasser-Stopp hilft, bevor du nachlegst.`
      : `Bisher sind es ${totalCaffeine} mg. Halte den Rhythmus ruhig und trinke zwischendurch Wasser.`);
  const actions = [
    remaining > 0 ? `${remaining} mg Reserve bewusst einteilen` : 'Keine weiteren Koffein-Drinks einplanen',
    `Schlafenszeit ${settings.sleepTime || '23:00'} im Blick behalten`,
    logs.length === 0 ? 'Ersten Drink eintragen, falls schon etwas dabei war' : 'Einträge kurz auf Vollständigkeit prüfen',
  ];
  return { date, risk, headline, advice, actions, source: 'fallback' };
};

const getDailyCoach = async ({ userId, email, date = getTodayKey() }) => {
  const safeDate = isValidDateKey(date) ? date : getTodayKey();
  const settings = getUserSettings({ userId, email });
  const dailyLimit = Number(settings.dailyLimit) || 400;
  const logs = getLogsForUser({ userId, email, start: safeDate, end: safeDate });
  const totalCaffeine = logs.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0);
  const remaining = Math.max(0, dailyLimit - totalCaffeine);

  const fallback = fallbackDailyCoach({ date: safeDate, logs, totalCaffeine, dailyLimit, remaining, settings });
  try {
    if (!loadAiConfig().apiKey) return fallback;
    const result = await callOpenRouter([
      {
        role: 'system',
        content: 'Du bist der kurze Tagescoach einer Koffein-Tracker-App. Antworte ausschliesslich als JSON mit risk low|medium|high, headline, advice und actions Array mit 3 kurzen deutschen Strings. Keine Markdown-Erklaerung.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          date: safeDate,
          totalCaffeine,
          dailyLimit,
          remaining,
          sleepTime: settings.sleepTime || '23:00',
          logs: logs.map((log) => ({ name: log.name, caffeine: log.caffeine, size: log.size, createdAt: log.createdAt })),
        }),
      },
    ], { model: loadAiConfig().model });
    const parsed = parseJsonObject(result.content);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      date: safeDate,
      risk: ['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : fallback.risk,
      headline: String(parsed.headline || fallback.headline).slice(0, 90),
      advice: String(parsed.advice || fallback.advice).slice(0, 220),
      actions: Array.isArray(parsed.actions) && parsed.actions.length
        ? parsed.actions.slice(0, 3).map((item) => String(item).slice(0, 90))
        : fallback.actions,
      source: 'ai',
    };
  } catch {
    return fallback;
  }
};

const sendReminderEmail = async ({ to }) => {
  const cfg = await loadSmtpConfig();
  if (!cfg?.host || !cfg?.auth?.user) {
    throw new Error('SMTP ist nicht vollständig konfiguriert.');
  }

  const appUrl = process.env.WEBAUTHN_ORIGIN || 'http://localhost:8080';
  const htmlContent = buildModernEmail({
    icon: '⚡',
    headerText: 'Koffein-Tracker',
    contentHtml: `
      <p style="text-align: center; margin-top: 0;">Hey! Kurze Erinnerung: Hast du heute schon deinen Energy-Drink oder Kaffee getrackt?</p>
      <p style="text-align: center;">Behalte deinen Koffeinpegel im Blick und bleib im gesunden Limit.</p>
      <div style="text-align: center; margin-top: 25px;">
        <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #c084fc); color: white; text-decoration: none; padding: 14px 32px; border-radius: 16px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(139,92,246,0.4);">
          Jetzt eintragen
        </a>
      </div>
    `,
    footerText: 'Du erhältst diese E-Mail aufgrund deiner Profil-Einstellungen.',
  });

  const transporter = createTransporter(cfg);
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail || 'admin@fra03.de'}>`,
    to,
    subject: '⚡ Dein täglicher Reminder - Koffein-Tracker',
    html: htmlContent,
  });
};

const sendDiscordReminder = async ({ webhookUrl, email, title, message }) => {
  const randomColor = Math.floor(Math.random() * 16777215);
  const embedTitle = title || '⏰ Erinnerung';
  const embedDesc = message || `Hallo **${email}**!\nBitte denke daran, deinen heutigen Koffein-Bedarf im Tracker einzutragen.`;
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: embedTitle,
        description: embedDesc,
        color: randomColor,
        timestamp: new Date().toISOString(),
        footer: { text: 'Koffein-Tracker' }
      }]
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Discord Webhook Fehler (${response.status})`);
  }
};

const formatDiscordLogDate = (dateKey) => {
  if (!isValidDateKey(dateKey)) return String(dateKey || 'unbekannt');
  return parseDateKey(dateKey).toLocaleDateString('de-DE', { timeZone: APP_TIME_ZONE });
};

const sendDiscordLogChangeNotification = async ({ action, log, actorEmail }) => {
  try {
    const cfg = await loadSmtpConfig();
    if (!cfg?.discordWebhook || !log) return;

    const isDelete = action === 'deleted';
    const title = isDelete ? 'Eintrag gelöscht' : 'Eintrag hinzugefügt';
    const actor = actorEmail || log.email || 'unbekannt';
    const dateLabel = formatDiscordLogDate(log.date);
    const icon = log.icon || (isDelete ? '🗑️' : '🥤');
    const message = [
      `**Benutzer:** ${actor}`,
      `**Datum:** ${dateLabel}`,
      `**Getränk:** ${icon} ${log.name || 'Getränk'}`,
      `**Menge:** ${Number(log.size) || 0} ml`,
      `**Koffein:** ${Number(log.caffeine) || 0} mg`,
      log.id ? `**ID:** ${log.id}` : null,
    ].filter(Boolean).join('\n');

    await sendDiscordReminder({
      webhookUrl: cfg.discordWebhook,
      email: actor,
      title,
      message,
    });
  } catch (err) {
    console.error('[Discord Log Notify] Fehler:', err.message);
  }
};

const DISCORD_AI_SCHEDULER_INTERVAL_MS = 60 * 1000;
let discordAiSchedulerInterval = null;
const discordAiSchedulerState = {
  running: false,
  startedAt: null,
  lastTickAt: null,
  lastSentAt: null,
  lastError: null,
};

const parseDiscordScheduleTime = (time) => {
  const match = String(time || '').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
};

const buildDiscordRunAt = (time, now = new Date()) => {
  const safeTime = parseDiscordScheduleTime(time);
  if (!safeTime) return null;
  const [hour, minute] = safeTime.split(':').map(Number);
  const runAt = new Date(now);
  runAt.setHours(hour, minute, 0, 0);
  if (runAt <= now) runAt.setDate(runAt.getDate() + 1);
  return runAt.toISOString();
};

const ensureDiscordScheduleShape = (schedule) => {
  if (!schedule || typeof schedule !== 'object') return null;
  const time = parseDiscordScheduleTime(schedule.time);
  const message = String(schedule.message || '').trim();
  if (!time || !message) return null;

  if (!schedule.id) schedule.id = crypto.randomUUID();
  schedule.time = time;
  schedule.message = message;
  schedule.status = schedule.status || (schedule.sent ? 'sent' : 'pending');
  schedule.sent = schedule.status === 'sent';
  schedule.createdAt = schedule.createdAt || schedule.date || new Date().toISOString();
  schedule.runAt = schedule.runAt || buildDiscordRunAt(time, new Date(schedule.createdAt));
  schedule.updatedAt = schedule.updatedAt || schedule.createdAt;
  return schedule;
};

const getDiscordAiSchedulerStatus = async () => {
  const cfg = await loadSmtpConfig().catch(() => null);
  const schedules = asArray(dbState.discord_schedules)
    .map(ensureDiscordScheduleShape)
    .filter(Boolean);
  const pending = schedules.filter((item) => item.status === 'pending');
  const sent = schedules.filter((item) => item.status === 'sent');
  const failed = schedules.filter((item) => item.status === 'failed');
  const next = [...pending].sort((a, b) => String(a.runAt || '').localeCompare(String(b.runAt || '')))[0] || null;

  return {
    running: discordAiSchedulerState.running,
    startedAt: discordAiSchedulerState.startedAt,
    lastTickAt: discordAiSchedulerState.lastTickAt,
    lastSentAt: discordAiSchedulerState.lastSentAt,
    lastError: discordAiSchedulerState.lastError,
    intervalMs: DISCORD_AI_SCHEDULER_INTERVAL_MS,
    webhookConfigured: !!cfg?.discordWebhook,
    counts: {
      pending: pending.length,
      sent: sent.length,
      failed: failed.length,
      total: schedules.length,
    },
    nextSchedule: next ? {
      id: next.id,
      time: next.time,
      runAt: next.runAt,
      message: next.message,
      status: next.status,
    } : null,
  };
};

const processDiscordAiSchedulesTick = async () => {
  discordAiSchedulerState.lastTickAt = new Date().toISOString();
  const cfg = await loadSmtpConfig();
  let stateChanged = false;

  if (!Array.isArray(dbState.discord_schedules)) dbState.discord_schedules = [];

  for (const schedule of dbState.discord_schedules) {
    const before = JSON.stringify(schedule);
    const normalized = ensureDiscordScheduleShape(schedule);
    if (!normalized || normalized.status !== 'pending') {
      if (normalized && JSON.stringify(normalized) !== before) stateChanged = true;
      continue;
    }
    if (!normalized.runAt || new Date(normalized.runAt) > new Date()) {
      if (JSON.stringify(normalized) !== before) stateChanged = true;
      continue;
    }

    try {
      if (!cfg?.discordWebhook) {
        normalized.lastError = 'Kein Discord Webhook hinterlegt.';
        normalized.updatedAt = new Date().toISOString();
        discordAiSchedulerState.lastError = normalized.lastError;
        stateChanged = true;
        continue;
      }

      await sendDiscordReminder({
        webhookUrl: cfg.discordWebhook,
        title: 'KI-Assistent',
        message: normalized.message,
      });

      normalized.status = 'sent';
      normalized.sent = true;
      normalized.sentAt = new Date().toISOString();
      normalized.updatedAt = normalized.sentAt;
      normalized.lastError = null;
      discordAiSchedulerState.lastSentAt = normalized.sentAt;
      discordAiSchedulerState.lastError = null;
      stateChanged = true;
      console.log(`[Discord AI] Nachricht gesendet (${normalized.time}).`);
    } catch (err) {
      normalized.status = 'failed';
      normalized.sent = false;
      normalized.lastError = err.message;
      normalized.updatedAt = new Date().toISOString();
      discordAiSchedulerState.lastError = err.message;
      stateChanged = true;
      console.error('[Discord AI] Fehler:', err.message);
    }
  }

  if (stateChanged) await persistDbState();
};

const startDiscordAiScheduler = () => {
  if (discordAiSchedulerInterval) return;
  discordAiSchedulerState.running = true;
  discordAiSchedulerState.startedAt = new Date().toISOString();
  discordAiSchedulerInterval = setInterval(() => {
    processDiscordAiSchedulesTick().catch((err) => {
      discordAiSchedulerState.lastError = err.message;
      console.error('[Discord AI] Scheduler-Tick Fehler:', err.message);
    });
  }, DISCORD_AI_SCHEDULER_INTERVAL_MS);
  processDiscordAiSchedulesTick().catch((err) => {
    discordAiSchedulerState.lastError = err.message;
    console.error('[Discord AI] Start-Tick Fehler:', err.message);
  });
  console.log('[Discord AI] Scheduler gestartet.');
};

let reminderTickInProgress = false;

const processRemindersTick = async () => {
  if (reminderTickInProgress) return;
  reminderTickInProgress = true;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = getTodayKey();
  let stateChanged = false;

  try {
    const cfg = await loadSmtpConfig();

    // 1. Regular Reminders
    if (Array.isArray(dbState.reminders) && dbState.reminders.length > 0) {
      for (const reminder of dbState.reminders) {
        const normalized = sanitizeReminder(reminder);
        if (!normalized.enabled) continue;
        if (normalized.time !== hhmm) continue;
        if (normalized.lastTriggeredDate === today) continue;

        const user = dbState.users.find(u => (reminder.userId && String(u.id) === String(reminder.userId)) || (reminder.email && String(u.email).toLowerCase() === String(reminder.email).toLowerCase()));
        const targetEmail = user?.email || reminder.email;
        const targetUserId = user?.id || reminder.userId || null;
        const triggeredAt = new Date().toISOString();

        reminder.lastTriggeredDate = today;
        reminder.lastTriggeredAt = triggeredAt;
        reminder.updatedAt = triggeredAt;
        reminder.deliveryStatus = 'sending';
        delete reminder.lastError;
        delete reminder.skippedBecauseTrackedDate;
        stateChanged = true;
        await persistDbState();

        try {
          if (userHasLogForDate({ userId: targetUserId, email: targetEmail, date: today })) {
            reminder.deliveryStatus = 'skipped_tracked';
            reminder.skippedBecauseTrackedDate = today;
            reminder.updatedAt = new Date().toISOString();
            stateChanged = true;
            console.log(`[Reminder] Übersprungen für ${targetEmail}: heute bereits Eintrag vorhanden.`);
            continue;
          }

          if (normalized.mailEnabled) {
            await sendReminderEmail({ to: targetEmail });
          }
          if (normalized.discordEnabled && cfg.discordWebhook) {
            await sendDiscordReminder({ webhookUrl: cfg.discordWebhook, email: targetEmail });
          }

          reminder.deliveryStatus = 'sent';
          reminder.updatedAt = new Date().toISOString();
          stateChanged = true;
          console.log(`[Reminder] Gesendet an ${reminder.email} (${normalized.time})`);
        } catch (err) {
          reminder.deliveryStatus = 'failed';
          reminder.lastError = err.message;
          reminder.lastTriggeredDate = today;
          reminder.updatedAt = new Date().toISOString();
          stateChanged = true;
          console.error(`[Reminder] Fehler für ${reminder.email}:`, err.message);
        }
      }
    }

    if (stateChanged) {
      await persistDbState();
    }
  } finally {
    reminderTickInProgress = false;
  }
};

app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', db_type: DB_TYPE });
});

app.get('/api/version', async (req, res) => {
  res.json({ version: appVersion });
});

// ── Docker Hub update check ───────────────────────────────────────────────
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const date = req.query.date;
    const requestedUserId = String(req.query.userId || '').trim() || null;
    const requestedEmail = String(req.query.email || '').toLowerCase().trim();

    if (!date) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }

    const dbPool = getPool();
    const [rows] = await dbPool.execute(
      'SELECT * FROM caffeine_logs WHERE date = ? ORDER BY createdAt DESC',
      [date]
    );

    const identity = req.auth.role === 'admin' && (requestedUserId || requestedEmail)
      ? { userId: requestedUserId, email: requestedEmail }
      : authIdentity(req);
    const filteredRows = req.auth.role === 'admin' && !requestedUserId && !requestedEmail
      ? rows
      : rows.filter((row) => logMatchesUser(row, identity));

    res.json(filteredRows);
  } catch (err) {
    console.error('GET /api/logs error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/logs', requireAuth, async (req, res) => {
  try {
    const { name, size, caffeine, caffeinePerMl, icon, isPreset, date } = req.body || {};
    const { userId, email } = authIdentity(req);
    if (!name || !size || !caffeine) {
      return res.status(400).json({ error: 'name, size, caffeine are required' });
    }

    const safeDate = isValidDateKey(date) ? date : getTodayKey();

    const dbPool = getPool();
    const [result] = await dbPool.execute(
      `INSERT INTO caffeine_logs (name, size, caffeine, caffeinePerMl, icon, isPreset, date, userId, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [name, size, caffeine, caffeinePerMl ?? null, icon ?? null, !!isPreset, safeDate, userId || null, email || null]
    );

    const insertedId = result.insertId;
    const [rows] = await dbPool.execute(
      'SELECT * FROM caffeine_logs WHERE id = ?',
      [insertedId]
    );
    
    const newLog = rows[0];
    sendDiscordLogChangeNotification({
      action: 'created',
      log: newLog,
      actorEmail: email,
    });

    // Notification Logic
    if (email) {
      const user = dbState.users.find(u => (userId && String(u.id) === String(userId)) || (email && String(u.email).toLowerCase() === String(email).toLowerCase()));
      const targetEmail = user?.email || email;

      const [allTodayLogs] = await dbPool.execute('SELECT * FROM caffeine_logs WHERE date = ?', [safeDate]);
      const todayLogs = allTodayLogs.filter(r => 
        (userId && String(r.userId) === String(userId)) || 
        (targetEmail && String(r.email).toLowerCase() === String(targetEmail).toLowerCase())
      );
      const totalCaffeine = todayLogs.reduce((sum, log) => sum + (Number(log.caffeine) || 0), 0);
      const settings = getUserSettings({ userId: userId || null, email: targetEmail });
      const limit = settings.dailyLimit || 400;
      
      const now = new Date();
      const hour = now.getHours();
      
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const recentDrinks = todayLogs.filter(log => new Date(log.createdAt || now) > twoHoursAgo);

      const notifyPromises = [];

      const tryNotify = async (condition, title, message) => {
        if (condition) {
          const cfg = await loadSmtpConfig();
          if (cfg.discordWebhook) {
            notifyPromises.push(
              sendDiscordReminder({ 
                webhookUrl: cfg.discordWebhook, 
                email: targetEmail, 
                title, message 
              }).catch(e => console.error('Discord notify error:', e))
            );
          }
        }
      };

      if (settings.notifyAtLimit && settings.discordNotifyAtLimit && totalCaffeine > limit) {
        const excess = totalCaffeine - limit;
        await tryNotify(true, 'Limit überschritten!', `Du hast dein Limit um ${excess}mg überschritten (${totalCaffeine}/${limit}mg)`);
      }

      if (settings.notifyLate && settings.discordNotifyLate && hour >= 18) {
        await tryNotify(true, 'Spätes Koffein', `${newLog.name} um ${hour}:${String(now.getMinutes()).padStart(2, '0')} Uhr könnte deinen Schlaf beeinflussen`);
      }

      if (settings.notifyRapid && settings.discordNotifyRapid && recentDrinks.length >= 3) {
        await tryNotify(true, 'Schnelle Folge erkannt', `${recentDrinks.length} Getränke in 2h – versuche langsamer zu trinken!`);
      }

      await Promise.all(notifyPromises);
    }

    res.status(201).json(newLog);
  } catch (err) {
    console.error('POST /api/logs error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


app.put('/api/logs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, size, caffeine, icon } = req.body;
    const dbPool = getPool();
    const [existingRows] = await dbPool.execute('SELECT * FROM caffeine_logs WHERE id = ?', [id]);
    const existingLog = existingRows[0];
    if (!existingLog) return res.status(404).json({ error: 'Log nicht gefunden.' });
    if (!canAccessLog(req, existingLog)) return res.status(403).json({ error: 'Kein Zugriff auf diesen Eintrag.' });

    const [result] = await dbPool.execute('UPDATE caffeine_logs SET name = ?, size = ?, caffeine = ?, icon = ? WHERE id = ?', [name, Number(size), Number(caffeine), icon, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Log nicht gefunden.' });
    }
    res.json({ id, name, size: Number(size), caffeine: Number(caffeine), icon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/logs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const dbPool = getPool();
    const [existingRows] = await dbPool.execute('SELECT * FROM caffeine_logs WHERE id = ?', [id]);
    const existingLog = existingRows[0];
    if (!existingLog) return res.status(404).json({ error: 'Log nicht gefunden.' });
    if (!canAccessLog(req, existingLog)) return res.status(403).json({ error: 'Kein Zugriff auf diesen Eintrag.' });

    await dbPool.execute('DELETE FROM caffeine_logs WHERE id = ?', [id]);
    sendDiscordLogChangeNotification({
      action: 'deleted',
      log: existingLog,
      actorEmail: req.auth?.email,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/logs error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/admin/logs/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, size, caffeine, icon } = req.body;
    const dbPool = getPool();
    const [result] = await dbPool.execute('UPDATE caffeine_logs SET name = ?, size = ?, caffeine = ?, icon = ? WHERE id = ?', [name, Number(size), Number(caffeine), icon, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Log nicht gefunden.' });
    res.json({ id, name, size: Number(size), caffeine: Number(caffeine), icon });
  } catch (err) {
    console.error('PUT /api/admin/logs/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/admin/logs/:id', requireAdmin, async (req, res) => {
  try {
    const dbPool = getPool();
    const [existingRows] = await dbPool.execute('SELECT * FROM caffeine_logs WHERE id = ?', [req.params.id]);
    const existingLog = existingRows[0];
    if (!existingLog) return res.status(404).json({ error: 'Log nicht gefunden.' });
    const [result] = await dbPool.execute('DELETE FROM caffeine_logs WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Log nicht gefunden.' });
    sendDiscordLogChangeNotification({
      action: 'deleted',
      log: existingLog,
      actorEmail: req.auth?.email,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/logs/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── SMTP Admin Routes ─────────────────────────────────────────────────────────
app.get('/api/admin/smtp', requireAdmin, async (req, res) => {
  try {
    const cfg = await loadSmtpConfig();
    if (!cfg) return res.json(null);
    // Mask password before sending to client
    res.json({ ...cfg, auth: { ...cfg.auth, pass: cfg.auth.pass ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '' } });
  } catch (err) {
    console.error('GET /api/admin/smtp error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/smtp', requireAdmin, async (req, res) => {
  const {
    host = '',
    port = 587,
    secure,
    auth = {},
    fromName,
    fromEmail,
    baseUrl,
    registrationEnabled,
    demoEnabled,
    discordWebhook,
  } = req.body || {};
  const incomingAuthPass = String(auth?.pass || '').trim();
  const hasSmtpValues = !!(
    String(host || '').trim()
    || String(auth?.user || '').trim()
    || (incomingAuthPass && !isMaskedSecret(incomingAuthPass))
  );
  if (hasSmtpValues && !String(host || '').trim()) {
    return res.status(400).json({ error: 'SMTP-Host ist erforderlich, wenn E-Mail-Versand konfiguriert wird.' });
  }

  try {
    await saveSmtpConfig({
      host: String(host || '').trim(),
      port: Number(port),
      secure: !!secure,
      auth: {
        user: auth?.user || '',
        pass: auth?.pass || '',
      },
      fromName: fromName || 'Koffein-Tracker',
      fromEmail: fromEmail || 'admin@fra03.de',
      baseUrl: baseUrl || '',
      registrationEnabled: registrationEnabled !== false,
      demoEnabled: demoEnabled !== false,
      discordWebhook,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/smtp error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

app.post('/api/admin/smtp/test', requireAdmin, async (req, res) => {
  const { testEmail } = req.body || {};
  const cfg = await loadSmtpConfig();
  if (!cfg)       return res.status(400).json({ error: 'Kein SMTP konfiguriert.' });
  if (!testEmail) return res.status(400).json({ error: 'Ziel-E-Mail fehlt.' });
  try {
    const t = createTransporter(cfg);
    await t.verify();
    await t.sendMail({
      from:    `"${cfg.fromName}" <${cfg.fromEmail || 'admin@fra03.de'}>`,
      to:      testEmail,
      subject: 'Koffein-Tracker \u2013 SMTP Test \u2713',
      html:    buildModernEmail({
        icon: '✉️',
        headerText: 'SMTP Test Erfolgreich',
        contentHtml: '<p style="text-align: center; margin: 0;">Der SMTP-Server ist korrekt konfiguriert. Diese E-Mail bestätigt die erfolgreiche Verbindung.</p>',
      }),
    });
    res.json({ success: true, message: `Test-E-Mail an ${testEmail} gesendet.` });
  } catch (err) {
    res.status(500).json({ error: `SMTP-Fehler: ${err.message}` });
  }
});

app.post('/api/admin/discord/test', requireAdmin, async (req, res) => {
  const { webhookUrl } = req.body || {};
  const safeWebhook = String(webhookUrl || '').trim();

  if (!safeWebhook) {
    return res.status(400).json({ error: 'Discord Webhook URL fehlt.' });
  }
  if (!isValidDiscordWebhookUrl(safeWebhook)) {
    return res.status(400).json({ error: 'Ungültige Discord Webhook URL.' });
  }

  try {
    await sendDiscordReminder({
      webhookUrl: safeWebhook,
      email: 'Admin-Test',
    });
    res.json({ success: true, message: 'Discord Testnachricht wurde gesendet.' });
  } catch (err) {
    res.status(500).json({ error: `Discord-Fehler: ${err.message}` });
  }
});

app.post('/api/admin/discord/webhook', requireAdmin, async (req, res) => {
  const { webhookUrl } = req.body || {};
  const safeWebhook = String(webhookUrl || '').trim();

  if (safeWebhook && !isValidDiscordWebhookUrl(safeWebhook)) {
    return res.status(400).json({ error: 'Ungültige Discord Webhook URL.' });
  }

  try {
    const current = await loadSmtpConfig();
    await saveSmtpConfig({
      ...current,
      discordWebhook: safeWebhook,
    });
    res.json({
      success: true,
      message: safeWebhook
        ? 'Discord Bot Webhook gespeichert.'
        : 'Discord Bot Webhook entfernt.',
      webhookConfigured: !!safeWebhook,
    });
  } catch (err) {
    console.error('POST /api/admin/discord/webhook error:', err);
    res.status(500).json({ error: err.message || 'Discord Webhook konnte nicht gespeichert werden.' });
  }
});

// ── Redis Health Check ────────────────────────────────────────────────────────
app.get('/api/admin/redis/health', requireAdmin, async (req, res) => {
  try {
    // Ping Redis
    const pong = await redis.ping();

    // Check persistence config (CONFIG GET save)
    let persistConfig = null;
    try {
      const cfg = await redis.config('GET', 'save');
      persistConfig = cfg[1] || '';
    } catch { /* Redis may not allow CONFIG in all setups */ }

    // Check last RDB save time
    let lastSaveTs = null;
    try {
      lastSaveTs = await redis.lastsave();
    } catch { /* ignore */ }

    // Count entries per key from in-memory state (mirrors what's in Redis)
    const keys = await redis.keys('koffein:*');
    const keyDetails = {};
    for (const key of keys) {
      const raw = await redis.get(key);
      const parsed = safeParse(raw, null);
      const shortKey = key.replace('koffein:', '');
      if (Array.isArray(parsed)) {
        keyDetails[shortKey] = { count: parsed.length, type: 'array' };
      } else if (parsed && typeof parsed === 'object') {
        keyDetails[shortKey] = { count: 1, type: 'object' };
      } else {
        keyDetails[shortKey] = { count: parsed ? 1 : 0, type: 'null' };
      }
    }

    res.json({
      connected:    pong === 'PONG',
      persistMode:  persistConfig !== null ? (persistConfig === '' ? 'disabled' : `rdb: ${persistConfig}`) : 'unknown',
      lastSave:     lastSaveTs ? new Date(lastSaveTs * 1000).toISOString() : null,
      keys:         keyDetails,
      totalKeys:    keys.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/discord-ai/status', requireAdmin, async (req, res) => {
  try {
    res.json(await getDiscordAiSchedulerStatus());
  } catch (err) {
    console.error('GET /api/admin/discord-ai/status error:', err);
    res.status(500).json({ error: 'Discord AI Status konnte nicht geladen werden.' });
  }
});

app.get('/api/admin/app-settings', requireAdmin, (req, res) => {
  res.json(appSettingsForAdmin());
});

app.post('/api/admin/app-settings', requireAdmin, async (req, res) => {
  try {
    saveAppSettings(req.body || {});
    await persistDbState();
    res.json({ success: true, settings: appSettingsForAdmin() });
  } catch (err) {
    if ((err.status || 500) >= 500) {
      console.error('POST /api/admin/app-settings error:', err);
    } else {
      console.warn('POST /api/admin/app-settings validation:', err.message);
    }
    res.status(err.status || 500).json({ error: err.message || 'App-Einstellungen konnten nicht gespeichert werden.' });
  }
});

app.get('/api/admin/database/export', requireAdmin, async (req, res) => {
  try {
    const requestedScope = String(req.query.scope || 'full').trim();
    const scope = BACKUP_SCOPES.has(requestedScope) ? requestedScope : 'full';
    const backup = buildDatabaseExport({ scope });
    const stamp = backup.exportedAt.replace(/[:.]/g, '-');
    const suffix = scope === 'full' ? 'full' : scope;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="koffein-${suffix}-backup-${stamp}.db"`);
    res.json(backup);
  } catch (err) {
    console.error('GET /api/admin/database/export error:', err);
    res.status(500).json({ error: 'Datenbank-Export fehlgeschlagen.' });
  }
});

app.post('/api/admin/database/import', requireAdmin, async (req, res) => {
  try {
    const payload = req.body?.backup || req.body;
    const result = await importDatabasePayload(payload);

    res.json({
      success: true,
      importedAt: result.importedAt,
      summary: result.summary,
    });
  } catch (err) {
    console.error('POST /api/admin/database/import error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Datenbank-Import fehlgeschlagen.' });
  }
});

app.get('/api/admin/s3/status', requireAdmin, async (req, res) => {
  res.json(s3Status());
});

app.get('/api/admin/s3/config', requireAdmin, async (req, res) => {
  res.json(s3ConfigForAdmin());
});

app.post('/api/admin/s3/config', requireAdmin, async (req, res) => {
  try {
    const settings = saveS3Settings(req.body || {});
    await persistDbState();
    res.json({
      success: true,
      settings: s3ConfigForAdmin(),
      raw: {
        ...settings,
        accessKeyId: settings.accessKeyId ? maskBackupSecret(settings.accessKeyId) : '',
        secretAccessKey: settings.secretAccessKey ? '••••••••' : '',
      },
    });
  } catch (err) {
    console.error('POST /api/admin/s3/config error:', err);
    res.status(500).json({ error: err.message || 'S3-Konfiguration konnte nicht gespeichert werden.' });
  }
});

app.get('/api/admin/s3/backups', requireAdmin, async (req, res) => {
  try {
    res.json({ items: await listS3Backups(), status: s3Status() });
  } catch (err) {
    console.error('GET /api/admin/s3/backups error:', err);
    res.status(err.status || 500).json({ error: err.message || 'S3 Backups konnten nicht geladen werden.' });
  }
});

app.post('/api/admin/s3/backup', requireAdmin, async (req, res) => {
  try {
    const requestedScope = String(req.body?.scope || 'full').trim();
    const scope = BACKUP_SCOPES.has(requestedScope) ? requestedScope : 'full';
    const backup = buildDatabaseExport({ scope });
    const stamp = backup.exportedAt.replace(/[:.]/g, '-');
    const suffix = scope === 'full' ? 'full' : scope;
    const filename = `koffein-${suffix}-backup-${stamp}.db`;
    const key = s3ObjectKey(filename);
    const body = JSON.stringify(backup, null, 2);

    await s3Request({
      method: 'PUT',
      key,
      body,
      contentType: 'application/vnd.koffein-tracker.database+json; charset=utf-8',
    });

    res.json({
      success: true,
      key,
      filename,
      scope,
      size: Buffer.byteLength(body),
      exportedAt: backup.exportedAt,
    });
  } catch (err) {
    console.error('POST /api/admin/s3/backup error:', err);
    res.status(err.status || 500).json({ error: err.message || 'S3 Backup fehlgeschlagen.' });
  }
});

app.post('/api/admin/s3/restore', requireAdmin, async (req, res) => {
  try {
    const key = String(req.body?.key || '').trim();
    const cfg = ensureS3Configured();
    const allowedPrefix = cfg.prefix ? `${cfg.prefix}/` : '';
    if (!key || !key.endsWith('.db') || (allowedPrefix && !key.startsWith(allowedPrefix))) {
      return res.status(400).json({ error: 'Ungültiger S3 Backup-Schlüssel.' });
    }

    const { text } = await s3Request({ method: 'GET', key });
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return res.status(400).json({ error: 'Die S3 .db-Datei ist kein gültiges Koffein-Tracker-Backup.' });
    }

    const result = await importDatabasePayload(payload);
    res.json({
      success: true,
      key,
      importedAt: result.importedAt,
      summary: result.summary,
    });
  } catch (err) {
    console.error('POST /api/admin/s3/restore error:', err);
    res.status(err.status || 500).json({ error: err.message || 'S3 Restore fehlgeschlagen.' });
  }
});





// ── User Management Routes ────────────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const dbPool = getPool();
    const [rows] = await dbPool.execute(
      `SELECT
        id,
        name,
        email,
        role,
        verified,
        created_at AS createdAt,
        last_login AS lastLogin
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/admin/ai/chat-stats', requireAdmin, async (req, res) => {
  try {
    const rowsByOwner = new Map();

    dbState.users.forEach((user) => {
      const ownerKey = getSettingsOwnerKey({ userId: user.id, email: user.email });
      rowsByOwner.set(ownerKey, {
        ownerKey,
        userId: user.id,
        name: user.name || 'Unbekannt',
        email: user.email || '',
        role: user.role || 'user',
        registered: true,
        userMessages: 0,
        assistantMessages: 0,
        systemMessages: 0,
        totalMessages: 0,
        updatedAt: null,
      });
    });

    dbState.ai_chat_messages.forEach((entry, index) => {
      const email = String(entry.email || '').toLowerCase().trim();
      const user = dbState.users.find((u) =>
        (entry.userId && String(u.id) === String(entry.userId))
        || (email && String(u.email || '').toLowerCase() === email)
      );
      const ownerKey = user
        ? getSettingsOwnerKey({ userId: user.id, email: user.email })
        : entry.ownerKey || (entry.userId || email
          ? getSettingsOwnerKey({ userId: entry.userId, email })
          : `unknown:${index}`);
      const row = rowsByOwner.get(ownerKey) || {
        ownerKey,
        userId: entry.userId || user?.id || null,
        name: user?.name || (email ? email.split('@')[0] : 'Unbekannt'),
        email: user?.email || email,
        role: user?.role || 'user',
        registered: !!user,
        userMessages: 0,
        assistantMessages: 0,
        systemMessages: 0,
        totalMessages: 0,
        updatedAt: null,
      };
      const messages = Array.isArray(entry.messages) ? entry.messages : [];

      row.userMessages = messages.filter((message) => message?.role === 'user').length;
      row.assistantMessages = messages.filter((message) => message?.role === 'assistant').length;
      row.systemMessages = messages.filter((message) => message?.role === 'system').length;
      row.totalMessages = messages.length;
      row.updatedAt = entry.updatedAt || null;
      rowsByOwner.set(ownerKey, row);
    });

    const users = [...rowsByOwner.values()].sort((a, b) =>
      (b.userMessages - a.userMessages)
      || String(a.email || a.name).localeCompare(String(b.email || b.name))
    );

    res.json({
      users,
      totals: {
        users: users.length,
        usersWithChat: users.filter((user) => user.totalMessages > 0).length,
        userMessages: users.reduce((sum, user) => sum + user.userMessages, 0),
        assistantMessages: users.reduce((sum, user) => sum + user.assistantMessages, 0),
        totalMessages: users.reduce((sum, user) => sum + user.totalMessages, 0),
      },
    });
  } catch (err) {
    console.error('GET /api/admin/ai/chat-stats error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/admin/activity', requireAdmin, async (req, res) => {
  try {
    res.json(getAdminActivity());
  } catch (err) {
    console.error('GET /api/admin/activity error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/admin/tests/api', requireAdmin, (req, res) => {
  try {
    res.json(readApiTestOverview());
  } catch (err) {
    console.error('GET /api/admin/tests/api error:', err);
    res.status(500).json({ error: 'API-Testübersicht konnte nicht geladen werden.' });
  }
});

app.get('/api/admin/export/logs', requireAdmin, async (req, res) => {
  try {
    const { start, end } = getRangeFromQuery(req.query, 30);
    const email = String(req.query.email || '').toLowerCase().trim();
    const format = String(req.query.format || 'json').toLowerCase();
    const logs = dbState.caffeine_logs
      .filter((log) => (!email || String(log.email || '').toLowerCase() === email))
      .filter((log) => String(log.date || '') >= start && String(log.date || '') <= end)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="koffein-admin-${start}-${end}.csv"`);
      return res.send(buildLogsCsv(logs));
    }

    res.json({ items: logs, summary: getExportSummary(logs, start, end) });
  } catch (err) {
    console.error('GET /api/admin/export/logs error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Database error' });
  }
});

app.post('/api/admin/users/:id/verify', requireAdmin, async (req, res) => {
  try {
    const dbPool = getPool();
    const [result] = await dbPool.execute(
      'UPDATE users SET verified = true, verify_token = NULL, verify_token_expiry = NULL WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/users/:id/verify error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const dbPool = getPool();
    const [result] = await dbPool.execute(
      'DELETE FROM users WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/users/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body || {};
  if (!role || !['admin', 'user'].includes(role))
    return res.status(400).json({ error: 'Rolle muss "admin" oder "user" sein.' });
  try {
    const dbPool = getPool();
    const [result] = await dbPool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/users/:id/role error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { name, email, password, role = 'user', verified = false } = req.body || {};

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
  if (!['admin', 'user'].includes(role))
    return res.status(400).json({ error: 'Rolle muss "admin" oder "user" sein.' });

  const lowerEmail = email.toLowerCase();
  const existing = dbState.users.find((u) => u.email === lowerEmail);
  if (existing)
    return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });

  const newId = crypto.randomUUID();
  const newUser = {
    id: newId,
    name,
    email: lowerEmail,
    password_hash: hashPassword(password),
    role,
    verified: !!verified,
    verify_token: null,
    verify_token_expiry: null,
    totp_enabled: false,
    totp_secret: null,
    totp_temp_secret: null,
    webauthn_user_id: toBase64Url(crypto.randomBytes(32)),
    passkeys: [],
    created_at: new Date().toISOString(),
    last_login: null,
  };

  dbState.users.push(newUser);
  persistDbState();

  res.status(201).json({
    id: newId,
    name,
    email: lowerEmail,
    role,
    verified: !!verified,
    createdAt: newUser.created_at,
    lastLogin: null,
  });
});

app.post('/api/admin/users/:id/impersonate', requireAdmin, (req, res) => {
  const user = dbState.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  res.json(buildSessionUser(user));
});

// ── Public settings (no auth required) ────────────────────────────────────────
app.get('/api/settings/public', async (req, res) => {
  try {
    const cfg = await loadSmtpConfig();
    const demoEnabled = cfg?.demoEnabled !== false;
    res.json({
      demoEnabled,
      registrationEnabled: cfg?.registrationEnabled !== false,
      entryMode: sanitizeAppSettings(dbState.app_settings).entryMode,
      demoCredentials: demoEnabled ? {
        admin: { email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD },
        user: { email: DEMO_USER_EMAIL, password: DEMO_USER_PASSWORD },
      } : null,
      authMode: 'local',
      authentikEnabled: false,
      setupRequired: false,
    });
  } catch (err) {
    console.error('GET /api/settings/public error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});



// ── Public Registration & Login ───────────────────────────────────────────────
app.post('/api/register', async (req, res) => {


  const cfg = await loadSmtpConfig();
  if (!cfg?.registrationEnabled)
    return res.status(403).json({ error: 'Registrierung ist aktuell deaktiviert. Bitte wende dich an den Administrator.' });

  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });

  const dbPool = getPool();
  const lowerEmail = email.toLowerCase();

  const [existing] = await dbPool.execute(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [lowerEmail]
  );
  if (existing.length > 0)
    return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });

  const verifyToken  = crypto.randomBytes(32).toString('hex');
  const newUserId = crypto.randomUUID();
  await dbPool.execute(
    `INSERT INTO users
      (id, name, email, password_hash, role, verified, verify_token, verify_token_expiry)
     VALUES (?, ?, ?, ?, 'user', false, ?, ?)`
    , [
      newUserId,
      name,
      lowerEmail,
      hashPassword(password),
      verifyToken,
      Date.now() + 24 * 60 * 60 * 1000,
    ]
  );

  try {
    const t        = createTransporter(cfg);
    const base     = (cfg.baseUrl || `http://localhost:${PORT}`).replace(/\/$/, '');
    const link     = `${base}/api/verify/${verifyToken}`;
    await t.sendMail({
      from:    `"${cfg.fromName}" <${cfg.fromEmail || 'admin@fra03.de'}>`,
      to:      email,
      subject: 'Koffein-Tracker \u2013 E-Mail-Adresse bestätigen',
      html: buildModernEmail({
        icon: '👋',
        headerText: `Willkommen, ${name}!`,
        contentHtml: `
          <p style="text-align: center; margin-top: 0;">Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #60a5fa); color: white; text-decoration: none; padding: 14px 32px; border-radius: 16px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(59,130,246,0.4);">
              E-Mail bestätigen
            </a>
          </div>
          <p style="text-align: center; color: #64748b; font-size: 13px; margin: 0;">Dieser Link ist 24 Stunden gültig.<br>Falls du dich nicht registriert hast, ignoriere diese E-Mail.</p>
        `,
      }),
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[Register] E-Mail konnte nicht gesendet werden:', err.message);
    res.status(201).json({ success: true, emailWarning: `Konto erstellt, Verifizierungs-E-Mail fehlgeschlagen: ${err.message}` });
  }
});

app.get('/api/verify/:token', async (req, res) => {
  try {
    const dbPool = getPool();
    const [rows] = await dbPool.execute(
      `SELECT id, verify_token_expiry AS verifyTokenExpiry
       FROM users
       WHERE verify_token = ?
       LIMIT 1`,
      [req.params.token]
    );
    const user = rows[0];
    if (!user) return res.redirect('/?verified=invalid');
    if (Date.now() > Number(user.verifyTokenExpiry || 0))
      return res.redirect('/?verified=expired');

    await dbPool.execute(
      'UPDATE users SET verified = true, verify_token = NULL, verify_token_expiry = NULL WHERE id = ?',
      [user.id]
    );
    res.redirect('/?verified=1');
  } catch (err) {
    console.error('GET /api/verify/:token error:', err);
    res.redirect('/?verified=invalid');
  }
});

// ── Password Reset ────────────────────────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'E-Mail erforderlich.' });

  try {
    const lowerEmail = String(email).toLowerCase().trim();
    const user = dbState.users.find((u) => u.email === lowerEmail);
    if (!user) return res.json({ success: true }); // Silent return for security

    const resetToken = toBase64Url(crypto.randomBytes(32));
    const resetExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

    const dbPool = getPool();
    await dbPool.execute('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', [
      resetToken,
      resetExpiry,
      user.id
    ]);
    
    // Send Email
    const cfg = getMailConfig();
    if (cfg.enabled) {
      const t = createTransporter(cfg);
      const base = (cfg.baseUrl || `http://localhost:${PORT}`).replace(/\/$/, '');
      const link = `${base}/?resetToken=${resetToken}`;
      
      await t.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail || 'admin@fra03.de'}>`,
        to: lowerEmail,
        subject: 'Koffein-Tracker \u2013 Passwort zur\u00fccksetzen',
        html: buildModernEmail({
          icon: '\uD83D\uDD12',
          headerText: 'Passwort zur\u00fccksetzen',
          contentHtml: `
            <p style="text-align: center;">Du hast eine R\u00fccksetzung deines Passworts angefordert. Klicke auf den Button, um ein neues Passwort zu vergeben:</p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #60a5fa); color: white; text-decoration: none; padding: 14px 32px; border-radius: 16px; font-weight: bold; font-size: 16px;">
                Neues Passwort vergeben
              </a>
            </div>
            <p style="text-align: center; font-size: 12px; color: #94a3b8;">Dieser Link ist f\u00fcr 1 Stunde g\u00fcltig. Falls du diese \u00c4nderung nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
          `,
          footerText: 'Koffein-Tracker Sicherheit',
        }),
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/auth/forgot-password error:', err);
    res.status(500).json({ error: 'Interner Fehler.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Token und neues Passwort erforderlich.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });

  try {
    const user = dbState.users.find((u) => u.reset_token === token);
    if (!user) return res.status(400).json({ error: 'Ung\u00fcltiger oder abgelaufener Token.' });
    if (user.reset_token_expiry < Date.now()) return res.status(400).json({ error: 'Token ist abgelaufen.' });

    const newHash = hashPassword(newPassword);
    const dbPool = getPool();
    await dbPool.execute('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', [
      newHash,
      user.id
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/auth/reset-password error:', err);
    res.status(500).json({ error: 'Interner Fehler.' });
  }
});

app.post('/api/login', async (req, res) => {


  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' });

  try {
    const dbPool = getPool();
    const [rows] = await dbPool.execute(
      `SELECT
        id,
        name,
        email,
        role,
        verified,
        password_hash AS passwordHash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user) {
      const cfg = await loadSmtpConfig();
      const demoUser = cfg?.demoEnabled !== false ? demoUserForCredentials(email, password) : null;
      if (demoUser) return res.json({ success: true, user: buildSessionUser(demoUser) });
      return res.status(401).json({ error: 'Ung\u00fcltige Zugangsdaten.' });
    }
    if (!user.verified)
      return res.status(403).json({ error: 'E-Mail-Adresse noch nicht best\u00e4tigt. Bitte pr\u00fcfe dein Postfach.' });
    if (user.passwordHash !== hashPassword(password))
      return res.status(401).json({ error: 'Ung\u00fcltige Zugangsdaten.' });

    const fullUser = getUserByIdentity({ userId: user.id, email: user.email });
    if (fullUser) ensureUserSecurityFields(fullUser);

    const hasTotp = !!fullUser?.totp_enabled && !!fullUser?.totp_secret;
    const hasPasskey = Array.isArray(fullUser?.passkeys) && fullUser.passkeys.length > 0;

    if (hasTotp || hasPasskey) {
      const loginToken = createSecondFactorToken(fullUser);
      return res.json({
        success: true,
        requiresSecondFactor: true,
        loginToken,
        methods: {
          totp: hasTotp,
          passkey: hasPasskey,
        },
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    }

    const safeUser = await completeLoginForUser(fullUser || user);
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('POST /api/login error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/login/2fa/totp', async (req, res) => {
  try {
    const { loginToken, code } = req.body || {};
    if (!loginToken || !code) return res.status(400).json({ error: 'loginToken und Code sind erforderlich.' });

    const pending = peekSecondFactorToken(loginToken);
    if (!pending) return res.status(401).json({ error: '2FA-Sitzung ist abgelaufen. Bitte neu anmelden.' });

    const user = getUserByIdentity({ userId: pending.userId, email: pending.email });
    ensureUserSecurityFields(user);
    if (!user || !user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ error: 'TOTP ist für dieses Konto nicht aktiv.' });
    }

    const ok = (await authenticator.verify({ token: String(code).replace(/\s+/g, ''), secret: user.totp_secret })).valid;
    if (!ok) return res.status(401).json({ error: 'Ungültiger 2FA-Code.' });

    consumeSecondFactorToken(loginToken);
    const safeUser = await completeLoginForUser(user);
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('POST /api/login/2fa/totp error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/login/2fa/passkey/options', async (req, res) => {
  try {
    const { loginToken } = req.body || {};
    if (!loginToken) return res.status(400).json({ error: 'loginToken ist erforderlich.' });

    const pending = peekSecondFactorToken(loginToken);
    if (!pending) return res.status(401).json({ error: '2FA-Sitzung ist abgelaufen. Bitte neu anmelden.' });

    const user = getUserByIdentity({ userId: pending.userId, email: pending.email });
    ensureUserSecurityFields(user);
    if (!user || user.passkeys.length === 0) {
      return res.status(400).json({ error: 'Kein Sicherheitsschlüssel hinterlegt.' });
    }

    const { rpID } = getWebAuthnConfig(req);

    const options = await generateAuthenticationOptions({
      rpID: rpID,
      userVerification: 'required',
      allowCredentials: user.passkeys.map((k) => ({
        id: k.id,
        transports: Array.isArray(k.transports) ? k.transports : [],
      })),
      timeout: 60000,
    });

    pendingWebAuthn.set(`login:${loginToken}`, {
      type: 'login',
      userId: user.id,
      challenge: options.challenge,
      expiresAt: Date.now() + AUTH_CHALLENGE_TTL_MS,
    });

    res.json({ success: true, options });
  } catch (err) {
    console.error('POST /api/login/2fa/passkey/options error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/login/2fa/passkey/verify', async (req, res) => {
  try {
    const { loginToken, response } = req.body || {};
    if (!loginToken || !response) return res.status(400).json({ error: 'loginToken und response sind erforderlich.' });

    const pending = peekSecondFactorToken(loginToken);
    if (!pending) return res.status(401).json({ error: '2FA-Sitzung ist abgelaufen. Bitte neu anmelden.' });

    const challengeState = pendingWebAuthn.get(`login:${loginToken}`);
    if (!challengeState || challengeState.type !== 'login') {
      return res.status(401).json({ error: 'Passkey-Challenge fehlt oder ist abgelaufen.' });
    }

    const user = getUserByIdentity({ userId: pending.userId, email: pending.email });
    ensureUserSecurityFields(user);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

    const passkey = user.passkeys.find((k) => k.id === response.id);
    if (!passkey) return res.status(401).json({ error: 'Unbekannter Sicherheitsschlüssel.' });

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeState.challenge,
      expectedOrigin: getWebAuthnConfig(req).origin,
      expectedRPID: getWebAuthnConfig(req).rpID,
      credential: {
        id: passkey.id,
        publicKey: fromBase64Url(passkey.publicKey),
        counter: Number(passkey.counter || 0),
        transports: Array.isArray(passkey.transports) ? passkey.transports : [],
      },
      requireUserVerification: true,
    });

    if (!verification.verified) return res.status(401).json({ error: 'Passkey-Überprüfung fehlgeschlagen.' });

    if (verification.authenticationInfo) {
      passkey.counter = verification.authenticationInfo.newCounter;
      passkey.lastUsedAt = new Date().toISOString();
      persistDbState();
    }

    pendingWebAuthn.delete(`login:${loginToken}`);
    consumeSecondFactorToken(loginToken);

    const safeUser = await completeLoginForUser(user);
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('POST /api/login/2fa/passkey/verify error:', err);
    res.status(500).json({ error: 'Passkey-Verifikation fehlgeschlagen.' });
  }
});

// ── User Reminder Settings ───────────────────────────────────────────────────
app.get('/api/reminders/me', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const reminder = getReminderForUser({ userId, email });
    res.json(reminder);
  } catch (err) {
    console.error('GET /api/reminders/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/reminders/me', requireAuth, async (req, res) => {
  try {
    const { enabled, time, mailEnabled, discordEnabled, discordWebhook } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);

    if (!isValidReminderTime(time)) return res.status(400).json({ error: 'Uhrzeit muss im Format HH:MM sein.' });


    const reminder = upsertReminderForUser({
      userId: safeUserId,
      email: safeEmail,
      settings: {
        enabled: enabled !== false && enabled !== 'false',
        time,
        mailEnabled: mailEnabled !== false && mailEnabled !== 'false',
        discordEnabled: !!discordEnabled,
        discordWebhook: discordWebhook || '',
      },
    });

    res.json({ success: true, reminder });
  } catch (err) {
    console.error('POST /api/reminders/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── User Favorites ───────────────────────────────────────────────────────────
app.get('/api/favorites/me', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const favorites = getFavoritesForUser({ userId, email });
    res.json({ items: favorites.items });
  } catch (err) {
    console.error('GET /api/favorites/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/favorites/me', requireAuth, async (req, res) => {
  try {
    const { drink } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);

    if (!drink || typeof drink !== 'object') return res.status(400).json({ error: 'drink ist erforderlich.' });

    const name = String(drink.name || '').trim();
    const size = Number(drink.size);
    const caffeine = Number(drink.caffeine);

    if (!name) return res.status(400).json({ error: 'drink.name ist erforderlich.' });
    if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'drink.size ist ungültig.' });
    if (!Number.isFinite(caffeine) || caffeine < 0) return res.status(400).json({ error: 'drink.caffeine ist ungültig.' });

    const item = upsertFavoriteForUser({
      userId: safeUserId,
      email: safeEmail,
      drink: {
        name,
        size: Math.round(size),
        caffeine: Math.round(caffeine),
        caffeinePerMl: drink.caffeinePerMl,
        icon: drink.icon || '🥤',
      },
    });

    res.json({ success: true, item });
  } catch (err) {
    console.error('POST /api/favorites/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/favorites/me', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);
    const favoriteId = String(req.query.favoriteId || '').trim();

    if (!favoriteId) return res.status(400).json({ error: 'favoriteId ist erforderlich.' });

    const removed = removeFavoriteForUser({ userId, email, favoriteId });
    if (!removed) return res.status(404).json({ error: 'Favorit nicht gefunden.' });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/favorites/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── USER SETTINGS ────────────────────────────────────────────────────────────
app.get('/api/settings/me', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const settings = getUserSettings({ userId, email });
    res.json(settings);
  } catch (err) {
    console.error('GET /api/settings/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/settings/me', requireAuth, async (req, res) => {
  try {
    const { dailyLimit, sleepTime, notifyAtLimit, notifyLate, notifyRapid, discordNotifyAtLimit, discordNotifyLate, discordNotifyRapid, theme } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);

    if (dailyLimit !== undefined && (!Number.isFinite(dailyLimit) || dailyLimit < 0))
      return res.status(400).json({ error: 'dailyLimit muss eine positive Zahl sein.' });
    if (sleepTime !== undefined && !isValidTime(sleepTime))
      return res.status(400).json({ error: 'sleepTime muss im Format HH:MM sein.' });

    const settings = updateUserSettings({
      userId: safeUserId,
      email: safeEmail,
      dailyLimit,
      sleepTime,
      notifyAtLimit,
      notifyLate,
      notifyRapid,
      discordNotifyAtLimit,
      discordNotifyLate,
      discordNotifyRapid,
      theme });

    res.json(settings);
  } catch (err) {
    console.error('POST /api/settings/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/user/profile', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newName, newEmail, newPassword } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);

    const user = getUserByIdentity({ userId: safeUserId, email: safeEmail });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    
    if (user.password_hash !== hashPassword(currentPassword)) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch.' });
    }

    const dbPool = getPool();
    let finalEmail = user.email;
    let finalName = user.name;
    let finalHash = user.password_hash;

    if (newEmail && newEmail.toLowerCase() !== user.email) {
      const lowerNewEmail = newEmail.toLowerCase();
      const [existing] = await dbPool.execute('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [lowerNewEmail, user.id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Diese E-Mail wird bereits verwendet.' });
      }
      finalEmail = lowerNewEmail;
    }
    
    if (newName && newName.trim() !== '') {
      finalName = newName.trim();
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen lang sein.' });
      }
      finalHash = hashPassword(newPassword);
    }

    await dbPool.execute(
      'UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?',
      [finalName, finalEmail, finalHash, user.id]
    );

    res.json({ success: true, name: finalName, email: finalEmail, token: createSessionToken({ ...user, name: finalName, email: finalEmail }) });
  } catch (err) {
    console.error('POST /api/user/profile error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── USER TEST ROUTES ────────────────────────────────────────────────────────
app.post('/api/user/test-email', requireAuth, async (req, res) => {
  try {
    const targetEmail = req.auth.email;

    // Testemail senden
    const cfg = await loadSmtpConfig();
    if (!cfg.host) {
      return res.status(400).json({ error: 'SMTP ist auf diesem Server noch nicht eingerichtet.' });
    }

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.auth.user, pass: cfg.auth.pass },
    });

    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail || 'admin@fra03.de'}>`,
      to: targetEmail,
      subject: 'Test-Nachricht: Paulaner & Energy Tracker',
      text: 'Hallo! Deine E-Mail-Benachrichtigungen für den Paulaner & Energy Tracker funktionieren einwandfrei.',
      html: buildModernEmail({
        icon: '🎉',
        headerText: 'Test erfolgreich!',
        contentHtml: `
          <p style="text-align: center; margin-top: 0;">Deine E-Mail-Benachrichtigungen für den Paulaner & Energy Tracker funktionieren einwandfrei.</p>
          <p style="text-align: center; margin-bottom: 0;">Du erhältst ab sofort Benachrichtigungen für deine täglichen Reminder oder Warnungen (falls konfiguriert).</p>
        `,
      }),
    });

    res.json({ success: true, message: `Test-E-Mail wurde erfolgreich an ${targetEmail} gesendet!` });
  } catch (err) {
    console.error('Test-E-Mail Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Senden der Test-E-Mail' });
  }
});

// ── USER SECURITY (2FA + PASSKEYS) ─────────────────────────────────────────
app.get('/api/security/me', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const user = getUserByIdentity({ userId, email });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    res.json(sanitizeSecurityOverview(user));
  } catch (err) {
    console.error('GET /api/security/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/security/totp/setup', requireAuth, async (req, res) => {
  try {
    const { password } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);
    if (!password) return res.status(400).json({ error: 'password ist erforderlich.' });

    const user = getUserByIdentity({ userId: safeUserId, email: safeEmail });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    if (user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Passwort ist falsch.' });
    }

    ensureUserSecurityFields(user);
    const secret = authenticator.generateSecret();
    user.totp_temp_secret = secret;
    persistDbState();

    const otpauthUrl = authenticator.generateURI({ issuer: WEBAUTHN_RP_NAME, label: user.email, secret });
    res.json({ success: true, secret, otpauthUrl, issuer: WEBAUTHN_RP_NAME });
  } catch (err) {
    console.error('POST /api/security/totp/setup error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/security/totp/enable', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);
    if (!code) return res.status(400).json({ error: 'code ist erforderlich.' });

    const user = getUserByIdentity({ userId: safeUserId, email: safeEmail });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    ensureUserSecurityFields(user);
    if (!user.totp_temp_secret) return res.status(400).json({ error: 'Bitte zuerst TOTP-Setup starten.' });

    const ok = (await authenticator.verify({ token: String(code).replace(/\s+/g, ''), secret: user.totp_temp_secret })).valid;
    if (!ok) return res.status(401).json({ error: 'Ungültiger Verifizierungscode.' });

    user.totp_secret = user.totp_temp_secret;
    user.totp_temp_secret = null;
    user.totp_enabled = true;
    persistDbState();

    res.json({ success: true, security: sanitizeSecurityOverview(user) });
  } catch (err) {
    console.error('POST /api/security/totp/enable error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/security/totp/disable', requireAuth, async (req, res) => {
  try {
    const { password } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);
    if (!password) return res.status(400).json({ error: 'password ist erforderlich.' });

    const user = getUserByIdentity({ userId: safeUserId, email: safeEmail });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    if (user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Passwort ist falsch.' });
    }

    ensureUserSecurityFields(user);
    user.totp_enabled = false;
    user.totp_secret = null;
    user.totp_temp_secret = null;
    persistDbState();

    res.json({ success: true, security: sanitizeSecurityOverview(user) });
  } catch (err) {
    console.error('POST /api/security/totp/disable error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/security/passkeys/register/options', requireAuth, async (req, res) => {
  try {
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);

    const user = getUserByIdentity({ userId: safeUserId, email: safeEmail });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    ensureUserSecurityFields(user);

    if (!user.webauthn_user_id) {
      user.webauthn_user_id = toBase64Url(crypto.randomBytes(32));
      persistDbState();
    }

    const { rpID } = getWebAuthnConfig(req);

    const options = await generateRegistrationOptions({
      rpID: rpID,
      rpName: WEBAUTHN_RP_NAME,
      userID: fromBase64Url(user.webauthn_user_id),
      userName: user.email,
      userDisplayName: user.name || user.email,
      timeout: 60000,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      excludeCredentials: user.passkeys.map((k) => ({ id: k.id, transports: k.transports || [] })),
    });

    const challengeToken = crypto.randomBytes(24).toString('hex');
    pendingWebAuthn.set(`register:${challengeToken}`, {
      type: 'register',
      userId: user.id,
      challenge: options.challenge,
      expiresAt: Date.now() + AUTH_CHALLENGE_TTL_MS,
    });

    res.json({ success: true, challengeToken, options });
  } catch (err) {
    console.error('POST /api/security/passkeys/register/options error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/security/passkeys/register/verify', requireAuth, async (req, res) => {
  try {
    const { challengeToken, response, name } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);
    if (!challengeToken || !response) {
      return res.status(400).json({ error: 'challengeToken und response sind erforderlich.' });
    }

    const user = getUserByIdentity({ userId: safeUserId, email: safeEmail });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    ensureUserSecurityFields(user);

    const challengeState = pendingWebAuthn.get(`register:${challengeToken}`);
    if (!challengeState || challengeState.type !== 'register' || challengeState.userId !== user.id) {
      return res.status(401).json({ error: 'Registrierungs-Challenge fehlt oder ist abgelaufen.' });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeState.challenge,
      expectedOrigin: getWebAuthnConfig(req).origin,
      expectedRPID: getWebAuthnConfig(req).rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(401).json({ error: 'Sicherheitsschlüssel konnte nicht verifiziert werden.' });
    }

    const credential = verification.registrationInfo.credential;
    const credentialId = credential.id;
    if (user.passkeys.some((k) => k.id === credentialId)) {
      pendingWebAuthn.delete(`register:${challengeToken}`);
      return res.status(409).json({ error: 'Dieser Schlüssel ist bereits registriert.' });
    }

    user.passkeys.push({
      id: credentialId,
      publicKey: toBase64Url(credential.publicKey),
      counter: Number(credential.counter || 0),
      transports: Array.isArray(response.response?.transports) ? response.response.transports : [],
      name: String(name || 'Sicherheitsschlüssel').trim() || 'Sicherheitsschlüssel',
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    });

    pendingWebAuthn.delete(`register:${challengeToken}`);
    persistDbState();
    res.json({ success: true, security: sanitizeSecurityOverview(user) });
  } catch (err) {
    console.error('POST /api/security/passkeys/register/verify error:', err);
    res.status(500).json({ error: 'Passkey-Registrierung fehlgeschlagen.' });
  }
});

app.delete('/api/security/passkeys/:credentialId', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);
    const credentialId = String(req.params.credentialId || '').trim();
    if (!credentialId) return res.status(400).json({ error: 'credentialId ist erforderlich.' });

    const user = getUserByIdentity({ userId, email });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    ensureUserSecurityFields(user);

    const before = user.passkeys.length;
    user.passkeys = user.passkeys.filter((k) => k.id !== credentialId);
    if (user.passkeys.length === before) {
      return res.status(404).json({ error: 'Sicherheitsschlüssel nicht gefunden.' });
    }

    persistDbState();
    res.json({ success: true, security: sanitizeSecurityOverview(user) });
  } catch (err) {
    console.error('DELETE /api/security/passkeys/:credentialId error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── CUSTOM DRINKS ───────────────────────────────────────────────────────────
app.get('/api/custom-drinks/me', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const drinks = getCustomDrinksForUser({ userId, email });
    res.json({ items: drinks });
  } catch (err) {
    console.error('GET /api/custom-drinks/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/custom-drinks/me', requireAuth, async (req, res) => {
  try {
    const { name, size, caffeine, icon } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);

    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name ist erforderlich.' });
    if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'size muss positiv sein.' });
    if (!Number.isFinite(caffeine) || caffeine < 0) return res.status(400).json({ error: 'caffeine muss >= 0 sein.' });

    const drink = addCustomDrink({
      userId: safeUserId,
      email: safeEmail,
      name: String(name).trim(),
      size: Math.round(size),
      caffeine: Math.round(caffeine),
      icon: icon || '🥤',
    });

    res.json({ success: true, item: drink });
  } catch (err) {
    console.error('POST /api/custom-drinks/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/custom-drinks/me', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);
    const drinkId = String(req.query.drinkId || '').trim();

    if (!drinkId) return res.status(400).json({ error: 'drinkId ist erforderlich.' });

    const removed = removeCustomDrink({ userId, email, drinkId });
    if (!removed) return res.status(404).json({ error: 'Getränk nicht gefunden.' });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/custom-drinks/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── STATISTICS ───────────────────────────────────────────────────────────────
app.get('/api/stats/today', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const stats = getTodayStats({ userId, email });
    res.json(stats);
  } catch (err) {
    console.error('GET /api/stats/today error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
app.get('/api/stats/weekly', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const stats = getWeeklyStats({ userId, email });
    res.json({ items: stats });
  } catch (err) {
    console.error('GET /api/stats/weekly error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/stats/overview', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    res.json(getStatsOverview({ userId, email }));
  } catch (err) {
    console.error('GET /api/stats/overview error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/stats/records', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    res.json(getPersonalRecords({ userId, email }));
  } catch (err) {
    console.error('GET /api/stats/records error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/insights/me', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    res.json(getUserInsights({ userId, email }));
  } catch (err) {
    console.error('GET /api/insights/me error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/export/logs', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const { start, end } = getRangeFromQuery(req.query, 30);
    const format = String(req.query.format || 'json').toLowerCase();
    const logs = getLogsForUser({ userId, email, start, end });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="koffein-${start}-${end}.csv"`);
      return res.send(buildLogsCsv(logs));
    }

    res.json({ items: logs, summary: getExportSummary(logs, start, end) });
  } catch (err) {
    console.error('GET /api/export/logs error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Database error' });
  }
});

app.post('/api/export/logs/email-pdf', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);
    const profileUser = getUserByIdentity({ userId, email }) || req.user;
    const recipientEmail = String(profileUser?.email || email || '').toLowerCase().trim();
    const { start, end } = getRangeFromQuery(req.body || {}, 30);
    const logs = getLogsForUser({ userId, email, start, end });
    const summary = getExportSummary(logs, start, end);
    const result = await sendExportPdfEmail({ to: recipientEmail, logs, summary });
    res.json({
      success: true,
      to: recipientEmail,
      filename: result.filename,
      size: result.size,
      summary,
    });
  } catch (err) {
    console.error('POST /api/export/logs/email-pdf error:', err);
    res.status(err.status || 500).json({ error: err.message || 'PDF-Export konnte nicht per E-Mail gesendet werden.' });
  }
});

app.get('/api/ai/daily-hydration', requireAuth, async (req, res) => {
  try {
    const date = isValidDateKey(req.query.date) ? String(req.query.date) : getTodayKey();
    res.json(await getDailyHydrationQuote(date));
  } catch (err) {
    console.error('GET /api/ai/daily-hydration error:', err);
    res.status(500).json({ error: 'Tagesziel-Spruch konnte nicht geladen werden.' });
  }
});

app.get('/api/ai/daily-coach', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);
    const date = isValidDateKey(req.query.date) ? String(req.query.date) : getTodayKey();
    res.json(await getDailyCoach({ userId, email, date }));
  } catch (err) {
    console.error('GET /api/ai/daily-coach error:', err);
    res.status(500).json({ error: 'Tagescoach konnte nicht geladen werden.' });
  }
});

app.get('/api/admin/ai', requireAdmin, (req, res) => {
  const cfg = loadAiConfig();
  const maskedKey = cfg.apiKey ? cfg.apiKey.slice(0, 8) + '********' + cfg.apiKey.slice(-4) : '';
  const maskedBraveKey = cfg.braveSearchKey
    ? cfg.braveSearchKey.slice(0, 4) + '••••••••' + cfg.braveSearchKey.slice(-4)
    : '';
  res.json({
    apiKeySet: !!cfg.apiKey,
    apiKeyMasked: maskedKey,
    model: cfg.model,
    braveSearchKeySet: !!cfg.braveSearchKey,
    braveSearchKeyMasked: maskedBraveKey,
  });
});

app.post('/api/admin/ai', requireAdmin, (req, res) => {
  const { apiKey, model, braveSearchKey } = req.body || {};
  const aiCfg = loadAiConfig();
  
  const newApiKey = apiKey !== undefined ? String(apiKey).trim() : aiCfg.apiKey;
  const newModel = model !== undefined ? String(model).trim() : aiCfg.model;
  const newBraveSearchKey = braveSearchKey !== undefined ? String(braveSearchKey).trim() : aiCfg.braveSearchKey;

  saveAiConfig({
    ...aiCfg,
    apiKey: newApiKey,
    model: newModel,
    braveSearchKey: newBraveSearchKey,
  });
  
  res.json({ success: true });
});

// ── AI Chat History ──────────────────────────────────────────────────────────
app.get('/api/ai/chat-history', requireAuth, async (req, res) => {
  try {
    const { userId, email } = authIdentity(req);

    const history = getAiChatHistory({ userId, email });
    res.json({ messages: history.messages || [], updatedAt: history.updatedAt });
  } catch (err) {
    console.error('GET /api/ai/chat-history error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/ai/chat-history', requireAuth, async (req, res) => {
  try {
    const { messages } = req.body || {};
    const { userId: safeUserId, email: safeEmail } = authIdentity(req);

    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages ist erforderlich.' });

    const history = upsertAiChatHistory({ userId: safeUserId, email: safeEmail, messages });
    res.json({ success: true, updatedAt: history.updatedAt });
  } catch (err) {
    console.error('POST /api/ai/chat-history error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── AI Chat ──────────────────────────────────────────────────────────────────
app.post('/api/ai/chat', requireAuth, async (req, res) => {
  try {
    const { messages, totalCaffeineToday, dailyLimit, clientTime, clientDate, selectedDate, logs } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'messages ist erforderlich.' });

    // Validate message structure
    for (const m of messages) {
      if (!['user', 'assistant', 'system'].includes(m?.role) || typeof m?.content !== 'string')
        return res.status(400).json({ error: 'Ungültiges Nachrichtenformat.' });
      if (m.content.length > 2000)
        return res.status(400).json({ error: 'Nachricht zu lang (max. 2000 Zeichen).' });
    }

    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(clientDate || '')) ? clientDate : getTodayKey();
    const selectedLogDate = /^\d{4}-\d{2}-\d{2}$/.test(String(selectedDate || '')) ? selectedDate : today;
    const caffeineInfo = typeof totalCaffeineToday === 'number'
      ? `Koffein am aktuell ausgewählten Tag (${selectedLogDate}): ${totalCaffeineToday}mg von ${dailyLimit || 400}mg Tageslimit.`
      : '';
    const logsInfo = Array.isArray(logs) && logs.length > 0 ? `Getränke am aktuell ausgewählten Tag (${selectedLogDate}) bisher:\n${logs.map(l => `- ID: ${l.id}, Name: ${l.name}, Menge: ${l.size}ml, Koffein: ${l.caffeine}mg`).join('\n')}\n` : `Bisher am aktuell ausgewählten Tag (${selectedLogDate}) keine Getränke getrackt. `;
    const timeInfo = `Das aktuelle Datum beim Nutzer ist ${today}${clientTime ? `, die aktuelle Uhrzeit ist ${clientTime}` : ''}. Der im Tracker ausgewählte Tag ist ${selectedLogDate}. Berücksichtige Datum und Uhrzeit unbedingt bei deinen Empfehlungen (z.B. warne vor spätem Koffeinkonsum am Abend, oder gib morgens einen Energiekick-Tipp). `;

    const systemPrompt = `Du bist ein hilfreicher Assistent für den Drink-Tracker (Version 2.0). Du beantwortest Fragen zu Hydration, Kalorien, Energie und Getränken auf Deutsch. Sei präzise, freundlich und praxisnah. ${timeInfo} ${caffeineInfo}
${logsInfo}

Wenn der Nutzer dich bittet, ein Getränk hinzuzufügen, zu ändern oder zu löschen, nutze die zur Verfügung gestellten Tools (Funktionen), um die Aktion auszuführen. Stelle keine Rückfrage, wenn Getränk, Anzahl/Menge oder ein üblicher Koffeinwert plausibel geschätzt werden können.
Wenn der Nutzer nach IDs, Eintrags-IDs oder einer Liste der Einträge fragt, antworte direkt mit den IDs aus der obigen Liste für ${selectedLogDate}. Behaupte niemals, dass du keine Funktion zum Anzeigen der IDs hast.
Für Hinzufügen: Nutze add_drink nur für ein einzelnes Getränk. Wenn der Nutzer mehrere Getränke, mehrere Mengen oder Getränke für mehrere Tage nennt, nutze add_drinks und erstelle einen Eintrag pro Getränk. Berechne Koffein basierend auf ml und üblichem Gehalt, z.B. 32mg/100ml bei Energy-Drinks, 80mg pro 250ml Red Bull, 160mg pro 500ml Monster, 100mg pro Kaffee. Nutze ein passendes Emoji. Setze date bei jedem Eintrag immer als ISO-Datum YYYY-MM-DD. Wenn der Nutzer kein Datum nennt, nutze den aktuell ausgewählten Tag ${selectedLogDate}. Wenn der Nutzer relative Tage nennt (z.B. heute, gestern, vorgestern, letzten Montag), berechne das Datum ausgehend vom aktuellen Datum ${today}. Lege keine zukünftigen Log-Einträge an. Bei Formulierungen wie "ich hatte gestern zwei Monster und heute einen Kaffee" sollst du direkt add_drinks ausführen.
Für Ändern/Löschen (update_drink/delete_drink): Nutze exakt die ID aus der Liste der Getränke für ${selectedLogDate}.
Für geplante Discord-Nachrichten (schedule_discord_message): Nutze dieses Tool, um eine Nachricht zu einer bestimmten Uhrzeit in Discord (Admin Webhook) posten zu lassen.
Antworte dem Nutzer natürlich, während du die Aktion über die Tools auslöst.`.trim();

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "add_drink",
          description: "Fügt ein neues Getränk zum Log eines bestimmten Datums hinzu.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Name des Getränks" },
              size: { type: "number", description: "Menge in ml" },
              caffeine: { type: "number", description: "Gesamtes Koffein in mg" },
              icon: { type: "string", description: "Passendes Emoji für das Getränk" },
              date: { type: "string", description: `Datum des Eintrags im Format YYYY-MM-DD. Standard ist der aktuell ausgewählte Tag ${selectedLogDate}; relative Angaben vom Nutzer ausgehend von ${today} umrechnen.` }
            },
            required: ["name", "size", "caffeine", "date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_drinks",
          description: "Fügt mehrere Getränke zu beliebigen Log-Daten hinzu. Ein Array-Eintrag entspricht genau einem Getränk an genau einem Datum.",
          parameters: {
            type: "object",
            properties: {
              drinks: {
                type: "array",
                minItems: 1,
                description: "Liste der hinzuzufügenden Getränke. Für mehrere Tage muss jedes Getränk sein eigenes date-Feld haben.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Name des Getränks" },
                    size: { type: "number", description: "Menge in ml" },
                    caffeine: { type: "number", description: "Gesamtes Koffein in mg" },
                    icon: { type: "string", description: "Passendes Emoji für das Getränk" },
                    date: { type: "string", description: `Datum dieses Getränks im Format YYYY-MM-DD. Standard ist der aktuell ausgewählte Tag ${selectedLogDate}; relative Angaben vom Nutzer ausgehend von ${today} umrechnen.` }
                  },
                  required: ["name", "size", "caffeine", "date"]
                }
              }
            },
            required: ["drinks"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_drink",
          description: "Löscht ein Getränk aus dem heutigen Log anhand der ID.",
          parameters: {
            type: "object",
            properties: { id: { type: "number", description: "ID des zu löschenden Getränks" } },
            required: ["id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_drink",
          description: "Aktualisiert ein Getränk im heutigen Log anhand der ID.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "number", description: "ID des Getränks" },
              name: { type: "string", description: "Neuer Name" },
              size: { type: "number", description: "Neue Menge in ml" },
              caffeine: { type: "number", description: "Neues Koffein in mg" },
              icon: { type: "string", description: "Neues Emoji" }
            },
            required: ["id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "schedule_discord_message",
          description: "Plant eine einmalige Nachricht an den Discord-Webhook für eine bestimmte Uhrzeit (Format HH:MM).",
          parameters: {
            type: "object",
            properties: {
              time: { type: "string", description: "Uhrzeit im Format HH:MM (z.B. 15:30)" },
              message: { type: "string", description: "Die Nachricht, die gesendet werden soll" }
            },
            required: ["time", "message"]
          }
        }
      }
    ];

    const reply = await callOpenRouter(fullMessages, { tools });
    res.json(reply); // reply is already { content, tool_calls }
  } catch (err) {
    console.error('[AI Chat] Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AI Schedule Discord ──────────────────────────────────────────────────────
app.post('/api/ai/schedule-discord', requireAuth, async (req, res) => {
  try {
    const { time, message } = req.body || {};
    if (!time || !message) return res.status(400).json({ error: 'time und message werden benötigt.' });
    const cfg = await loadSmtpConfig();
    if (!cfg?.discordWebhook) {
      return res.status(400).json({ error: 'Kein Discord Webhook im Admin-Panel konfiguriert.' });
    }
    
    const formattedTime = parseDiscordScheduleTime(time);
    if (!formattedTime) return res.status(400).json({ error: 'time muss eine Uhrzeit im Format HH:MM enthalten.' });
    const safeMessage = String(message || '').trim();
    if (!safeMessage) return res.status(400).json({ error: 'message darf nicht leer sein.' });
    const runAt = buildDiscordRunAt(formattedTime);
    
    if (!Array.isArray(dbState.discord_schedules)) {
      dbState.discord_schedules = [];
    }
    
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const schedule = {
      id,
      time: formattedTime,
      message: safeMessage,
      runAt,
      status: 'pending',
      sent: false,
      createdAt,
      updatedAt: createdAt,
      createdBy: {
        userId: req.auth?.userId || null,
        email: req.auth?.email || null,
      },
    };
    dbState.discord_schedules.push(schedule);
    
    persistDbState();
    res.json({ success: true, id, time: formattedTime, runAt, message: safeMessage });
  } catch (err) {
    console.error('[AI Schedule Discord] Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AI Drink Recognition ─────────────────────────────────────────────────────
app.post('/api/ai/recognize-drink', requireAuth, async (req, res) => {
  try {
    const { description } = req.body || {};
    if (!description || typeof description !== 'string' || description.trim().length < 2)
      return res.status(400).json({ error: 'Beschreibung ist erforderlich.' });
    if (description.length > 500)
      return res.status(400).json({ error: 'Beschreibung zu lang (max. 500 Zeichen).' });

    const cleanedDescription = description.trim();
    const aiCfg = loadAiConfig();

    // Try Brave Search first if key is configured, fall back to OpenFoodFacts
    let webContext;
    let searchSource = 'none';
    if (aiCfg.braveSearchKey) {
      const braveContext = await fetchDrinkWebContextBrave(cleanedDescription, aiCfg.braveSearchKey);
      if (braveContext) {
        webContext = braveContext;
        searchSource = 'brave';
      }
    }
    if (searchSource === 'none') {
      const webHits = await fetchDrinkWebContext(cleanedDescription);
      webContext = formatDrinkWebContext(webHits);
      searchSource = webHits.length > 0 ? 'openfoodfacts' : 'none';
    }

    const messages = [
      {
        role: 'system',
        content: `Du bist ein Experte für Getränke und Koffeingehalt. Nutze die bereitgestellten Online-Treffer als primäre Datenquelle und antworte AUSSCHLIESSLICH mit einem JSON-Objekt ohne Markdown-Formatierung. Format:
{"name":"Getränkename","caffeinePer100ml":Zahl,"sizeMl":Zahl,"confidence":"hoch|mittel|niedrig","hint":"optionaler Hinweis auf Deutsch"}
Wichtig: caffeinePer100ml und sizeMl müssen Ganzzahlen sein. Bei widersprüchlichen Quellen nimm den konservativeren Wert und setze confidence auf "mittel" oder "niedrig".`,
      },
      {
        role: 'user',
        content: `Getränkeangabe des Nutzers:\n${cleanedDescription}\n\nOnline-Treffer:\n${webContext}`,
      },
    ];

    const raw = await callOpenRouter(messages);

    // Extract JSON from response (strip markdown if present)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Keine gültige Antwort vom AI-Modell.');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.name || typeof parsed.caffeinePer100ml !== 'number')
      throw new Error('Unvollständige AI-Antwort.');

    const defaultHint = searchSource === 'brave'
      ? 'Mit Brave Search abgeglichen.'
      : searchSource === 'openfoodfacts'
        ? 'Mit Online-Treffern abgeglichen (OpenFoodFacts).'
        : 'Keine passenden Online-Treffer gefunden, Schätzung basiert auf Standards.';

    res.json({
      name: String(parsed.name),
      caffeinePer100ml: Math.max(0, Math.round(Number(parsed.caffeinePer100ml))),
      sizeMl: Math.max(1, Math.round(Number(parsed.sizeMl || 250))),
      confidence: parsed.confidence || 'mittel',
      hint: parsed.hint || defaultHint,
    });
  } catch (err) {
    console.error('[AI Recognize] Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AI Daily Summary ─────────────────────────────────────────────────────────
// ── AI Drink Search (Brave API) ─────────────────────────────────────────────
app.get('/api/ai/search-drink', requireAuth, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json([]);

    const aiCfg = loadAiConfig();
    let webContext = '';

    if (aiCfg.braveSearchKey) {
      const url = new URL(BRAVE_SEARCH_URL);
      url.searchParams.set('q', query + ' Koffeingehalt mg 100ml');
      url.searchParams.set('count', '5');
      url.searchParams.set('search_lang', 'de');

      const resp = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': aiCfg.braveSearchKey,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (resp.ok) {
        const data = await resp.json();
        const results = Array.isArray(data?.web?.results) ? data.web.results : [];
        webContext = results.map(r => r.title + ': ' + r.description).join('\n');
      }
    }

    const messages = [
      {
        role: 'system',
        content: `Du bist eine Suchmaschine für Getränke und ihren Koffeingehalt. 
Suche nach dem Getränk: "${query}".
${webContext ? `Nutze diese aktuellen Suchergebnisse zur Verifizierung:\n${webContext}` : 'Es konnten keine Live-Suchdaten abgerufen werden, nutze dein Wissen.'}
Antworte AUSSCHLIESSLICH mit einem JSON-Array von bis zu 3 gefundenen Getränken. 
Formatiere JEDES Objekt im Array exakt so:
{"name":"Getränkename", "brand":"Markenname", "caffeinePer100ml":Zahl, "sizeMl":Zahl}
Wichtig: caffeinePer100ml und sizeMl müssen Ganzzahlen sein. Wenn keine Größe bekannt ist, nimm 330 oder 500.
Kein Markdown, nur das pure JSON-Array!`
      },
      { role: 'user', content: query }
    ];

    const resultText = await callOpenRouter(messages);
      const arrayMatch = resultText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!arrayMatch) throw new Error('Kein JSON Array in der Antwort gefunden: ' + resultText);
      const parsed = JSON.parse(arrayMatch[0]);

    const results = Array.isArray(parsed) ? parsed : [parsed];
    const mapped = results.map((item, i) => ({
      id: 'ai-' + Date.now() + '-' + i,
      name: item.name || query,
      brand: item.brand || 'Unbekannt',
      caffeinePer100ml: Number(item.caffeinePer100ml) || 0,
      sizeMl: Number(item.sizeMl) || 330,
      isCaffeineEstimated: false,
    }));

    res.json(mapped);
  } catch (err) {
    console.error('AI Drink Search Error:', err);
    res.status(500).json({ error: 'Fehler bei der Suche' });
  }
});

app.post('/api/ai/daily-summary', requireAuth, async (req, res) => {
  try {
    const { logs, totalCaffeine, dailyLimit, clientTime, clientDate, selectedDate } = req.body || {};
    if (!Array.isArray(logs))
      return res.status(400).json({ error: 'logs ist erforderlich.' });

    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(clientDate || '')) ? clientDate : getTodayKey();
    const selectedLogDate = /^\d{4}-\d{2}-\d{2}$/.test(String(selectedDate || '')) ? selectedDate : today;
    const limit = Number(dailyLimit) || 400;
    const total = Number(totalCaffeine) || 0;
    const remaining = Math.max(0, limit - total);
    const percent = Math.round((total / limit) * 100);

    const logList = logs.slice(0, 30).map((l) =>
      `- ${l.name} (${l.caffeine}mg, ${l.sizeMl || l.size || '?'}ml)`
    ).join('\n') || 'Keine Einträge an diesem Tag.';

    const messages = [
      {
        role: 'system',
        content: `Du bist ein Gesundheitsassistent für einen Koffein-Tracker. Antworte auf Deutsch, freundlich und präzise. Maximal 200 Wörter.`,
      },
      {
        role: 'user',
        content: `Analysiere meine Koffein-Aufnahme am ausgewählten Tag (${selectedLogDate}) und gib mir eine persönliche Auswertung und Empfehlung.

Aktuelles Datum: ${today}
Ausgewählter Tag: ${selectedLogDate}
${clientTime ? `Aktuelle Uhrzeit: ${clientTime}\n` : ''}Verbrauch am ausgewählten Tag: ${total}mg von ${limit}mg Tageslimit (${percent}%)
Noch verfügbar: ${remaining}mg

Einträge am ausgewählten Tag:
${logList}

Bitte: 1) kurze Bewertung, 2) ob ich noch Koffein trinken sollte, 3) ein praktischer Tipp.`,
      },
    ];

    const summary = await callOpenRouter(messages);
    res.json({ summary: summary?.content || 'Keine Antwort erhalten', total, limit, remaining, percent });
  } catch (err) {
    console.error('[AI Summary] Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Reject unresolved asset requests with 404 instead of returning index.html
app.use('/assets', (req, res) => {
  res.status(404).send('Asset not found');
});

// SPA Fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

process.on('SIGINT', () => {
  process.exit(0);
});

// Graceful shutdown — flush state to Redis before container stops
process.on('SIGTERM', async () => {
  console.log('[DB] SIGTERM empfangen, schreibe letzten Stand nach Redis...');
  try {
    const next = dbStateForStorage(dbState);
    dbState = next;
    await redis.mset(
      REDIS_KEYS.caffeine_logs,  JSON.stringify(next.caffeine_logs),
      REDIS_KEYS.users,          JSON.stringify(next.users),
      REDIS_KEYS.smtp_settings,  JSON.stringify(next.smtp_settings),
      REDIS_KEYS.auth_config,    JSON.stringify(next.auth_config),
      REDIS_KEYS.reminders,      JSON.stringify(next.reminders),
      REDIS_KEYS.favorites,      JSON.stringify(next.favorites),
      REDIS_KEYS.ai_config,      JSON.stringify(next.ai_config),
      REDIS_KEYS.s3_settings,    JSON.stringify(next.s3_settings),
      REDIS_KEYS.user_settings,  JSON.stringify(next.user_settings),
      REDIS_KEYS.custom_drinks,  JSON.stringify(next.custom_drinks),
      REDIS_KEYS.ai_chat_messages, JSON.stringify(next.ai_chat_messages),
      REDIS_KEYS.app_settings,   JSON.stringify(next.app_settings),
      REDIS_KEYS.discord_schedules, JSON.stringify(next.discord_schedules),
    );
    console.log('[DB] ✓ Letzter Stand gespeichert.');
  } catch (err) {
    console.error('[DB] Fehler beim Flush:', err.message);
  }
  await redis.quit();
  process.exit(0);
});
initDb()
  .then(() => {

    startDiscordAiScheduler();

    // Check every minute whether a reminder is due.
    setInterval(() => {
      processRemindersTick().catch((err) => console.error('[Reminder] Tick-Fehler:', err.message));
    }, 60 * 1000);

    setInterval(() => {
      cleanupAuthChallenges();
    }, 60 * 1000);

    app.listen(PORT, () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`);
      console.log(`📦 DB Type: ${DB_TYPE}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  });
