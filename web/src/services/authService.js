/**
 * Frontend Authentication & Admin Approval API Client
 */

const TOKEN_KEY = 'tb_auth_token_v1';
const USER_KEY = 'tb_auth_user_v1';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

async function parseSafeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: 'Authentication server unavailable. Please ensure API endpoints are deployed.' };
  }
}

export async function loginUser(username, password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username, password }),
  });
  const data = await parseSafeJson(res);
  if (res.ok && data.ok && data.token && data.user) {
    saveSession(data.token, data.user);
  }
  return { httpStatus: res.status, ...data };
}

export async function registerUser(name, username, password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', name, username, password }),
  });
  const data = await parseSafeJson(res);
  return { httpStatus: res.status, ...data };
}

export async function verifySession() {
  const token = getStoredToken();
  if (!token) return { ok: false, error: 'Not signed in' };

  try {
    const res = await fetch('/api/auth', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    const data = await parseSafeJson(res);
    if (res.ok && data.ok && data.user) {
      saveSession(token, data.user);
      return data;
    }
    clearSession();
    return { ok: false, status: data.status, error: data.error || 'Session expired.' };
  } catch {
    return { ok: false, networkError: true, error: 'Unable to reach authentication server.' };
  }
}

export async function fetchAdminUsers() {
  const token = getStoredToken();
  const res = await fetch('/api/admin', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseSafeJson(res);
  return { httpStatus: res.status, ...data };
}

export async function adminAction(action, payload = {}) {
  const token = getStoredToken();
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await parseSafeJson(res);
  return { httpStatus: res.status, ...data };
}
