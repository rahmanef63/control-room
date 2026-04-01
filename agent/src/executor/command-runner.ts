import { exec } from 'child_process';
import { promisify } from 'util';

import { config } from '../config.js';
import { logger } from '../logger.js';
import { mutate } from '../convex-client.js';
import { ALLOWLIST, buildCommand as buildAllowlistCommand } from './allowlist.js';
import type { AuditActor, CommandFinalStatus, ConvexCommand } from './types.js';

const execAsync = promisify(exec);

function toAuditActor(input: string): AuditActor {
  if (input === 'manual-dashboard') return input;
  if (input === 'manual-cli') return input;
  if (input === 'manual-tui') return input;
  if (input === 'system-agent') return input;
  if (input === 'scheduled-check') return input;
  return 'manual-dashboard';
}

function buildShellCommand(
  action: string,
  targetId: string,
  payload?: Record<string, unknown>
): string {
  const cmd = buildAllowlistCommand(action, targetId, payload);
  if (cmd === null) throw new Error(`Action ${action} not in allowlist`);
  return cmd;
}

async function markCommandRunning(command: ConvexCommand, startedAt: number): Promise<void> {
  try {
    await mutate('commands:updateCommandStatus', {
      id: command._id,
      status: 'running',
      started_at: startedAt,
    });
  } catch (err) {
    logger.error('Failed to update command status to running', {
      id: command._id,
      error: String(err),
    });
  }
}

async function updateFinalCommandStatus(
  command: ConvexCommand,
  status: CommandFinalStatus,
  startedAt: number,
  finishedAt: number,
  result?: string,
  error?: string
): Promise<void> {
  try {
    await mutate('commands:updateCommandStatus', {
      id: command._id,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      ...(result !== undefined ? { result } : {}),
      ...(error !== undefined ? { error } : {}),
    });
  } catch (err) {
    logger.error('Failed to update command final status', {
      id: command._id,
      error: String(err),
    });
  }
}

async function insertAuditEntry(
  command: ConvexCommand,
  status: CommandFinalStatus,
  startedAt: number,
  finishedAt: number,
  error?: string
): Promise<void> {
  const auditSeverity = ALLOWLIST.get(command.action)?.sensitive ? 'warning' : 'info';

  try {
    await mutate('audit:insertAudit', {
      timestamp: finishedAt,
      action: command.action,
      target: command.target_id,
      result: status === 'success' ? 'success' : 'failed',
      severity: auditSeverity,
      triggered_by: toAuditActor(command.requested_by),
      request_id: command.request_id,
      metadata: {
        duration_ms: finishedAt - startedAt,
        target_type: command.target_type,
        ...(error ? { error: error.slice(0, 500) } : {}),
      },
    });
  } catch (err) {
    logger.error('Failed to insert audit log', {
      action: command.action,
      error: String(err),
    });
  }
}

export async function executeCommand(command: ConvexCommand): Promise<void> {
  const startedAt = Date.now();
  await markCommandRunning(command, startedAt);

  const actionDef = ALLOWLIST.get(command.action);
  const timeoutMs = actionDef?.timeout_ms ?? config.AGENT_COMMAND_TIMEOUT_MS;

  let result: string | undefined;
  let error: string | undefined;
  let finalStatus: CommandFinalStatus = 'failed';

  try {
    const cmd = buildShellCommand(command.action, command.target_id, command.payload);
    logger.info('Executing command', {
      action: command.action,
      target_id: command.target_id,
      cmd: cmd.replace(/sudo\s+/, ''),
    });

    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    result = [stdout, stderr].filter(Boolean).join('\n').trim().slice(0, 4000);
    finalStatus = 'success';
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes('Command failed') &&
      'killed' in err &&
      (err as NodeJS.ErrnoException & { killed?: boolean }).killed
    ) {
      finalStatus = 'timeout';
      error = `Command timed out after ${timeoutMs}ms`;
    } else if (err instanceof Error && err.message.toLowerCase().includes('timed out')) {
      finalStatus = 'timeout';
      error = `Command timed out after ${timeoutMs}ms`;
    } else {
      finalStatus = 'failed';
      if (
        err !== null &&
        typeof err === 'object' &&
        'stdout' in err &&
        'stderr' in err
      ) {
        const execErr = err as { stdout: string; stderr: string; message: string };
        error = [execErr.stderr, execErr.message]
          .filter(Boolean)
          .join('\n')
          .slice(0, 2000);
        result = execErr.stdout?.slice(0, 2000);
      } else {
        error = String(err).slice(0, 2000);
      }
    }
  }

  const finishedAt = Date.now();

  await updateFinalCommandStatus(
    command,
    finalStatus,
    startedAt,
    finishedAt,
    result,
    error
  );
  await insertAuditEntry(command, finalStatus, startedAt, finishedAt, error);

  logger.info('Command completed', {
    action: command.action,
    target_id: command.target_id,
    status: finalStatus,
    duration_ms: finishedAt - startedAt,
  });
}
