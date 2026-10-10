const TOKEN_KEY = 'sb_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body, admin = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (admin && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (admin && res.status === 401) {
      setToken(null);
      window.dispatchEvent(new Event('sb-logout'));
    }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
