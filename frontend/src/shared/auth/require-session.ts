import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { isApproved } from '@/shared/auth/device-store';
import { verifySession } from '@/shared/auth/session';

/**
 * Defense-in-depth for the privileged agent-proxy routes. They already sit
 * behind middleware, but re-verifying the signed session cookie here means a
 * middleware bypass can't reach the host-control proxy. Mirrors middleware.ts
 * exactly (signature + expiry + live device-allowlist re-check), so it never
 * rejects a request middleware would have allowed.
 *
 * Returns a 401 response to return early, or null when the session is valid.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const secret = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
  const cookie = (await cookies()).get('session')?.value;
  const payload = cookie ? verifySession(cookie, secret) : null;
  // Re-check the device allowlist so a revoked device loses access immediately,
  // not only when its stateless token expires (mirrors middleware.ts).
  const deviceOk = payload ? !payload.device_id || (await isApproved(payload.device_id)) : false;
  if (!payload || !deviceOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
