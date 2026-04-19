import type { ConvexHttpClient } from 'convex/browser';

import { query } from '../infra/convex-client.js';
import type { CommandRecord, PaginatedResult } from '../shared/contracts.js';

export async function listCommands(
  client: ConvexHttpClient,
  limit: number
): Promise<PaginatedResult<CommandRecord>> {
  return query<PaginatedResult<CommandRecord>>(client, 'commands:listCommands', {
    paginationOpts: { cursor: null, numItems: limit },
  });
}

export async function runCommandsList(client: ConvexHttpClient, limit: number): Promise<void> {
  const commands = await listCommands(client, limit);

  console.table(
    commands.page.map((command) => ({
      request_id: command.request_id,
      action: command.action,
      target: command.target_id,
      status: command.status,
      by: command.requested_by,
      requested_at: new Date(command.requested_at).toISOString(),
    }))
  );
}
