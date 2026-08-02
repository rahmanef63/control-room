import { NextResponse } from 'next/server';
import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';

export const runtime = 'nodejs';

// Public, unauthenticated liveness probe only. We deliberately do NOT forward
// the gateway secret here, so the agent returns minimal status (no host
// telemetry / recon data) to anonymous callers.
export async function GET() {
  try {
    const response = await terminalGatewayFetch('/health', {}, { authenticate: false });
    const payload = (await response.json().catch(() => ({}))) as {
      status?: string;
      uptime?: number;
    };
    return NextResponse.json(
      { status: payload.status ?? 'ok', uptime: payload.uptime },
      { status: response.status }
    );
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 503 });
  }
}
