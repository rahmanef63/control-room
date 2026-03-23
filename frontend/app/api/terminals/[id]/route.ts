import { NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/lib/server/terminal-gateway';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function GET(_request: Request, context: RouteContext) {
  const id = await resolveId(context);
  const response = await terminalGatewayFetch(`/terminals/${encodeURIComponent(id)}`);
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await resolveId(context);
  const response = await terminalGatewayFetch(`/terminals/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
