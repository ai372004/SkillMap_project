// Small wrapper around fetch for the Masar API.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';
const TOKEN_KEY = 'masar.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore blocked storage */
  }
}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error || {};
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(
      res.status,
      err.code || (res.status >= 500 ? 'SERVER_ERROR' : 'default'),
      err.message,
      err.details
    );
  }
  return data;
}

/**
 * Downloads a file from the API (sent with the login token) and saves it
 * under the name the server suggests, or `fallbackName`.
 */
export async function apiDownload(path, fallbackName) {
  const token = getToken();
  let res;
  try {
    res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error');
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))).error || {};
    throw new ApiError(res.status, err.code || (res.status >= 500 ? 'SERVER_ERROR' : 'default'), err.message);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Cached public data that rarely changes.
let tracksPromise = null;
export function loadTracks() {
  tracksPromise ??= api('/tracks')
    .then((d) => d.tracks)
    .catch((e) => {
      tracksPromise = null;
      throw e;
    });
  return tracksPromise;
}
