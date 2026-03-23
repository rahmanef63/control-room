import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/lib/server/terminal-gateway';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const id = await resolveId(context);
  const body = await request.text();
  const response = await terminalGatewayFetch(`/terminals/${encodeURIComponent(id)}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
