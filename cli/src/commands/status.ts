import type { ConvexHttpClient } from 'convex/browser';

import { query } from '../infra/convex-client.js';
import type { OverviewQueryResult } from '../shared/contracts.js';

export async function runStatus(client: ConvexHttpClient): Promise<void> {
  const overview = await query<OverviewQueryResult>(client, 'snapshots:getOverview', {});

  if (!overview.snapshot) {
    console.log('No system snapshot available yet.');
    return;
  }

  const ramPct =
    overview.snapshot.ram_total > 0
      ? ((overview.snapshot.ram_used / overview.snapshot.ram_total) * 100).toFixed(1)
      : '0.0';

  console.log('=== VPS STATUS ===');
  console.log(`CPU: ${overview.snapshot.cpu_total.toFixed(1)}%`);
  console.log(`RAM: ${ramPct}%`);
  console.log(`Uptime(s): ${Math.round(overview.snapshot.uptime_seconds)}`);
  console.log(`Apps: ${overview.app_count}`);
  console.log(`Agents: ${overview.agent_count}`);
  console.log(`Active alerts: ${overview.active_alert_count}`);
}
