import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';
import { API_BASE_URL } from './config';

const API_BASE = API_BASE_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    const detail = typeof body === 'object' && body !== null && 'detail' in body
      ? (body as Record<string, unknown>).detail
      : null;
    const msg = detail !== null
      ? (typeof detail === 'string' ? detail : JSON.stringify(detail))
      : statusText;
    super(msg);
    this.name = 'ApiError';
  }
}

// ---------- Token refresh lock ----------

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ---------- Core fetch wrapper ----------

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip automatic JSON content-type header (e.g. for FormData). */
  skipContentType?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const { body, skipContentType, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {};

  if (!skipContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Merge caller-supplied headers (they win on conflict)
  if (extraHeaders) {
    const entries = extraHeaders instanceof Headers
      ? Array.from(extraHeaders.entries())
      : Array.isArray(extraHeaders)
        ? extraHeaders
        : Object.entries(extraHeaders);

    for (const [k, v] of entries) {
      headers[k] = v;
    }
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Handle 401 — attempt token refresh then retry once
  // Skip refresh/redirect for login requests so the error reaches the caller
  const isLoginRequest = url.includes('/api/auth/login');
  if (res.status === 401 && !isLoginRequest) {
    const refreshed = await tryRefresh();

    if (refreshed) {
      const retryToken = getAccessToken();
      if (retryToken) {
        headers['Authorization'] = `Bearer ${retryToken}`;
      }

      const retryRes = await fetch(url, {
        ...rest,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!retryRes.ok) {
        const retryBody = await retryRes.json().catch(() => null);
        throw new ApiError(retryRes.status, retryRes.statusText, retryBody);
      }

      return retryRes.json() as Promise<T>;
    }

    // Refresh failed — clear auth and redirect
    clearTokens();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized', null);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new ApiError(res.status, res.statusText, errorBody);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ---------- Convenience methods ----------

export const api = {
  get<T>(path: string): Promise<T> {
    return apiFetch<T>(path, { method: 'GET' });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, { method: 'POST', body });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, { method: 'PUT', body });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, { method: 'PATCH', body });
  },

  delete<T>(path: string): Promise<T> {
    return apiFetch<T>(path, { method: 'DELETE' });
  },
};
