const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const stripTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const isLocalHost = (hostname) => LOCAL_HOSTS.has(String(hostname || '').toLowerCase());

export const resolveApiBase = () => {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const configured = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL);
  if (!configured) return browserOrigin;

  try {
    const configuredUrl = new URL(configured, browserOrigin || 'http://localhost:3001');
    const browserUrl = browserOrigin ? new URL(browserOrigin) : null;
    if (browserUrl && isLocalHost(configuredUrl.hostname) && !isLocalHost(browserUrl.hostname)) {
      return browserOrigin;
    }
    return configuredUrl.origin;
  } catch {
    return browserOrigin;
  }
};

export const API_BASE = resolveApiBase();
