import crypto from 'crypto';

export interface SessionPayload {
  issued_at: number;
  expires_at: number;
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
