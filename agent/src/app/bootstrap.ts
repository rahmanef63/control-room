import { config } from "../config.js";
import { mutate } from "../convex-client.js";
import { startExecutor, stopExecutor } from "../executor/index.js";
import { logger } from "../logger.js";
import { CollectorRuntime } from "./collector-runtime.js";
import { startHealthServer, stopHealthServer } from "./health-server.js";

async function insertLifecycleEvent(type: string, message: string): Promise<void> {
  await mutate("events:insertEvent", {
    timestamp: Date.now(),
    type,
    message,
    severity: "info",
    source: "agent",
  });
}

class AgentBootstrap {
  private readonly collectorRuntime = new CollectorRuntime();
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

    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception", { error: String(err), stack: err.stack });
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled promise rejection", { reason: String(reason) });
    });
  }

  async start(): Promise<void> {
    logger.info("Agent initialized, starting collectors...");

    await this.collectorRuntime.runInitialCollection();
    this.collectorRuntime.startScheduledCollection();

    startExecutor();
    startHealthServer();

    logger.info("Agent running", {
      system_poll_ms: config.SYSTEM_POLL_INTERVAL_MS,
      docker_poll_ms: config.DOCKER_POLL_INTERVAL_MS,
      agent_poll_ms: config.AGENT_POLL_INTERVAL_MS,
      security_poll_ms: config.SECURITY_POLL_INTERVAL_MS,
      command_poll_ms: config.AGENT_COMMAND_POLL_INTERVAL_MS,
    });

    try {
      await insertLifecycleEvent("agent_startup", "VPS Control Room Agent started");
    } catch (err) {
      logger.warn("Could not log startup event to Convex", {
        error: String(err),
      });
    }
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    logger.info("Shutting down agent", { signal });

    this.collectorRuntime.stop();
    await stopExecutor();
    stopHealthServer();

    try {
      await insertLifecycleEvent(
        "agent_shutdown",
        `Agent shutting down (signal: ${signal})`
      );
    } catch {
      // Ignore - connection may already be gone
    }

    logger.info("Agent shutdown complete");
    process.exit(0);
  }
}

export async function bootstrapAgent(): Promise<void> {
  const app = new AgentBootstrap();
  app.registerProcessHandlers();
  await app.start();
}
