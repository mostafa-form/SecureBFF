import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const jar         = await cookies();
  const accessToken = jar.get('sb_access')?.value;

  if (!accessToken) {
    return NextResponse.json(
      { user: null },
      {
        status:  401,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const upstream = await fetch(`${process.env.BACKEND_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!upstream.ok) {
    jar.delete('sb_access');
    jar.delete('sb_refresh');

    return NextResponse.json(
      { user: null },
      {
        status:  401,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const data = await upstream.json();

  return NextResponse.json(
    { user: data },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
