// @ts-nocheck — stub API types; remove after `npx convex deploy` generates real types
'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';

import { api } from '@/_generated/api';
import { ConfirmActionDialog } from '@/components/dashboard/confirm-action-dialog';
import { SortableTableHead } from '@/components/dashboard/sortable-table-head';
import { TableSearch } from '@/components/dashboard/table-search';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AgentStatus } from '@/lib/types';
import { filterItems, sortItems, toggleSort, type SortState } from '@/lib/table-controls';

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
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const AGENT_SORTERS = {
  name: (agent: AgentStatus) => agent.name,
  status: (agent: AgentStatus) => agent.status,
  pid: (agent: AgentStatus) => agent.pid ?? -1,
  cpu: (agent: AgentStatus) => agent.cpu,
  memory: (agent: AgentStatus) => agent.memory,
  uptime: (agent: AgentStatus) => agent.uptime_seconds,
  detection: (agent: AgentStatus) => agent.detection_source,
  lastSeen: (agent: AgentStatus) => agent.last_seen,
  actions: (agent: AgentStatus) => agent.available_actions.length,
};

export default function AgentsPage() {
  const agents = useQuery(api.agentStatus.listAgents);
  const enqueue = useMutation(api.commands.enqueueCommand);

  const [confirm, setConfirm] = useState<{
    action: string;
    targetId: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<SortState>({ key: 'name', direction: 'asc' });

  async function handleAction(action: string, targetId: string) {
    setConfirm(null);
    try {
      await enqueue({
        action,
        target_type: 'agent',
        target_id: targetId,
        requested_by: 'manual-dashboard',
      });
      setFeedback((current) => ({ ...current, [targetId]: 'Queued' }));
      setTimeout(() => {
        setFeedback((current) => {
          const next = { ...current };
          delete next[targetId];
          return next;
        });
      }, 3000);
    } catch {
      setFeedback((current) => ({ ...current, [targetId]: 'Error' }));
    }
  }

  const visibleAgents = useMemo(() => {
    const base = agents ?? [];
    const filtered = filterItems(base, search, (agent) =>
      [
        agent.name,
        agent.status,
        agent.pid ?? '',
        agent.detection_source,
        agent.available_actions.join(' '),
      ].join(' ')
    );
    return sortItems(filtered, sortState, AGENT_SORTERS);
  }, [agents, search, sortState]);

  if (agents === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Loading agents...</div>;
  }

  const running = agents.filter((agent) => agent.status === 'running').length;

  return (
    <div className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Agents</h2>
        <p className="text-sm text-muted-foreground">
          {running} running / {agents.length} total
        </p>
      </div>

      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Search agents, status, PID, detection source…"
        resultCount={visibleAgents.length}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>
                <SortableTableHead
                  label="Name"
                  active={sortState.key === 'name'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'name'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Status"
                  active={sortState.key === 'status'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'status'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="PID"
                  active={sortState.key === 'pid'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'pid'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="CPU"
                  active={sortState.key === 'cpu'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'cpu'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Memory"
                  active={sortState.key === 'memory'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'memory'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Uptime"
                  active={sortState.key === 'uptime'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'uptime'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Detected via"
                  active={sortState.key === 'detection'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'detection'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Last seen"
                  active={sortState.key === 'lastSeen'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'lastSeen'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Actions"
                  active={sortState.key === 'actions'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'actions'))}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No agents matched the current filter.
                </TableCell>
              </TableRow>
            ) : (
              visibleAgents.map((agent) => (
                <TableRow key={agent._id} className="hover:bg-muted/10">
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <StatusDot status={agent.status} />
                      {agent.name}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{agent.status}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {agent.pid ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{agent.cpu.toFixed(1)}%</TableCell>
                  <TableCell className="text-muted-foreground">
                    {(agent.memory / (1024 * 1024)).toFixed(0)} MB
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatUptime(agent.uptime_seconds)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{agent.detection_source}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(agent.last_seen).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {feedback[agent.name] ? (
                        <span className="text-xs text-emerald-400">{feedback[agent.name]}</span>
                      ) : (
                        agent.available_actions.map((action) => (
                          <button
                            key={action}
                            onClick={() => setConfirm({ action, targetId: agent.name })}
                            className="rounded bg-primary/10 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                          >
                            {action}
                          </button>
                        ))
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmActionDialog
        open={confirm !== null}
        action={confirm?.action ?? ''}
        target={confirm?.targetId ?? ''}
        onConfirm={() => {
          if (confirm) {
            void handleAction(confirm.action, confirm.targetId);
          }
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
