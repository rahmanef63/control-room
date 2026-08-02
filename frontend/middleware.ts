import { NextRequest, NextResponse } from 'next/server';
import { signSession, verifySession, type SessionPayload } from '@/shared/auth/session';

export const runtime = 'nodejs';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/',
  '/api/health',
  '/manifest.webmanifest',
  '/sw.js',
  '/icon',
  '/apple-icon',
  // Social-share crawlers fetch this unauthenticated; must bypass the login gate
  // or the OpenGraph/Twitter card renders blank.
  '/og-card.png',
];

// Keep in sync with app/api/auth/login/route.ts. 72h = 3 days.
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS ?? '72', 10);
const SESSION_LIFETIME_MS = SESSION_EXPIRY_HOURS * 3600 * 1000;

// Sliding renewal: once a valid session passes the halfway mark of its life,
// re-issue it with a fresh full-length expiry. An actively-used dashboard
// (terminals open, polling every few seconds) therefore never hits the hard
// expiry — the terminal stays reachable until the user explicitly closes it.
// The hard cap only bites after SESSION_EXPIRY_HOURS of *zero* activity.
function applySlidingRenewal(
  payload: SessionPayload,
  response: NextResponse,
  secret: string
): NextResponse {
  const now = Date.now();
  const lifetime = payload.expires_at - payload.issued_at;
  if (lifetime <= 0) return response;
  const halfLife = payload.issued_at + lifetime / 2;
  if (now < halfLife) return response;

  const renewed: SessionPayload = {
    issued_at: now,
    expires_at: now + SESSION_LIFETIME_MS,
    device_id: payload.device_id,
  };
  response.cookies.set('session', signSession(renewed, secret), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_EXPIRY_HOURS * 3600,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

// Synchronous on purpose: under the Node.js middleware runtime an `await` of
// I/O (the device-allowlist read used to live here) widens a request-body
// clone race in Next 15.5 that intermittently throws "Response body object
// should not be disturbed or locked" on body-carrying routes (upload / input /
// state PUT). The live device-allowlist re-check now runs per privileged route
// in requireSession() instead, so revocation still bites immediately without
// any I/O in the hot middleware path. This stays a cheap stateless gate:
// signature + expiry only.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/favicon.ico') {
    const iconUrl = request.nextUrl.clone();
    iconUrl.pathname = '/icon';
    return NextResponse.rewrite(iconUrl);
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublic) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session')?.value;
  const secret = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
  const payload = sessionCookie ? verifySession(sessionCookie, secret) : null;

  if (!payload) {
    // API clients call fetch().json(). A redirect to /login is a 307 that fetch
    // auto-follows AS POST /login — a GET-only page route — which Next answers
    // with a plain-text 405 "Method Not Allowed". response.json() then throws
    // `Unexpected token 'M'`. So API routes get a JSON 401 the client can read;
    // only page navigations redirect to the login screen.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Session expired', code: 'session_expired' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return applySlidingRenewal(payload, NextResponse.next(), secret);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
