const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

export const sendAiChat = async ({ messages, totalCaffeineToday, dailyLimit }) => {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, totalCaffeineToday, dailyLimit }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI-Fehler');
  return data.reply;
};

export const recognizeDrink = async (description) => {
  const res = await fetch(`${API_BASE}/api/ai/recognize-drink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI-Fehler');
  return data;
};

export const fetchDailySummary = async ({ logs, totalCaffeine, dailyLimit }) => {
  const res = await fetch(`${API_BASE}/api/ai/daily-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs, totalCaffeine, dailyLimit }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI-Fehler');
  return data;
};
