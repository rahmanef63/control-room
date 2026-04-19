import { config } from "../config.js";
import { hasConvexConfig, mutate } from "../convex-client.js";
import { startExecutor, stopExecutor } from "../executor/index.js";
import { logger } from "../logger.js";
import { CollectorRuntime } from "./collector-runtime.js";
import { startHostTelemetry, stopHostTelemetry } from "./host-telemetry.js";
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
    logger.info("Agent initialized, starting terminal runtime...");

    await startHostTelemetry();
    startHealthServer();

    if (!config.TERMINAL_ONLY_MODE) {
      if (!hasConvexConfig()) {
        throw new Error(
          "TERMINAL_ONLY_MODE is disabled, but Convex is not configured."
        );
      }

      await this.collectorRuntime.runInitialCollection();
      this.collectorRuntime.startScheduledCollection();
      startExecutor();
    }

    logger.info("Agent running", {
      terminal_only_mode: config.TERMINAL_ONLY_MODE,
      host_telemetry_interval_ms: config.HOST_TELEMETRY_INTERVAL_MS,
      health_port: config.AGENT_HEALTH_PORT,
    });

    if (config.TERMINAL_ONLY_MODE) {
      logger.info("Legacy Convex collectors and command executor are disabled.");
      return;
    }

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

    stopHostTelemetry();
    stopHealthServer();

    if (!config.TERMINAL_ONLY_MODE) {
      this.collectorRuntime.stop();
      await stopExecutor();

      try {
        await insertLifecycleEvent(
          "agent_shutdown",
          `Agent shutting down (signal: ${signal})`
        );
      } catch {
        // Ignore - connection may already be gone
      }
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
