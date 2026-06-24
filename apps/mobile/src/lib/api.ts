import { router } from 'expo-router';
import { storage } from './storage';

export const API_BASE = 'https://mh-datapedia-web.fly.dev';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}

// Single in-flight refresh promise shared across all concurrent 401s.
// All callers that 401 concurrently await the same promise, so we only
// call /api/auth/refresh once.
let refreshPromise: Promise<string> | null = null;

async function refreshToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('refresh failed');
    const { accessToken } = (await res.json()) as { accessToken: string };
    await storage.setToken(accessToken);
    return accessToken;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await storage.getToken();
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    if (path.startsWith('/api/auth/')) {
      await storage.clearToken();
      throw new ApiError(401, null);
    }

    let newToken: string;
    try {
      newToken = await refreshToken();
    } catch {
      await storage.clearToken();
      router.replace('/auth/login');
      throw new ApiError(401, null);
    }

    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set('Content-Type', 'application/json');
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    const retryRes = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: retryHeaders,
      credentials: 'include',
    });
    if (!retryRes.ok) {
      const body = await retryRes.json().catch(() => null);
      throw new ApiError(retryRes.status, body);
    }
    if (retryRes.status === 204) return undefined as T;
    return retryRes.json() as Promise<T>;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' });
}
