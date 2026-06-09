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

// Multipart variant for file uploads. Sends FormData (no Content-Type so the browser sets the
// multipart boundary) with the admin password header.
async function requestForm(path, { method = 'POST', form } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'x-admin-password': getStoredPassword() },
    body: form,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
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
export const getTomorrowCard = () => request('/admin/cards/tomorrow', { admin: true });
export const generateTomorrowCard = () =>
  request('/admin/cards/generate-tomorrow', { method: 'POST', admin: true });
export const regenerateMessage = (date) =>
  request(`/admin/cards/${date}/regenerate-message`, { method: 'POST', admin: true });
export const regenerateImage = (date) =>
  request(`/admin/cards/${date}/regenerate-image`, { method: 'POST', admin: true });
export const sendTestNotification = () =>
  request('/admin/notifications/test', { method: 'POST', admin: true });

export const getSchedules = () => request('/admin/schedules', { admin: true });
export const createSchedule = (schedule) =>
  request('/admin/schedules', { method: 'POST', body: schedule, admin: true });
export const updateSchedule = (id, schedule) =>
  request(`/admin/schedules/${id}`, { method: 'PUT', body: schedule, admin: true });
export const deleteSchedule = (id) =>
  request(`/admin/schedules/${id}`, { method: 'DELETE', admin: true });

export const getDevices = () => request('/admin/devices', { admin: true });
export const setDeviceActive = (id, active) =>
  request(`/admin/devices/${id}`, { method: 'PATCH', body: { active }, admin: true });
export const deleteDevice = (id) =>
  request(`/admin/devices/${id}`, { method: 'DELETE', admin: true });

// Personalities + tones (admin)
export const getPersonalities = () => request('/admin/personalities', { admin: true });
export const addPersonality = (name) =>
  request('/admin/personalities', { method: 'POST', body: { name }, admin: true });
export const deletePersonality = (id) =>
  request(`/admin/personalities/${id}`, { method: 'DELETE', admin: true });

export const getTones = () => request('/admin/tones', { admin: true });
export const addTone = (label) =>
  request('/admin/tones', { method: 'POST', body: { label }, admin: true });
export const deleteTone = (id) =>
  request(`/admin/tones/${id}`, { method: 'DELETE', admin: true });

// Memories (admin write; create/update are multipart for the optional image)
export const createMemory = (form) => requestForm('/admin/memories', { method: 'POST', form });
export const updateMemory = (id, form) =>
  requestForm(`/admin/memories/${id}`, { method: 'PUT', form });
export const deleteMemory = (id) =>
  request(`/admin/memories/${id}`, { method: 'DELETE', admin: true });

// Public push endpoints (no admin header).
export const getVapidPublicKey = () => request('/push/vapid-public-key');
export const registerPush = (body) => request('/push/register', { method: 'POST', body });
