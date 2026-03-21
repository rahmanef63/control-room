// @ts-nocheck — stub API types; remove after `npx convex deploy` generates real types
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/_generated/api';
import type { CommandRecord } from '@/lib/types';

const STATUS_BADGES: Record<CommandRecord['status'], string> = {
  queued: 'bg-blue-500/10 text-blue-400 border-blue-800',
  running: 'bg-yellow-500/10 text-yellow-400 border-yellow-800',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-800',
  failed: 'bg-red-500/10 text-red-400 border-red-800',
  cancelled: 'bg-muted text-muted-foreground border-border',
  timeout: 'bg-orange-500/10 text-orange-400 border-orange-800',
};

const SAFE_ACTIONS = [
  { action: 'container.restart', target_type: 'container' as const, label: 'Restart container' },
  { action: 'service.restart', target_type: 'service' as const, label: 'Restart service' },
  { action: 'container.logs', target_type: 'container' as const, label: 'Fetch container logs (last 100)' },
] as const;

const KNOWN_CONTAINERS = [
  'azzahrah-site',
  'brutalism-website',
  'designs',
  'franchise-rocker-chicken',
  'ggrahmanef-com',
  'lebaran-shop',
  'openclaw-dashboard-manef',
  'rahmanef-com',
  'superspace-apps',
  'superspace-mobile',
  'test-template-app',
  'dokploy',
  'dokploy-postgres',
  'dokploy-redis',
  'dokploy-traefik',
  'n8n',
];

const KNOWN_SERVICES = ['fail2ban', 'ufw', 'ssh', 'docker'];

export default function ActionsPage() {
  const commands = useQuery(api.commands.listCommands, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const enqueue = useMutation(api.commands.enqueueCommand);

  const [selectedAction, setSelectedAction] = useState<string>(SAFE_ACTIONS[0].action);
  const [selectedType, setSelectedType] = useState<'container' | 'service'>(SAFE_ACTIONS[0].target_type as 'container' | 'service');
  const [targetId, setTargetId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function handleSubmit() {
    if (!targetId.trim()) return;
    setSubmitting(true);
    setConfirm(false);
    try {
      await enqueue({
        action: selectedAction,
        target_type: selectedType,
        target_id: targetId.trim(),
        requested_by: 'manual-dashboard',
        ...(selectedAction === 'container.logs' ? { payload: { lines: 100 } } : {}),
      });
      setSubmitted(`Queued: ${selectedAction} on ${targetId}`);
      setTargetId('');
      setTimeout(() => setSubmitted(null), 4000);
    } catch {
      setSubmitted('Error queuing command');
    } finally {
      setSubmitting(false);
    }
  }

  const knownTargets = selectedType === 'container' ? KNOWN_CONTAINERS : KNOWN_SERVICES;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Actions</h2>

      {/* Action form */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4 max-w-lg">
        <h3 className="text-sm font-semibold text-foreground">Queue an Action</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Action</label>
            <select
              value={`${selectedAction}:${selectedType}`}
              onChange={(e) => {
                const [action, type] = e.target.value.split(':') as [string, 'container' | 'service'];
                setSelectedAction(action);
                setSelectedType(type);
                setTargetId('');
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SAFE_ACTIONS.map((a) => (
                <option key={`${a.action}:${a.target_type}`} value={`${a.action}:${a.target_type}`}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Target ({selectedType})
            </label>
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder={`Enter ${selectedType} name...`}
              list="known-targets"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <datalist id="known-targets">
              {knownTargets.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-muted-foreground">
              Only allowlisted targets will be accepted by the agent.
            </p>
          </div>

          {submitted && (
            <div className="rounded-md border border-emerald-800 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-400">
              {submitted}
            </div>
          )}

          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              disabled={!targetId.trim() || submitting}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              Queue Action
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Confirm: <span className="font-mono text-foreground">{selectedAction}</span> on{' '}
                <span className="font-medium text-foreground">{targetId}</span>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? 'Queueing...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="flex-1 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Command history */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Commands
        </h3>

        {commands === undefined ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : commands.page.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commands issued yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Time</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Target</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commands.page.map((cmd: CommandRecord) => (
                  <tr key={cmd._id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {new Date(cmd.requested_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-foreground">{cmd.action}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{cmd.target_id}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{cmd.target_type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[cmd.status]}`}
                      >
                        {cmd.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {cmd.result ?? cmd.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
