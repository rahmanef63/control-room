'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';

import { api } from '@/_generated/api';
import { SortableTableHead } from '@/shared/table/sortable-table-head';
import { TableSearch } from '@/shared/table/table-search';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CommandRecord } from '@/shared/types/contracts';
import {
  filterItems,
  sortItems,
  toggleSort,
  type SortState,
} from '@/shared/table/model/table-controls';

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

// Replace with your actual container names — this list is for UI autocomplete only.
// The agent enforces its own allowlist independently of what appears here.
const KNOWN_CONTAINERS = [
  'my-app',
  'my-site',
  'dokploy',
  'dokploy-postgres',
  'dokploy-redis',
  'dokploy-traefik',
  'n8n',
];

const KNOWN_SERVICES = ['fail2ban', 'ufw', 'ssh', 'docker'];

const COMMAND_SORTERS = {
  time: (command: CommandRecord) => command.requested_at,
  action: (command: CommandRecord) => command.action,
  target: (command: CommandRecord) => command.target_id,
  type: (command: CommandRecord) => command.target_type,
  status: (command: CommandRecord) => command.status,
  result: (command: CommandRecord) => command.result ?? command.error ?? '',
};

export default function ActionsPage() {
  const commands = useQuery(api.commands.listCommands, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const enqueue = useMutation(api.commands.enqueueCommand);

  const [selectedAction, setSelectedAction] = useState<string>(SAFE_ACTIONS[0].action);
  const [selectedType, setSelectedType] = useState<'container' | 'service'>(
    SAFE_ACTIONS[0].target_type as 'container' | 'service'
  );
  const [targetId, setTargetId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<SortState>({ key: 'time', direction: 'desc' });

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

  const visibleCommands = useMemo(() => {
    const base = commands?.page ?? [];
    const filtered = filterItems(base, search, (command) =>
      [
        command.action,
        command.target_id,
        command.target_type,
        command.status,
        command.result ?? '',
        command.error ?? '',
      ].join(' ')
    );
    return sortItems(filtered, sortState, COMMAND_SORTERS);
  }, [commands, search, sortState]);

  return (
    <div className="dashboard-page">
      <h2 className="text-lg font-semibold text-foreground">Actions</h2>

      <div className="dashboard-panel max-w-lg space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Queue an Action</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Action</label>
            <select
              value={`${selectedAction}:${selectedType}`}
              onChange={(event) => {
                const [action, type] = event.target.value.split(':') as [string, 'container' | 'service'];
                setSelectedAction(action);
                setSelectedType(type);
                setTargetId('');
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SAFE_ACTIONS.map((action) => (
                <option key={`${action.action}:${action.target_type}`} value={`${action.action}:${action.target_type}`}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Target ({selectedType})</label>
            <input
              type="text"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              placeholder={`Enter ${selectedType} name...`}
              list="known-targets"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <datalist id="known-targets">
              {knownTargets.map((target) => (
                <option key={target} value={target} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-muted-foreground">
              Only allowlisted targets will be accepted by the agent.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-md border border-emerald-800 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-400">
              {submitted}
            </div>
          ) : null}

          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              disabled={!targetId.trim() || submitting}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Queueing...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="flex-1 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Commands
        </h3>

        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Search actions, targets, type, result…"
          resultCount={visibleCommands.length}
        />

        {commands === undefined ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : visibleCommands.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commands matched the current filter.</p>
        ) : (
          <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>
                    <SortableTableHead
                      label="Time"
                      active={sortState.key === 'time'}
                      direction={sortState.direction}
                      onToggle={() => setSortState((current) => toggleSort(current, 'time'))}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Action"
                      active={sortState.key === 'action'}
                      direction={sortState.direction}
                      onToggle={() => setSortState((current) => toggleSort(current, 'action'))}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Target"
                      active={sortState.key === 'target'}
                      direction={sortState.direction}
                      onToggle={() => setSortState((current) => toggleSort(current, 'target'))}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Type"
                      active={sortState.key === 'type'}
                      direction={sortState.direction}
                      onToggle={() => setSortState((current) => toggleSort(current, 'type'))}
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
                      label="Result"
                      active={sortState.key === 'result'}
                      direction={sortState.direction}
                      onToggle={() => setSortState((current) => toggleSort(current, 'result'))}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCommands.map((command) => (
                  <TableRow key={command._id} className="hover:bg-muted/10">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(command.requested_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">{command.action}</TableCell>
                    <TableCell className="text-sm text-foreground">{command.target_id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{command.target_type}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[command.status]}`}
                      >
                        {command.status}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {command.result ?? command.error ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        )}
      </section>
    </div>
  );
}
