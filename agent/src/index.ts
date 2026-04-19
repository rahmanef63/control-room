import { config } from "./config.js";
import { logger } from "./logger.js";
import { bootstrapAgent } from "./app/bootstrap.js";

logger.info("VPS Control Room Agent starting...", {
  mode: config.TERMINAL_ONLY_MODE ? "terminal-only" : "legacy",
  convex_url: config.CONVEX_URL ?? "disabled",
  health_port: config.AGENT_HEALTH_PORT,
});

bootstrapAgent().catch((err) => {
  logger.error("Fatal error during agent startup", {
    error: String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
