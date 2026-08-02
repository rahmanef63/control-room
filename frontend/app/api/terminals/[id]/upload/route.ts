import { NextRequest, NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Proxies a drag-and-drop file upload to the agent. Body is raw binary; the
// original filename rides in the `?name=` query so we don't parse multipart.
export async function POST(request: NextRequest, context: RouteContext) {
  // Body first — an awaited I/O ahead of the body read loses it under Next 15.5.
  // See app/api/state/[key]/route.ts for the full explanation.
  const body = await request.arrayBuffer();
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await context.params;
  const name = request.nextUrl.searchParams.get('name') ?? 'upload.bin';

  const response = await terminalGatewayFetch(
    `/terminals/${encodeURIComponent(id)}/upload?name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.from(body),
    }
  );

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
