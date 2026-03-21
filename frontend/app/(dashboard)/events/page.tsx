// @ts-nocheck — stub API types; remove after `npx convex deploy` generates real types
'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/_generated/api';
import type { EventRecord } from '@/lib/types';

const SEVERITY_COLORS: Record<EventRecord['severity'], string> = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-orange-400',
  critical: 'text-red-400',
};

const SEVERITY_BADGES: Record<EventRecord['severity'], string> = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-800',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-800',
  error: 'bg-orange-500/10 text-orange-400 border-orange-800',
  critical: 'bg-red-500/10 text-red-400 border-red-800',
};

const SEVERITY_FILTER_OPTIONS = ['all', 'info', 'warning', 'error', 'critical'] as const;
type SeverityFilter = (typeof SEVERITY_FILTER_OPTIONS)[number];

export default function EventsPage() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const events = useQuery(api.events.listEvents, {
    paginationOpts: { numItems: 100, cursor: null },
    type: undefined,
    severity: severityFilter === 'all' ? undefined : severityFilter,
  });

  if (events === undefined) {
    return <div className="p-6 text-muted-foreground text-sm">Loading events...</div>;
  }

  const items = events.page;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Events Timeline</h2>
          <p className="text-sm text-muted-foreground">{items.length} events shown</p>
        </div>
        <div className="flex items-center gap-1.5">
          {SEVERITY_FILTER_OPTIONS.map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                severityFilter === sev
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events found.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((event) => (
            <div
              key={event._id}
              className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-2.5 hover:bg-muted/10 transition-colors"
            >
              <span className="font-mono text-xs text-muted-foreground shrink-0 mt-0.5 w-20">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium shrink-0 ${SEVERITY_BADGES[event.severity]}`}
              >
                {event.severity}
              </span>
              <span className="text-xs font-mono text-muted-foreground shrink-0">{event.type}</span>
              <span className="text-sm text-foreground flex-1">{event.message}</span>
              {event.target && (
                <span className="text-xs text-muted-foreground shrink-0">{event.target}</span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">{event.source}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
