import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const k of ['since', 'level', 'limit']) {
    const v = sp.get(k);
    if (v) params.set(k, v);
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await terminalGatewayFetch(`/log${suffix}`);
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}

export async function DELETE() {
  const denied = await requireSession();
  if (denied) return denied;
  const response = await terminalGatewayFetch('/log', { method: 'DELETE' });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
