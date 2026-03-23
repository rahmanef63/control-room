import { NextRequest, NextResponse } from 'next/server';

import type { TerminalProfile } from '@/lib/types';
import { TERMINAL_PROFILES } from '@/lib/server/terminal-profiles';
import { terminalManager } from '@/lib/server/terminal-manager';

export const runtime = 'nodejs';

const VALID_PROFILES = new Set<TerminalProfile>(
  TERMINAL_PROFILES.map((profile) => profile.profile)
);

export async function GET() {
  return NextResponse.json({
    profiles: TERMINAL_PROFILES,
    sessions: terminalManager.listSessions(),
  });
}

export async function POST(request: NextRequest) {
  let body: { profile?: TerminalProfile };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.profile || !VALID_PROFILES.has(body.profile)) {
    return NextResponse.json({ error: 'Unsupported terminal profile' }, { status: 400 });
  }

  try {
    const session = terminalManager.createSession(body.profile);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create terminal session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
