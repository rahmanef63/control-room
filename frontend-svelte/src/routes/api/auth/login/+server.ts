// Ported from frontend/app/api/auth/login/route.ts. Rate limiting, the
// two-factor (password + approved device) flow, and every status code
// (400/401/403/429/500) are kept identical so the login +page.svelte's
// response handling ports over unchanged.
import crypto from 'node:crypto';

import { json, type RequestHandler } from '@sveltejs/kit';

import {
	approveDevice,
	isApproved,
	isValidDeviceId,
	recordPending,
	touchApproved
} from '$lib/server/device-store';
import { MIN_SECRET_LEN, signSession, type SessionPayload } from '$lib/server/session';

interface RateLimitEntry {
	count: number;
	reset_at: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;
const MAX_TRACKED_IPS = 1024;
const GLOBAL_MAX_ATTEMPTS = 30;

let globalWindowStart = Date.now();
let globalAttempts = 0;

const CONTROL_ROOM_SECRET = process.env.CONTROL_ROOM_SECRET ?? '';
const CONTROL_ROOM_SESSION_SECRET = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS ?? '72', 10);
const LOCAL_TRUST_DEVICES = process.env.CONTROL_ROOM_LOCAL_TRUST === '1';

function checkRateLimit(ip: string): boolean {
	const now = Date.now();

	if (now - globalWindowStart > WINDOW_MS) {
		globalWindowStart = now;
		globalAttempts = 0;
	}
	globalAttempts += 1;
	if (globalAttempts > GLOBAL_MAX_ATTEMPTS) {
		return false;
	}

	if (rateLimitMap.size > MAX_TRACKED_IPS) {
		for (const [key, value] of rateLimitMap) {
			if (now > value.reset_at) rateLimitMap.delete(key);
		}
		if (rateLimitMap.size > MAX_TRACKED_IPS) rateLimitMap.clear();
	}

	const entry = rateLimitMap.get(ip);
	if (!entry || now > entry.reset_at) {
		rateLimitMap.set(ip, { count: 1, reset_at: now + WINDOW_MS });
		return true;
	}
	if (entry.count >= MAX_ATTEMPTS) {
		return false;
	}
	entry.count += 1;
	return true;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	if (CONTROL_ROOM_SESSION_SECRET.length < MIN_SECRET_LEN) {
		return json({ error: 'Server auth is not configured' }, { status: 500 });
	}

	const ip =
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		request.headers.get('x-real-ip') ??
		getClientAddress();

	if (!checkRateLimit(ip)) {
		return json({ error: 'Too many attempts, try again later' }, { status: 429 });
	}

	let body: { secret?: string; deviceId?: string; deviceLabel?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { secret, deviceId, deviceLabel } = body;
	if (typeof secret !== 'string' || secret.length === 0) {
		return json({ error: 'Secret is required' }, { status: 400 });
	}
	if (!isValidDeviceId(deviceId)) {
		return json({ error: 'Missing or invalid device id' }, { status: 400 });
	}
	const label = typeof deviceLabel === 'string' ? deviceLabel.slice(0, 80) : 'unknown device';

	const secretBuf = Buffer.from(CONTROL_ROOM_SECRET, 'utf8');
	const providedBuf = Buffer.from(secret, 'utf8');

	let valid = false;
	if (secretBuf.length === providedBuf.length) {
		valid = crypto.timingSafeEqual(secretBuf, providedBuf);
	} else {
		crypto.timingSafeEqual(secretBuf, secretBuf);
	}

	if (!valid) {
		return json({ error: 'Invalid secret' }, { status: 401 });
	}

	if (!(await isApproved(deviceId))) {
		if (LOCAL_TRUST_DEVICES) {
			await approveDevice(deviceId, label);
			console.warn(`[auth] LOCAL_TRUST: auto-approved device ${deviceId} (${ip})`);
		} else {
			await recordPending(deviceId, label, ip);
			console.warn(
				`[auth] NEW DEVICE pending approval — id=${deviceId} label=${JSON.stringify(label)} ip=${ip}. ` +
					`Approve with: node scripts/approve-device.js ${deviceId}`
			);
			return json({ error: 'device_pending', deviceId, label }, { status: 403 });
		}
	}

	await touchApproved(deviceId);

	const now = Date.now();
	const payload: SessionPayload = {
		issued_at: now,
		expires_at: now + SESSION_EXPIRY_HOURS * 3600 * 1000,
		device_id: deviceId
	};

	const sessionToken = signSession(payload, CONTROL_ROOM_SESSION_SECRET);
	cookies.set('session', sessionToken, {
		httpOnly: true,
		sameSite: 'strict',
		path: '/',
		maxAge: SESSION_EXPIRY_HOURS * 3600,
		secure: process.env.NODE_ENV === 'production'
	});

	return json({ success: true });
};
