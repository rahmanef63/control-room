'use client';

import { Bot } from 'lucide-react';

import { SessionColorPicker } from '@/features/terminals/components/session-color-picker';
import { useSessionColors } from '@/features/terminals/hooks/use-session-colors';
import { ALFA_DEFAULT_PROMPT, type AlfaWatcher } from '@/features/terminals/hooks/use-alfa-watchers';
import { shortenCwd } from '@/features/terminals/lib/utils';
import type { TerminalSession } from '@/shared/types/contracts';

const ALFA_SKILL_BOOT = '/vps-alfa\r';

interface AlfaRegistryPromoteProps {
  promotable: TerminalSession[];
  onPromote: (watcher: AlfaWatcher, injectSkills?: string[]) => void;
}

/**
 * One-click promote: every running, non-alfa pane gets a single
 * "Turn into ALFA" button. The watcher is registered with empty targets
 * and the default prompt — the user wires targets in via the tree above
 * and edits the label/instruction via the group accordion.
 *
 * `/vps-alfa` is auto-injected only when an AI CLI was detected inside
 * the pane (pstree probe). Raw shell panes are registered but left alone,
 * since typing "/vps-alfa" into bash would just error.
 */
export function AlfaRegistryPromote({ promotable, onPromote }: AlfaRegistryPromoteProps) {
  const { colorOf, setColor, clearColor, colors } = useSessionColors();

  if (promotable.length === 0) return null;

  function promote(session: TerminalSession) {
    const watcher: AlfaWatcher = {
      id: session.id,
      label: session.title,
      watchedSessionIds: [],
      instructions: {},
      defaultInstruction: ALFA_DEFAULT_PROMPT,
      createdAt: Date.now(),
    };
    const injects = session.inner_agent ? [ALFA_SKILL_BOOT] : [];
    onPromote(watcher, injects);
  }

  return (
    <section className="alfa-registry-promote">
      <header className="alfa-registry-promote-header">
        <span className="alfa-registry-eyebrow">Promote running pane to alfa</span>
        <p className="alfa-registry-help">
          One click registers the pane as an alfa with sensible defaults. Drag
          targets in via the tree above, then expand the alfa to edit its label
          or default instruction. Panes with an inner AI CLI auto-boot the
          <code> /vps-alfa</code> skill; plain shell panes get registered only —
          run the skill yourself once claude/codex/gemini is up.
        </p>
      </header>

      <ul className="alfa-registry-promote-list">
        {promotable.map((session) => {
          const color = colorOf(session.id);
          return (
            <li
              key={session.id}
              className="alfa-registry-promote-row"
              style={{ ['--session-color' as string]: color }}
            >
              <div className="alfa-registry-promote-line">
                <SessionColorPicker
                  sessionId={session.id}
                  color={color}
                  hasOverride={session.id in colors}
                  onPick={(value) => setColor(session.id, value)}
                  onClear={() => clearColor(session.id)}
                />
                <div className="alfa-registry-promote-line-title">
                  <span className="alfa-registry-promote-name">{session.title}</span>
                  <span className="alfa-registry-promote-cwd">{shortenCwd(session.cwd, 36)}</span>
                </div>
                <span
                  className="alfa-registry-promote-meta"
                  data-inner-agent={session.inner_agent ?? undefined}
                  title={session.inner_agent ? `AI CLI detected: ${session.inner_agent}` : 'No AI CLI detected — skill will not auto-boot'}
                >
                  {session.inner_agent ?? 'shell · no AI'}
                </span>
                <button
                  type="button"
                  className="alfa-registry-promote-cta"
                  onClick={() => promote(session)}
                >
                  <Bot className="h-3.5 w-3.5" /> Turn into ALFA
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
