import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_OPTIONS, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from '@/lib/cookies';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`login:${ip}`, 5, 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Wait a minute and try again.' },
      {
        status:  429,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const body = await request.json();

  const upstream = await fetch(`${process.env.BACKEND_URL}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(data, {
      status:  upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const jar = await cookies();
  jar.set('sb_access',  data.access_token,  { ...COOKIE_OPTIONS, maxAge: ACCESS_TOKEN_MAX_AGE  });
  jar.set('sb_refresh', data.refresh_token, { ...COOKIE_OPTIONS, maxAge: REFRESH_TOKEN_MAX_AGE });

  return NextResponse.json(
    { user: data.user },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
