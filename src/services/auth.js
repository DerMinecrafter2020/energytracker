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

const getStorageItem = (key) => {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
};

const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return;
  } catch {
  }

  try {
    sessionStorage.setItem(key, value);
  } catch {
  }
};

const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
  }
};

const decodeSessionFromToken = (token) => {
  try {
    const [payload] = String(token || '').split('.');
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const data = JSON.parse(atob(padded));
    if (!data?.email || !data?.sub || (data.exp && Date.now() > Number(data.exp))) return null;
    return {
      id: String(data.sub),
      name: data.name || data.email,
      email: String(data.email).toLowerCase(),
      role: data.role === 'admin' ? 'admin' : 'user',
      token,
      loginAt: Number(data.iat || Date.now()),
    };
  } catch {
    return null;
  }
};

const normalizeSession = (session) => {
  if (!session || typeof session !== 'object') return null;
  const token = session.token || getStorageItem(TOKEN_KEY);
  const tokenSession = decodeSessionFromToken(token);
  if (!session.email || !token) return null;
  if (!tokenSession) return null;
  return {
    ...tokenSession,
    ...session,
    email: String(session.email).toLowerCase(),
    role: session.role === 'admin' ? 'admin' : 'user',
    token,
  };
};

export const saveSession = (user) => {
  if (!user || typeof user !== 'object') return null;
  const { password, ...safeUser } = user;
  const session = normalizeSession({ ...safeUser, loginAt: Date.now() });
  if (!session) return null;
  setStorageItem(AUTH_KEY, JSON.stringify(session));
  setStorageItem(TOKEN_KEY, session.token);
  return session;
};

const readJsonStorage = (key) => {
  try {
    const raw = getStorageItem(key);
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
  removeStorageItem(AUTH_KEY);
  removeStorageItem(TOKEN_KEY);
};

/** Return current session object, or null if not logged in. */
export const getSession = () => {
  const session = normalizeSession(readJsonStorage(AUTH_KEY));
  if (session) {
    setStorageItem(AUTH_KEY, JSON.stringify(session));
    setStorageItem(TOKEN_KEY, session.token);
    return session;
  }

  const restored = decodeSessionFromToken(getStorageItem(TOKEN_KEY));
  if (!restored) {
    logout();
    return null;
  }

  setStorageItem(AUTH_KEY, JSON.stringify(restored));
  return restored;
};

/** True when the current user has the admin role. */
export const isAdmin = () => getSession()?.role === 'admin';

// ── Impersonation ─────────────────────────────────────────────────────────────
const IMPERSONATOR_KEY = 'et-impersonator';

/** Start impersonating a user. Saves the current admin session and switches to the target. */
export const startImpersonation = (targetUser) => {
  const adminSession = getSession();
  setStorageItem(IMPERSONATOR_KEY, JSON.stringify(adminSession));
  const session = saveSession({ ...targetUser, impersonated: true });
  return session;
};

/** Stop impersonating and restore the original admin session. */
export const stopImpersonation = () => {
  const adminSession = getStorageItem(IMPERSONATOR_KEY);
  removeStorageItem(IMPERSONATOR_KEY);
  if (adminSession) {
    const parsed = JSON.parse(adminSession);
    return saveSession(parsed);
  }
  removeStorageItem(AUTH_KEY);
  removeStorageItem(TOKEN_KEY);
  return null;
};

/** Return the original admin session if currently impersonating, otherwise null. */
export const getImpersonatorSession = () => {
  return readJsonStorage(IMPERSONATOR_KEY);
};
