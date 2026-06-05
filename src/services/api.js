const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

export const fetchLogs = async (date, { userId, email } = {}) => {
  const url = new URL('/api/logs', API_BASE_URL);
  url.searchParams.set('date', date);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Fehler beim Laden der Logs');
  }
  return response.json();
};

export const createLog = async (logData) => {
  const response = await fetch(`${API_BASE_URL}/api/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(logData),
  });

  if (!response.ok) {
    throw new Error('Fehler beim Speichern des Logs');
  }

  return response.json();
};

export const deleteLog = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/logs/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Fehler beim LÃ¶schen des Logs');
  }

  return response.json();
};

export const fetchReminderSettings = async ({ userId, email }) => {
  const url = new URL('/api/reminders/me', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Fehler beim Laden der Erinnerungen');
  }
  return data;
};

export const saveReminderSettings = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/reminders/me`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Fehler beim Speichern der Erinnerungen');
  }

  return data;
};

export const fetchFavorites = async ({ userId, email }) => {
  const url = new URL('/api/favorites/me', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Fehler beim Laden der Favoriten');
  }
  return data;
};

export const testDiscordWebhook = async (webhookUrl) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/test-discord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Fehler beim Discord Test');
  }
  return response.json();
};

export const testUserEmail = async ({ userId, email }) => {
  const response = await fetch(`${API_BASE_URL}/api/user/test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Fehler beim E-Mail Test');
  }
  return response.json();
};

export const addFavorite = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/favorites/me`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Fehler beim Speichern des Favoriten');
  }

  return data;
};

export const removeFavorite = async ({ userId, email, favoriteId }) => {
  const url = new URL('/api/favorites/me', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);
  if (favoriteId) url.searchParams.set('favoriteId', favoriteId);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Fehler beim Entfernen des Favoriten');
  }

  return data;
};

// â”€â”€ USER SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const fetchUserSettings = async ({ userId, email }) => {
  const url = new URL('/api/settings/me', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim Abrufen der Einstellungen');
  return data;
};

export const updateUserSettings = async ({ userId, email, dailyLimit, notifyAtLimit, notifyLate, notifyRapid, discordNotifyAtLimit, discordNotifyLate, discordNotifyRapid, theme, language }) => {
  const response = await fetch(`${API_BASE_URL}/api/settings/me`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, dailyLimit, notifyAtLimit, notifyLate, notifyRapid, discordNotifyAtLimit, discordNotifyLate, discordNotifyRapid, theme, language }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim Speichern der Einstellungen');
  return data;
};

export const updateUserProfile = async ({ userId, email, currentPassword, newName, newEmail, newPassword }) => {
  const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, currentPassword, newName, newEmail, newPassword }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim Aktualisieren des Profils');
  return data;
};

// â”€â”€ CUSTOM DRINKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const fetchCustomDrinks = async ({ userId, email }) => {
  const url = new URL('/api/custom-drinks/me', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim Abrufen der GetrÃ¤nke');
  return data.items || [];
};

export const addCustomDrink = async ({ userId, email, name, size, caffeine, icon }) => {
  const response = await fetch(new URL('/api/custom-drinks/me', API_BASE_URL).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, name, size, caffeine, icon }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim HinzufÃ¼gen des GetrÃ¤nks');
  return data.item;
};

export const removeCustomDrink = async ({ userId, email, drinkId }) => {
  const url = new URL('/api/custom-drinks/me', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);
  if (drinkId) url.searchParams.set('drinkId', drinkId);

  const response = await fetch(url.toString(), { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim LÃ¶schen des GetrÃ¤nks');
  return data;
};

// â”€â”€ STATISTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const fetchTodayStats = async ({ userId, email }) => {
  const url = new URL('/api/stats/today', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim Abrufen der Statistiken');
  return data;
};

export const fetchWeeklyStats = async ({ userId, email }) => {
  const url = new URL('/api/stats/weekly', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim Abrufen der Wochenstatistiken');
  return data.items || [];
};

// â”€â”€ SECURITY (2FA / PASSKEYS) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const fetchSecurityStatus = async ({ userId, email }) => {
  const url = new URL('/api/security/me', API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler beim Abrufen der Sicherheitseinstellungen');
  return data;
};

export const setupTotp = async ({ userId, email, password }) => {
  const response = await fetch(`${API_BASE_URL}/api/security/totp/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'TOTP-Setup fehlgeschlagen');
  return data;
};

export const enableTotp = async ({ userId, email, code }) => {
  const response = await fetch(`${API_BASE_URL}/api/security/totp/enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, code }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'TOTP-Aktivierung fehlgeschlagen');
  return data;
};

export const disableTotp = async ({ userId, email, password }) => {
  const response = await fetch(`${API_BASE_URL}/api/security/totp/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'TOTP-Deaktivierung fehlgeschlagen');
  return data;
};

export const fetchPasskeyRegistrationOptions = async ({ userId, email }) => {
  const response = await fetch(`${API_BASE_URL}/api/security/passkeys/register/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Passkey-Optionen konnten nicht geladen werden');
  return data;
};

export const verifyPasskeyRegistration = async ({ userId, email, challengeToken, response, name }) => {
  const apiResponse = await fetch(`${API_BASE_URL}/api/security/passkeys/register/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, challengeToken, response, name }),
  });
  const data = await apiResponse.json();
  if (!apiResponse.ok) throw new Error(data.error || 'Passkey-Registrierung fehlgeschlagen');
  return data;
};

export const removePasskey = async ({ userId, email, credentialId }) => {
  const url = new URL(`/api/security/passkeys/${encodeURIComponent(credentialId)}`, API_BASE_URL);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url.toString(), { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'SicherheitsschlÃ¼ssel konnte nicht gelÃ¶scht werden');
  return data;
};





