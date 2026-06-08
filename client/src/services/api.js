// Tiny fetch wrapper around the backend API.
// Admin requests attach the password (kept in localStorage for dev convenience).

const PASSWORD_KEY = 'bg_admin_password';

export function getStoredPassword() {
  return localStorage.getItem(PASSWORD_KEY) || '';
}

export function setStoredPassword(password) {
  if (password) localStorage.setItem(PASSWORD_KEY, password);
  else localStorage.removeItem(PASSWORD_KEY);
}

async function request(path, { method = 'GET', body, admin = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) headers['x-admin-password'] = getStoredPassword();

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response; leave data null
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Public
export const getToday = () => request('/today');
export const getHistory = () => request('/history');
export const getMemories = () => request('/memories');

// Admin
export const getSettings = () => request('/admin/settings', { admin: true });
export const updateSettings = (settings) =>
  request('/admin/settings', { method: 'PUT', body: settings, admin: true });
export const generateTodayCard = () =>
  request('/admin/cards/generate-today', { method: 'POST', admin: true });
export const getSchedules = () => request('/admin/schedules', { admin: true });
export const getDevices = () => request('/admin/devices', { admin: true });
