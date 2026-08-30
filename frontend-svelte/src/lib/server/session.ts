// Ported verbatim from frontend/src/shared/auth/session.ts. The HMAC
// algorithm, base64url framing, and timing-safe comparison are NOT changed —
// this is the one file in the whole migration where "close enough" is not
// acceptable, so it is a line-for-line port, not a rewrite. Existing session
// cookies stay valid across the Next.js → SvelteKit cutover as long as
// CONTROL_ROOM_SESSION_SECRET is unchanged.
//
// Unlike the Next.js version, there is no Edge/Node runtime split to work
// around in SvelteKit — hooks.server.ts always runs on full Node under
// adapter-node, so the `node:crypto` import needs no special-casing comment
// here (the original's comment about Next's Edge bundler no longer applies).
import crypto from 'node:crypto';

/** Minimum length for the signing secret. A short/empty key is forgeable. */
export const MIN_SECRET_LEN = 32;

export interface SessionPayload {
	issued_at: number;
	expires_at: number;
	/** Approved device this session was issued to (traceability). */
	device_id?: string;
}

function base64urlEncode(input: string | Buffer): string {
	const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
	return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(input: string): Buffer {
	const padded = input.replace(/-/g, '+').replace(/_/g, '/');
	const pad = padded.length % 4;
	const paddedStr = pad ? padded + '='.repeat(4 - pad) : padded;
	return Buffer.from(paddedStr, 'base64');
}

export function signSession(payload: SessionPayload, secret: string): string {
	const payloadJson = JSON.stringify(payload);
	const encodedPayload = base64urlEncode(payloadJson);
	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(encodedPayload);
	const signature = base64urlEncode(hmac.digest());
	return `${encodedPayload}.${signature}`;
}

export function verifySession(cookie: string, secret: string): SessionPayload | null {
	try {
		// Fail-closed: a missing/short signing key means anyone could forge a
		// cookie. Never accept a session under a weak key.
		if (!secret || secret.length < MIN_SECRET_LEN) return null;

		const parts = cookie.split('.');
		if (parts.length !== 2) return null;

		const [encodedPayload, providedSig] = parts;

		const hmac = crypto.createHmac('sha256', secret);
		hmac.update(encodedPayload);
		const expectedSig = base64urlEncode(hmac.digest());

		const expectedBuf = Buffer.from(expectedSig, 'utf8');
		const providedBuf = Buffer.from(providedSig, 'utf8');

		if (expectedBuf.length !== providedBuf.length) return null;
		if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) return null;

		const payloadJson = base64urlDecode(encodedPayload).toString('utf8');
		const payload: SessionPayload = JSON.parse(payloadJson);

		if (payload.expires_at <= Date.now()) return null;

		return payload;
	} catch {
		return null;
	}
}
