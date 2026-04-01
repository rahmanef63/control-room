import { mutate } from '../../convex-client.js';
import { collectAgents } from '../../collectors/agents.js';
import { updateKnownTargets } from '../../executor/allowlist.js';
import { logger } from '../../logger.js';

export async function runAgentsCollectorTask(): Promise<void> {
  try {
    const agents = await collectAgents();

    updateKnownTargets(
      'service',
      agents.filter((agent) => agent.status === 'running').map((agent) => agent.name)
    );
    updateKnownTargets(
      'agent',
      agents.map((agent) => agent.name)
    );

    for (const agent of agents) {
      try {
        await mutate('agentStatus:upsertAgentStatus', {
          name: agent.name,
          ...(agent.pid !== undefined ? { pid: agent.pid } : {}),
          status: agent.status,
          cpu: agent.cpu,
          memory: agent.memory,
          uptime_seconds: agent.uptime_seconds,
          last_seen: agent.last_seen,
          detection_source: agent.detection_source,
          available_actions: agent.available_actions,
          ...(agent.metadata !== undefined ? { metadata: agent.metadata } : {}),
        });
      } catch (err) {
        logger.error('Failed to upsert agent status', {
          name: agent.name,
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.error('Agents collector error', { error: String(err) });
  }
}
