import { logout } from './auth';
import { API_BASE } from './apiBase';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const handleAuthExpired = () => {
  logout();
  window.dispatchEvent(new CustomEvent('auth:expired', {
    detail: { message: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' },
  }));
};

const authHeader = () => {
  let token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) {
    try {
      token = JSON.parse(localStorage.getItem('et-session') || '{}')?.token;
    } catch {
      token = null;
    }
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const urlFor = (path, query = {}) => {
  const url = new URL(path, API_BASE);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url.toString();
};

const request = async (path, { method = 'GET', query, body, auth = false, fallback = 'API-Fehler' } = {}) => {
  const response = await fetch(urlFor(path, query), {
    method,
    headers: { ...(body !== undefined ? JSON_HEADERS : {}), ...authHeader() },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    handleAuthExpired();
    throw new Error(data.error || 'Sitzung abgelaufen. Bitte neu anmelden.');
  }
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
};

const get = (path, query, fallback) => request(path, { query, fallback });
const post = (path, body, fallback, auth = false) => request(path, { method: 'POST', body, fallback, auth });
const put = (path, body, fallback, auth = false) => request(path, { method: 'PUT', body, fallback, auth });
const del = (path, query, fallback, auth = false) => request(path, { method: 'DELETE', query, fallback, auth });
const identity = ({ userId, email } = {}) => ({ userId, email });

export const fetchLogs = (date, user = {}) =>
  get('/api/logs', { date, ...identity(user) }, 'Fehler beim Laden der Logs');

export const createLog = (logData) =>
  post('/api/logs', logData, 'Fehler beim Speichern des Logs');

export const deleteLog = (id) =>
  del(`/api/logs/${id}`, undefined, 'Fehler beim Löschen des Logs');

export const fetchReminderSettings = (user) =>
  get('/api/reminders/me', identity(user), 'Fehler beim Laden der Erinnerungen');

export const saveReminderSettings = (payload) =>
  post('/api/reminders/me', payload, 'Fehler beim Speichern der Erinnerungen');

export const fetchFavorites = (user) =>
  get('/api/favorites/me', identity(user), 'Fehler beim Laden der Favoriten');

export const addFavorite = (payload) =>
  post('/api/favorites/me', payload, 'Fehler beim Speichern des Favoriten');

export const removeFavorite = ({ userId, email, favoriteId }) =>
  del('/api/favorites/me', { userId, email, favoriteId }, 'Fehler beim Entfernen des Favoriten');

export const fetchUserSettings = (user) =>
  get('/api/settings/me', identity(user), 'Fehler beim Abrufen der Einstellungen');

export const updateUserSettings = (payload) =>
  post('/api/settings/me', payload, 'Fehler beim Speichern der Einstellungen');

export const updateUserProfile = (payload) =>
  post('/api/user/profile', payload, 'Fehler beim Aktualisieren des Profils');

export const fetchCustomDrinks = async (user) =>
  (await get('/api/custom-drinks/me', identity(user), 'Fehler beim Abrufen der Getränke')).items || [];

export const addCustomDrink = async (payload) =>
  (await post('/api/custom-drinks/me', payload, 'Fehler beim Hinzufügen des Getränks')).item;

export const removeCustomDrink = ({ userId, email, drinkId }) =>
  del('/api/custom-drinks/me', { userId, email, drinkId }, 'Fehler beim Löschen des Getränks');

export const fetchTodayStats = (user) =>
  get('/api/stats/today', identity(user), 'Fehler beim Abrufen der Statistiken');

export const fetchStatsOverview = (user) =>
  get('/api/stats/overview', identity(user), 'Fehler beim Abrufen der Zielübersicht');

export const fetchPersonalRecords = (user) =>
  get('/api/stats/records', identity(user), 'Fehler beim Abrufen der Rekorde');

export const fetchWeeklyStats = async (user) =>
  (await get('/api/stats/weekly', identity(user), 'Fehler beim Abrufen der Wochenstatistiken')).items || [];

export const fetchInsights = (user) =>
  get('/api/insights/me', identity(user), 'Fehler beim Abrufen der Muster');

export const fetchExportLogs = ({ userId, email, start, end }) =>
  get('/api/export/logs', { userId, email, start, end }, 'Fehler beim Exportieren der Logs');

export const sendExportPdfEmail = ({ userId, email, start, end }) =>
  post('/api/export/logs/email-pdf', { userId, email, start, end }, 'PDF-Export konnte nicht per E-Mail gesendet werden');

export const fetchSecurityStatus = (user) =>
  get('/api/security/me', identity(user), 'Fehler beim Abrufen der Sicherheitseinstellungen');

export const setupTotp = (payload) =>
  post('/api/security/totp/setup', payload, 'TOTP-Setup fehlgeschlagen');

export const enableTotp = (payload) =>
  post('/api/security/totp/enable', payload, 'TOTP-Aktivierung fehlgeschlagen');

export const disableTotp = (payload) =>
  post('/api/security/totp/disable', payload, 'TOTP-Deaktivierung fehlgeschlagen');

export const fetchPasskeyRegistrationOptions = (payload) =>
  post('/api/security/passkeys/register/options', payload, 'Passkey-Optionen konnten nicht geladen werden');

export const verifyPasskeyRegistration = (payload) =>
  post('/api/security/passkeys/register/verify', payload, 'Passkey-Registrierung fehlgeschlagen');

export const removePasskey = ({ userId, email, credentialId }) =>
  del(`/api/security/passkeys/${encodeURIComponent(credentialId)}`, { userId, email }, 'Sicherheitsschlüssel konnte nicht gelöscht werden');

export const fetchPublicSettings = () =>
  get('/api/settings/public', undefined, 'Fehler beim Laden der öffentlichen Einstellungen');

export const updateAppName = (appName) =>
  post('/api/admin/app-name', { appName }, 'Fehler beim Speichern', true);

export const updateLog = (id, data) =>
  put(`/api/logs/${id}`, data, 'Fehler beim Aktualisieren des Logs', true);

export const adminUpdateLog = (id, data) =>
  put(`/api/admin/logs/${id}`, data, 'Fehler beim Aktualisieren', true);

export const adminDeleteLog = (id) =>
  del(`/api/admin/logs/${id}`, undefined, 'Fehler beim Löschen', true);

export const testDiscordWebhook = (webhookUrl) =>
  post('/api/admin/discord/test', { webhookUrl }, 'Fehler beim Discord Test');

export const testUserEmail = (payload) =>
  post('/api/user/test-email', payload, 'Fehler beim E-Mail Test');
