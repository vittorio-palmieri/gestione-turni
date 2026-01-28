let memoryToken = null;
const KEY = "token";

export function setToken(token) {
  memoryToken = token;
  try { localStorage.setItem(KEY, token); } catch (e) {}
  try { sessionStorage.setItem(KEY, token); } catch (e) {}
}

export function getToken() {
  if (memoryToken) return memoryToken;

  try {
    const t = sessionStorage.getItem(KEY);
    if (t) { memoryToken = t; return t; }
  } catch (e) {}

  try {
    const t = localStorage.getItem(KEY);
    if (t) { memoryToken = t; return t; }
  } catch (e) {}

  return null;
}

export function clearToken() {
  memoryToken = null;
  try { localStorage.removeItem(KEY); } catch (e) {}
  try { sessionStorage.removeItem(KEY); } catch (e) {}
}

// IMPORTANTE: in Next.js le env pubbliche vanno lette così
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function apiFetch(path, options = {}) {
  if (!BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL mancante su Vercel");

  const tokenOverride = Object.prototype.hasOwnProperty.call(options, "token") ? options.token : undefined;
  const token = tokenOverride === null ? null : (tokenOverride || getToken());

  const headers = {
    ...(options.headers || {})
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });

  // 401: token mancante/scaduto
  if (res.status === 401) {
    clearToken();
    throw new Error("Non autenticato (rifai login)");
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Errore HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;

  return await res.json();
}