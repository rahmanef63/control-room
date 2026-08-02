import { NextRequest, NextResponse } from 'next/server';

import {
  listWatchers,
  upsertWatcher,
} from '@/features/terminals/server/alfa-watchers-store';
import {
  ALFA_DEFAULT_PROMPT,
  ALFA_PATROL_MODES,
  type AlfaPatrolMode,
  type AlfaWatcher,
} from '@/shared/types/contracts';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const watchers = await listWatchers();
  return NextResponse.json({ watchers });
}

export async function POST(request: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  const input: Omit<AlfaWatcher, 'createdAt'> & { createdAt?: number } = {
    id: body.id,
    label: typeof body.label === 'string' ? body.label : undefined,
    watchedSessionIds: Array.isArray(body.watchedSessionIds)
      ? body.watchedSessionIds.filter((value: unknown): value is string => typeof value === 'string')
      : [],
    instructions:
      body.instructions && typeof body.instructions === 'object'
        ? Object.fromEntries(
            Object.entries(body.instructions).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === 'string' && typeof entry[1] === 'string'
            )
          )
        : {},
    defaultInstruction:
      typeof body.defaultInstruction === 'string'
        ? body.defaultInstruction
        : ALFA_DEFAULT_PROMPT,
    mode:
      typeof body.mode === 'string' &&
      (ALFA_PATROL_MODES as readonly string[]).includes(body.mode)
        ? (body.mode as AlfaPatrolMode)
        : undefined,
    scopeWorkspaceId: typeof body.scopeWorkspaceId === 'string' ? body.scopeWorkspaceId : undefined,
    createdAt: typeof body.createdAt === 'number' ? body.createdAt : undefined,
  };
  const watcher = await upsertWatcher(input);
  return NextResponse.json({ watcher }, { status: 200 });
}
