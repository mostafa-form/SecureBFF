import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ALLOWED_PATHS = [
  '/api/users',
  '/api/profile',
  '/api/data',
];

export async function POST(request: NextRequest) {
  const jar         = await cookies();
  const accessToken = jar.get('sb_access')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body: { path?: string; method?: string; data?: unknown } =
    await request.json().catch(() => ({}));

  const path   = body.path   ?? '';
  const method = body.method ?? 'GET';
  const data   = body.data;

  const isAllowed = ALLOWED_PATHS.some(
    allowed => path === allowed || path.startsWith(allowed + '/')
  );
  if (!isAllowed) {
    return NextResponse.json(
      { error: `Path not allowed: ${path}` },
      { status: 403 }
    );
  }

  const requestId = crypto.randomUUID();

  const upstream = await fetch(`${process.env.BACKEND_URL}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Request-ID':  requestId,
    },
    body: method !== 'GET' && data !== undefined
      ? JSON.stringify(data)
      : undefined,
  });

  const responseData = await upstream.json().catch(() => ({}));

  return NextResponse.json(responseData, {
    status:  upstream.status,
    headers: { 'X-Request-ID': requestId },
  });
}
