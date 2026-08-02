import { NextResponse } from 'next/server';
import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';

export const runtime = 'nodejs';

// Authenticated host overview. Unlike /api/health (public, minimal), this
// forwards the gateway secret so the agent returns its full telemetry snapshot
// (CPU / RAM / disk / load / net / uptime) plus runtime counts. Middleware
// already gates /api/* behind a valid session, so only a logged-in owner reaches
// this recon data.
export async function GET() {
  try {
    const response = await terminalGatewayFetch('/health', {}, { authenticate: true });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 503 });
  }
}
