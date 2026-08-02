import { NextRequest } from 'next/server';

import { proxyGatewayJson } from '@/features/terminals/server/gateway-proxy';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await context.params;
  const linesParam = request.nextUrl.searchParams.get('lines');
  const suffix = linesParam ? `?lines=${encodeURIComponent(linesParam)}` : '';
  return proxyGatewayJson(`/terminals/${encodeURIComponent(id)}/buffer${suffix}`);
}
