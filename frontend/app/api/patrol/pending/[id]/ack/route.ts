import { NextRequest } from 'next/server';

import { proxyGatewayJson } from '@/features/terminals/server/gateway-proxy';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await context.params;
  return proxyGatewayJson(`/patrol/pending/${encodeURIComponent(id)}/ack`, {
    method: 'POST',
  });
}
