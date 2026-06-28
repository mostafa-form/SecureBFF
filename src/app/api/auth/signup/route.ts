import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const upstream = await fetch(`${process.env.BACKEND_URL}/api/auth/signup`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await upstream.json();

  return NextResponse.json(data, {
    status:  upstream.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
