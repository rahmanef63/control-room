import { config } from '../config.js';
import { logger } from '../logger.js';
import { mutate, query } from '../convex-client.js';
import { validateCommand } from './validators.js';
import { executeCommand } from './command-runner.js';
import type { ConvexCommand } from './types.js';

export class ExecutorRuntimeService {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private runningCount = 0;
  private isShuttingDown = false;
  private readonly runningCommands = new Set<Promise<void>>();

  start(): void {
    logger.info('Starting command executor', {
      poll_interval_ms: config.AGENT_COMMAND_POLL_INTERVAL_MS,
      max_concurrent: config.AGENT_MAX_CONCURRENT_COMMANDS,
    });

    this.pollInterval = setInterval(() => {
      this.pollAndExecute().catch((err) => {
        logger.error('Unexpected error in executor poll', { error: String(err) });
      });
    }, config.AGENT_COMMAND_POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    logger.info('Stopping executor...');
    this.isShuttingDown = true;

    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.runningCommands.size > 0) {
      logger.info(`Waiting for ${this.runningCommands.size} running command(s) to finish...`);
      const waitPromise = Promise.allSettled([...this.runningCommands]);
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 10000));
      await Promise.race([waitPromise, timeoutPromise]);
    }

    logger.info('Executor stopped');
  }

  private async pollAndExecute(): Promise<void> {
    if (this.isShuttingDown) return;
    if (this.runningCount >= config.AGENT_MAX_CONCURRENT_COMMANDS) return;

    let commands: ConvexCommand[];
    try {
      const raw = await query('commands:pollPendingCommands', {});
      commands = (raw as ConvexCommand[]) ?? [];
    } catch (err) {
      logger.error('Failed to poll pending commands', { error: String(err) });
      return;
    }

    if (!commands.length) return;

    for (const command of commands) {
      if (this.isShuttingDown) break;
      if (this.runningCount >= config.AGENT_MAX_CONCURRENT_COMMANDS) break;

      const validation = validateCommand(
        command.action,
        command.target_type,
        command.target_id,
        command.payload
      );

      if (!validation.valid) {
        await this.markInvalidCommandFailed(command, validation.reason);
        continue;
      }

      this.runningCount += 1;
      const commandPromise = executeCommand(command).finally(() => {
        this.runningCount -= 1;
        this.runningCommands.delete(commandPromise);
      });

      this.runningCommands.add(commandPromise);
    }
  }

  private async markInvalidCommandFailed(
    command: ConvexCommand,
    reason?: string
  ): Promise<void> {
    logger.warn('Command validation failed', {
      id: command._id,
      action: command.action,
      reason,
    });

    try {
      await mutate('commands:updateCommandStatus', {
        id: command._id,
        status: 'failed',
        finished_at: Date.now(),
        error: `Validation failed: ${reason}`,
      });
    } catch (err) {
      logger.error('Failed to mark invalid command as failed', {
        error: String(err),
      });
    }
  }
}
