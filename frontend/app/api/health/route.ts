import { NextResponse } from 'next/server';
import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';

export const runtime = 'nodejs';

export async function GET() {
  const response = await terminalGatewayFetch('/health');
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
