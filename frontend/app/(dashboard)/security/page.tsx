// @ts-nocheck — stub API types; remove after `npx convex deploy` generates real types
'use client';

import { useQuery } from 'convex/react';

import { api } from '@/_generated/api';
import { SecurityEventsTable } from '@/components/dashboard/security/security-events-table';

const KNOWN_PORTS = new Set([22, 2221, 80, 443, 3000]);

export default function SecurityPage() {
  const events = useQuery(api.events.listEvents, {
    paginationOpts: { numItems: 50, cursor: null },
    type: undefined,
    severity: undefined,
  });

  if (events === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Loading security data...</div>;
  }

  const securityEvents = events.page.filter((event) => event.type.startsWith('security.'));
  const sshSuccess = securityEvents.filter((event) => event.type === 'security.ssh_success');
  const sshFailed = securityEvents.filter((event) => event.type === 'security.ssh_failed');
  const banEvents = securityEvents.filter((event) => event.type === 'security.ban');
  const portEvents = securityEvents.filter((event) => event.type === 'security.new_port');

  const unknownPorts = portEvents.filter((event) => {
    const port = Number(event.metadata?.port);
    return port && !KNOWN_PORTS.has(port);
  });

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-lg font-semibold text-foreground">Security</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-sm border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">SSH Success (recent)</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{sshSuccess.length}</p>
        </div>
        <div className="rounded-sm border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">SSH Failed (recent)</p>
          <p className={`mt-1 text-2xl font-bold ${sshFailed.length > 5 ? 'text-red-400' : 'text-foreground'}`}>
            {sshFailed.length}
          </p>
        </div>
        <div className="rounded-sm border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Bans (recent)</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{banEvents.length}</p>
        </div>
        <div className="rounded-sm border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Unknown Ports</p>
          <p className={`mt-1 text-2xl font-bold ${unknownPorts.length > 0 ? 'text-red-400' : 'text-foreground'}`}>
            {unknownPorts.length}
          </p>
        </div>
      </div>

      {unknownPorts.length > 0 ? (
        <div className="space-y-1 rounded-sm border border-red-800 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          <p className="font-semibold">Warning: Unknown ports detected</p>
          {unknownPorts.map((event) => (
            <p key={event._id} className="text-xs">
              Port {String(event.metadata?.port ?? '?')} — {event.message} ({new Date(event.timestamp).toLocaleString()})
            </p>
          ))}
        </div>
      ) : null}

      {sshFailed.length > 0 ? (
        <SecurityEventsTable
          title="Recent SSH Failed Logins"
          placeholder="Search failed SSH logins…"
          emptyText="No failed SSH logins matched the current filter."
          events={sshFailed}
          columns={[
            {
              key: 'time',
              label: 'Time',
              sortValue: (event) => event.timestamp,
              render: (event) => (
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'message',
              label: 'Message',
              sortValue: (event) => event.message,
              render: (event) => <span className="text-sm text-foreground">{event.message}</span>,
            },
            {
              key: 'source',
              label: 'Source',
              sortValue: (event) => event.source,
              render: (event) => <span className="text-xs text-muted-foreground">{event.source}</span>,
            },
          ]}
        />
      ) : null}

      {sshSuccess.length > 0 ? (
        <SecurityEventsTable
          title="Recent SSH Successful Logins"
          placeholder="Search successful SSH logins…"
          emptyText="No successful SSH logins matched the current filter."
          events={sshSuccess}
          columns={[
            {
              key: 'time',
              label: 'Time',
              sortValue: (event) => event.timestamp,
              render: (event) => (
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'message',
              label: 'Message',
              sortValue: (event) => event.message,
              render: (event) => <span className="text-sm text-foreground">{event.message}</span>,
            },
            {
              key: 'source',
              label: 'Source',
              sortValue: (event) => event.source,
              render: (event) => <span className="text-xs text-muted-foreground">{event.source}</span>,
            },
          ]}
        />
      ) : null}

      {banEvents.length > 0 ? (
        <SecurityEventsTable
          title="Recent Bans (fail2ban)"
          placeholder="Search ban events…"
          emptyText="No ban events matched the current filter."
          events={banEvents}
          columns={[
            {
              key: 'time',
              label: 'Time',
              sortValue: (event) => event.timestamp,
              render: (event) => (
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'message',
              label: 'Message',
              sortValue: (event) => event.message,
              render: (event) => <span className="text-sm text-foreground">{event.message}</span>,
            },
          ]}
        />
      ) : null}

      {securityEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No security events yet. Agent will populate this when it starts running.
        </p>
      ) : null}
    </div>
  );
}
