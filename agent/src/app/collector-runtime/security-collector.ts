import { mutate } from '../../convex-client.js';
import { collectSecurity } from '../../collectors/security.js';
import { updateKnownTargets } from '../../executor/allowlist.js';
import { logger } from '../../logger.js';

type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

const severityMap: Record<string, EventSeverity> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  critical: 'critical',
};

export async function runSecurityCollectorTask(): Promise<void> {
  try {
    const security = await collectSecurity();

    updateKnownTargets('fail2ban', security.fail2ban_status.banned_ips);

    for (const event of security.events_to_emit) {
      try {
        const severity: EventSeverity = severityMap[event.severity] ?? 'warning';

        await mutate('events:insertEvent', {
          timestamp: Date.now(),
          type: event.type,
          message: event.message,
          severity,
          source: event.source,
        });
      } catch (err) {
        logger.error('Failed to insert security event', {
          type: event.type,
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.error('Security collector error', { error: String(err) });
  }
}
