const API_BASE = "";

const store = {
  token: localStorage.getItem("authToken"),
  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem("authToken", t); else localStorage.removeItem("authToken");
  }
};

async function apiRequest(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  if (store.token) headers["Authorization"] = `Bearer ${store.token}`;
  const resp = await fetch(API_BASE + path, { ...options, headers });
  if (resp.status === 401) {
    store.setToken(null);
    location.hash = "#/login";
    throw new Error("未认证或会话过期");
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.message || resp.statusText);
  }
  if (resp.status === 204) return null;
  return resp.json();
}
