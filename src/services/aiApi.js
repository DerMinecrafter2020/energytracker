import { logout } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const handleAuthExpired = () => {
  logout();
  window.dispatchEvent(new CustomEvent('auth:expired', {
    detail: { message: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' },
  }));
};

const clientTime = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const clientDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const urlFor = (path, query = {}) => {
  const url = new URL(path, API_BASE);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url.toString();
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

const post = async (path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    handleAuthExpired();
    throw new Error(data.error || 'Sitzung abgelaufen. Bitte neu anmelden.');
  }
  if (!res.ok) throw new Error(data.error || 'AI-Fehler');
  return data;
};

const get = async (path, query) => {
  const res = await fetch(urlFor(path, query), { headers: authHeader() });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    handleAuthExpired();
    throw new Error(data.error || 'Sitzung abgelaufen. Bitte neu anmelden.');
  }
  if (!res.ok) throw new Error(data.error || 'AI-Fehler');
  return data;
};

const identity = ({ userId, email } = {}) => ({ userId, email });

export const sendAiChat = ({ messages, totalCaffeineToday, dailyLimit, logs, selectedDate }) =>
  post('/api/ai/chat', { messages, totalCaffeineToday, dailyLimit, logs, selectedDate, clientTime: clientTime(), clientDate: clientDate() });

export const fetchAiChatHistory = (user) =>
  get('/api/ai/chat-history', identity(user));

export const saveAiChatHistory = ({ userId, email, messages }) =>
  post('/api/ai/chat-history', { userId, email, messages });

export const recognizeDrink = (description) =>
  post('/api/ai/recognize-drink', { description });

export const fetchDailySummary = ({ logs, totalCaffeine, dailyLimit, selectedDate }) =>
  post('/api/ai/daily-summary', { logs, totalCaffeine, dailyLimit, selectedDate, clientTime: clientTime(), clientDate: clientDate() });

export const fetchDailyHydrationQuote = (date) =>
  get('/api/ai/daily-hydration', { date: date || clientDate() });

export const fetchDailyCoach = (date) =>
  get('/api/ai/daily-coach', { date: date || clientDate() });

export const scheduleDiscordMessage = (time, message) =>
  post('/api/ai/schedule-discord', { time, message });
