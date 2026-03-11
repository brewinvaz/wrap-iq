const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Decode a JWT payload without verification (client-side only).
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Returns the expiry timestamp (seconds since epoch) from a JWT, or null
 * if the token is missing, malformed, or has no `exp` claim.
 */
export function getTokenExpiry(token: string | null): number | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp;
}

/**
 * Returns true if the given JWT is expired (or missing/malformed).
 */
function isTokenExpired(token: string | null): boolean {
  const exp = getTokenExpiry(token);
  if (exp === null) return true;
  // Compare against current time in seconds
  return Date.now() / 1000 >= exp;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh?: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Remove tokens from storage if the access token is expired.
 * Call on app initialisation to avoid holding stale credentials.
 */
export function clearExpiredTokens(): void {
  if (typeof window === 'undefined') return;
  const token = getAccessToken();
  if (token && isTokenExpired(token)) {
    clearTokens();
  }
}

/**
 * Returns true only when a non-expired access token is present.
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  return !isTokenExpired(token);
}
