import { runSecurityCommand } from './shell.js';
import type { ParsedSshLogs, SshLoginEntry } from './types.js';

const SSH_LOG_COMMAND =
  `journalctl -u ssh -u sshd --since "1 hour ago" --no-pager -o short-iso 2>/dev/null || ` +
  `journalctl _SYSTEMD_UNIT=ssh.service --since "1 hour ago" --no-pager -o short-iso 2>/dev/null`;

export function parseSshLogs(output: string): ParsedSshLogs {
  const success: SshLoginEntry[] = [];
  const failed: SshLoginEntry[] = [];

  const lines = output.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const acceptedMatch = line.match(
      /^(\S+T\S+|\w{3}\s+\d+\s+\S+)\s+\S+\s+sshd\[.*?\]:\s+Accepted\s+\S+\s+for\s+(\S+)\s+from\s+([\d.a-f:]+)/i
    );
    if (acceptedMatch) {
      success.push({
        timestamp: acceptedMatch[1] ?? '',
        user: acceptedMatch[2] ?? '',
        from_ip: acceptedMatch[3] ?? '',
      });
      continue;
    }

    const failedMatch = line.match(
      /^(\S+T\S+|\w{3}\s+\d+\s+\S+)\s+\S+\s+sshd\[.*?\]:\s+Failed\s+\S+\s+for\s+(?:invalid user\s+)?(\S+)\s+from\s+([\d.a-f:]+)/i
    );
    if (failedMatch) {
      failed.push({
        timestamp: failedMatch[1] ?? '',
        user: failedMatch[2] ?? '',
        from_ip: failedMatch[3] ?? '',
      });
      continue;
    }

    const invalidUserMatch = line.match(
      /^(\S+T\S+|\w{3}\s+\d+\s+\S+)\s+\S+\s+sshd\[.*?\]:\s+Invalid\s+user\s+(\S+)\s+from\s+([\d.a-f:]+)/i
    );
    if (invalidUserMatch) {
      failed.push({
        timestamp: invalidUserMatch[1] ?? '',
        user: invalidUserMatch[2] ?? '',
        from_ip: invalidUserMatch[3] ?? '',
      });
    }
  }

  return { success, failed };
}

export async function collectRecentSshLogins(): Promise<ParsedSshLogs> {
  const sshLogOutput = await runSecurityCommand(SSH_LOG_COMMAND);
  return parseSshLogs(sshLogOutput);
}
