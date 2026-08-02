import { NextRequest } from 'next/server';

import { proxyGatewayJson } from '@/features/terminals/server/gateway-proxy';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  return proxyGatewayJson(`/patrol/pending${request.nextUrl.search}`);
}
