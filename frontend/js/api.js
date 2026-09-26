// REST client for the SmartLib backend.
// When the frontend is served by the Express server the API is same-origin.
// When opened from a separate static server (e.g. VS Code Live Server on :5500)
// it falls back to http://localhost:5000. Override with localStorage 'smartlib-api'.
function apiOrigin() {
  try {
    const custom = localStorage.getItem('smartlib-api');
    if (custom) return custom;
  } catch {
    /* storage unavailable */
  }
  if (location.protocol === 'file:' || ['5500', '5501', '8080', '3000'].includes(location.port)) return 'http://localhost:5000';
  return '';
}

export const API_BASE = `${apiOrigin().replace(/\/$/, '')}/api`;

const TOKEN_KEY = 'smartlib-token';
const USER_KEY = 'smartlib-user';

export const session = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function qs(params) {
  if (!params) return '';
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.append(k, v);
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

async function request(method, path, { body, params } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}${qs(params)}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Cannot reach the SmartLib server. Is the backend running?', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      session.clear();
      const here = location.pathname.split('/').pop() || 'index.html';
      if (here !== 'index.html') location.href = `index.html?next=${encodeURIComponent(here + location.search)}&expired=1`;
    }
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data?.details);
  }
  return data;
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body: body ?? {} }),
  patch: (path, body) => request('PATCH', path, { body: body ?? {} }),
  del: (path) => request('DELETE', path),
};
