import type { ConvexHttpClient } from 'convex/browser';

import { query } from '../infra/convex-client.js';
import type { AgentListItem } from '../shared/contracts.js';

export async function runAgentsList(client: ConvexHttpClient): Promise<void> {
  const agents = await query<AgentListItem[]>(client, 'agentStatus:listAgents', {});

  const rows = agents
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((agent) => ({
      name: agent.name,
      status: agent.status,
      pid: agent.pid ?? '-',
      cpu: `${agent.cpu.toFixed(1)}%`,
      uptime_s: Math.round(agent.uptime_seconds),
    }));

  console.table(rows);
}
