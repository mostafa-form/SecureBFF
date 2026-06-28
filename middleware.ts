import { NextRequest, NextResponse } from 'next/server';
import { jwtDecode }                 from 'jwt-decode';
import { COOKIE_OPTIONS, ACCESS_TOKEN_MAX_AGE } from '@/lib/cookies';

// --- Route configuration -----------------------------------------
// Add routes here as the app grows.
// Matching uses startsWith, so '/admin' also covers '/admin/users'.

const PUBLIC_ROUTES   = ['/', '/login', '/signup'];
const ADMIN_ROUTES    = ['/admin'];
const APPROVED_ROUTES = ['/dashboard', '/data-sources', '/settings'];

// Any route not listed above requires basic authentication.
// -----------------------------------------------------------------

interface JwtClaims {
  is_admin:    boolean;
  is_approved: boolean;
  exp:         number;
}

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    r => pathname === r || pathname.startsWith(r + '/')
  );
}

function requiresAdmin(pathname: string): boolean {
  return ADMIN_ROUTES.some(
    r => pathname === r || pathname.startsWith(r + '/')
  );
}

function requiresApproval(pathname: string): boolean {
  return APPROVED_ROUTES.some(
    r => pathname === r || pathname.startsWith(r + '/')
  );
}

async function tryRefresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/auth/refresh`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const accessToken  = request.cookies.get('sb_access')?.value;
  const refreshToken = request.cookies.get('sb_refresh')?.value;

  let token               = accessToken;
  let newlyRefreshedToken = '';

  if (!token && refreshToken) {
    const refreshed = await tryRefresh(refreshToken);

    if (!refreshed) {
      const failResponse = NextResponse.redirect(new URL('/login', request.url));
      failResponse.cookies.delete('sb_refresh');
      return failResponse;
    }

    token               = refreshed;
    newlyRefreshedToken = refreshed;
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let claims: JwtClaims;
  try {
    claims = jwtDecode<JwtClaims>(token);
  } catch {
    const failResponse = NextResponse.redirect(new URL('/login', request.url));
    failResponse.cookies.delete('sb_access');
    failResponse.cookies.delete('sb_refresh');
    return failResponse;
  }

  if (claims.exp * 1000 < Date.now()) {
    if (refreshToken) {
      const refreshed = await tryRefresh(refreshToken);
      if (refreshed) {
        token               = refreshed;
        newlyRefreshedToken = refreshed;
        claims              = jwtDecode<JwtClaims>(token);
      } else {
        const failResponse = NextResponse.redirect(new URL('/login', request.url));
        failResponse.cookies.delete('sb_access');
        failResponse.cookies.delete('sb_refresh');
        return failResponse;
      }
    } else {
      const failResponse = NextResponse.redirect(new URL('/login', request.url));
      failResponse.cookies.delete('sb_access');
      return failResponse;
    }
  }

  if (requiresAdmin(pathname) && !claims.is_admin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (requiresApproval(pathname) && !claims.is_approved && !claims.is_admin) {
    return NextResponse.redirect(new URL('/pending-approval', request.url));
  }

  const response = NextResponse.next();

  if (newlyRefreshedToken) {
    response.cookies.set('sb_access', newlyRefreshedToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
