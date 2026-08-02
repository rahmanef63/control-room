'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronRight, Eye, Inbox, MoveRight, Power, Save, Sparkles } from 'lucide-react';

import { SessionColorPicker } from '@/features/terminals/components/session-color-picker';
import { useSessionColors } from '@/features/terminals/hooks/use-session-colors';
import { ALFA_DEFAULT_PROMPT, type AlfaWatcher } from '@/features/terminals/hooks/use-alfa-watchers';
import {
  ALFA_PATROL_SENIOR_FULLSTACK_PROMPT,
  type TerminalSession,
} from '@/shared/types/contracts';

interface AlfaTreeProps {
  watchers: AlfaWatcher[];
  allSessions: TerminalSession[];
  onSave: (watcher: AlfaWatcher) => void;
  onDeregister: (alfaId: string) => Promise<void> | void;
}

type DragPayload = {
  sourceAlfaId: string | null;
  targetSessionId: string;
};

const DRAG_MIME = 'application/x-alfa-target';

function targetKey(alfaId: string, targetId: string): string {
  return `${alfaId}:${targetId}`;
}

/**
 * Tree view + accordion editor for the alfa registry.
 *
 * Vertical: ALFA groups → child TARGETs → optional Unassigned bucket.
 * Drag a target between groups to reassign; drop on Unassigned to detach.
 * Click the chevron on a group to expand its label + default-instruction
 * editor; click the chevron on a target to expand its per-target instruction
 * override. Drag handle is the row itself; the chevron stops propagation so
 * it never triggers a drag start.
 */
export function AlfaTree({ watchers, allSessions, onSave, onDeregister }: AlfaTreeProps) {
  const { colorOf, setColor, clearColor, colors } = useSessionColors();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [expandedAlfas, setExpandedAlfas] = useState<Set<string>>(new Set());
  const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());

  // Local drafts for the open editors — keyed by alfaId for the group form,
  // by `${alfaId}:${targetId}` for per-target instruction overrides. Saving
  // dispatches one onSave with the whole watcher.
  const [groupDrafts, setGroupDrafts] = useState<Record<string, AlfaWatcher>>({});

  // Keep group drafts in sync if the server pushes a new watcher state.
  useEffect(() => {
    setGroupDrafts((current) => {
      const next: Record<string, AlfaWatcher> = {};
      for (const watcher of watchers) {
        const existing = current[watcher.id];
        next[watcher.id] = existing ?? watcher;
      }
      return next;
    });
  }, [watchers]);

  const targetOwner = useMemo(() => {
    const map = new Map<string, string>();
    for (const watcher of watchers) {
      for (const id of watcher.watchedSessionIds) map.set(id, watcher.id);
    }
    return map;
  }, [watchers]);

  const alfaIds = useMemo(() => new Set(watchers.map((watcher) => watcher.id)), [watchers]);

  const unassigned = useMemo(
    () =>
      allSessions.filter(
        (session) =>
          session.status === 'running' &&
          !alfaIds.has(session.id) &&
          !targetOwner.has(session.id)
      ),
    [allSessions, alfaIds, targetOwner]
  );

  function findSession(id: string): TerminalSession | undefined {
    return allSessions.find((session) => session.id === id);
  }

  function toggleAlfa(alfaId: string) {
    setExpandedAlfas((current) => {
      const next = new Set(current);
      if (next.has(alfaId)) next.delete(alfaId);
      else next.add(alfaId);
      return next;
    });
  }

  function toggleTarget(alfaId: string, targetId: string) {
    const key = targetKey(alfaId, targetId);
    setExpandedTargets((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateDraft(alfaId: string, patch: Partial<AlfaWatcher>) {
    setGroupDrafts((current) => {
      const base = current[alfaId] ?? watchers.find((watcher) => watcher.id === alfaId);
      if (!base) return current;
      return { ...current, [alfaId]: { ...base, ...patch } };
    });
  }

  function setTargetInstruction(alfaId: string, targetId: string, text: string) {
    const draft = groupDrafts[alfaId] ?? watchers.find((watcher) => watcher.id === alfaId);
    if (!draft) return;
    updateDraft(alfaId, {
      instructions: { ...draft.instructions, [targetId]: text },
    });
  }

  function isGroupDirty(alfaId: string): boolean {
    const remote = watchers.find((watcher) => watcher.id === alfaId);
    const draft = groupDrafts[alfaId];
    if (!remote || !draft) return false;
    return JSON.stringify(remote) !== JSON.stringify(draft);
  }

  function saveGroup(alfaId: string) {
    const draft = groupDrafts[alfaId];
    if (draft) onSave(draft);
  }

  function handleDragStart(event: React.DragEvent<HTMLLIElement>, payload: DragPayload) {
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(payload.targetSessionId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverGroup(null);
  }

  function handleDragOver(event: React.DragEvent, groupId: string) {
    if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverGroup(groupId);
  }

  function handleDragLeave(_event: React.DragEvent, groupId: string) {
    if (dragOverGroup === groupId) setDragOverGroup(null);
  }

  function handleDrop(event: React.DragEvent, destAlfaId: string | null) {
    event.preventDefault();
    setDragOverGroup(null);
    setDraggingId(null);
    const raw = event.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.sourceAlfaId === destAlfaId) return;

    if (payload.sourceAlfaId) {
      const source = watchers.find((watcher) => watcher.id === payload.sourceAlfaId);
      if (source) {
        const next: AlfaWatcher = {
          ...source,
          watchedSessionIds: source.watchedSessionIds.filter(
            (id) => id !== payload.targetSessionId
          ),
        };
        onSave(next);
      }
    }

    if (destAlfaId) {
      const dest = watchers.find((watcher) => watcher.id === destAlfaId);
      if (dest && !dest.watchedSessionIds.includes(payload.targetSessionId)) {
        const next: AlfaWatcher = {
          ...dest,
          watchedSessionIds: [...dest.watchedSessionIds, payload.targetSessionId],
        };
        onSave(next);
      }
    }
  }

  return (
    <div className="alfa-tree">
      <p className="alfa-tree-help">
        Drag a <span className="alfa-registry-role-chip" data-role="target"><Eye className="h-3 w-3" /> TARGET</span>{' '}
        between alfas to reassign — or onto <em>Unassigned</em> to detach.
        Click <ChevronRight className="inline h-3 w-3" /> to expand an alfa
        (edit label/instruction) or a target (set its per-target instruction).
      </p>

      {watchers.length === 0 ? (
        <p className="alfa-tree-help">No alfas registered yet — pick a pane below.</p>
      ) : null}

      {watchers.map((watcher) => {
        const alfaSession = findSession(watcher.id);
        const title = alfaSession?.title ?? watcher.label ?? watcher.id.slice(0, 8);
        const groupColor = colorOf(watcher.id);
        const alfaExpanded = expandedAlfas.has(watcher.id);
        const draft = groupDrafts[watcher.id] ?? watcher;

        return (
          <section
            key={watcher.id}
            className="alfa-tree-group"
            style={{ ['--session-color' as string]: groupColor }}
            data-drag-over={dragOverGroup === watcher.id || undefined}
            data-expanded={alfaExpanded || undefined}
            onDragOver={(event) => handleDragOver(event, watcher.id)}
            onDragLeave={(event) => handleDragLeave(event, watcher.id)}
            onDrop={(event) => handleDrop(event, watcher.id)}
          >
            <header className="alfa-tree-group-head">
              <button
                type="button"
                className="alfa-tree-chevron"
                onClick={() => toggleAlfa(watcher.id)}
                aria-label={alfaExpanded ? 'Collapse alfa detail' : 'Expand alfa detail'}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <SessionColorPicker
                sessionId={watcher.id}
                color={groupColor}
                hasOverride={watcher.id in colors}
                onPick={(color) => setColor(watcher.id, color)}
                onClear={() => clearColor(watcher.id)}
              />
              <span className="alfa-tree-group-title">
                <span className="alfa-registry-role-chip" data-role="alfa">
                  <Bot className="h-3 w-3" /> ALFA
                </span>
                {title}
                <span className="alfa-tree-group-count">
                  {watcher.watchedSessionIds.length} watched
                </span>
              </span>
              <button
                type="button"
                className="alfa-registry-row-demote"
                onClick={() => void onDeregister(watcher.id)}
                title="Deregister this alfa (pane keeps running)"
              >
                <Power className="h-3 w-3" /> Demote
              </button>
            </header>

            {alfaExpanded ? (
              <div className="alfa-tree-detail">
                <label className="alfa-registry-field">
                  <span className="alfa-registry-label">Label</span>
                  <input
                    type="text"
                    className="alfa-registry-input"
                    value={draft.label ?? ''}
                    onChange={(event) => updateDraft(watcher.id, { label: event.target.value })}
                    placeholder={watcher.id.slice(0, 8)}
                  />
                </label>
                <fieldset className="alfa-registry-field alfa-registry-mode">
                  <legend className="alfa-registry-label">Patrol mode</legend>
                  <label className="alfa-registry-mode-option">
                    <input
                      type="radio"
                      name={`alfa-mode-${watcher.id}`}
                      value="static"
                      checked={(draft.mode ?? 'static') === 'static'}
                      onChange={() => {
                        const next: Partial<AlfaWatcher> = { mode: 'static' };
                        if (draft.defaultInstruction === ALFA_PATROL_SENIOR_FULLSTACK_PROMPT) {
                          next.defaultInstruction = ALFA_DEFAULT_PROMPT;
                        }
                        updateDraft(watcher.id, next);
                      }}
                    />
                    <span className="alfa-registry-mode-title">Static prompt</span>
                    <span className="alfa-registry-mode-desc">
                      Send the default (or per-target) instruction verbatim on every ping.
                    </span>
                  </label>
                  <label className="alfa-registry-mode-option">
                    <input
                      type="radio"
                      name={`alfa-mode-${watcher.id}`}
                      value="patrol-senior-fullstack"
                      checked={draft.mode === 'patrol-senior-fullstack'}
                      onChange={() => {
                        const next: Partial<AlfaWatcher> = { mode: 'patrol-senior-fullstack' };
                        if (
                          !draft.defaultInstruction ||
                          draft.defaultInstruction === ALFA_DEFAULT_PROMPT
                        ) {
                          next.defaultInstruction = ALFA_PATROL_SENIOR_FULLSTACK_PROMPT;
                        }
                        updateDraft(watcher.id, next);
                      }}
                    />
                    <span className="alfa-registry-mode-title">
                      <Sparkles className="h-3 w-3" /> Senior Fullstack (context-aware)
                    </span>
                    <span className="alfa-registry-mode-desc">
                      Alfa reads each target&apos;s buffer, picks relevant skills, and crafts a
                      tailored prompt per session as a senior fullstack engineer would.
                    </span>
                  </label>
                </fieldset>
                <label className="alfa-registry-field">
                  <span className="alfa-registry-label">
                    {draft.mode === 'patrol-senior-fullstack'
                      ? 'Patrol meta-template (sent as system guidance)'
                      : 'Default instruction'}
                  </span>
                  <textarea
                    className="alfa-registry-textarea"
                    rows={draft.mode === 'patrol-senior-fullstack' ? 5 : 2}
                    value={draft.defaultInstruction}
                    onChange={(event) =>
                      updateDraft(watcher.id, { defaultInstruction: event.target.value })
                    }
                    placeholder={
                      draft.mode === 'patrol-senior-fullstack'
                        ? ALFA_PATROL_SENIOR_FULLSTACK_PROMPT
                        : ALFA_DEFAULT_PROMPT
                    }
                  />
                </label>
                <div className="alfa-registry-actions">
                  <button
                    type="button"
                    className="alfa-registry-save"
                    onClick={() => saveGroup(watcher.id)}
                    disabled={!isGroupDirty(watcher.id)}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isGroupDirty(watcher.id) ? 'Save alfa' : 'No changes'}
                  </button>
                </div>
              </div>
            ) : null}

            <ul className="alfa-tree-children">
              {watcher.watchedSessionIds.length === 0 ? (
                <li className="alfa-tree-empty">
                  <MoveRight className="mr-1 inline h-3 w-3" />
                  Drag a target here.
                </li>
              ) : (
                watcher.watchedSessionIds.map((targetId) => {
                  const session = findSession(targetId);
                  if (!session) return null;
                  const nodeColor = colorOf(session.id);
                  const expanded = expandedTargets.has(targetKey(watcher.id, targetId));
                  const instructionValue = draft.instructions[targetId] ?? '';
                  return (
                    <li
                      key={targetId}
                      className="alfa-tree-node"
                      draggable
                      style={{ ['--session-color' as string]: nodeColor }}
                      data-dragging={draggingId === targetId || undefined}
                      data-expanded={expanded || undefined}
                      onDragStart={(event) =>
                        handleDragStart(event, {
                          sourceAlfaId: watcher.id,
                          targetSessionId: targetId,
                        })
                      }
                      onDragEnd={handleDragEnd}
                    >
                      <div className="alfa-tree-node-row">
                        <button
                          type="button"
                          className="alfa-tree-chevron"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTarget(watcher.id, targetId);
                          }}
                          aria-label={expanded ? 'Collapse target detail' : 'Expand target detail'}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                        <SessionColorPicker
                          sessionId={session.id}
                          color={nodeColor}
                          hasOverride={session.id in colors}
                          onPick={(color) => setColor(session.id, color)}
                          onClear={() => clearColor(session.id)}
                        />
                        <span className="alfa-registry-role-chip" data-role="target">
                          <Eye className="h-3 w-3" /> TARGET
                        </span>
                        <span className="alfa-tree-node-title">{session.title}</span>
                        <span className="alfa-tree-node-meta">
                          {session.inner_agent ?? session.profile}
                        </span>
                      </div>

                      {expanded ? (
                        <div className="alfa-tree-target-detail" onClick={(event) => event.stopPropagation()}>
                          <label className="alfa-registry-field">
                            <span className="alfa-registry-label">Per-target instruction</span>
                            <textarea
                              className="alfa-registry-textarea"
                              rows={2}
                              value={instructionValue}
                              onChange={(event) =>
                                setTargetInstruction(watcher.id, targetId, event.target.value)
                              }
                              placeholder={`Falls back to alfa default: "${draft.defaultInstruction || ALFA_DEFAULT_PROMPT}"`}
                            />
                          </label>
                          <div className="alfa-registry-actions">
                            <button
                              type="button"
                              className="alfa-registry-save"
                              onClick={() => saveGroup(watcher.id)}
                              disabled={!isGroupDirty(watcher.id)}
                            >
                              <Save className="h-3.5 w-3.5" />
                              {isGroupDirty(watcher.id) ? 'Save alfa' : 'No changes'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        );
      })}

      <section
        className="alfa-tree-group"
        data-unassigned
        data-drag-over={dragOverGroup === '__unassigned' || undefined}
        onDragOver={(event) => handleDragOver(event, '__unassigned')}
        onDragLeave={(event) => handleDragLeave(event, '__unassigned')}
        onDrop={(event) => handleDrop(event, null)}
      >
        <header className="alfa-tree-group-head">
          <span className="alfa-tree-group-title">
            <Inbox className="h-3.5 w-3.5" />
            Unassigned terminals
            <span className="alfa-tree-group-count">{unassigned.length}</span>
          </span>
        </header>
        <ul className="alfa-tree-children">
          {unassigned.length === 0 ? (
            <li className="alfa-tree-empty">All running terminals are watched.</li>
          ) : (
            unassigned.map((session) => {
              const nodeColor = colorOf(session.id);
              return (
                <li
                  key={session.id}
                  className="alfa-tree-node"
                  draggable
                  style={{ ['--session-color' as string]: nodeColor }}
                  data-dragging={draggingId === session.id || undefined}
                  onDragStart={(event) =>
                    handleDragStart(event, {
                      sourceAlfaId: null,
                      targetSessionId: session.id,
                    })
                  }
                  onDragEnd={handleDragEnd}
                >
                  <div className="alfa-tree-node-row">
                    <SessionColorPicker
                      sessionId={session.id}
                      color={nodeColor}
                      hasOverride={session.id in colors}
                      onPick={(color) => setColor(session.id, color)}
                      onClear={() => clearColor(session.id)}
                    />
                    <span className="alfa-tree-node-title">{session.title}</span>
                    <span className="alfa-tree-node-meta">
                      {session.inner_agent ?? session.profile}
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
