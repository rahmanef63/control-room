import { NextRequest, NextResponse } from 'next/server';

import { deleteWatcher } from '@/features/terminals/server/alfa-watchers-store';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await context.params;
  const removed = await deleteWatcher(id);
  if (!removed) {
    return NextResponse.json({ error: 'Watcher not found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
