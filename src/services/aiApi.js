const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
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

const post = async (path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'AI-Fehler');
  return data;
};

const get = async (path, query) => {
  const res = await fetch(urlFor(path, query));
  const data = await res.json().catch(() => ({}));
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

export const scheduleDiscordMessage = (time, message) =>
  post('/api/ai/schedule-discord', { time, message });
