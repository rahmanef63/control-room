'use client';

import { useEffect, useState } from 'react';
import {
  ChevronsDown,
  ChevronsUp,
  CopyPlus,
  Cpu,
  FolderInput,
  FolderSearch,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  MoreVertical,
  Plus,
  Rocket,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';

import type { RuntimeResolvedAgentProfile } from '@/shared/types/contracts';
interface WorkspaceLite {
  id: string;
  name: string;
  color?: string;
}

type SkillScope = 'global' | 'project';

interface SkillSummary {
  id: string;
  name: string;
  description: string;
  invocation: string;
  scope: SkillScope;
  source: string;
}

const BYPASS_FLAGS: Record<string, string> = {
  codex: '--yolo',
  claude: '--dangerously-skip-permissions',
  gemini: '--yolo',
};

function buildCommand(profile: RuntimeResolvedAgentProfile, bypass: boolean): string {
  const base = profile.launchCommand || profile.terminalProfile;
  if (!bypass) return base;
  const flagForLaunch = '--dangerously-skip-permissions';
  if (profile.launchCommand) return `${base} ${flagForLaunch}`;
  const flag = BYPASS_FLAGS[profile.terminalProfile];
  return flag ? `${base} ${flag}` : base;
}

interface PaneActionsMenuProps {
  agentProfiles: RuntimeResolvedAgentProfile[];
  disabled: boolean;
  onInject: (command: string) => void;
  cwd: string;
  workspaces: WorkspaceLite[];
  currentWorkspaceId: string;
  zoomDisabledIn: boolean;
  zoomDisabledOut: boolean;
  fullscreen: boolean;
  viewMode: 'single' | 'grid';
  onBrowse: () => void;
  onDuplicate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomMin: () => void;
  onZoomMax: () => void;
  onMoveToWorkspace: (workspaceId: string) => void;
  onToggleFullscreen: () => void;
  onFocus: () => void;
  onClose: () => void;
  /** Controlled open state. When provided, the menu reports open changes via
   *  onOpenChange instead of holding its own — lets the mobile cluster drive it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in ⋮ trigger (mobile cluster supplies its own entry). */
  hideTrigger?: boolean;
}

type Tab = 'agents' | 'skills' | 'actions';

export function PaneActionsMenu({
  agentProfiles,
  disabled,
  onInject,
  cwd,
  workspaces,
  currentWorkspaceId,
  zoomDisabledIn,
  zoomDisabledOut,
  fullscreen,
  viewMode,
  onBrowse,
  onDuplicate,
  onZoomIn,
  onZoomOut,
  onZoomMin,
  onZoomMax,
  onMoveToWorkspace,
  onToggleFullscreen,
  onFocus,
  onClose: onClosePane,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: PaneActionsMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };
  const [tab, setTab] = useState<Tab>('actions');
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillsLoadedFor, setSkillsLoadedFor] = useState<string | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (skillsLoadedFor === cwd) return;
    let cancelled = false;
    setSkillsLoading(true);
    setSkillsError(null);
    const url = cwd ? `/api/skills?cwd=${encodeURIComponent(cwd)}` : '/api/skills';
    fetch(url)
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload?.skills)) {
          setSkills(payload.skills);
        } else if (payload?.error) {
          setSkillsError(String(payload.error));
        }
        setSkillsLoadedFor(cwd);
      })
      .catch((caught) => {
        if (!cancelled) {
          setSkillsError(caught instanceof Error ? caught.message : 'Skills failed');
        }
      })
      .finally(() => {
        if (!cancelled) setSkillsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cwd, skillsLoadedFor]);

  const projectSkills = skills.filter((s) => s.scope === 'project');
  const globalSkills = skills.filter((s) => s.scope === 'global');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-bind when `open` changes; setOpen is a stable local closure.
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pane-action-btn"
          title="Pane actions"
          aria-label="Open pane actions"
          data-tone="ai"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}

      {open ? (
        <div className="pane-actions-overlay" role="dialog" aria-modal="true">
          <div className="pane-actions-backdrop" onClick={close} />
          <div className="pane-actions-panel">
            <header className="pane-actions-header">
              <div className="pane-actions-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'agents'}
                  className="pane-actions-tab"
                  data-active={tab === 'agents' || undefined}
                  onClick={() => setTab('agents')}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  <span>Agents</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'skills'}
                  className="pane-actions-tab"
                  data-active={tab === 'skills' || undefined}
                  onClick={() => setTab('skills')}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Skills</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'actions'}
                  className="pane-actions-tab"
                  data-active={tab === 'actions' || undefined}
                  onClick={() => setTab('actions')}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Actions</span>
                </button>
              </div>
              <button
                type="button"
                onClick={close}
                className="topbar-icon-button"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="pane-actions-body">
              {tab === 'agents' && (
                agentProfiles.length === 0 ? (
                  <p className="pane-actions-empty">No agent profiles configured</p>
                ) : (
                  agentProfiles.map((profile) => (
                    <div key={profile.id} className="agent-inject-row">
                      <div className="agent-inject-row-head">
                        <Rocket className="h-3.5 w-3.5 text-sky-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {profile.label}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {profile.model}
                          </p>
                        </div>
                      </div>
                      <div className="agent-inject-row-actions">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            onInject(buildCommand(profile, false));
                            close();
                          }}
                          className="agent-inject-btn"
                          data-tone="regular"
                        >
                          <Shield className="h-3 w-3" /> Regular
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            onInject(buildCommand(profile, true));
                            close();
                          }}
                          className="agent-inject-btn"
                          data-tone="bypass"
                        >
                          <Zap className="h-3 w-3" /> Bypass
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
              {tab === 'skills' && (skillsLoading ? (
                <div className="pane-actions-empty">
                  <Loader2 className="mr-2 inline h-3 w-3 animate-spin" />
                  Loading…
                </div>
              ) : skillsError ? (
                <p className="pane-actions-empty text-destructive">{skillsError}</p>
              ) : skills.length === 0 ? (
                <p className="pane-actions-empty">No skills installed</p>
              ) : (
                <>
                  {projectSkills.length > 0 ? (
                    <div className="skills-section">
                      <p className="skills-section-label">Project</p>
                      {projectSkills.map((skill) => (
                        <button
                          key={`project-${skill.id}`}
                          type="button"
                          onClick={() => {
                            onInject(skill.invocation);
                            close();
                          }}
                          className="folder-menu-item"
                          data-kind="agent"
                          title={skill.source}
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-emerald-300" />
                            <span className="folder-menu-label">{skill.name}</span>
                          </span>
                          {skill.description ? (
                            <span className="folder-menu-path line-clamp-2">{skill.description}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {globalSkills.length > 0 ? (
                    <div className="skills-section">
                      <p className="skills-section-label">Global</p>
                      {globalSkills.map((skill) => (
                        <button
                          key={`global-${skill.id}`}
                          type="button"
                          onClick={() => {
                            onInject(skill.invocation);
                            close();
                          }}
                          className="folder-menu-item"
                          data-kind="agent"
                          title={skill.source}
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-fuchsia-300" />
                            <span className="folder-menu-label">{skill.name}</span>
                          </span>
                          {skill.description ? (
                            <span className="folder-menu-path line-clamp-2">{skill.description}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ))}
              {tab === 'actions' && (
                <>
                  <div className="skills-section">
                    <p className="skills-section-label">View</p>
                    <button
                      type="button"
                      className="folder-menu-item"
                      data-kind="agent"
                      onClick={() => {
                        if (viewMode === 'grid') onFocus();
                        else onToggleFullscreen();
                        close();
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {fullscreen ? (
                          <Minimize2 className="h-3 w-3" />
                        ) : (
                          <Maximize2 className="h-3 w-3" />
                        )}
                        <span className="folder-menu-label">
                          {viewMode === 'grid'
                            ? 'Focus this terminal'
                            : fullscreen
                              ? 'Exit fullscreen'
                              : 'Maximize'}
                        </span>
                      </span>
                    </button>
                    <div className="actions-zoom-row">
                      <button
                        type="button"
                        className="folder-menu-item flex-1"
                        data-kind="agent"
                        onClick={onZoomMin}
                        disabled={zoomDisabledOut}
                        title="Zoom to minimum"
                      >
                        <span className="flex items-center gap-1">
                          <ChevronsDown className="h-3 w-3" />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="folder-menu-item flex-1"
                        data-kind="agent"
                        onClick={onZoomOut}
                        disabled={zoomDisabledOut}
                        title="Zoom out"
                      >
                        <span className="flex items-center gap-1">
                          <Minus className="h-3 w-3" />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="folder-menu-item flex-1"
                        data-kind="agent"
                        onClick={onZoomIn}
                        disabled={zoomDisabledIn}
                        title="Zoom in"
                      >
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="folder-menu-item flex-1"
                        data-kind="agent"
                        onClick={onZoomMax}
                        disabled={zoomDisabledIn}
                        title="Zoom to maximum"
                      >
                        <span className="flex items-center gap-1">
                          <ChevronsUp className="h-3 w-3" />
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="skills-section">
                    <p className="skills-section-label">Pane</p>
                    <button
                      type="button"
                      className="folder-menu-item"
                      data-kind="agent"
                      onClick={() => { onBrowse(); close(); }}
                      disabled={disabled}
                    >
                      <span className="flex items-center gap-1.5">
                        <FolderSearch className="h-3 w-3" />
                        <span className="folder-menu-label">Browse folders</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="folder-menu-item"
                      data-kind="agent"
                      onClick={() => { onDuplicate(); close(); }}
                    >
                      <span className="flex items-center gap-1.5">
                        <CopyPlus className="h-3 w-3" />
                        <span className="folder-menu-label">Duplicate terminal</span>
                      </span>
                    </button>
                  </div>

                  <div className="skills-section">
                    <p className="skills-section-label">Move to workspace</p>
                    {workspaces.length === 0 ? (
                      <p className="pane-actions-empty">No workspaces</p>
                    ) : (
                      workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          type="button"
                          className="folder-menu-item"
                          data-kind="agent"
                          onClick={() => { onMoveToWorkspace(ws.id); close(); }}
                          disabled={ws.id === currentWorkspaceId}
                          title={ws.id === currentWorkspaceId ? 'Already in this workspace' : `Move to ${ws.name}`}
                        >
                          <span className="flex items-center gap-1.5">
                            <FolderInput className="h-3 w-3" style={{ color: ws.color }} />
                            <span className="folder-menu-label">{ws.name}</span>
                          </span>
                          {ws.id === currentWorkspaceId ? (
                            <span className="folder-menu-path">current</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="skills-section">
                    <p className="skills-section-label">Danger</p>
                    <button
                      type="button"
                      className="folder-menu-item"
                      data-kind="recent"
                      style={{ color: '#fca5a5' }}
                      onClick={() => { onClosePane(); close(); }}
                    >
                      <span className="flex items-center gap-1.5">
                        <Trash2 className="h-3 w-3" />
                        <span className="folder-menu-label">Close terminal</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
