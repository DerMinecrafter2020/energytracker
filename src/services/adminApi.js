const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'et-admin-2024';

const adminHeaders = () => ({ 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_SECRET });
const handle = async (resp) => {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
};
const request = (path, { method = 'GET', body, admin = true } = {}) =>
  fetch(`${API_BASE}${path}`, {
    method,
    headers: admin ? adminHeaders() : undefined,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
export const verifyAdminUser = (id) => post(`/api/admin/users/${id}/verify`);
export const deleteAdminUser = (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' });
export const setUserRole = (id, role) => post(`/api/admin/users/${id}/role`, { role });
export const createAdminUser = ({ name, email, password, role, verified }) =>
  post('/api/admin/users', { name, email, password, role, verified });
export const impersonateUser = (id) => post(`/api/admin/users/${id}/impersonate`);
export const fetchPublicSettings = () => request('/api/settings/public', { admin: false });
export const fetchRedisHealth = () => request('/api/admin/redis/health');
