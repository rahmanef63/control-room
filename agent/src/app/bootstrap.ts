import { config } from "../config.js";
import { logger } from "../logger.js";
import { appendLog, cleanupLog } from "../state/log.js";
import { startHostTelemetry, stopHostTelemetry } from "./host-telemetry.js";
import { startHealthServer, stopHealthServer } from "./health-server.js";

const DAY_MS = 24 * 60 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

class AgentBootstrap {
  private isShuttingDown = false;

  registerProcessHandlers(): void {
    process.on("SIGTERM", () => {
      this.shutdown("SIGTERM").catch((err) => {
        logger.error("Error during SIGTERM shutdown", { error: String(err) });
        process.exit(1);
      });
    });

    process.on("SIGINT", () => {
      this.shutdown("SIGINT").catch((err) => {
        logger.error("Error during SIGINT shutdown", { error: String(err) });
        process.exit(1);
      });
    });

    // After an uncaught exception the process is in an undefined state — serving
    // further requests risks stale/corrupt responses, so log and exit(1) to let
    // systemd restart a clean process (StartLimitBurst in the unit bounds the
    // loop). An unhandled REJECTION is only a missed .catch(), not necessarily a
    // corrupt process, and the agent's collectors each wrap their own try/catch —
    // so we log it loudly but keep running rather than kill live terminals.
    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception", { error: String(err), stack: err.stack });
      appendLog({
        level: "error",
        source: "agent",
        message: "Uncaught exception",
        data: { error: String(err), stack: err.stack },
      });
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled promise rejection", { reason: String(reason) });
      appendLog({
        level: "error",
        source: "agent",
        message: "Unhandled promise rejection",
        data: { reason: String(reason) },
      });
    });
  }

  async start(): Promise<void> {
    logger.info("Agent initialized, starting terminal runtime...");

    await startHostTelemetry();
    startHealthServer();

    // Daily log TTL cleanup
    cleanupTimer = setInterval(() => {
      cleanupLog().catch((err) => {
        logger.warn("Log cleanup failed", { error: String(err) });
      });
    }, DAY_MS);
    cleanupTimer.unref();

    logger.info("Agent running", {
      host_telemetry_interval_ms: config.HOST_TELEMETRY_INTERVAL_MS,
      health_port: config.AGENT_HEALTH_PORT,
    });

    appendLog({
      level: "info",
      source: "agent",
      message: "Agent started",
      data: { health_port: config.AGENT_HEALTH_PORT },
    });
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info("Shutting down agent", { signal });
    appendLog({ level: "info", source: "agent", message: "Agent shutting down", data: { signal } });

    if (cleanupTimer) clearInterval(cleanupTimer);
    stopHostTelemetry();
    stopHealthServer();

    logger.info("Agent shutdown complete");
    process.exit(0);
  }
}

export async function bootstrapAgent(): Promise<void> {
  const app = new AgentBootstrap();
  app.registerProcessHandlers();
  await app.start();
}
