# SecureBFF

SecureBFF is a reference implementation of the Backend-for-Frontend (BFF) authentication pattern using Next.js 14 and Flask. It demonstrates how to keep JWTs out of the browser entirely using HTTP-only cookies and a server-side proxy.

The browser never holds a token and never contacts the backend directly. All authentication and authorization is centralized in the Next.js layer, making it a single point of enforcement.

This project is intended for learning and portfolio purposes. It prioritizes clean architecture and security over production completeness.

## What This Project Demonstrates

- Backend-for-Frontend architecture
- HTTP-only cookie authentication
- Secure proxy pattern
- Edge Middleware authorization
- Role-based access control
- Silent access-token refresh
- Token revocation
- Authentication state management
- Security hardening

## Architecture

```
Browser                  Next.js (BFF)               Flask
   |                          |                          |
   |  POST /api/auth/login    |                          |
   |------------------------->|                          |
   |                          |  POST /api/auth/login    |
   |                          |------------------------->|
   |                          |  { access_token, user }  |
   |                          |<-------------------------|
   |  Set-Cookie: sb_access   |                          |
   |<-------------------------|                          |
   |                          |                          |
   |  POST /api/proxy         |                          |
   |  (no token in request)   |                          |
   |------------------------->|                          |
   |                          |  GET /api/data           |
   |                          |  Authorization: Bearer   |
   |                          |------------------------->|
   |                          |  { data }                |
   |                          |<-------------------------|
   |  { data }                |                          |
   |<-------------------------|                          |
```

The browser never receives JWTs as raw values. It never contacts Flask directly. The Next.js layer becomes the authentication boundary — all cookie handling, token injection, and authorization decisions happen there.

## Authentication Flow

### Login

```
Browser          Next.js            Flask
   |                |                  |
   |  POST /login   |                  |
   |--------------->|                  |
   |                |  POST /auth      |
   |                |  /login          |
   |                |----------------->|
   |                |  { access,       |
   |                |    refresh,      |
   |                |    user }        |
   |                |<-----------------|
   |  Set-Cookie:   |                  |
   |  sb_access     |                  |
   |  sb_refresh    |                  |
   |<---------------|                  |
   |  { user }      |                  |
   |<---------------|                  |
```

On success the Next.js route handler stores both tokens as HTTP-only cookies and returns only the user object to the browser. The browser never sees the raw tokens.

### Authenticated API Request

```
Browser          Next.js              Flask
   |                |                    |
   |  proxyRequest  |                    |
   |  ('/api/data') |                    |
   |--------------->|                    |
   |                |  GET /api/data     |
   |                |  Authorization:    |
   |                |  Bearer <token>    |
   |                |-------------------->
   |                |  { data }          |
   |                |<--------------------|
   |  { data }      |                    |
   |<---------------|                    |
```

The browser sends a POST to `/api/proxy` with the desired backend path. The proxy reads the access token from the cookie, injects it as an Authorization header, and forwards the request to Flask. The backend URL is never exposed to the browser.

### Expired Access Token

```
Browser          Next.js              Flask
   |                |                    |
   |  proxyRequest  |                    |
   |  401            |                    |
   |<---------------|                    |
   |  POST /refresh |                    |
   |--------------->|                    |
   |  { success }   |                    |
   |  + Set-Cookie  |                    |
   |<---------------|                    |
   |  proxyRequest  |                    |
   |  (retry)       |                    |
   |--------------->|  200               |
   |<---------------|--------------------|
```

When the proxy returns 401, `proxyRequest()` silently calls `/api/auth/refresh`. If the refresh token is still valid, the access token is renewed and stored as a cookie. The original request is then retried once. The browser experiences no interruption.

## Repository Structure

```
src/
  app/
    api/
      auth/     Next.js route handlers for login, signup, logout, refresh, me
      proxy/    Single proxy endpoint for all authenticated backend requests
  context/      React context for authentication state
  hooks/        useAuth consumer with derived role helpers
  lib/          Cookie config, rate limiter, proxyRequest client
middleware.ts   Edge Middleware for route protection and silent refresh
backend/
  app.py        Flask application entry point
  auth/
    models.py   User model with password hashing
    tokens.py   Token creation
    routes.py   Authentication API endpoints
    decorators.py  Role-based access control decorators
```

Authentication responsibilities are intentionally separated across layers: Edge Middleware handles navigation decisions, Next.js route handlers manage cookies and forward credentials, Flask performs cryptographic verification and token issuance.

## Key Features

| Feature | Description |
|---------|-------------|
| BFF authentication | Next.js acts as a dedicated backend for the browser, hiding the real backend |
| HTTP-only cookies | Tokens are stored as cookies that JavaScript cannot read |
| Secure proxy | A single proxy route injects the Authorization header so the browser never handles JWTs |
| Edge Middleware | Route-level authorization runs before React renders any page |
| Role-based authorization | Admin and approval checks are enforced by Flask decorators and middleware redirects |
| Automatic refresh | When an access token expires, the client refreshes it silently and retries the request |
| Logout revocation | Both the access token and refresh token are revoked server-side on logout |
| Proxy allowlist | Only explicitly configured backend paths can be proxied |
| Security headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS |
| Request tracing | X-Request-ID is generated by the proxy and forwarded to Flask for correlated logging |

## Security Features

| Feature | What It Prevents |
|---------|------------------|
| HTTP-only cookies | XSS token theft — JavaScript cannot read the token |
| SameSite=Lax | Most CSRF attacks |
| Backend URL hidden by proxy | Browser cannot probe the backend directly |
| Path allowlist on proxy | Proxy cannot be abused to reach arbitrary endpoints |
| Access token revocation on logout | Using a captured token after the user logs out |
| Refresh token revocation on logout | Re-authenticating with the refresh token after logout |
| Rate limiting on /api/auth/login | Brute-force password attacks |
| Security headers | Clickjacking, MIME sniffing |
| Cache-Control: no-store on auth routes | Tokens cached in browser history or by a proxy |
| X-Request-ID forwarded to Flask | Untraceable failures across the two services |

## Architecture Decisions

### Why Backend-for-Frontend?

The BFF pattern hides the real backend URL and authentication mechanism from the browser. The browser never receives a JWT as a raw value, never decides where to send it, and never manages token expiry on its own. Authentication and authorization are centralized in the Next.js layer, reducing the attack surface to a single controlled point. If a vulnerability exists in a client component, the tokens remain inaccessible in HTTP-only cookies.

### Why HTTP-only Cookies?

Storing tokens in HTTP-only cookies prevents JavaScript from reading them via `document.cookie` or any other DOM API. An XSS vulnerability in a React component cannot leak tokens because the browser enforces the HTTP-only restriction. The cookie is automatically sent with every fetch to the same origin, so the application never needs to attach an Authorization header from client code.

### Why Edge Middleware?

Edge Middleware runs before a page is rendered, making it the correct place for navigation decisions. If a user visits `/admin` without being an admin, the middleware redirects them before any React code executes. This prevents a flash of an unauthorized page and avoids an unnecessary round trip to check permissions on the client.

### Why jwt-decode Without Signature Verification?

Middleware uses `jwt-decode` to read the JWT payload without verifying the signature. This is intentional. Middleware only decides where to redirect the user — a navigation concern. It never grants access to backend data. Flask verifies the signature cryptographically on every backend request. That is the security enforcement layer. Verifying signatures in middleware would duplicate Flask's responsibility across two runtimes and add latency to every page navigation.

### Why a Proxy Layer?

The proxy route at `/api/proxy` is the only way authenticated client code communicates with the backend. It injects the Authorization header from the HTTP-only cookie, enforces a path allowlist, and returns the response. The browser never knows the backend URL and has no way to bypass the proxy to send an unauthenticated request directly to Flask.

### Why Not Refresh Token Rotation?

This implementation does not rotate refresh tokens. A stolen refresh token remains valid for 30 days. Production systems should issue a new refresh token on every refresh and track token families to detect reuse. This project documents the trade-off rather than hiding it.

## Request Tracing

Every proxied request generates a unique `X-Request-ID` using `crypto.randomUUID()` inside the Next.js proxy route. This ID is forwarded to Flask as an HTTP header and stored in Flask's `g.request_id` object. Both services include the ID in their log lines. When a failure occurs, searching both logs for the same ID traces the complete request path across the two services.

## Custom Authorization Decorators

Flask route handlers use custom decorators to enforce role-based access control instead of repeating identity checks inline.

`@admin_required` rejects requests where `is_admin` is false with HTTP 403. `@approved_required` rejects requests where neither `is_approved` nor `is_admin` is true. This keeps authorization centralized and avoids duplicated logic across routes.

## Proxy Allowlist

The proxy route maintains an `ALLOWED_PATHS` array that specifies which backend paths can be forwarded. Requests to paths not in this list receive HTTP 403. This prevents the proxy from being used as an open relay to reach arbitrary endpoints, even if a client component is compromised or a malicious actor discovers the proxy URL.

## Usage

```typescript
import proxyRequest from '@/lib/api';

const users = await proxyRequest<User[]>('/api/users');

await proxyRequest('/api/profile', {
  method: 'POST',
  body:   { bio: 'Hello' },
});
```

## Setup

### Backend

```bash
cd backend
source venv/bin/activate
python app.py
```

The Flask server starts on `http://localhost:5000`.

### Frontend

```bash
npm run dev
```

The Next.js app starts on `http://localhost:3000`.

## Known Limitations

- `MemoryRateLimiter` resets on server restart and does not work across multiple server instances. Production fix: Upstash Redis.
- Token blocklist is in-memory with the same limitation.
- No refresh token rotation. A stolen refresh token is valid for 30 days. Production fix: issue a new refresh token on every refresh and track families.
- JWT claims become stale after a role change until the 15-minute access token expires. Production fix: reduce TTL or re-read roles from the database on sensitive routes.

## Future Improvements

- Redis for token blocklist and rate limiter
- Refresh token rotation with reuse detection
- Docker Compose for one-command startup
- Catch-all proxy route that preserves HTTP methods natively
- End-to-end tests with Playwright

## Project Goals

This project prioritizes clean architecture, security, separation of responsibilities, readability, and educational value over production completeness. Every layer has a single responsibility: middleware navigates, routes handle cookies, the proxy forwards requests, Flask issues and verifies tokens. The trade-offs are documented as known limitations rather than hidden.
