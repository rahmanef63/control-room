'use client';

import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';

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
import type { AuditRecord } from '@/shared/types/contracts';
import {
  filterItems,
  sortItems,
  toggleSort,
  type SortState,
} from '@/shared/table/model/table-controls';

const RESULT_BADGES: Record<AuditRecord['result'], string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-800',
  failed: 'bg-red-500/10 text-red-400 border-red-800',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const SEVERITY_BADGES: Record<AuditRecord['severity'], string> = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
};

const AUDIT_SORTERS = {
  timestamp: (entry: AuditRecord) => entry.timestamp,
  action: (entry: AuditRecord) => entry.action,
  target: (entry: AuditRecord) => entry.target,
  result: (entry: AuditRecord) => entry.result,
  severity: (entry: AuditRecord) => entry.severity,
  actor: (entry: AuditRecord) => entry.triggered_by,
  requestId: (entry: AuditRecord) => entry.request_id,
};

export default function AuditPage() {
  const logs = useQuery(api.audit.listAuditLogs, {
    paginationOpts: { numItems: 100, cursor: null },
    target: undefined,
    action: undefined,
  });

  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<SortState>({ key: 'timestamp', direction: 'desc' });

  const visibleLogs = useMemo(() => {
    const base = logs?.page ?? [];
    const filtered = filterItems(base, search, (entry) =>
      [
        entry.action,
        entry.target,
        entry.result,
        entry.severity,
        entry.triggered_by,
        entry.request_id,
      ].join(' ')
    );
    return sortItems(filtered, sortState, AUDIT_SORTERS);
  }, [logs, search, sortState]);

  if (logs === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Loading audit log...</div>;
  }

  return (
    <div className="dashboard-page">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
        <p className="text-sm text-muted-foreground">
          Immutable record of all actions. {logs.page.length} entries shown.
        </p>
      </div>

      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Search action, target, severity, actor, request ID…"
        resultCount={visibleLogs.length}
      />

      {visibleLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries matched the current filter.</p>
      ) : (
        <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>
                  <SortableTableHead
                    label="Timestamp"
                    active={sortState.key === 'timestamp'}
                    direction={sortState.direction}
                    onToggle={() => setSortState((current) => toggleSort(current, 'timestamp'))}
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
                    label="Result"
                    active={sortState.key === 'result'}
                    direction={sortState.direction}
                    onToggle={() => setSortState((current) => toggleSort(current, 'result'))}
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHead
                    label="Severity"
                    active={sortState.key === 'severity'}
                    direction={sortState.direction}
                    onToggle={() => setSortState((current) => toggleSort(current, 'severity'))}
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHead
                    label="Actor"
                    active={sortState.key === 'actor'}
                    direction={sortState.direction}
                    onToggle={() => setSortState((current) => toggleSort(current, 'actor'))}
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHead
                    label="Request ID"
                    active={sortState.key === 'requestId'}
                    direction={sortState.direction}
                    onToggle={() => setSortState((current) => toggleSort(current, 'requestId'))}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLogs.map((entry) => (
                <TableRow key={entry._id} className="hover:bg-muted/10">
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground">{entry.action}</TableCell>
                  <TableCell className="text-sm text-foreground">{entry.target}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RESULT_BADGES[entry.result]}`}
                    >
                      {entry.result}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    <span className={SEVERITY_BADGES[entry.severity]}>{entry.severity}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.triggered_by}</TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs text-muted-foreground">
                    {entry.request_id}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      )}
    </div>
  );
}
