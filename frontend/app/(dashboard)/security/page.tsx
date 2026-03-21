// @ts-nocheck — stub API types; remove after `npx convex deploy` generates real types
'use client';

import { useQuery } from 'convex/react';
import { api } from '@/_generated/api';

// Security data is stored in events with type 'security.*'
// The agent collector pushes security events into the events table.
// We also show latest security-typed events as activity log.

const KNOWN_PORTS = new Set([22, 2221, 80, 443, 3000]);

export default function SecurityPage() {
  const events = useQuery(api.events.listEvents, {
    paginationOpts: { numItems: 50, cursor: null },
    type: undefined,
    severity: undefined,
  });

  if (events === undefined) {
    return <div className="p-6 text-muted-foreground text-sm">Loading security data...</div>;
  }

  const securityEvents = events.page.filter((e) => e.type.startsWith('security.'));
  const sshSuccess = securityEvents.filter((e) => e.type === 'security.ssh_success');
  const sshFailed = securityEvents.filter((e) => e.type === 'security.ssh_failed');
  const banEvents = securityEvents.filter((e) => e.type === 'security.ban');
  const portEvents = securityEvents.filter((e) => e.type === 'security.new_port');

  const unknownPorts = portEvents.filter((e) => {
    const port = Number(e.metadata?.port);
    return port && !KNOWN_PORTS.has(port);
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Security</h2>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">SSH Success (recent)</p>
          <p className="text-2xl font-bold text-foreground mt-1">{sshSuccess.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">SSH Failed (recent)</p>
          <p className={`text-2xl font-bold mt-1 ${sshFailed.length > 5 ? 'text-red-400' : 'text-foreground'}`}>
            {sshFailed.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Bans (recent)</p>
          <p className="text-2xl font-bold text-foreground mt-1">{banEvents.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Unknown Ports</p>
          <p className={`text-2xl font-bold mt-1 ${unknownPorts.length > 0 ? 'text-red-400' : 'text-foreground'}`}>
            {unknownPorts.length}
          </p>
        </div>
      </div>

      {/* Warnings */}
      {unknownPorts.length > 0 && (
        <div className="rounded-lg border border-red-800 bg-red-950/20 px-4 py-3 text-sm text-red-400 space-y-1">
          <p className="font-semibold">Warning: Unknown ports detected</p>
          {unknownPorts.map((e) => (
            <p key={e._id} className="text-xs">
              Port {String(e.metadata?.port ?? '?')} — {e.message} ({new Date(e.timestamp).toLocaleString()})
            </p>
          ))}
        </div>
      )}

      {/* SSH failed logins */}
      {sshFailed.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent SSH Failed Logins
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Message</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sshFailed.slice(0, 10).map((e) => (
                  <tr key={e._id} className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-foreground">{e.message}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{e.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SSH success logins */}
      {sshSuccess.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent SSH Successful Logins
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Message</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sshSuccess.slice(0, 10).map((e) => (
                  <tr key={e._id} className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-foreground">{e.message}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{e.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Ban events */}
      {banEvents.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Bans (fail2ban)
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {banEvents.slice(0, 10).map((e) => (
                  <tr key={e._id} className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-foreground">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {securityEvents.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No security events yet. Agent will populate this when it starts running.
        </p>
      )}
    </div>
  );
}
