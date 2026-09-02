import { randomUUID } from 'node:crypto';

import { redirect, type Handle } from '@sveltejs/kit';

import { isApproved } from '$lib/server/device-store';
import { signSession, verifySession, type SessionPayload } from '$lib/server/session';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/',
  '/api/health',
  '/api/version',
  '/manifest.webmanifest',
  '/icon',
  '/apple-icon',
  '/favicon.png',
  '/og-card.png'
];

const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS ?? '72', 10);
const SESSION_LIFETIME_MS = SESSION_EXPIRY_HOURS * 3600 * 1000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function applySlidingRenewal(
  payload: SessionPayload,
  cookies: import('@sveltejs/kit').Cookies,
  secret: string
): void {
  const now = Date.now();
  const lifetime = payload.expires_at - payload.issued_at;
  if (lifetime <= 0) return;
  const halfLife = payload.issued_at + lifetime / 2;
  if (now < halfLife) return;

  const renewed: SessionPayload = {
    issued_at: now,
    expires_at: now + SESSION_LIFETIME_MS,
    device_id: payload.device_id
  };
  cookies.set('session', signSession(renewed, secret), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_EXPIRY_HOURS * 3600,
    secure: IS_PRODUCTION
  });
}

function hardenResponse(response: Response, requestId: string, durationMs: number): Response {
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('Server-Timing', `app;dur=${Math.max(0, durationMs).toFixed(1)}`);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  if (IS_PRODUCTION) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  }
  if (response.headers.get('content-type')?.includes('text/html')) {
    response.headers.set('Cache-Control', 'no-cache');
  }
  return response;
}

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  const requestId = event.request.headers.get('x-request-id')?.slice(0, 128) || randomUUID();
  const startedAt = performance.now();
  event.locals.requestId = requestId;

  const resolveHardened = async (): Promise<Response> => hardenResponse(await resolve(event), requestId, performance.now() - startedAt);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return resolveHardened();

  const sessionCookie = event.cookies.get('session');
  const secret = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
  const payload = sessionCookie ? verifySession(sessionCookie, secret) : null;
  const deviceApproved = payload ? !payload.device_id || (await isApproved(payload.device_id)) : false;

  if (!payload || !deviceApproved) {
    event.locals.session = null;
    if (pathname.startsWith('/api/')) {
      return hardenResponse(
        new Response(JSON.stringify({ error: 'Session expired', code: 'session_expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }),
        requestId,
        performance.now() - startedAt
      );
    }
    redirect(307, '/login');
  }

  event.locals.session = payload;
  applySlidingRenewal(payload, event.cookies, secret);
  return resolveHardened();
};
