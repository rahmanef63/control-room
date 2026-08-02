import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ key: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const denied = await requireSession();
  if (denied) return denied;
  const { key } = await ctx.params;
  const response = await terminalGatewayFetch(`/state/${encodeURIComponent(key)}`);
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  // Read the body BEFORE any other awaited I/O. requireSession() awaits a
  // filesystem device-allowlist read, and under Next 15.5 an I/O await placed
  // ahead of the body read re-opens the request-body clone race described in
  // middleware.ts — the body arrives empty or the read throws "Response body
  // object should not be disturbed or locked", surfacing as a bare 400 the
  // handler never sees and the server never logs. Middleware already gates this
  // route, so requireSession stays defense-in-depth wherever it runs.
  const body = await req.text();
  const denied = await requireSession();
  if (denied) return denied;
  const { key } = await ctx.params;
  const response = await terminalGatewayFetch(`/state/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
