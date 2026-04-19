'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Download, Grid2x2, LogOut, Plus, RadioTower, RefreshCw, Rows, TerminalSquare } from 'lucide-react';

import { LauncherDrawer, type LauncherTab } from '@/features/terminals/components/launcher-drawer';
import type { TerminalProfileOption } from '@/features/terminals/components/launcher-card';
import { SessionTabs } from '@/features/terminals/components/session-tabs';
import { TerminalPane } from '@/features/terminals/components/terminal-pane';
import {
  ACTIVE_SESSION_KEY,
  clampFontSize,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_STORAGE_KEY,
  GRID_COLS_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  VIEW_MODE_STORAGE_KEY,
  type ActivityState,
} from '@/features/terminals/lib/utils';
import { usePwaInstall } from '@/shared/pwa/use-pwa-install';
import type {
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
  TerminalSession,
} from '@/shared/types/contracts';

interface TerminalListResponse {
  profiles?: TerminalProfileOption[];
  sessions?: TerminalSession[];
  environments?: RuntimeEnvironmentSummary[];
  agentProfiles?: RuntimeResolvedAgentProfile[];
}

export default function TerminalsPage() {
  const router = useRouter();
  const { canInstall, install } = usePwaInstall();
  const [profiles, setProfiles] = useState<TerminalProfileOption[]>([]);
  const [environments, setEnvironments] = useState<RuntimeEnvironmentSummary[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<RuntimeResolvedAgentProfile[]>([]);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherTab, setLauncherTab] = useState<LauncherTab>('base');
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [gridCols, setGridCols] = useState<'auto' | '1' | '2' | '3' | '4'>('auto');
  const [fontSizes, setFontSizes] = useState<Record<string, number>>({});
  const [activityStates, setActivityStates] = useState<Record<string, ActivityState>>({});
  const [broadcast, setBroadcast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        const cleaned: Record<string, number> = {};
        for (const [id, size] of Object.entries(parsed)) {
          cleaned[id] = clampFontSize(Number(size));
        }
        setFontSizes(cleaned);
      }
      const storedView = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (storedView === 'grid' || storedView === 'single') {
        setViewMode(storedView);
      }
      const storedCols = window.localStorage.getItem(GRID_COLS_STORAGE_KEY);
      if (storedCols && ['auto', '1', '2', '3', '4'].includes(storedCols)) {
        setGridCols(storedCols as typeof gridCols);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, JSON.stringify(fontSizes));
    } catch {
      // ignore
    }
  }, [fontSizes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GRID_COLS_STORAGE_KEY, gridCols);
    } catch {
      // ignore
    }
  }, [gridCols]);

  const setFontSize = useCallback((id: string, size: number) => {
    setFontSizes((current) => ({ ...current, [id]: clampFontSize(size) }));
  }, []);

  const handleActivityChange = useCallback((id: string, state: ActivityState) => {
    setActivityStates((current) => (current[id] === state ? current : { ...current, [id]: state }));
  }, []);

  const focusSession = useCallback((id: string) => {
    setActiveId(id);
    setViewMode('single');
  }, []);

  function openLauncher(tab: LauncherTab) {
    setLauncherTab(tab);
    setLauncherOpen(true);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/terminals');
        const payload = (await response.json()) as TerminalListResponse;
        if (cancelled) return;

        const profileList = payload.profiles ?? [];
        const environmentList = payload.environments ?? [];
        const agentProfileList = (payload.agentProfiles ?? []).map((profile) => ({
          ...profile,
          skills: profile.skills ?? [],
        }));
        const sessionList = (payload.sessions ?? []).map((session) => ({
          ...session,
          skills: session.skills ?? [],
        }));

        const persistedIds =
          typeof window !== 'undefined'
            ? JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? '[]')
            : [];
        const orderedSessions =
          Array.isArray(persistedIds) && persistedIds.length > 0
            ? [
                ...sessionList.filter((session) => persistedIds.includes(session.id)),
                ...sessionList.filter((session) => !persistedIds.includes(session.id)),
              ]
            : sessionList;

        setProfiles(profileList);
        setEnvironments(environmentList);
        setAgentProfiles(agentProfileList);
        setSessions(orderedSessions);

        if (orderedSessions.length > 0) {
          const storedActive =
            typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_SESSION_KEY) : null;
          const candidate =
            storedActive && orderedSessions.some((item) => item.id === storedActive)
              ? storedActive
              : orderedSessions[0].id;
          setActiveId(candidate);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load terminal sessions');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(sessions.map((session) => session.id))
    );
  }, [sessions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeId) {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, activeId);
    }
  }, [activeId]);

  const createSession = useCallback(
    async (
      body: Record<string, unknown> & { dangerouslyAllow?: boolean; useActiveDir?: boolean },
      key: string
    ) => {
      setCreatingKey(key);
      setError(null);

      try {
        const response = await fetch('/api/terminals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const payload = (await response.json()) as { session?: TerminalSession; error?: string };
        if (!response.ok || !payload.session) {
          throw new Error(payload.error || 'Failed to create terminal');
        }

        const nextSession = {
          ...payload.session,
          skills: payload.session.skills ?? [],
        };

        setSessions((current) => [
          nextSession,
          ...current.filter((item) => item.id !== nextSession.id),
        ]);
        setActiveId(nextSession.id);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to create terminal');
      } finally {
        setCreatingKey(null);
      }
    },
    []
  );

  const closeSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/terminals/${id}`, { method: 'DELETE' });
        setSessions((current) => {
          const next = current.filter((session) => session.id !== id);
          if (activeId === id) {
            setActiveId(next[0]?.id ?? null);
          }
          return next;
        });
      } catch {
        setError('Failed to close terminal');
      }
    },
    [activeId]
  );

  const updateSession = useCallback((nextSession: TerminalSession) => {
    const normalized = { ...nextSession, skills: nextSession.skills ?? [] };
    setSessions((current) => {
      const exists = current.some((session) => session.id === normalized.id);
      if (!exists) {
        return [normalized, ...current];
      }
      return current.map((session) => (session.id === normalized.id ? normalized : session));
    });
  }, []);

  const broadcastInput = useCallback(
    (data: string) => {
      for (const session of sessions) {
        if (session.status !== 'running') continue;
        void fetch(`/api/terminals/${encodeURIComponent(session.id)}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
      }
    },
    [sessions]
  );

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="terminal-shell" data-fullscreen={fullscreen || undefined}>
      <header className="terminal-topbar">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/70">
            <TerminalSquare className="h-4 w-4 text-sky-300" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              VPS Terminals
            </p>
            <p className="truncate text-xs text-foreground">
              {sessions.length} pane{sessions.length === 1 ? '' : 's'} ·{' '}
              {sessions.filter((s) => s.status === 'running').length} running
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openLauncher('base')}
            className="new-terminal-trigger"
            aria-label="New terminal"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New</span>
          </button>
          <button
            type="button"
            onClick={() => openLauncher('agents')}
            className="ai-terminal-trigger"
            aria-label="Launch AI agent"
            title="Launch AI agent"
          >
            <Cpu className="h-4 w-4" />
            <span className="hidden sm:inline">AI</span>
            {agentProfiles.length > 0 ? (
              <span className="ai-terminal-badge">{agentProfiles.length}</span>
            ) : null}
          </button>
          {sessions.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setViewMode((mode) => (mode === 'grid' ? 'single' : 'grid'))}
                className="topbar-icon-button"
                title={viewMode === 'grid' ? 'Minimize to single view' : 'Show all terminals'}
                aria-label={viewMode === 'grid' ? 'Minimize to single view' : 'Show all terminals'}
                data-tone={viewMode === 'grid' ? 'accent' : undefined}
              >
                {viewMode === 'grid' ? <Rows className="h-4 w-4" /> : <Grid2x2 className="h-4 w-4" />}
              </button>
              {viewMode === 'grid' ? (
                <select
                  value={gridCols}
                  onChange={(event) => setGridCols(event.target.value as typeof gridCols)}
                  className="grid-cols-select"
                  aria-label="Terminals per row"
                  title="Terminals per row"
                >
                  <option value="auto">Auto</option>
                  <option value="1">1 / row</option>
                  <option value="2">2 / row</option>
                  <option value="3">3 / row</option>
                  <option value="4">4 / row</option>
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => setBroadcast((value) => !value)}
                className="topbar-icon-button"
                title={broadcast ? 'Stop broadcasting input' : 'Broadcast input to all panes'}
                aria-label="Broadcast input"
                data-tone={broadcast ? 'danger' : undefined}
              >
                <RadioTower className="h-4 w-4" />
              </button>
            </>
          ) : null}
          {canInstall ? (
            <button
              type="button"
              onClick={() => void install()}
              className="topbar-icon-button"
              title="Install as app"
              aria-label="Install app"
            >
              <Download className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="topbar-icon-button"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="topbar-icon-button"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <SessionTabs
        sessions={sessions}
        activeId={activeId}
        viewMode={viewMode}
        activityStates={activityStates}
        onSelect={setActiveId}
        onClose={closeSession}
      />

      {error ? (
        <div className="mx-3 mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <main className="terminal-main">
        {loading ? (
          <div className="terminal-empty">Loading terminal sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="terminal-empty">
            <TerminalSquare className="h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-sm font-semibold text-foreground">No terminal open</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Tap <span className="font-semibold text-foreground">New</span> or{' '}
              <span className="font-semibold text-foreground">AI</span> to launch a shell, agent, or environment.
            </p>
          </div>
        ) : (
          <div
            className="terminal-pane-stack"
            data-view={viewMode}
            data-grid-cols={gridCols}
            style={
              gridCols !== 'auto'
                ? ({ '--grid-cols': gridCols } as React.CSSProperties)
                : undefined
            }
          >
            {sessions.map((session) => {
              const slotActive = viewMode === 'grid' ? true : session.id === activeId;
              return (
              <div
                key={session.id}
                className="terminal-pane-slot"
                data-active={slotActive}
                aria-hidden={!slotActive}
              >
                <TerminalPane
                  session={session}
                  active={slotActive}
                  onUpdate={updateSession}
                  onClose={closeSession}
                  fullscreen={fullscreen}
                  onToggleFullscreen={() => setFullscreen((value) => !value)}
                  fontSize={fontSizes[session.id] ?? DEFAULT_FONT_SIZE}
                  onFontSizeChange={setFontSize}
                  onActivityChange={handleActivityChange}
                  viewMode={viewMode}
                  onRequestFocus={focusSession}
                  agentProfiles={agentProfiles}
                  broadcast={broadcast}
                  onBroadcastInput={broadcastInput}
                />
              </div>
              );
            })}
          </div>
        )}
      </main>

      <LauncherDrawer
        open={launcherOpen}
        tab={launcherTab}
        onOpenChange={setLauncherOpen}
        onTabChange={setLauncherTab}
        profiles={profiles}
        environments={environments}
        agentProfiles={agentProfiles}
        creatingKey={creatingKey}
        onLaunchProfile={(profileKey) =>
          void createSession({ profile: profileKey }, `profile:${profileKey}`)
        }
        onLaunchAgent={(agentId, opts) =>
          void createSession({ agentProfileId: agentId, ...opts }, `agent:${agentId}`)
        }
        onLaunchEnvironment={(environmentId) =>
          void createSession({ profile: 'shell', environmentId }, `env:${environmentId}`)
        }
      />
    </div>
  );
}
