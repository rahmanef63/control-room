import { exec } from "child_process";
import { promisify } from "util";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { mutate, query } from "../convex-client.js";
import { ALLOWLIST, buildCommand as buildAllowlistCommand } from "./allowlist.js";
import { validateCommand } from "./validators.js";

const execAsync = promisify(exec);

interface ConvexCommand {
  _id: string;
  request_id: string;
  action: string;
  target_type: string;
  target_id: string;
  payload?: Record<string, unknown>;
  status: string;
  requested_by: string;
  requested_at: number;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let runningCount = 0;
let isShuttingDown = false;

// Track running promises so we can wait for them on shutdown
const runningCommands: Set<Promise<void>> = new Set();

function buildCommand(
  action: string,
  target_id: string,
  payload?: Record<string, unknown>
): string {
  const cmd = buildAllowlistCommand(action, target_id, payload);
  if (cmd === null) throw new Error(`Action ${action} not in allowlist`);
  return cmd;
}

async function executeCommand(command: ConvexCommand): Promise<void> {
  const startTime = Date.now();

  // Mark as running
  try {
    await mutate("commands:updateCommandStatus", {
      id: command._id,
      status: "running",
      started_at: startTime,
    });
  } catch (err) {
    logger.error("Failed to update command status to running", {
      id: command._id,
      error: String(err),
    });
  }

  const actionDef = ALLOWLIST.get(command.action);
  const timeoutMs =
    actionDef?.timeout_ms ?? config.AGENT_COMMAND_TIMEOUT_MS;

  let result: string | undefined;
  let error: string | undefined;
  let finalStatus: "success" | "failed" | "timeout" = "failed";

  try {
    const cmd = buildCommand(command.action, command.target_id, command.payload);
    logger.info("Executing command", {
      action: command.action,
      target_id: command.target_id,
      cmd: cmd.replace(/sudo\s+/, ""), // sanitize from logs
    });

    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    result = [stdout, stderr].filter(Boolean).join("\n").trim().slice(0, 4000);
    finalStatus = "success";
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("Command failed") &&
      "killed" in err &&
      (err as NodeJS.ErrnoException & { killed?: boolean }).killed
    ) {
      finalStatus = "timeout";
      error = `Command timed out after ${timeoutMs}ms`;
    } else if (err instanceof Error && err.message.toLowerCase().includes("timed out")) {
      finalStatus = "timeout";
      error = `Command timed out after ${timeoutMs}ms`;
    } else {
      finalStatus = "failed";
      // exec errors may have stdout/stderr too
      if (
        err !== null &&
        typeof err === "object" &&
        "stdout" in err &&
        "stderr" in err
      ) {
        const execErr = err as { stdout: string; stderr: string; message: string };
        error = [execErr.stderr, execErr.message]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2000);
        result = execErr.stdout?.slice(0, 2000);
      } else {
        error = String(err).slice(0, 2000);
      }
    }
  }

  const finishedAt = Date.now();

  // Update command status
  try {
    await mutate("commands:updateCommandStatus", {
      id: command._id,
      status: finalStatus,
      started_at: startTime,
      finished_at: finishedAt,
      ...(result !== undefined ? { result } : {}),
      ...(error !== undefined ? { error } : {}),
    });
  } catch (err) {
    logger.error("Failed to update command final status", {
      id: command._id,
      error: String(err),
    });
  }

  // Insert audit log
  const auditSeverity =
    ALLOWLIST.get(command.action)?.sensitive ? "warning" : "info";

  try {
    await mutate("audit:insertAudit", {
      timestamp: finishedAt,
      action: command.action,
      target: command.target_id,
      result: finalStatus === "success" ? "success" : finalStatus === "timeout" ? "failed" : "failed",
      severity: auditSeverity,
      triggered_by: "manual-dashboard",
      request_id: command.request_id,
      metadata: {
        duration_ms: finishedAt - startTime,
        target_type: command.target_type,
        ...(error ? { error: error.slice(0, 500) } : {}),
      },
    });
  } catch (err) {
    logger.error("Failed to insert audit log", {
      action: command.action,
      error: String(err),
    });
  }

  logger.info("Command completed", {
    action: command.action,
    target_id: command.target_id,
    status: finalStatus,
    duration_ms: finishedAt - startTime,
  });
}

async function pollAndExecute(): Promise<void> {
  if (isShuttingDown) return;
  if (runningCount >= config.AGENT_MAX_CONCURRENT_COMMANDS) return;

  let commands: ConvexCommand[];
  try {
    const raw = await query("commands:pollPendingCommands", {});
    commands = (raw as ConvexCommand[]) ?? [];
  } catch (err) {
    logger.error("Failed to poll pending commands", { error: String(err) });
    return;
  }

  if (!commands.length) return;

  for (const command of commands) {
    if (isShuttingDown) break;
    if (runningCount >= config.AGENT_MAX_CONCURRENT_COMMANDS) break;

    // Validate the command
    const validation = validateCommand(
      command.action,
      command.target_type,
      command.target_id,
      command.payload
    );

    if (!validation.valid) {
      logger.warn("Command validation failed", {
        id: command._id,
        action: command.action,
        reason: validation.reason,
      });

      try {
        await mutate("commands:updateCommandStatus", {
          id: command._id,
          status: "failed",
          finished_at: Date.now(),
          error: `Validation failed: ${validation.reason}`,
        });
      } catch (err) {
        logger.error("Failed to mark invalid command as failed", {
          error: String(err),
        });
      }
      continue;
    }

    runningCount++;
    const cmdPromise = executeCommand(command).finally(() => {
      runningCount--;
      runningCommands.delete(cmdPromise);
    });

    runningCommands.add(cmdPromise);
  }
}

export function startExecutor(): void {
  logger.info("Starting command executor", {
    poll_interval_ms: config.AGENT_COMMAND_POLL_INTERVAL_MS,
    max_concurrent: config.AGENT_MAX_CONCURRENT_COMMANDS,
  });

  pollInterval = setInterval(() => {
    pollAndExecute().catch((err) => {
      logger.error("Unexpected error in executor poll", { error: String(err) });
    });
  }, config.AGENT_COMMAND_POLL_INTERVAL_MS);
}

export async function stopExecutor(): Promise<void> {
  logger.info("Stopping executor...");
  isShuttingDown = true;

  if (pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  if (runningCommands.size > 0) {
    logger.info(`Waiting for ${runningCommands.size} running command(s) to finish...`);
    const waitPromise = Promise.allSettled([...runningCommands]);
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, 10000)
    );
    await Promise.race([waitPromise, timeoutPromise]);
  }

  logger.info("Executor stopped");
}
