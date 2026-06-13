const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const clientTime = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

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

export const sendAiChat = ({ messages, totalCaffeineToday, dailyLimit, logs }) =>
  post('/api/ai/chat', { messages, totalCaffeineToday, dailyLimit, logs, clientTime: clientTime() });

export const recognizeDrink = (description) =>
  post('/api/ai/recognize-drink', { description });

export const fetchDailySummary = ({ logs, totalCaffeine, dailyLimit }) =>
  post('/api/ai/daily-summary', { logs, totalCaffeine, dailyLimit, clientTime: clientTime() });

export const scheduleDiscordMessage = (time, message) =>
  post('/api/ai/schedule-discord', { time, message });
