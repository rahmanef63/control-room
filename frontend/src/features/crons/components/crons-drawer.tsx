'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Play, Plus, Trash2, X } from 'lucide-react';

import type { TerminalProfileOption } from '@/features/terminals/components/launcher-card';
import type {
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
  TerminalProfile,
  TerminalSession,
} from '@/shared/types/contracts';

import type {
  CronAction,
  CronCreateInput,
  CronEntry,
  CronUpdateInput,
} from '@/features/crons/types';

interface CronsDrawerProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  crons: CronEntry[];
  profiles: TerminalProfileOption[];
  agentProfiles: RuntimeResolvedAgentProfile[];
  environments: RuntimeEnvironmentSummary[];
  sessions: TerminalSession[];
  onClose: () => void;
  onRefresh: () => void;
  onCreate: (input: CronCreateInput) => Promise<CronEntry | null>;
  onUpdate: (id: string, input: CronUpdateInput) => Promise<CronEntry | null>;
  onDelete: (id: string) => Promise<boolean>;
  onRun: (id: string) => Promise<void>;
}

interface FormState {
  id?: string;
  name: string;
  cronExpr: string;
  enabled: boolean;
  actionType: CronAction['type'];
  profile: TerminalProfile | '';
  agentProfileId: string;
  environmentId: string;
  cwd: string;
  initialCommand: string;
  sessionId: string;
  data: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  cronExpr: '*/5 * * * *',
  enabled: true,
  actionType: 'spawn',
  profile: 'shell',
  agentProfileId: '',
  environmentId: '',
  cwd: '',
  initialCommand: '',
  sessionId: '',
  data: '',
};

function entryToForm(entry: CronEntry): FormState {
  if (entry.action.type === 'spawn') {
    return {
      id: entry.id,
      name: entry.name,
      cronExpr: entry.cronExpr,
      enabled: entry.enabled,
      actionType: 'spawn',
      profile: (entry.action.profile as TerminalProfile) ?? 'shell',
      agentProfileId: entry.action.agentProfileId ?? '',
      environmentId: entry.action.environmentId ?? '',
      cwd: entry.action.cwd ?? '',
      initialCommand: entry.action.initialCommand ?? '',
      sessionId: '',
      data: '',
    };
  }
  return {
    id: entry.id,
    name: entry.name,
    cronExpr: entry.cronExpr,
    enabled: entry.enabled,
    actionType: 'send_input',
    profile: 'shell',
    agentProfileId: '',
    environmentId: '',
    cwd: '',
    initialCommand: '',
    sessionId: entry.action.sessionId,
    data: entry.action.data,
  };
}

function formToInput(form: FormState): CronCreateInput {
  const action: CronAction =
    form.actionType === 'spawn'
      ? {
          type: 'spawn',
          profile: form.profile || undefined,
          agentProfileId: form.agentProfileId || undefined,
          environmentId: form.environmentId || undefined,
          cwd: form.cwd || undefined,
          initialCommand: form.initialCommand || undefined,
        }
      : {
          type: 'send_input',
          sessionId: form.sessionId,
          data: form.data,
        };
  return {
    name: form.name,
    cronExpr: form.cronExpr,
    enabled: form.enabled,
    action,
  };
}

export function CronsDrawer({
  open,
  loading,
  error,
  crons,
  profiles,
  agentProfiles,
  environments,
  sessions,
  onClose,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onRun,
}: CronsDrawerProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    setForm(EMPTY_FORM);
    setEditing(true);
  }

  function startEdit(entry: CronEntry) {
    setForm(entryToForm(entry));
    setEditing(true);
  }

  function cancelEdit() {
    setForm(EMPTY_FORM);
    setEditing(false);
  }

  async function submit() {
    setSubmitting(true);
    try {
      if (form.id) {
        await onUpdate(form.id, formToInput(form));
      } else {
        await onCreate(formToInput(form));
      }
      cancelEdit();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Cron jobs">
      <div className="settings-backdrop" onClick={onClose} />
      <div className="settings-panel">
        <header className="settings-header">
          <h2>Automation · cron jobs</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRefresh}
              className="topbar-icon-button"
              aria-label="Refresh"
              title="Refresh"
            >
              <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="topbar-icon-button"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {!editing ? (
          <>
            <button type="button" onClick={startCreate} className="new-terminal-trigger w-full">
              <Plus className="h-4 w-4" />
              <span>New cron</span>
            </button>

            {crons.length === 0 ? (
              <p className="settings-help">No crons yet. Create one to schedule terminal automation.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {crons.map((entry) => (
                  <li key={entry.id} className="cron-card" data-enabled={entry.enabled}>
                    <div className="cron-card-head">
                      <strong className="truncate">{entry.name}</strong>
                      <code className="cron-expr">{entry.cronExpr}</code>
                    </div>
                    <div className="cron-card-meta">
                      <span>{entry.action.type === 'spawn' ? 'spawn' : 'send_input'}</span>
                      {entry.action.type === 'spawn' && entry.action.initialCommand ? (
                        <span className="truncate font-mono">$ {entry.action.initialCommand}</span>
                      ) : null}
                      {entry.action.type === 'send_input' ? (
                        <span className="truncate font-mono">→ {entry.action.sessionId.slice(0, 8)}</span>
                      ) : null}
                      {entry.lastRunAt ? (
                        <span>last: {new Date(entry.lastRunAt).toLocaleString()}</span>
                      ) : null}
                      {entry.lastResult ? (
                        <span data-ok={entry.lastResult.ok}>
                          {entry.lastResult.ok ? '✓' : `✗ ${entry.lastResult.message ?? ''}`}
                        </span>
                      ) : null}
                    </div>
                    <div className="cron-card-actions">
                      <button
                        type="button"
                        onClick={() => void onRun(entry.id)}
                        className="topbar-icon-button"
                        title="Run now"
                        aria-label="Run now"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <label className="settings-row" style={{ flex: '0 0 auto' }}>
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          onChange={(e) =>
                            void onUpdate(entry.id, { enabled: e.target.checked })
                          }
                        />
                        <span className="text-[10px]">enabled</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        className="topbar-icon-button"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete cron "${entry.name}"?`)) {
                            void onDelete(entry.id);
                          }
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-2"
          >
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
              <span>Cron expr</span>
              <input
                type="text"
                value={form.cronExpr}
                onChange={(e) => setForm({ ...form, cronExpr: e.target.value })}
                required
                placeholder="*/5 * * * *"
                className="settings-select font-mono"
                style={{ flex: 1, maxWidth: 'none' }}
              />
            </label>
            <p className="settings-help">
              5-field cron: <code>min hour day-of-month month day-of-week</code>. Examples:
              <code>{' */15 * * * *'}</code> (every 15 min), <code>{'0 9 * * 1'}</code> (Mon 9am).
            </p>

            <label className="settings-row">
              <span>Enabled</span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
            </label>

            <label className="settings-row">
              <span>Action</span>
              <select
                value={form.actionType}
                onChange={(e) =>
                  setForm({ ...form, actionType: e.target.value as CronAction['type'] })
                }
                className="settings-select"
              >
                <option value="spawn">Spawn new terminal</option>
                <option value="send_input">Send input to existing</option>
              </select>
            </label>

            {form.actionType === 'spawn' ? (
              <>
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
                    placeholder="npm test"
                    className="settings-select font-mono"
                    style={{ flex: 1, maxWidth: 'none' }}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="settings-row">
                  <span>Session</span>
                  <select
                    value={form.sessionId}
                    onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
                    required
                    className="settings-select"
                  >
                    <option value="">—</option>
                    {sessions
                      .filter((s) => s.status === 'running')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="settings-row">
                  <span>Data</span>
                  <input
                    type="text"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    required
                    placeholder="echo hi\\r"
                    className="settings-select font-mono"
                    style={{ flex: 1, maxWidth: 'none' }}
                  />
                </label>
                <p className="settings-help">
                  Use <code>\r</code> at end to press Enter. Newlines must be raw <code>\\r</code> in JSON.
                </p>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="new-terminal-trigger flex-1 justify-center"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>{form.id ? 'Save' : 'Create'}</span>
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
