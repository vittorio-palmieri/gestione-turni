export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}
export function setToken(t) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); }

export async function apiFetch(path, { method='GET', body=null, token=null } = {}) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const headers = { 'Content-Type': 'application/json' };
  const t = token || getToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const data = await res.json(); msg = data?.detail || msg; } catch {}
    throw new Error(msg);
  }
  return await res.json();
}
