import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  const cwd = req.nextUrl.searchParams.get('cwd');
  const suffix = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
  const response = await terminalGatewayFetch(`/skills${suffix}`);
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
