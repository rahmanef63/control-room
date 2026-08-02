'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Copy, Pencil, Play, Plus, Trash2, X } from 'lucide-react';

import type { TerminalProfileOption } from '@/features/terminals/components/launcher-card';
import type { Workspace } from '@/features/terminals/hooks/use-workspaces';
import type {
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
  TerminalProfile,
  TerminalSession,
} from '@/shared/types/contracts';

import type {
  TemplateCreateInput,
  TemplateUpdateInput,
  TerminalTemplate,
} from '@/features/templates/types';

interface TemplatesDrawerProps {
  open: boolean;
  templates: TerminalTemplate[];
  profiles: TerminalProfileOption[];
  agentProfiles: RuntimeResolvedAgentProfile[];
  environments: RuntimeEnvironmentSummary[];
  workspaces: Workspace[];
  activeSession: TerminalSession | null;
  activeWorkspaceId: string;
  onClose: () => void;
  onCreate: (input: TemplateCreateInput) => TerminalTemplate;
  onUpdate: (id: string, input: TemplateUpdateInput) => TerminalTemplate | null;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => TerminalTemplate | null;
  onLaunch: (template: TerminalTemplate) => void;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  profile: TerminalProfile | '';
  agentProfileId: string;
  environmentId: string;
  cwd: string;
  initialCommand: string;
  customTitle: string;
  workspaceId: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  profile: 'shell',
  agentProfileId: '',
  environmentId: '',
  cwd: '',
  initialCommand: '',
  customTitle: '',
  workspaceId: '',
};

function templateToForm(t: TerminalTemplate): FormState {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    profile: (t.profile as TerminalProfile) ?? 'shell',
    agentProfileId: t.agentProfileId ?? '',
    environmentId: t.environmentId ?? '',
    cwd: t.cwd ?? '',
    initialCommand: t.initialCommand ?? '',
    customTitle: t.customTitle ?? '',
    workspaceId: t.workspaceId ?? '',
  };
}

function sessionToForm(s: TerminalSession, defaults: { workspaceId?: string }): FormState {
  return {
    name: s.title,
    description: '',
    profile: s.profile,
    agentProfileId: s.agent_profile_id ?? '',
    environmentId: s.environment_id ?? '',
    cwd: s.cwd,
    initialCommand: '',
    customTitle: s.title,
    workspaceId: defaults.workspaceId ?? '',
  };
}

function formToCreate(form: FormState): TemplateCreateInput {
  return {
    name: form.name,
    description: form.description || undefined,
    profile: form.profile || undefined,
    agentProfileId: form.agentProfileId || undefined,
    environmentId: form.environmentId || undefined,
    cwd: form.cwd || undefined,
    initialCommand: form.initialCommand || undefined,
    customTitle: form.customTitle || undefined,
    workspaceId: form.workspaceId || undefined,
  };
}

export function TemplatesDrawer({
  open,
  templates,
  profiles,
  agentProfiles,
  environments,
  workspaces,
  activeSession,
  activeWorkspaceId,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onDuplicate,
  onLaunch,
}: TemplatesDrawerProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  function startCreate() {
    setForm({ ...EMPTY_FORM, workspaceId: activeWorkspaceId });
    setEditing(true);
  }

  function startCreateFromActive() {
    if (!activeSession) {
      startCreate();
      return;
    }
    setForm(sessionToForm(activeSession, { workspaceId: activeWorkspaceId }));
    setEditing(true);
  }

  function startEdit(t: TerminalTemplate) {
    setForm(templateToForm(t));
    setEditing(true);
  }

  function cancelEdit() {
    setForm(EMPTY_FORM);
    setEditing(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.id) {
      onUpdate(form.id, formToCreate(form));
    } else {
      onCreate(formToCreate(form));
    }
    cancelEdit();
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Templates">
      <div className="settings-backdrop" onClick={onClose} />
      <div className="settings-panel">
        <header className="settings-header">
          <h2>Templates · quick launch</h2>
          <button
            type="button"
            onClick={onClose}
            className="topbar-icon-button"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {!editing ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={startCreate}
                className="new-terminal-trigger flex-1 justify-center"
              >
                <Plus className="h-4 w-4" />
                <span>Blank template</span>
              </button>
              <button
                type="button"
                onClick={startCreateFromActive}
                disabled={!activeSession}
                className="ai-terminal-trigger flex-1 justify-center disabled:opacity-50"
              >
                <Bookmark className="h-4 w-4" />
                <span>{activeSession ? `Save "${activeSession.title}"` : 'No active session'}</span>
              </button>
            </div>

            {templates.length === 0 ? (
              <p className="settings-help">
                No templates yet. Save the current terminal or create a blank template.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {templates.map((t) => (
                  <li key={t.id} className="cron-card">
                    <div className="cron-card-head">
                      <span
                        className="workspace-tab-dot"
                        style={t.color ? { backgroundColor: t.color } : undefined}
                      />
                      <strong className="flex-1 truncate">{t.name}</strong>
                      <code className="cron-expr">{t.profile ?? 'shell'}</code>
                    </div>
                    {t.description ? (
                      <p className="settings-help" style={{ padding: 0 }}>
                        {t.description}
                      </p>
                    ) : null}
                    <div className="cron-card-meta">
                      {t.cwd ? <span className="font-mono">{t.cwd}</span> : null}
                      {t.initialCommand ? (
                        <span className="font-mono">$ {t.initialCommand}</span>
                      ) : null}
                      {t.workspaceId ? (
                        <span>
                          ws: {workspaces.find((w) => w.id === t.workspaceId)?.name ?? t.workspaceId}
                        </span>
                      ) : null}
                    </div>
                    <div className="cron-card-actions">
                      <button
                        type="button"
                        onClick={() => onLaunch(t)}
                        className="topbar-icon-button"
                        title="Launch"
                        aria-label="Launch template"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="topbar-icon-button"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicate(t.id)}
                        className="topbar-icon-button"
                        title="Duplicate"
                        aria-label="Duplicate template"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete template "${t.name}"?`)) onDelete(t.id);
                        }}
                        className="topbar-icon-button"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="settings-row">
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="settings-select"
                style={{ flex: 1, maxWidth: 'none' }}
              />
            </label>
            <label className="settings-row">
              <span>Description</span>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="settings-select"
                style={{ flex: 1, maxWidth: 'none' }}
              />
            </label>
            <label className="settings-row">
              <span>Profile</span>
              <select
                value={form.profile}
                onChange={(e) =>
                  setForm({ ...form, profile: e.target.value as TerminalProfile })
                }
                className="settings-select"
              >
                {profiles.map((p) => (
                  <option key={p.profile} value={p.profile}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span>Agent profile</span>
              <select
                value={form.agentProfileId}
                onChange={(e) => setForm({ ...form, agentProfileId: e.target.value })}
                className="settings-select"
              >
                <option value="">—</option>
                {agentProfiles.map((ap) => (
                  <option key={ap.id} value={ap.id}>
                    {ap.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span>Environment</span>
              <select
                value={form.environmentId}
                onChange={(e) => setForm({ ...form, environmentId: e.target.value })}
                className="settings-select"
              >
                <option value="">—</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span>Workspace</span>
              <select
                value={form.workspaceId}
                onChange={(e) => setForm({ ...form, workspaceId: e.target.value })}
                className="settings-select"
              >
                <option value="">— current —</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span>cwd</span>
              <input
                type="text"
                value={form.cwd}
                onChange={(e) => setForm({ ...form, cwd: e.target.value })}
                placeholder="/absolute/path"
                className="settings-select font-mono"
                style={{ flex: 1, maxWidth: 'none' }}
              />
            </label>
            <label className="settings-row">
              <span>Initial command</span>
              <input
                type="text"
                value={form.initialCommand}
                onChange={(e) => setForm({ ...form, initialCommand: e.target.value })}
                placeholder="npm run dev"
                className="settings-select font-mono"
                style={{ flex: 1, maxWidth: 'none' }}
              />
            </label>
            <label className="settings-row">
              <span>Custom title</span>
              <input
                type="text"
                value={form.customTitle}
                onChange={(e) => setForm({ ...form, customTitle: e.target.value })}
                placeholder="(uses session default)"
                className="settings-select"
                style={{ flex: 1, maxWidth: 'none' }}
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="new-terminal-trigger flex-1 justify-center">
                {form.id ? 'Save' : 'Create'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="topbar-icon-button px-3 w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
