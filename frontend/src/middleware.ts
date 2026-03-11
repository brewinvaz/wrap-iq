import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Lightweight server-side auth guard.
 *
 * Checks for an access token (cookie or Authorization header) and redirects
 * unauthenticated users away from protected /dashboard/* routes to /login.
 *
 * NOTE: This does NOT verify the JWT signature — that is the backend's job.
 * It only checks for token presence and a non-expired `exp` claim to avoid
 * sending obviously-stale sessions to protected pages.
 */
export function middleware(request: NextRequest) {
  const token =
    request.cookies.get('access_token')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    null;

  const isExpired = token ? tokenIsExpired(token) : true;

  if (!token || isExpired) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Decode the JWT payload and check the `exp` claim.
 * Returns true if the token is malformed or expired.
 */
function tokenIsExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp !== 'number') return true;
    return Date.now() / 1000 >= payload.exp;
  } catch {
    return true;
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
