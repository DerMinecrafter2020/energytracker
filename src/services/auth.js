import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';

const AUTH_KEY = 'et-session';
const TOKEN_KEY = 'token';

const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const postJson = async (path, body, fallback) => {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || fallback);
  return data;
};

const saveSession = (user) => {
  const { password, ...safeUser } = user;
  const session = { ...safeUser, loginAt: Date.now() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  if (session.token) localStorage.setItem(TOKEN_KEY, session.token);
  else localStorage.removeItem(TOKEN_KEY);
  return session;
};

const readJsonStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const isWebAuthnSupported = () => {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
};

/** Attempt login against the server. Returns session object on success, throws on failure. */
export const login = async (email, password) => {
  const trimmed = email.trim().toLowerCase();
  const data = await postJson('/api/login', { email: trimmed, password }, 'Anmeldung fehlgeschlagen.');

  if (data.requiresSecondFactor) {
    return {
      requiresSecondFactor: true,
      loginToken: data.loginToken,
      methods: data.methods || { totp: false, passkey: false },
      user: data.user,
    };
  }

  return saveSession(data.user);
};

export const loginRepairAdmin = async (email, password) => {
  return login(email, password);
};

export const completeLoginWithTotp = async ({ loginToken, code }) => {
  const data = await postJson('/api/login/2fa/totp', { loginToken, code }, '2FA-Code ungültig.');
  return saveSession(data.user);
};

export const completeLoginWithPasskey = async ({ loginToken }) => {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn wird von diesem Browser nicht unterstützt. Bitte nutze den 2FA-Code.');
  }

  const optionsData = await postJson('/api/login/2fa/passkey/options', { loginToken }, 'Passkey-Optionen konnten nicht geladen werden.');

  const credential = await startAuthentication({
    optionsJSON: optionsData.options,
  });

  const verifyData = await postJson('/api/login/2fa/passkey/verify', { loginToken, response: credential }, 'Passkey-Verifikation fehlgeschlagen.');
  return saveSession(verifyData.user);
};

/** Clear the stored session. */
export const logout = () => {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

/** Return current session object, or null if not logged in. */
export const getSession = () => {
  return readJsonStorage(AUTH_KEY);
};

/** True when the current user has the admin role. */
export const isAdmin = () => getSession()?.role === 'admin';

// ── Impersonation ─────────────────────────────────────────────────────────────
const IMPERSONATOR_KEY = 'et-impersonator';

/** Start impersonating a user. Saves the current admin session and switches to the target. */
export const startImpersonation = (targetUser) => {
  const adminSession = getSession();
  localStorage.setItem(IMPERSONATOR_KEY, JSON.stringify(adminSession));
  const session = { ...targetUser, loginAt: Date.now(), impersonated: true };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  if (session.token) localStorage.setItem(TOKEN_KEY, session.token);
  return session;
};

/** Stop impersonating and restore the original admin session. */
export const stopImpersonation = () => {
  const adminSession = localStorage.getItem(IMPERSONATOR_KEY);
  localStorage.removeItem(IMPERSONATOR_KEY);
  if (adminSession) {
    localStorage.setItem(AUTH_KEY, adminSession);
    const parsed = JSON.parse(adminSession);
    if (parsed?.token) localStorage.setItem(TOKEN_KEY, parsed.token);
    else localStorage.removeItem(TOKEN_KEY);
    return parsed;
  }
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(TOKEN_KEY);
  return null;
};

/** Return the original admin session if currently impersonating, otherwise null. */
export const getImpersonatorSession = () => {
  return readJsonStorage(IMPERSONATOR_KEY);
};
