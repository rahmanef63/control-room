import { assertConfigSecrets, config } from "./config.js";
import { logger } from "./logger.js";
import { bootstrapAgent } from "./app/bootstrap.js";

// Fail-closed before anything binds: weak/missing secrets must not run.
assertConfigSecrets();

logger.info("VPS Control Room Agent starting...", {
  health_port: config.AGENT_HEALTH_PORT,
});

bootstrapAgent().catch((err) => {
  logger.error("Fatal error during agent startup", {
    error: String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
