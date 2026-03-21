// @ts-nocheck — stub API types; remove after `npx convex deploy` generates real types
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/_generated/api';
import type { AppStatus } from '@/lib/types';

function StatusBadge({ status }: { status: AppStatus['runtime_status'] }) {
  const map: Record<AppStatus['runtime_status'], string> = {
    running: 'bg-emerald-500/10 text-emerald-400 border-emerald-800',
    stopped: 'bg-red-500/10 text-red-400 border-red-800',
    restarting: 'bg-yellow-500/10 text-yellow-400 border-yellow-800',
    error: 'bg-red-500/10 text-red-400 border-red-800',
    unknown: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

function HealthBadge({ status }: { status: AppStatus['health_status'] }) {
  const map: Record<AppStatus['health_status'], string> = {
    healthy: 'text-emerald-400',
    unhealthy: 'text-red-400',
    none: 'text-muted-foreground',
    unknown: 'text-muted-foreground',
  };
  return <span className={`text-xs ${map[status]}`}>{status}</span>;
}

function ConfirmDialog({
  open,
  action,
  target,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  action: string;
  target: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold text-foreground">Confirm Action</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Execute <span className="font-mono text-foreground">{action}</span> on{' '}
          <span className="font-medium text-foreground">{target}</span>?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppsPage() {
  const apps = useQuery(api.appStatus.listApps);
  const enqueue = useMutation(api.commands.enqueueCommand);

  const [confirm, setConfirm] = useState<{
    action: string;
    targetType: 'container' | 'dokploy-app';
    targetId: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  async function handleAction(
    action: string,
    targetType: 'container' | 'dokploy-app',
    targetId: string
  ) {
    setConfirm(null);
    try {
      await enqueue({
        action,
        target_type: targetType,
        target_id: targetId,
        requested_by: 'manual-dashboard',
      });
      setFeedback((f) => ({ ...f, [targetId]: 'Queued' }));
      setTimeout(() => setFeedback((f) => { const n = { ...f }; delete n[targetId]; return n; }), 3000);
    } catch {
      setFeedback((f) => ({ ...f, [targetId]: 'Error queuing command' }));
    }
  }

  if (apps === undefined) {
    return <div className="p-6 text-muted-foreground text-sm">Loading apps...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Apps & Services</h2>
      <p className="text-sm text-muted-foreground">{apps.length} apps tracked</p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Health</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Ports</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Domain</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Restarts</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {apps.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No apps found. Agent may not have reported yet.
                </td>
              </tr>
            ) : (
              apps.map((app) => {
                const targetType: 'container' | 'dokploy-app' =
                  app.source === 'dokploy' ? 'dokploy-app' : 'container';
                return (
                  <tr key={app._id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{app.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{app.source}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.runtime_status} />
                    </td>
                    <td className="px-4 py-3">
                      <HealthBadge status={app.health_status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {app.ports.length > 0
                        ? app.ports.map((p) => `${p.internal}→${p.published}`).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {app.domain ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.restart_count ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {feedback[app.name] ? (
                          <span className="text-xs text-emerald-400">{feedback[app.name]}</span>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setConfirm({ action: `${targetType}.restart`, targetType, targetId: app.name })
                              }
                              className="rounded px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              Restart
                            </button>
                            {app.source === 'dokploy' && (
                              <button
                                onClick={() =>
                                  setConfirm({ action: 'dokploy-app.redeploy', targetType: 'dokploy-app', targetId: app.name })
                                }
                                className="rounded px-2 py-1 text-xs bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
                              >
                                Redeploy
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setConfirm({ action: `${targetType}.stop`, targetType, targetId: app.name })
                              }
                              className="rounded px-2 py-1 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                              Stop
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        action={confirm?.action ?? ''}
        target={confirm?.targetId ?? ''}
        onConfirm={() => {
          if (confirm) {
            handleAction(confirm.action, confirm.targetType, confirm.targetId);
          }
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
