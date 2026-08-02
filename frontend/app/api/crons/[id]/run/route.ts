import { NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await context.params;
  const response = await terminalGatewayFetch(`/crons/${encodeURIComponent(id)}/run`, {
    method: 'POST',
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
