import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

// Server-side proxy: forwards a CRUD step list to the agent's /browser/crud,
// injecting the gateway secret (never exposed to the browser). The agent in turn
// drives the os-vps remote browser with its own agent token.
export async function POST(request: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = await request.text();
  const response = await terminalGatewayFetch('/browser/crud', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const payload = await response.json().catch(() => ({ error: 'bad agent response' }));
  return NextResponse.json(payload, { status: response.status });
}
