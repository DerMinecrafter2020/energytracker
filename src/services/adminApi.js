const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const authToken = () => {
  let token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) {
    try {
      token = JSON.parse(localStorage.getItem('et-session') || '{}')?.token;
    } catch {
      token = null;
    }
  }
  return token;
};
const adminHeaders = (hasBody = true) => ({
  ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  ...(authToken() ? { Authorization: `Bearer ${authToken()}` } : {}),
});
const handle = async (resp) => {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
};
const urlFor = (path, query = {}) => {
  const url = new URL(path, API_BASE);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url.toString();
};
const request = (path, { method = 'GET', body, admin = true } = {}) =>
  fetch(`${API_BASE}${path}`, {
    method,
    headers: admin ? adminHeaders(body !== undefined) : undefined,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(handle);
const requestQuery = (path, query, { admin = true } = {}) =>
  fetch(urlFor(path, query), {
    headers: admin ? adminHeaders(false) : undefined,
  }).then(handle);
const post = (path, body) => request(path, { method: 'POST', body });

export const fetchSmtpConfig = () => request('/api/admin/smtp');
export const saveSmtpConfig = (config) => post('/api/admin/smtp', config);
export const testSmtpConfig = (testEmail) => post('/api/admin/smtp/test', { testEmail });
export const testDiscordWebhook = (webhookUrl) => post('/api/admin/discord/test', { webhookUrl });
export const fetchAiConfig = () => request('/api/admin/ai');
export const saveAiConfig = ({ apiKey, model, braveSearchKey }) =>
  post('/api/admin/ai', { apiKey, model, braveSearchKey });
export const fetchAdminUsers = () => request('/api/admin/users');
export const fetchAdminChatStats = () => request('/api/admin/ai/chat-stats');
export const fetchAdminActivity = () => request('/api/admin/activity');
export const fetchAdminExportLogs = ({ start, end, email } = {}) =>
  requestQuery('/api/admin/export/logs', { start, end, email });
export const verifyAdminUser = (id) => post(`/api/admin/users/${id}/verify`);
export const deleteAdminUser = (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' });
export const setUserRole = (id, role) => post(`/api/admin/users/${id}/role`, { role });
export const createAdminUser = ({ name, email, password, role, verified }) =>
  post('/api/admin/users', { name, email, password, role, verified });
export const impersonateUser = (id) => post(`/api/admin/users/${id}/impersonate`);
export const fetchPublicSettings = () => request('/api/settings/public', { admin: false });
export const fetchRedisHealth = () => request('/api/admin/redis/health');
