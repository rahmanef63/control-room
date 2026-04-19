import type { ConvexHttpClient } from 'convex/browser';

import { query } from '../infra/convex-client.js';
import type { EventListItem, PaginatedResult } from '../shared/contracts.js';

export async function runEventsList(client: ConvexHttpClient, limit: number): Promise<void> {
  const events = await query<PaginatedResult<EventListItem>>(client, 'events:listEvents', {
    paginationOpts: { cursor: null, numItems: limit },
  });

  for (const event of events.page) {
    const timestamp = new Date(event.timestamp).toISOString();
    console.log(`[${timestamp}] ${event.severity.toUpperCase()} ${event.type} (${event.source}) ${event.message}`);
  }
}
