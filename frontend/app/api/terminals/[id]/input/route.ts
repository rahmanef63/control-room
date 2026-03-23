import { NextRequest, NextResponse } from 'next/server';

import { terminalManager } from '@/lib/server/terminal-manager';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function POST(request: NextRequest, context: RouteContext) {
  let body: { data?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body.data !== 'string') {
    return NextResponse.json({ error: 'Input data must be a string' }, { status: 400 });
  }

  try {
    const id = await resolveId(context);
    terminalManager.sendInput(id, body.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send input';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
