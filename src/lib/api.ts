async function proxyRequest<T = unknown>(
  path: string,
  options: {
    method?:    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?:      unknown;
    returnRaw?: boolean;
  } = {}
): Promise<T> {
  const { method = 'GET', body, returnRaw = false } = options;

  const send = () =>
    fetch('/api/proxy', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ path, method, data: body }),
    });

  let response = await send();

  if (response.status === 401) {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method:      'POST',
      credentials: 'include',
    });

    if (!refreshResponse.ok) {
      throw new Error('Your session has expired. Please log in again.');
    }

    response = await send();
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? `Request failed (${response.status})`);
  }

  return returnRaw ? (response as unknown as T) : response.json();
}

export default proxyRequest;
