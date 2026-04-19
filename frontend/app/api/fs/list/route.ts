import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const pathParam = request.nextUrl.searchParams.get('path') ?? '~';
  const encoded = encodeURIComponent(pathParam);
  const response = await terminalGatewayFetch(`/fs/list?path=${encoded}`);
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
