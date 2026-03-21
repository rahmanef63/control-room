'use client';

import { useQuery } from 'convex/react';
import { api } from '@/_generated/api';
import type { AuditRecord } from '@/lib/types';

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

export default function AuditPage() {
  const logs = useQuery(api.audit.listAuditLogs, {
    paginationOpts: { numItems: 100, cursor: null },
    target: undefined,
    action: undefined,
  });

  if (logs === undefined) {
    return <div className="p-6 text-muted-foreground text-sm">Loading audit log...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
        <p className="text-sm text-muted-foreground">
          Immutable record of all actions. {logs.page.length} entries shown.
        </p>
      </div>

      {logs.page.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Timestamp</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Target</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Result</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Severity</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Actor</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Request ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.page.map((entry) => (
                <tr key={entry._id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-foreground">{entry.action}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{entry.target}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RESULT_BADGES[entry.result]}`}
                    >
                      {entry.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">
                    <span className={SEVERITY_BADGES[entry.severity]}>
                      {entry.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{entry.triggered_by}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono truncate max-w-32">
                    {entry.request_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
