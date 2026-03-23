'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Folder, PanelTop, RefreshCw, TerminalSquare } from 'lucide-react';

import { CollapsiblePanel } from '@/components/dashboard/collapsible-panel';
import { AgentPresetCard } from '@/components/terminals/agent-preset-card';
import { EnvironmentCard } from '@/components/terminals/environment-card';
import {
  LauncherCard,
  type TerminalProfileOption,
} from '@/components/terminals/launcher-card';
import { TerminalPane } from '@/components/terminals/terminal-pane';
import { SESSION_STORAGE_KEY } from '@/components/terminals/utils';
import type {
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
  TerminalSession,
} from '@/lib/types';

interface TerminalListResponse {
  profiles?: TerminalProfileOption[];
  sessions?: TerminalSession[];
  environments?: RuntimeEnvironmentSummary[];
  agentProfiles?: RuntimeResolvedAgentProfile[];
}

export default function TerminalsPage() {
  const [profiles, setProfiles] = useState<TerminalProfileOption[]>([]);
  const [environments, setEnvironments] = useState<RuntimeEnvironmentSummary[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<RuntimeResolvedAgentProfile[]>([]);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showActiveTerminals, setShowActiveTerminals] = useState(true);
  const [showBaseLaunchers, setShowBaseLaunchers] = useState(true);
  const [showAgentLaunchers, setShowAgentLaunchers] = useState(true);
  const [showEnvironmentLaunchers, setShowEnvironmentLaunchers] = useState(true);
  const [launchLayoutInitialized, setLaunchLayoutInitialized] = useState(false);

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
    if (loading || launchLayoutInitialized) return;
    if (sessions.length > 0) {
      setShowActiveTerminals(true);
      setShowBaseLaunchers(false);
      setShowAgentLaunchers(false);
      setShowEnvironmentLaunchers(false);
    }
    setLaunchLayoutInitialized(true);
  }, [launchLayoutInitialized, loading, sessions.length]);

  async function createSession(body: Record<string, unknown>, key: string) {
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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create terminal');
    } finally {
      setCreatingKey(null);
    }
  }

  async function closeSession(id: string) {
    try {
      await fetch(`/api/terminals/${id}`, { method: 'DELETE' });
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch {
      setError('Failed to close terminal');
    }
  }

  function updateSession(nextSession: TerminalSession) {
    const normalizedSession = { ...nextSession, skills: nextSession.skills ?? [] };
    setSessions((current) => {
      const exists = current.some((session) => session.id === normalizedSession.id);
      if (!exists) {
        return [normalizedSession, ...current];
      }
      return current.map((session) =>
        session.id === normalizedSession.id ? normalizedSession : session
      );
    });
  }

  const runningCount = useMemo(
    () => sessions.filter((session) => session.status === 'running').length,
    [sessions]
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_minmax(360px,0.9fr)]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(8,47,73,0.92),rgba(15,23,42,0.98))] p-6 shadow-[0_40px_120px_-60px_rgba(14,165,233,0.65)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.12),transparent_24%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-300">
                <PanelTop className="h-3.5 w-3.5" />
                Live Agent Cockpit
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Multi-agent terminals, bound environments, and reconnect-safe sessions.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Launch an empty shell inside a known workspace or jump straight into Codex,
                  Claude, Gemini, or OpenClaw with environment variables and skill context already attached.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-[340px]">
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Live panes</p>
                <p className="mt-2 text-3xl font-semibold text-white">{sessions.length}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Running</p>
                <p className="mt-2 text-3xl font-semibold text-white">{runningCount}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Environments</p>
                <p className="mt-2 text-3xl font-semibold text-white">{environments.length}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Agent presets</p>
                <p className="mt-2 text-3xl font-semibold text-white">{agentProfiles.length}</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.55)]">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <RefreshCw className="h-4 w-4 text-cyan-300" />
            Connection behavior
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <li>Browser panes stream through a same-origin event channel so Tailscale and proxies stay stable.</li>
            <li>Input still lands on the host PTY immediately, with pane status showing `connecting`, `reconnecting`, and `connected`.</li>
            <li>Sessions live in the host agent and reattach after browser reloads.</li>
            <li>Launcher panels collapse once sessions exist, so active terminals stay within reach.</li>
          </ul>
        </aside>
      </section>

      {error ? (
        <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <CollapsiblePanel
        title="Active terminals"
        description="This section is kept at the top so you can jump straight into open panes without scrolling past launchers."
        open={showActiveTerminals}
        onToggle={() => setShowActiveTerminals((current) => !current)}
        badge={
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
            {sessions.length} open
          </span>
        }
      >
        {loading ? (
          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 px-5 py-12 text-sm text-slate-400">
            Loading terminal sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-black/20 px-5 py-12 text-sm text-slate-400">
            No active terminals yet. Launch one of the presets below to start.
          </div>
        ) : (
          <section className="grid gap-4 2xl:grid-cols-2">
            {sessions.map((session) => (
              <TerminalPane
                key={session.id}
                session={session}
                onUpdate={updateSession}
                onClose={closeSession}
              />
            ))}
          </section>
        )}
      </CollapsiblePanel>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <CollapsiblePanel
          title="Base terminals"
          description="Spawn an empty shell or jump straight into a CLI agent. Missing binaries fall back to a shell."
          open={showBaseLaunchers}
          onToggle={() => setShowBaseLaunchers((current) => !current)}
          badge={<TerminalSquare className="h-4 w-4 text-cyan-300" />}
        >
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <LauncherCard
                key={profile.profile}
                profile={profile}
                busy={creatingKey === `profile:${profile.profile}`}
                onLaunch={() => createSession({ profile: profile.profile }, `profile:${profile.profile}`)}
              />
            ))}
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Agent presets"
          description="These presets carry the AI model, target environment, and skill list so you can launch the right agent in one click."
          open={showAgentLaunchers}
          onToggle={() => setShowAgentLaunchers((current) => !current)}
          badge={<Cpu className="h-4 w-4 text-orange-300" />}
        >
          <div className="grid gap-3 xl:grid-cols-2">
            {agentProfiles.map((profile) => (
              <AgentPresetCard
                key={profile.id}
                profile={profile}
                busy={creatingKey === `agent:${profile.id}`}
                onLaunch={() => createSession({ agentProfileId: profile.id }, `agent:${profile.id}`)}
              />
            ))}
          </div>
        </CollapsiblePanel>
      </section>

      <CollapsiblePanel
        title="Environment launcher"
        description="Each environment block is parsed into variables and passed directly into the host PTY before the terminal starts."
        open={showEnvironmentLaunchers}
        onToggle={() => setShowEnvironmentLaunchers((current) => !current)}
        badge={<Folder className="h-4 w-4 text-cyan-300" />}
      >
        <div className="grid gap-3 xl:grid-cols-3">
          {environments.map((environment) => (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              busy={creatingKey === `env:${environment.id}`}
              onLaunch={() =>
                createSession(
                  { profile: 'shell', environmentId: environment.id },
                  `env:${environment.id}`
                )
              }
            />
          ))}
        </div>
      </CollapsiblePanel>
    </div>
  );
}
