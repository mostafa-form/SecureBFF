import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const jar          = await cookies();
  const accessToken  = jar.get('sb_access')?.value;
  const refreshToken = jar.get('sb_refresh')?.value;

  if (accessToken) {
    await fetch(`${process.env.BACKEND_URL}/api/auth/logout`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken ?? null }),
    }).catch(() => {
    });
  }

  jar.delete('sb_access');
  jar.delete('sb_refresh');

  return NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
