import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';

export const runtime = 'nodejs';

export async function GET() {
  const response = await terminalGatewayFetch('/terminals');
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const response = await terminalGatewayFetch('/terminals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
