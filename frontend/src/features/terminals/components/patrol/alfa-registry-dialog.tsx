'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronRight, Eye, Inbox, Trash2, X } from 'lucide-react';

import type { AlfaWatcher } from '@/features/terminals/hooks/use-alfa-watchers';
import type { PatrolPing } from '@/features/terminals/hooks/use-patrol-pings';
import type { TerminalSession } from '@/shared/types/contracts';

import { AlfaRegistryEmpty } from './alfa-registry-empty';
import { AlfaRegistryPromote } from './alfa-registry-promote';
import { AlfaTree } from './alfa-tree';

interface AlfaRegistryDialogProps {
  open: boolean;
  onClose: () => void;
  watchers: AlfaWatcher[];
  allSessions: TerminalSession[];
  pings: PatrolPing[];
  agentOverridesIds: Set<string>;
  onSave: (watcher: AlfaWatcher, injectSkills?: string[]) => void;
  onDeregister: (alfaId: string) => Promise<void>;
  onAckPing: (pingId: string) => void;
}

type TabId = 'registry' | 'pings';

export function AlfaRegistryDialog({
  open,
  onClose,
  watchers,
  allSessions,
  pings,
  agentOverridesIds,
  onSave,
  onDeregister,
  onAckPing,
}: AlfaRegistryDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('registry');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // NOTE: All hooks must run on every render — keep them above the early
  // `if (!open) return null` exit. React error #310 fires if the call
  // order changes between renders.
  const pendingPings = useMemo(
    () => pings.filter((ping) => !ping.acknowledged),
    [pings]
  );

  // Group by target session so the list reads as "agent X has 3 pending,
  // agent Y has 1" instead of a flat fire-hose. Sort groups by most
  // recent ping so the freshest activity floats to the top.
  const pingGroups = useMemo(() => {
    const byTarget = new Map<string, PatrolPing[]>();
    for (const ping of pendingPings) {
      const list = byTarget.get(ping.sessionId);
      if (list) list.push(ping);
      else byTarget.set(ping.sessionId, [ping]);
    }
    const groups = Array.from(byTarget.entries()).map(([sessionId, items]) => {
      const session = allSessions.find((s) => s.id === sessionId);
      const sorted = items.slice().sort((a, b) => b.enqueuedAt - a.enqueuedAt);
      return {
        sessionId,
        title: session?.title ?? sorted[0].title ?? sessionId.slice(0, 8),
        items: sorted,
        latestAt: sorted[0].enqueuedAt,
      };
    });
    groups.sort((a, b) => b.latestAt - a.latestAt);
    return groups;
  }, [pendingPings, allSessions]);

  if (!open) return null;

  const alfaIds = new Set(watchers.map((watcher) => watcher.id));
  // Show every running, non-alfa terminal. Inner-agent detection happens
  // server-side now; the promote row surfaces the result. Manual override
  // (agentOverridesIds) is still honored as a secondary hint, but no longer
  // gates whether a pane appears in the list.
  const promotable = allSessions.filter(
    (session) => !alfaIds.has(session.id) && session.status === 'running'
  );
  void agentOverridesIds; // kept on the prop for backward compat / future hints

  function toggleGroup(sessionId: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function clearGroup(sessionId: string) {
    for (const ping of pendingPings) {
      if (ping.sessionId === sessionId) onAckPing(ping.id);
    }
  }

  function clearAll() {
    for (const ping of pendingPings) onAckPing(ping.id);
  }

  return (
    <div className="alfa-registry-overlay" role="dialog" aria-modal="true" aria-label="Alfa registry">
      <div className="alfa-registry-backdrop" onClick={onClose} />
      <div className="alfa-registry-sheet" onClick={(event) => event.stopPropagation()}>
        <header className="alfa-registry-sheet-header">
          <div>
            <h2 className="alfa-registry-sheet-title">Alfa registry</h2>
            <p className="alfa-registry-sheet-subtitle">
              <span className="alfa-registry-role-chip" data-role="alfa"><Bot className="h-3 w-3" /> ALFA</span>{' '}
              = patrol pane.{' '}
              <span className="alfa-registry-role-chip" data-role="target"><Eye className="h-3 w-3" /> TARGET</span>{' '}
              = pane being babysat. Alfa runs <code>/vps-alfa</code> and nudges its targets when silent.
            </p>
          </div>
          <button type="button" onClick={onClose} className="topbar-icon-button" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="alfa-registry-tabs" role="tablist" aria-label="Alfa registry sections">
          <button
            type="button"
            role="tab"
            id="alfa-tab-registry"
            aria-selected={activeTab === 'registry'}
            aria-controls="alfa-tabpanel-registry"
            className="alfa-registry-tab"
            data-active={activeTab === 'registry' || undefined}
            onClick={() => setActiveTab('registry')}
          >
            <Bot className="h-3.5 w-3.5" /> Registry
            <span className="alfa-registry-tab-count">{watchers.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="alfa-tab-pings"
            aria-selected={activeTab === 'pings'}
            aria-controls="alfa-tabpanel-pings"
            className="alfa-registry-tab"
            data-active={activeTab === 'pings' || undefined}
            onClick={() => setActiveTab('pings')}
          >
            <Inbox className="h-3.5 w-3.5" /> Activity feed
            {pendingPings.length > 0 ? (
              <span className="alfa-registry-tab-count" data-emphasis>
                {pendingPings.length}
              </span>
            ) : null}
          </button>
        </nav>

        <div className="alfa-registry-sheet-body">
          {activeTab === 'registry' ? (
            <div
              id="alfa-tabpanel-registry"
              role="tabpanel"
              aria-labelledby="alfa-tab-registry"
              className="alfa-registry-scroll"
            >
              {watchers.length === 0 ? (
                <AlfaRegistryEmpty hasPromotable={promotable.length > 0} />
              ) : (
                <section className="alfa-registry-active">
                  <span className="alfa-registry-eyebrow">Active alfas (patrollers)</span>
                  <AlfaTree
                    watchers={watchers}
                    allSessions={allSessions}
                    onSave={onSave}
                    onDeregister={onDeregister}
                  />
                </section>
              )}

              <AlfaRegistryPromote
                promotable={promotable}
                onPromote={onSave}
              />
            </div>
          ) : (
            <div
              id="alfa-tabpanel-pings"
              role="tabpanel"
              aria-labelledby="alfa-tab-pings"
              className="alfa-registry-scroll"
            >
              <section className="alfa-registry-pings">
                <header className="alfa-registry-pings-header">
                  <span className="alfa-registry-eyebrow">
                    Activity feed · {pendingPings.length}
                  </span>
                  {pendingPings.length > 0 ? (
                    <button
                      type="button"
                      className="alfa-registry-pings-clear"
                      onClick={clearAll}
                      title="Ack every pending ping"
                    >
                      <Trash2 className="h-3 w-3" /> Clear all
                    </button>
                  ) : null}
                </header>
                {pendingPings.length === 0 ? (
                  <p className="alfa-registry-help">
                    No activity yet. Live nudges appear here when the scheduler flags a
                    <code> waiting </code> or <code> done </code> event for one of your targets.
                  </p>
                ) : (
                  <div className="alfa-registry-pings-groups">
                    {pingGroups.map((group) => {
                      const collapsed = collapsedGroups.has(group.sessionId);
                      return (
                        <section
                          key={group.sessionId}
                          className="alfa-registry-pings-group"
                          data-collapsed={collapsed || undefined}
                        >
                          <header className="alfa-registry-pings-group-head">
                            <button
                              type="button"
                              className="alfa-registry-pings-group-toggle"
                              onClick={() => toggleGroup(group.sessionId)}
                              aria-expanded={!collapsed}
                            >
                              <ChevronRight className="alfa-registry-pings-group-chevron h-3 w-3" />
                              <span className="alfa-registry-pings-group-title">{group.title}</span>
                              <span className="alfa-registry-pings-group-count">
                                {group.items.length}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="alfa-registry-pings-clear"
                              onClick={() => clearGroup(group.sessionId)}
                              title={`Ack all pings for ${group.title}`}
                            >
                              <Trash2 className="h-3 w-3" /> Clear
                            </button>
                          </header>
                          {collapsed ? null : (
                            <ul className="alfa-registry-pings-list">
                              {group.items.map((ping) => (
                                <li key={ping.id}>
                                  <span
                                    className="alfa-registry-ping-event"
                                    data-event={ping.activityState}
                                  >
                                    {ping.activityState}
                                  </span>
                                  <span className="alfa-registry-ping-title">{ping.title}</span>
                                  <button
                                    type="button"
                                    className="alfa-registry-ping-ack"
                                    onClick={() => onAckPing(ping.id)}
                                  >
                                    ack
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
