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
  let body: { cols?: number; rows?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body.cols !== 'number' || typeof body.rows !== 'number') {
    return NextResponse.json({ error: 'cols and rows must be numbers' }, { status: 400 });
  }

  try {
    const id = await resolveId(context);
    const session = terminalManager.resize(id, body.cols, body.rows);
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resize terminal';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
