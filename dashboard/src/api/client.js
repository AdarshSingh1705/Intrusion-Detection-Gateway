const BASE = '';  // Vite proxies /api and /auth to gateway:8080

function authHeaders() {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });

  // On 401, attempt a silent token refresh once then retry
  if (res.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const { accessToken, refreshToken: newRefreshToken } = await refreshRes.json();
        localStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        // Retry original request with new token
        const retry = await fetch(`${BASE}${path}`, {
          ...options,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...options.headers },
        });
        if (!retry.ok) throw new Error(`${retry.status} ${retry.statusText}`);
        const text = await retry.text();
        return text ? JSON.parse(text) : null;
      }
    }
    // Refresh failed or no token — clear session and redirect to login
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    return;
  }

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Auth
export async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data;
}

export function logout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function isLoggedIn() {
  return !!localStorage.getItem('accessToken');
}

// Events
export async function getEvents(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/events${qs ? '?' + qs : ''}`);
}

export async function getEventsByIp(ip) {
  return request(`/api/events/ip/${encodeURIComponent(ip)}`);
}

// Alerts
export async function getAlerts(acknowledged = false) {
  return request(`/api/alerts?acknowledged=${acknowledged}`);
}

export async function acknowledgeAlert(id) {
  return request(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' });
}

// Blocklist
export async function getActiveBlocklist() {
  return request('/api/blocklist');
}

export async function checkIpBlocked(ip) {
  return request(`/api/blocklist/${encodeURIComponent(ip)}`);
}

export async function blockIp(ip) {
  return request(`/api/blocklist/${encodeURIComponent(ip)}`, { method: 'POST' });
}

export async function unblockIp(ip) {
  return request(`/api/blocklist/${encodeURIComponent(ip)}`, { method: 'DELETE' });
}

// Tenants
export async function getTenant(tenantId) {
  return request(`/api/tenants/${tenantId}`);
}

export async function updateThresholds(tenantId, thresholds) {
  return request(`/api/tenants/${tenantId}/thresholds`, {
    method: 'PATCH',
    body: JSON.stringify(thresholds),
  });
}
