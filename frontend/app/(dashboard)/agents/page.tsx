'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/_generated/api';
import type { AgentStatus } from '@/lib/types';

function StatusDot({ status }: { status: AgentStatus['status'] }) {
  const color =
    status === 'running'
      ? 'bg-emerald-500'
      : status === 'stopped'
      ? 'bg-red-500'
      : 'bg-yellow-500';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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

export default function AgentsPage() {
  const agents = useQuery(api.agentStatus.listAgents);
  const enqueue = useMutation(api.commands.enqueueCommand);

  const [confirm, setConfirm] = useState<{
    action: string;
    targetId: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  async function handleAction(action: string, targetId: string) {
    setConfirm(null);
    try {
      await enqueue({
        action,
        target_type: 'agent',
        target_id: targetId,
        requested_by: 'manual-dashboard',
      });
      setFeedback((f) => ({ ...f, [targetId]: 'Queued' }));
      setTimeout(
        () =>
          setFeedback((f) => {
            const n = { ...f };
            delete n[targetId];
            return n;
          }),
        3000
      );
    } catch {
      setFeedback((f) => ({ ...f, [targetId]: 'Error' }));
    }
  }

  if (agents === undefined) {
    return <div className="p-6 text-muted-foreground text-sm">Loading agents...</div>;
  }

  const running = agents.filter((a) => a.status === 'running').length;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Agents</h2>
        <p className="text-sm text-muted-foreground">
          {running} running / {agents.length} total
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">PID</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">CPU</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Memory</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Uptime</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Detected via</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Last seen</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No agents found. Agent may not have reported yet.
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr key={agent._id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                    <StatusDot status={agent.status} />
                    {agent.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{agent.status}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {agent.pid ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {agent.cpu.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(agent.memory / (1024 * 1024)).toFixed(0)} MB
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatUptime(agent.uptime_seconds)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{agent.detection_source}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(agent.last_seen).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {feedback[agent.name] ? (
                        <span className="text-xs text-emerald-400">{feedback[agent.name]}</span>
                      ) : (
                        agent.available_actions.map((action) => (
                          <button
                            key={action}
                            onClick={() => setConfirm({ action, targetId: agent.name })}
                            className="rounded px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            {action}
                          </button>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        action={confirm?.action ?? ''}
        target={confirm?.targetId ?? ''}
        onConfirm={() => {
          if (confirm) handleAction(confirm.action, confirm.targetId);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
