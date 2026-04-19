'use client';

import { X } from 'lucide-react';

import type { TerminalSession } from '@/shared/types/contracts';
import { shortenCwd, type ActivityState } from '@/features/terminals/lib/utils';
import { TerminalProfileIcon } from '@/features/terminals/components/terminal-profile-icon';

function resolveTabState(session: TerminalSession, activity: ActivityState | undefined): string {
  if (session.status === 'exited') return 'exited';
  if (session.profile === 'shell') return 'running';
  if (activity === 'working') return 'working';
  if (activity === 'waiting') return 'waiting';
  if (activity === 'done') return 'done';
  return 'running';
}

const STATE_TITLE: Record<string, string> = {
  running: 'Running',
  working: 'Agent working',
  waiting: 'Waiting for input',
  done: 'Agent finished',
  exited: 'Exited',
};

export function SessionTabs({
  sessions,
  activeId,
  viewMode,
  activityStates,
  onSelect,
  onClose,
}: {
  sessions: TerminalSession[];
  activeId: string | null;
  viewMode: 'single' | 'grid';
  activityStates: Record<string, ActivityState>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <nav aria-label="Terminal tabs" className="session-tabs">
      <div className="session-tabs-scroll">
        {sessions.map((session) => {
          const isActive = viewMode === 'single' && session.id === activeId;
          const state = resolveTabState(session, activityStates[session.id]);

          return (
            <div
              key={session.id}
              data-profile={session.profile}
              data-active={isActive ? 'true' : 'false'}
              data-state={state}
              className="session-tab"
            >
              <button
                type="button"
                onClick={() => onSelect(session.id)}
                className="session-tab-main"
                title={`${session.title} · ${STATE_TITLE[state]} · ${session.cwd}`}
              >
                <span className="session-tab-icon">
                  <TerminalProfileIcon profile={session.profile} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold">{session.title}</span>
                    <span className="session-tab-dot" aria-label={STATE_TITLE[state]} />
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                    {shortenCwd(session.cwd, 28)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(session.id);
                }}
                className="session-tab-close"
                aria-label={`Close ${session.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
