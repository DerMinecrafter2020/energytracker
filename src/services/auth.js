const AUTH_KEY = 'et-session';

// Credentials from env or fallback defaults
const ADMIN_EMAIL    = import.meta.env.VITE_ADMIN_EMAIL    || 'admin@energytracker.de';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'Admin@2024!';
const USER_EMAIL     = import.meta.env.VITE_USER_EMAIL     || 'user@energytracker.de';
const USER_PASSWORD  = import.meta.env.VITE_USER_PASSWORD  || 'User@2024!';

const BUILTIN_USERS = [
  { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin', name: 'Administrator' },
  { email: USER_EMAIL,  password: USER_PASSWORD,  role: 'user',  name: 'Benutzer'       },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

/**
 * Attempt login. Checks built-in credentials first, then server-registered users.
 * Returns session object on success, throws on failure.
 */
export const login = async (email, password) => {
  const trimmed = email.trim().toLowerCase();

  // 1. Check built-in admin/user credentials
  const builtin = BUILTIN_USERS.find(
    (u) => u.email.toLowerCase() === trimmed && u.password === password
  );
  if (builtin) {
    const session = {
      email:   builtin.email,
      role:    builtin.role,
      name:    builtin.name,
      loginAt: Date.now(),
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    return session;
  }

  // 2. Check server-registered users
  const resp = await fetch(`${API_BASE}/api/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: trimmed, password }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Anmeldung fehlgeschlagen.');

  const session = { ...data.user, loginAt: Date.now() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return session;
};

/** Clear the stored session. */
export const logout = () => {
  localStorage.removeItem(AUTH_KEY);
};

/** Return current session object, or null if not logged in. */
export const getSession = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** True when the current user has the admin role. */
export const isAdmin = () => getSession()?.role === 'admin';

