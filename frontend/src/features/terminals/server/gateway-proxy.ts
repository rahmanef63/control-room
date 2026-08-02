// Shared helper for Next.js route handlers that proxy to the agent gateway.
// Centralises the response.text() + status pass-through + json-safe parse
// pattern (replaces three near-identical implementations in
// /api/patrol/pending, /api/patrol/pending/[id]/ack, /api/terminals/[id]/buffer).

import { NextResponse } from 'next/server';

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';

export async function proxyGatewayJson(
  path: string,
  init?: RequestInit
): Promise<NextResponse> {
  const response = await terminalGatewayFetch(path, init);
  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || `Gateway returned ${response.status}` },
      { status: response.status }
    );
  }
  try {
    return NextResponse.json(text.length === 0 ? {} : JSON.parse(text), {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { error: 'Gateway returned non-JSON body', body: text },
      { status: 502 }
    );
  }
}
