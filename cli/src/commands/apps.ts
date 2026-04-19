import type { ConvexHttpClient } from 'convex/browser';

import { query } from '../infra/convex-client.js';
import type { AppListItem } from '../shared/contracts.js';

export async function runAppsList(client: ConvexHttpClient): Promise<void> {
  const apps = await query<AppListItem[]>(client, 'appStatus:listApps', {});

  const rows = apps
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((app) => ({
      name: app.name,
      runtime: app.runtime_status,
      health: app.health_status,
      source: app.source,
      last_seen: new Date(app.last_seen).toISOString(),
    }));

  console.table(rows);
}
