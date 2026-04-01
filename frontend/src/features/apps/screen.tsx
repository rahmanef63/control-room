'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';

import { api } from '@/_generated/api';
import { SortableTableHead } from '@/shared/table/sortable-table-head';
import { TableSearch } from '@/shared/table/table-search';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AppStatus } from '@/shared/types/contracts';
import {
  filterItems,
  sortItems,
  toggleSort,
  type SortState,
} from '@/shared/table/model/table-controls';

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

const APP_SORTERS = {
  name: (app: AppStatus) => app.name,
  source: (app: AppStatus) => app.source,
  status: (app: AppStatus) => app.runtime_status,
  health: (app: AppStatus) => app.health_status,
  ports: (app: AppStatus) => app.ports.length,
  domain: (app: AppStatus) => app.domain ?? '',
  restarts: (app: AppStatus) => app.restart_count ?? -1,
  actions: (app: AppStatus) => (app.source === 'dokploy' ? 3 : 2),
};

export default function AppsPage() {
  const apps = useQuery(api.appStatus.listApps);
  const enqueue = useMutation(api.commands.enqueueCommand);

  const [confirm, setConfirm] = useState<{
    action: string;
    targetType: 'container' | 'dokploy-app';
    targetId: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<SortState>({ key: 'name', direction: 'asc' });

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
      setFeedback((current) => ({ ...current, [targetId]: 'Queued' }));
      setTimeout(() => {
        setFeedback((current) => {
          const next = { ...current };
          delete next[targetId];
          return next;
        });
      }, 3000);
    } catch {
      setFeedback((current) => ({ ...current, [targetId]: 'Error queuing command' }));
    }
  }

  const visibleApps = useMemo(() => {
    const base = apps ?? [];
    const filtered = filterItems(base, search, (app) =>
      [
        app.name,
        app.source,
        app.runtime_status,
        app.health_status,
        app.domain ?? '',
        app.ports.map((port) => `${port.internal}:${port.published}/${port.protocol}`).join(' '),
      ].join(' ')
    );
    return sortItems(filtered, sortState, APP_SORTERS);
  }, [apps, search, sortState]);

  if (apps === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Loading apps...</div>;
  }

  return (
    <div className="dashboard-page">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Apps & Services</h2>
        <p className="text-sm text-muted-foreground">{apps.length} apps tracked</p>
      </div>

      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Search apps, domains, ports, source…"
        resultCount={visibleApps.length}
      />

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
                  label="Source"
                  active={sortState.key === 'source'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'source'))}
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
                  label="Health"
                  active={sortState.key === 'health'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'health'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Ports"
                  active={sortState.key === 'ports'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'ports'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Domain"
                  active={sortState.key === 'domain'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'domain'))}
                />
              </TableHead>
              <TableHead>
                <SortableTableHead
                  label="Restarts"
                  active={sortState.key === 'restarts'}
                  direction={sortState.direction}
                  onToggle={() => setSortState((current) => toggleSort(current, 'restarts'))}
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
            {visibleApps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No apps matched the current filter.
                </TableCell>
              </TableRow>
            ) : (
              visibleApps.map((app) => {
                const targetType: 'container' | 'dokploy-app' =
                  app.source === 'dokploy' ? 'dokploy-app' : 'container';

                return (
                  <TableRow key={app._id} className="hover:bg-muted/10">
                    <TableCell className="font-medium text-foreground">{app.name}</TableCell>
                    <TableCell className="text-muted-foreground">{app.source}</TableCell>
                    <TableCell>
                      <StatusBadge status={app.runtime_status} />
                    </TableCell>
                    <TableCell>
                      <HealthBadge status={app.health_status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {app.ports.length > 0
                        ? app.ports.map((port) => `${port.internal}→${port.published}`).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{app.domain ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{app.restart_count ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {feedback[app.name] ? (
                          <span className="text-xs text-emerald-400">{feedback[app.name]}</span>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setConfirm({
                                  action: `${targetType}.restart`,
                                  targetType,
                                  targetId: app.name,
                                })
                              }
                              className="rounded bg-primary/10 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                            >
                              Restart
                            </button>
                            {app.source === 'dokploy' ? (
                              <button
                                onClick={() =>
                                  setConfirm({
                                    action: 'dokploy-app.redeploy',
                                    targetType: 'dokploy-app',
                                    targetId: app.name,
                                  })
                                }
                                className="rounded bg-orange-500/10 px-2 py-1 text-xs text-orange-400 transition-colors hover:bg-orange-500/20"
                              >
                                Redeploy
                              </button>
                            ) : null}
                            <button
                              onClick={() =>
                                setConfirm({
                                  action: `${targetType}.stop`,
                                  targetType,
                                  targetId: app.name,
                                })
                              }
                              className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/20"
                            >
                              Stop
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

      <ConfirmActionDialog
        open={confirm !== null}
        action={confirm?.action ?? ''}
        target={confirm?.targetId ?? ''}
        onConfirm={() => {
          if (confirm) {
            void handleAction(confirm.action, confirm.targetType, confirm.targetId);
          }
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
