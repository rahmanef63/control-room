'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Cpu, Folder, Rocket, TerminalSquare, X, Zap } from 'lucide-react';

import type { RuntimeEnvironmentSummary, RuntimeResolvedAgentProfile } from '@/shared/types/contracts';
import { Button } from '@/components/ui/button';
import { TerminalProfileIcon } from '@/features/terminals/components/terminal-profile-icon';
import type { TerminalProfileOption } from '@/features/terminals/components/launcher-card';

export type LauncherTab = 'base' | 'agents' | 'envs';

export interface LauncherDrawerProps {
  open: boolean;
  tab: LauncherTab;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: LauncherTab) => void;
  profiles: TerminalProfileOption[];
  environments: RuntimeEnvironmentSummary[];
  agentProfiles: RuntimeResolvedAgentProfile[];
  creatingKey: string | null;
  onLaunchProfile: (profileKey: TerminalProfileOption['profile']) => void;
  onLaunchAgent: (
    agentId: string,
    options: { dangerouslyAllow?: boolean; useActiveDir?: boolean }
  ) => void;
  onLaunchEnvironment: (environmentId: string) => void;
}

export function LauncherDrawer({
  open,
  tab,
  onOpenChange,
  onTabChange,
  profiles,
  environments,
  agentProfiles,
  creatingKey,
  onLaunchProfile,
  onLaunchAgent,
  onLaunchEnvironment,
}: LauncherDrawerProps) {
  const [useActiveDir, setUseActiveDir] = useState(false);
  const [openAgentMenu, setOpenAgentMenu] = useState<string | null>(null);
  const agentMenuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openAgentMenu) return;
    function handleOutside(event: MouseEvent) {
      if (!agentMenuContainerRef.current) return;
      if (!agentMenuContainerRef.current.contains(event.target as Node)) {
        setOpenAgentMenu(null);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openAgentMenu]);

  function close() {
    onOpenChange(false);
  }

  function handleLaunchProfile(profileKey: TerminalProfileOption['profile']) {
    onLaunchProfile(profileKey);
    close();
  }

  function handleLaunchAgent(
    agentId: string,
    options: { dangerouslyAllow?: boolean; useActiveDir?: boolean }
  ) {
    onLaunchAgent(agentId, options);
    close();
  }

  function handleLaunchEnv(environmentId: string) {
    onLaunchEnvironment(environmentId);
    close();
  }

  if (!open) return null;

  return (
    <div className="launcher-drawer-backdrop" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Launch terminal"
            onClick={(event) => event.stopPropagation()}
            className="launcher-drawer-sheet"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Launch terminal</p>
                <p className="text-[11px] text-muted-foreground">Pick a preset or environment to open a new pane.</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
                aria-label="Close launcher"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1.5 border-b border-border/60 px-3 py-2">
              <TabButton active={tab === 'base'} onClick={() => onTabChange('base')} icon={<TerminalSquare className="h-3.5 w-3.5" />}>
                Base
              </TabButton>
              <TabButton active={tab === 'agents'} onClick={() => onTabChange('agents')} icon={<Cpu className="h-3.5 w-3.5" />}>
                Agents
              </TabButton>
              <TabButton active={tab === 'envs'} onClick={() => onTabChange('envs')} icon={<Folder className="h-3.5 w-3.5" />}>
                Envs
              </TabButton>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
              {tab === 'base' ? (
                <div className="grid gap-2">
                  {profiles.length === 0 ? (
                    <EmptyRow label="No base profiles available." />
                  ) : (
                    profiles.map((profile) => {
                      const busy = creatingKey === `profile:${profile.profile}`;
                      return (
                        <button
                          key={profile.profile}
                          type="button"
                          onClick={() => handleLaunchProfile(profile.profile)}
                          disabled={busy}
                          data-profile={profile.profile}
                          className="launch-row"
                        >
                          <span className="launch-row-icon">
                            <TerminalProfileIcon profile={profile.profile} />
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {busy ? 'Launching…' : profile.title}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {profile.description}
                            </span>
                          </span>
                          <span className="dashboard-chip shrink-0">{profile.profile}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}

              {tab === 'agents' ? (
                <div className="space-y-3">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px]">
                    <span className="text-muted-foreground">Working dir</span>
                    <button
                      type="button"
                      onClick={() => setUseActiveDir((value) => !value)}
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        useActiveDir
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                          : 'border-border/70 bg-background/60 text-muted-foreground'
                      }`}
                    >
                      {useActiveDir ? 'Agent default' : 'Env cwd'}
                    </button>
                  </label>

                  <div ref={agentMenuContainerRef} className="grid gap-2">
                    {agentProfiles.length === 0 ? (
                      <EmptyRow label="No agent presets configured." />
                    ) : (
                      agentProfiles.map((agent) => {
                        const busy = creatingKey === `agent:${agent.id}`;
                        const skills = agent.skills ?? [];
                        const menuOpen = openAgentMenu === agent.id;
                        return (
                          <div
                            key={agent.id}
                            data-profile={agent.terminalProfile}
                            className="launch-row-card"
                          >
                            <div className="flex items-start gap-3">
                              <span className="launch-row-icon">
                                <TerminalProfileIcon profile={agent.terminalProfile} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{agent.label}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{agent.description}</p>
                                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                                  <span className="dashboard-chip" data-tone="accent">{agent.model}</span>
                                  {agent.environmentLabel ? <span className="dashboard-chip">{agent.environmentLabel}</span> : null}
                                  {skills.length > 0 ? <span className="dashboard-chip">{skills.length} skills</span> : null}
                                </div>
                              </div>
                            </div>
                            <div className="relative mt-3">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setOpenAgentMenu((cur) => (cur === agent.id ? null : agent.id))}
                                className="agent-launch-trigger"
                                aria-expanded={menuOpen}
                              >
                                <Rocket className="h-4 w-4" />
                                <span>{busy ? 'Starting…' : 'Launch'}</span>
                                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                              </button>
                              {menuOpen ? (
                                <div className="agent-launch-menu">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setOpenAgentMenu(null);
                                      handleLaunchAgent(agent.id, { useActiveDir });
                                    }}
                                    className="agent-launch-menu-item"
                                  >
                                    <Rocket className="h-4 w-4 text-sky-300" />
                                    <div className="flex-1 text-left">
                                      <p className="text-sm font-semibold">Regular</p>
                                      <p className="text-[11px] text-muted-foreground">Safe mode with prompts</p>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setOpenAgentMenu(null);
                                      handleLaunchAgent(agent.id, { dangerouslyAllow: true, useActiveDir });
                                    }}
                                    className="agent-launch-menu-item"
                                    data-tone="danger"
                                  >
                                    <Zap className="h-4 w-4 text-orange-300" />
                                    <div className="flex-1 text-left">
                                      <p className="text-sm font-semibold text-orange-200">YOLO</p>
                                      <p className="text-[11px] text-orange-300/70">Skip all permissions</p>
                                    </div>
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {tab === 'envs' ? (
                <div className="grid gap-2">
                  {environments.length === 0 ? (
                    <EmptyRow label="No environments configured." />
                  ) : (
                    environments.map((environment) => {
                      const busy = creatingKey === `env:${environment.id}`;
                      return (
                        <button
                          key={environment.id}
                          type="button"
                          onClick={() => handleLaunchEnv(environment.id)}
                          disabled={busy}
                          className="launch-row"
                        >
                          <span className="launch-row-icon">
                            <Folder className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {busy ? 'Opening…' : environment.label}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">
                              {environment.cwd}
                            </span>
                          </span>
                          <span className="dashboard-chip shrink-0">{environment.envVarCount} env</span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        active
          ? 'border-sky-500/40 bg-sky-500/10 text-sky-100'
          : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-6 text-center text-[11px] text-muted-foreground">
      {label}
    </div>
  );
}
