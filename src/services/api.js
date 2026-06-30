const TOKEN_KEY = 'watchnext_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req(path, { method = 'GET', body, auth = true, keepalive = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    keepalive, // lets the write survive a tab close / navigation
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  signup: (email, password, name) =>
    req('/auth/signup', { method: 'POST', body: { email, password, name }, auth: false }),
  login: (email, password) =>
    req('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => req('/auth/me'),
  getState: () => req('/state'),
  putState: (state, { keepalive = false } = {}) =>
    req('/state', { method: 'PUT', body: { state }, keepalive }),
};
