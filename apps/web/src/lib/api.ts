let _accessToken: string | null = null;
let _refreshCallback: (() => Promise<string | null>) | null = null;
let _isRefreshing = false;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function setRefreshCallback(cb: () => Promise<string | null>): void {
  _refreshCallback = cb;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (_accessToken) headers.set('Authorization', `Bearer ${_accessToken}`);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && _refreshCallback && !_isRefreshing) {
    _isRefreshing = true;
    try {
      const newToken = await _refreshCallback();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
      }
    } finally {
      _isRefreshing = false;
    }
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(path);
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetchWithAuth(path, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
}
