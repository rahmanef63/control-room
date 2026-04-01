import { config } from '../config.js';
import { logger } from '../logger.js';
import { runAgentsCollectorTask } from './collector-runtime/agents-collector.js';
import { runAppCollectorTask } from './collector-runtime/app-collector.js';
import { runSecurityCollectorTask } from './collector-runtime/security-collector.js';
import { runSystemCollectorTask } from './collector-runtime/system-collector.js';

type CollectorLoop = () => Promise<void>;

export class CollectorRuntime {
  private readonly intervals: Array<ReturnType<typeof setInterval>> = [];

  private addInterval(fn: CollectorLoop, ms: number): void {
    const handle = setInterval(() => {
      fn().catch((err) => {
        logger.error("Unhandled error in collector interval", {
          error: String(err),
        });
      });
    }, ms);

    this.intervals.push(handle);
  }

  stop(): void {
    for (const handle of this.intervals) {
      clearInterval(handle);
    }
    this.intervals.length = 0;
  }

  async runInitialCollection(): Promise<void> {
    await Promise.allSettled([
      runSystemCollectorTask(),
      runAppCollectorTask(),
      runAgentsCollectorTask(),
      runSecurityCollectorTask(),
    ]);
  }

  startScheduledCollection(): void {
    this.addInterval(() => runSystemCollectorTask(), config.SYSTEM_POLL_INTERVAL_MS);
    this.addInterval(() => runAppCollectorTask(), config.DOCKER_POLL_INTERVAL_MS);
    this.addInterval(() => runAgentsCollectorTask(), config.AGENT_POLL_INTERVAL_MS);
    this.addInterval(() => runSecurityCollectorTask(), config.SECURITY_POLL_INTERVAL_MS);
  }
}
