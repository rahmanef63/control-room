import type { Fail2banStatus, SecurityEvent, SshLoginEntry } from './types.js';

export function generateSecurityEvents(
  failed: SshLoginEntry[],
  fail2ban: Fail2banStatus
): SecurityEvent[] {
  const events: SecurityEvent[] = [];

  if (failed.length >= 10) {
    const uniqueIps = new Set(failed.map((entry) => entry.from_ip)).size;
    events.push({
      type: 'ssh_brute_force',
      message: `${failed.length} SSH login failures in the last hour from ${uniqueIps} unique IP(s)`,
      severity: failed.length >= 50 ? 'critical' : 'warning',
      source: 'security-collector',
    });
  }

  if (fail2ban.banned_ips.length > 0) {
    events.push({
      type: 'fail2ban_ban',
      message: `fail2ban has banned ${fail2ban.banned_ips.length} IP(s): ${fail2ban.banned_ips.slice(0, 5).join(', ')}${fail2ban.banned_ips.length > 5 ? '...' : ''}`,
      severity: 'warning',
      source: 'security-collector',
    });
  }

  return events;
}
