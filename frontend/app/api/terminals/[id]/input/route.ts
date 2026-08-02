import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function POST(request: NextRequest, context: RouteContext) {
  // Body first — an awaited I/O ahead of the body read loses it under Next 15.5.
  // See app/api/state/[key]/route.ts for the full explanation.
  const body = await request.text();
  const denied = await requireSession();
  if (denied) return denied;
  const id = await resolveId(context);
  const response = await terminalGatewayFetch(`/terminals/${encodeURIComponent(id)}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
