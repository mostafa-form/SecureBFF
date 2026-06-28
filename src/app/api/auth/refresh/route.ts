import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_OPTIONS, ACCESS_TOKEN_MAX_AGE } from '@/lib/cookies';

export async function POST(request: NextRequest) {
  const jar          = await cookies();
  const refreshToken = jar.get('sb_refresh')?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token' },
      {
        status:  401,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const upstream = await fetch(`${process.env.BACKEND_URL}/api/auth/refresh`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${refreshToken}` },
  });

  if (!upstream.ok) {
    jar.delete('sb_access');
    jar.delete('sb_refresh');

    return NextResponse.json(
      { error: 'Session expired. Please log in again.' },
      {
        status:  401,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const data = await upstream.json();

  jar.set('sb_access', data.access_token, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  return NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
