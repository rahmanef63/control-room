import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { signSession, SessionPayload } from '@/lib/auth';

interface RateLimitEntry {
  count: number;
  reset_at: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

const CONTROL_ROOM_SECRET = process.env.CONTROL_ROOM_SECRET ?? '';
const CONTROL_ROOM_SESSION_SECRET = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS ?? '24', 10);

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
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
  const ip = getClientIp(request);

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts, try again later' },
      { status: 429 }
    );
  }

  let body: { secret?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { secret } = body;
  if (typeof secret !== 'string' || secret.length === 0) {
    return NextResponse.json({ error: 'Secret is required' }, { status: 400 });
  }

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

  const now = Date.now();
  const payload: SessionPayload = {
    issued_at: now,
    expires_at: now + SESSION_EXPIRY_HOURS * 3600 * 1000,
  };

  const sessionToken = signSession(payload, CONTROL_ROOM_SESSION_SECRET);
  const maxAge = SESSION_EXPIRY_HOURS * 3600;

  const response = NextResponse.json({ success: true });
  response.cookies.set('session', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge,
    secure: false, // Tailscale-only access over HTTP
  });

  return response;
}
