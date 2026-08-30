// Ported from frontend/middleware.ts. Behaviour kept 1:1: same public-path
// allowlist, same sliding-renewal rule, same "JSON 401 for /api, redirect for
// pages" split (a 307 auto-followed as POST by fetch() was the original bug
// this avoids — see the source comment this one is adapted from).
//
// One real simplification versus the Next.js version: there is no Edge vs.
// Node runtime split to route around here. Every SvelteKit hook always runs
// on full Node under adapter-node, so `node:crypto` in session.ts just works
// — no `export const runtime = 'nodejs'` escape hatch needed.
import { redirect, type Handle } from '@sveltejs/kit';

import { signSession, verifySession, type SessionPayload } from '$lib/server/session';

const PUBLIC_PATHS = [
	'/login',
	'/api/auth/',
	'/api/health',
	'/manifest.webmanifest',
	'/sw.js',
	'/icon',
	'/apple-icon',
	'/favicon.png',
	'/og-card.png'
];

const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS ?? '72', 10);
const SESSION_LIFETIME_MS = SESSION_EXPIRY_HOURS * 3600 * 1000;

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
		secure: process.env.NODE_ENV === 'production'
	});
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
	if (isPublic) {
		return resolve(event);
	}

	const sessionCookie = event.cookies.get('session');
	const secret = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
	const payload = sessionCookie ? verifySession(sessionCookie, secret) : null;

	if (!payload) {
		event.locals.session = null;
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Session expired', code: 'session_expired' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		// `redirect()` throws — SvelteKit's request pipeline catches it from
		// inside `handle` and turns it into the response, same as it does from
		// a load function. 307 mirrors NextResponse.redirect()'s default; a
		// page navigation is already a GET, so method-preservation is moot.
		redirect(307, '/login');
	}

	event.locals.session = payload;
	applySlidingRenewal(payload, event.cookies, secret);
	return resolve(event);
};
