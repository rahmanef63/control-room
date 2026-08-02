import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  const pathParam = request.nextUrl.searchParams.get('path') ?? '~';
  const encoded = encodeURIComponent(pathParam);
  const response = await terminalGatewayFetch(`/fs/list?path=${encoded}`);
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
