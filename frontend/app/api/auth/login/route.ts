import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { MIN_SECRET_LEN, type SessionPayload, signSession } from '@/shared/auth/session';
import {
  approveDevice,
  isApproved,
  isValidDeviceId,
  recordPending,
  touchApproved,
} from '@/shared/auth/device-store';

interface RateLimitEntry {
  count: number;
  reset_at: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_TRACKED_IPS = 1024;
// Backstop independent of the client-controllable IP key, so rotating a spoofed
// X-Forwarded-For can't reset the counter and brute-force the single password.
const GLOBAL_MAX_ATTEMPTS = 30;

let globalWindowStart = Date.now();
let globalAttempts = 0;

const CONTROL_ROOM_SECRET = process.env.CONTROL_ROOM_SECRET ?? '';
const CONTROL_ROOM_SESSION_SECRET = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
// 72h = 3 days. Sliding renewal in middleware.ts re-issues this on activity, so
// an actively-used dashboard never hits the hard cap; it only bites after 3 days
// of zero activity. Keep this default in sync with middleware.ts.
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS ?? '72', 10);
// LOCAL-ONLY convenience: when running on your own machine (set by the local
// installer in .env.local), a correct password auto-approves the device instead
// of blocking the first login behind manual device approval. NEVER set this on a
// network-reachable / VPS deploy — it drops the second auth factor. Default off,
// so the production VPS keeps two-factor (password + approved device) unchanged.
const LOCAL_TRUST_DEVICES = process.env.CONTROL_ROOM_LOCAL_TRUST === '1';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

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

  // Bound the per-IP map so spoofed IPs can't grow it without limit.
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

export async function POST(request: NextRequest) {
  // The SIGNING key must stay strong (a weak/empty key is forgeable). The login
  // PASSWORD may be weak/memorable because device approval is the strong second
  // factor — so only the session secret is floor-checked here.
  if (CONTROL_ROOM_SESSION_SECRET.length < MIN_SECRET_LEN) {
    return NextResponse.json({ error: 'Server auth is not configured' }, { status: 500 });
  }

  const ip = getClientIp(request);

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts, try again later' },
      { status: 429 }
    );
  }

  let body: { secret?: string; deviceId?: string; deviceLabel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { secret, deviceId, deviceLabel } = body;
  if (typeof secret !== 'string' || secret.length === 0) {
    return NextResponse.json({ error: 'Secret is required' }, { status: 400 });
  }
  if (!isValidDeviceId(deviceId)) {
    return NextResponse.json({ error: 'Missing or invalid device id' }, { status: 400 });
  }
  const label = typeof deviceLabel === 'string' ? deviceLabel.slice(0, 80) : 'unknown device';

  const secretBuf = Buffer.from(CONTROL_ROOM_SECRET, 'utf8');
  const providedBuf = Buffer.from(secret, 'utf8');

  let valid = false;
  if (secretBuf.length === providedBuf.length) {
    valid = crypto.timingSafeEqual(secretBuf, providedBuf);
  } else {
    // Still do a comparison to prevent timing attacks that reveal length
    crypto.timingSafeEqual(secretBuf, secretBuf);
  }

  if (!valid) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  // Password is correct — now the device must be approved (second factor).
  // An unapproved device is recorded as pending and an alert is logged; no
  // session is issued until an admin seeds the id.
  if (!(await isApproved(deviceId))) {
    // LOCAL-ONLY: auto-approve so the first local login isn't blocked. Gated by
    // CONTROL_ROOM_LOCAL_TRUST, which only the local installer sets; the VPS
    // never sets it, so it still falls through to the pending gate below.
    if (LOCAL_TRUST_DEVICES) {
      await approveDevice(deviceId, label);
      console.warn(`[auth] LOCAL_TRUST: auto-approved device ${deviceId} (${ip})`);
    } else {
      await recordPending(deviceId, label, ip);
      console.warn(
        `[auth] NEW DEVICE pending approval — id=${deviceId} label=${JSON.stringify(label)} ip=${ip}. ` +
          `Approve with: node scripts/approve-device.js ${deviceId}`
      );
      return NextResponse.json(
        { error: 'device_pending', deviceId, label },
        { status: 403 }
      );
    }
  }

  await touchApproved(deviceId);

  const now = Date.now();
  const payload: SessionPayload = {
    issued_at: now,
    expires_at: now + SESSION_EXPIRY_HOURS * 3600 * 1000,
    device_id: deviceId,
  };

  const sessionToken = signSession(payload, CONTROL_ROOM_SESSION_SECRET);
  const maxAge = SESSION_EXPIRY_HOURS * 3600;

  const response = NextResponse.json({ success: true });
  response.cookies.set('session', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge,
    // Secure cookies are dropped by Safari/Firefox over http://localhost, which
    // breaks local-dev login on macOS/Linux. `next start` sets NODE_ENV=production
    // (the VPS, behind https) → secure; `next dev` sets development → plain http.
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
