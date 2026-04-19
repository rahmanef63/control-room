import type { ConvexHttpClient } from 'convex/browser';

import { mutation, query } from '../infra/convex-client.js';
import type { CommandArgs } from '../app/types.js';
import type {
  CommandRecord,
  PaginatedResult,
  TargetType,
} from '../shared/contracts.js';
import { sleep } from '../shared/sleep.js';

async function waitForCommand(
  client: ConvexHttpClient,
  requestId: string,
  timeoutMs = 30000
): Promise<CommandRecord | null> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const commands = await query<PaginatedResult<CommandRecord>>(client, 'commands:listCommands', {
      paginationOpts: { cursor: null, numItems: 50 },
    });

    const match = commands.page.find((command) => command.request_id === requestId);
    if (match && ['success', 'failed', 'cancelled', 'timeout'].includes(match.status)) {
      return match;
    }

    await sleep(1000);
  }

  return null;
}

export async function runAction(client: ConvexHttpClient, args: CommandArgs): Promise<void> {
  const action = args._[2];
  if (!action) {
    throw new Error('Missing action. Usage: vpsctl action run <action> --target-type <type> --target-id <id>');
  }

  const targetType = String(args.flags['target-type'] ?? '').trim() as TargetType;
  const targetId = String(args.flags['target-id'] ?? '').trim();
  const lines = args.flags.lines !== undefined ? Number(args.flags.lines) : undefined;
  const wait = Boolean(args.flags.wait);

  if (!targetType) throw new Error('--target-type is required');
  if (!targetId) throw new Error('--target-id is required');

  const payload: Record<string, unknown> = {};
  if (action === 'container.logs') {
    payload.lines = Number.isFinite(lines) ? lines : 100;
  }

  await mutation<string>(client, 'commands:enqueueCommand', {
    action,
    target_type: targetType,
    target_id: targetId,
    requested_by: 'manual-cli',
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  });

  console.log(`Queued ${action} on ${targetType}:${targetId} (requested_by=manual-cli)`);

  if (!wait) {
    return;
  }

  console.log('Waiting for completion...');

  const recent = await query<PaginatedResult<CommandRecord>>(client, 'commands:listCommands', {
    paginationOpts: { cursor: null, numItems: 10 },
  });
  const queued = recent.page.find(
    (command) =>
      command.action === action &&
      command.target_id === targetId &&
      command.requested_by === 'manual-cli'
  );

  if (!queued) {
    console.log('Queued command not found in recent list yet.');
    return;
  }

  const done = await waitForCommand(client, queued.request_id, 60000);
  if (!done) {
    console.log('Timed out while waiting for command result.');
    return;
  }

  console.log(`Final status: ${done.status}`);
  if (done.result) console.log(done.result);
  if (done.error) console.error(done.error);
}
