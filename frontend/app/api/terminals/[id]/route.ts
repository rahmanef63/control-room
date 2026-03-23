import { NextResponse } from 'next/server';

import { terminalManager } from '@/lib/server/terminal-manager';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = await resolveId(context);
    return NextResponse.json({ session: terminalManager.getSession(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terminal session not found';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await resolveId(context);
  terminalManager.closeSession(id);
  return new NextResponse(null, { status: 204 });
}
