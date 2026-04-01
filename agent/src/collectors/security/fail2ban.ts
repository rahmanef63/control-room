import { runSecurityCommand } from './shell.js';
import type { Fail2banStatus } from './types.js';

export async function collectFail2banStatus(): Promise<Fail2banStatus> {
  const defaultResult: Fail2banStatus = {
    active: false,
    jails: [],
    banned_ips: [],
  };

  const statusOutput = await runSecurityCommand('fail2ban-client status sshd 2>/dev/null');

  if (!statusOutput.trim()) {
    const generalStatus = await runSecurityCommand('fail2ban-client status 2>/dev/null');
    if (!generalStatus.trim()) {
      return defaultResult;
    }

    const jailMatch = generalStatus.match(/Jail list:\s+(.+)/);
    const jailNames = jailMatch
      ? jailMatch[1]!.split(',').map((jail) => jail.trim()).filter(Boolean)
      : [];

    return {
      active: true,
      jails: jailNames,
      banned_ips: [],
    };
  }

  const bannedIpsMatch = statusOutput.match(/Banned IP list:\s*(.*?)(?:\n|$)/i);
  const bannedStr = bannedIpsMatch?.[1]?.trim() ?? '';
  const banned_ips = bannedStr ? bannedStr.split(/\s+/).filter(Boolean) : [];

  return {
    active: true,
    jails: ['sshd'],
    banned_ips,
  };
}
