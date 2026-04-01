import type { ConvexHttpClient } from 'convex/browser';

import { query } from '../infra/convex-client.js';
import type {
  AppListItem,
  OverviewQueryResult,
  PaginatedResult,
  TuiAgentListItem,
  TuiEventListItem,
} from '../shared/contracts.js';
import { sleep } from '../shared/sleep.js';

function clearScreen(): void {
  process.stdout.write('\x1Bc');
}

export async function runTui(client: ConvexHttpClient, intervalSec: number): Promise<void> {
  while (true) {
    const [overview, apps, agents, events] = await Promise.all([
      query<OverviewQueryResult>(client, 'snapshots:getOverview', {}),
      query<AppListItem[]>(client, 'appStatus:listApps', {}),
      query<TuiAgentListItem[]>(client, 'agentStatus:listAgents', {}),
      query<PaginatedResult<TuiEventListItem>>(client, 'events:listEvents', {
        paginationOpts: { cursor: null, numItems: 5 },
      }),
    ]);

    clearScreen();
    console.log(`VPS Control Room TUI  |  ${new Date().toISOString()}\n`);

    if (overview.snapshot) {
      const ramPct =
        overview.snapshot.ram_total > 0
          ? ((overview.snapshot.ram_used / overview.snapshot.ram_total) * 100).toFixed(1)
          : '0.0';
      console.log(
        `CPU: ${overview.snapshot.cpu_total.toFixed(1)}% | RAM: ${ramPct}% | Uptime(s): ${Math.round(overview.snapshot.uptime_seconds)} | Alerts: ${overview.active_alert_count}`
      );
      console.log(`Apps: ${overview.app_count} | Agents: ${overview.agent_count}\n`);
    } else {
      console.log('No snapshot yet.\n');
    }

    console.log('Apps:');
    for (const app of apps.slice(0, 8)) {
      console.log(`- ${app.name.padEnd(28)} ${app.runtime_status.padEnd(10)} health=${app.health_status}`);
    }

    console.log('\nAgents:');
    for (const agent of agents.slice(0, 8)) {
      console.log(`- ${agent.name.padEnd(28)} ${agent.status.padEnd(10)} cpu=${agent.cpu.toFixed(1)}%`);
    }

    console.log('\nRecent Events:');
    for (const event of events.page) {
      console.log(`- [${new Date(event.timestamp).toISOString()}] ${event.severity.toUpperCase()} ${event.message}`);
    }

    console.log('\nPress Ctrl+C to exit.');

    await sleep(intervalSec * 1000);
  }
}
