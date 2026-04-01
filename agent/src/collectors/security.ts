import { collectFail2banStatus } from './security/fail2ban.js';
import { generateSecurityEvents } from './security/events.js';
import { collectListeningPorts } from './security/ports.js';
import { collectRecentSshLogins } from './security/ssh.js';
import type { SecurityData } from './security/types.js';
import { collectUfwRules } from './security/ufw.js';

export type { SecurityData } from './security/types.js';

export async function collectSecurity(): Promise<SecurityData> {
  const { success: ssh_success_logins, failed: ssh_failed_logins } =
    await collectRecentSshLogins();
  const fail2ban_status = await collectFail2banStatus();
  const ufw_rules = await collectUfwRules();
  const listening_ports = await collectListeningPorts();
  const events_to_emit = generateSecurityEvents(
    ssh_failed_logins,
    fail2ban_status
  );

  return {
    ssh_success_logins,
    ssh_failed_logins,
    fail2ban_status,
    ufw_rules,
    listening_ports,
    events_to_emit,
  };
}
