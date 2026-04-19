#!/usr/bin/env node
import { parseArgv } from './app/argv.js';
import { usage } from './app/usage.js';
import { runAction } from './commands/action.js';
import { runAgentsList } from './commands/agents.js';
import { runAppsList } from './commands/apps.js';
import { runCommandsList } from './commands/commands.js';
import { runEventsList } from './commands/events.js';
import { runStatus } from './commands/status.js';
import { runTui } from './commands/tui.js';
import { createClient } from './infra/convex-client.js';

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2));

  if (args._.length === 0 || args.flags.help) {
    usage();
    return;
  }

  const client = await createClient();

  const [a, b] = args._;

  if (a === 'status') {
    await runStatus(client);
    return;
  }

  if (a === 'apps' && b === 'list') {
    await runAppsList(client);
    return;
  }

  if (a === 'agents' && b === 'list') {
    await runAgentsList(client);
    return;
  }

  if (a === 'events' && b === 'list') {
    const limit = Number(args.flags.limit ?? 20);
    await runEventsList(client, Number.isFinite(limit) ? limit : 20);
    return;
  }

  if (a === 'commands' && b === 'list') {
    const limit = Number(args.flags.limit ?? 20);
    await runCommandsList(client, Number.isFinite(limit) ? limit : 20);
    return;
  }

  if (a === 'action' && b === 'run') {
    await runAction(client, args);
    return;
  }

  if (a === 'tui') {
    const interval = Number(args.flags.interval ?? 3);
    await runTui(client, Number.isFinite(interval) && interval > 0 ? interval : 3);
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(`[vpsctl] ${String(err)}`);
  process.exit(1);
});
