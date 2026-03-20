import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../logger.js";

const execAsync = promisify(exec);

export interface SecurityData {
  ssh_success_logins: Array<{
    timestamp: string;
    user: string;
    from_ip: string;
  }>;
  ssh_failed_logins: Array<{
    timestamp: string;
    user: string;
    from_ip: string;
  }>;
  fail2ban_status: {
    active: boolean;
    jails: string[];
    banned_ips: string[];
  };
  ufw_rules: string[];
  listening_ports: Array<{ port: number; protocol: string; process: string }>;
  events_to_emit: Array<{
    type: string;
    message: string;
    severity: string;
    source: string;
  }>;
}

async function runCommand(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 10000 });
    return stdout;
  } catch (err: unknown) {
    // Command may fail due to permissions, log at debug level
    const errMsg = err instanceof Error ? err.message : String(err);
    // Non-zero exit with stdout is still useful (e.g., journalctl with no results)
    if (
      err !== null &&
      typeof err === "object" &&
      "stdout" in err &&
      typeof (err as { stdout: unknown }).stdout === "string"
    ) {
      return (err as { stdout: string }).stdout;
    }
    logger.warn("Security command failed", { cmd: cmd.slice(0, 60), error: errMsg });
    return "";
  }
}

interface SshLoginEntry {
  timestamp: string;
  user: string;
  from_ip: string;
}

function parseSshLogs(
  output: string
): { success: SshLoginEntry[]; failed: SshLoginEntry[] } {
  const success: SshLoginEntry[] = [];
  const failed: SshLoginEntry[] = [];

  const lines = output.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    // Accepted password/publickey for user from IP
    const acceptedMatch = line.match(
      /^(\S+T\S+|\w{3}\s+\d+\s+\S+)\s+\S+\s+sshd\[.*?\]:\s+Accepted\s+\S+\s+for\s+(\S+)\s+from\s+([\d.a-f:]+)/i
    );
    if (acceptedMatch) {
      success.push({
        timestamp: acceptedMatch[1] ?? "",
        user: acceptedMatch[2] ?? "",
        from_ip: acceptedMatch[3] ?? "",
      });
      continue;
    }

    // Failed password for user from IP
    const failedMatch = line.match(
      /^(\S+T\S+|\w{3}\s+\d+\s+\S+)\s+\S+\s+sshd\[.*?\]:\s+Failed\s+\S+\s+for\s+(?:invalid user\s+)?(\S+)\s+from\s+([\d.a-f:]+)/i
    );
    if (failedMatch) {
      failed.push({
        timestamp: failedMatch[1] ?? "",
        user: failedMatch[2] ?? "",
        from_ip: failedMatch[3] ?? "",
      });
      continue;
    }

    // Invalid user attempt
    const invalidUserMatch = line.match(
      /^(\S+T\S+|\w{3}\s+\d+\s+\S+)\s+\S+\s+sshd\[.*?\]:\s+Invalid\s+user\s+(\S+)\s+from\s+([\d.a-f:]+)/i
    );
    if (invalidUserMatch) {
      failed.push({
        timestamp: invalidUserMatch[1] ?? "",
        user: invalidUserMatch[2] ?? "",
        from_ip: invalidUserMatch[3] ?? "",
      });
    }
  }

  return { success, failed };
}

interface Fail2banStatus {
  active: boolean;
  jails: string[];
  banned_ips: string[];
}

async function collectFail2ban(): Promise<Fail2banStatus> {
  const defaultResult: Fail2banStatus = {
    active: false,
    jails: [],
    banned_ips: [],
  };

  const statusOutput = await runCommand(
    "fail2ban-client status sshd 2>/dev/null"
  );

  if (!statusOutput.trim()) {
    // Try getting general status
    const generalStatus = await runCommand(
      "fail2ban-client status 2>/dev/null"
    );
    if (!generalStatus.trim()) {
      return defaultResult;
    }

    // Parse jail list from general status
    const jailMatch = generalStatus.match(/Jail list:\s+(.+)/);
    const jailNames = jailMatch
      ? jailMatch[1]!.split(",").map((j) => j.trim()).filter(Boolean)
      : [];

    return {
      active: true,
      jails: jailNames,
      banned_ips: [],
    };
  }

  // Parse sshd jail status
  const bannedIpsMatch = statusOutput.match(
    /Banned IP list:\s*(.*?)(?:\n|$)/i
  );
  const bannedStr = bannedIpsMatch?.[1]?.trim() ?? "";
  const banned_ips = bannedStr
    ? bannedStr.split(/\s+/).filter(Boolean)
    : [];

  return {
    active: true,
    jails: ["sshd"],
    banned_ips,
  };
}

async function collectUfwRules(): Promise<string[]> {
  const output = await runCommand("ufw status verbose 2>/dev/null");
  if (!output.trim()) return [];

  const lines = output.split("\n");
  const rules: string[] = [];
  let inRules = false;

  for (const line of lines) {
    if (line.startsWith("To ") || line.startsWith("--")) {
      inRules = true;
      continue;
    }
    if (inRules && line.trim()) {
      rules.push(line.trim());
    }
    if (!line.trim() && inRules) {
      // End of rules section
      break;
    }
  }

  // If parsing failed, return raw non-empty lines (up to 30)
  if (rules.length === 0) {
    return lines.filter((l) => l.trim()).slice(0, 30);
  }

  return rules;
}

interface ListeningPort {
  port: number;
  protocol: string;
  process: string;
}

async function collectListeningPorts(): Promise<ListeningPort[]> {
  const output = await runCommand("ss -tulpn 2>/dev/null");
  if (!output.trim()) return [];

  const lines = output.split("\n").slice(1); // skip header
  const ports: ListeningPort[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!line.trim()) continue;

    // ss -tulpn columns: Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const netid = parts[0] ?? "";
    const localAddr = parts[4] ?? "";
    const processInfo = parts.slice(6).join(" ");

    // Extract port from local address
    const portMatch = localAddr.match(/:(\d+)$/);
    if (!portMatch) continue;

    const port = parseInt(portMatch[1] ?? "0", 10);
    if (port === 0) continue;

    const protocol =
      netid === "tcp" || netid === "tcp6"
        ? "tcp"
        : netid === "udp" || netid === "udp6"
        ? "udp"
        : netid;

    // Extract process name from users:(("nginx",pid=123,...))
    const procNameMatch = processInfo.match(/\(\("([^"]+)"/);
    const procName = procNameMatch?.[1] ?? "unknown";

    const key = `${port}:${protocol}`;
    if (!seen.has(key)) {
      seen.add(key);
      ports.push({ port, protocol, process: procName });
    }
  }

  return ports.sort((a, b) => a.port - b.port);
}

function generateSecurityEvents(
  failed: SshLoginEntry[],
  fail2ban: Fail2banStatus
): Array<{ type: string; message: string; severity: string; source: string }> {
  const events: Array<{
    type: string;
    message: string;
    severity: string;
    source: string;
  }> = [];

  // Alert on high number of failed SSH logins
  if (failed.length >= 10) {
    const uniqueIps = new Set(failed.map((f) => f.from_ip)).size;
    events.push({
      type: "ssh_brute_force",
      message: `${failed.length} SSH login failures in the last hour from ${uniqueIps} unique IP(s)`,
      severity: failed.length >= 50 ? "critical" : "warning",
      source: "security-collector",
    });
  }

  // Alert on newly banned IPs
  if (fail2ban.banned_ips.length > 0) {
    events.push({
      type: "fail2ban_ban",
      message: `fail2ban has banned ${fail2ban.banned_ips.length} IP(s): ${fail2ban.banned_ips.slice(0, 5).join(", ")}${fail2ban.banned_ips.length > 5 ? "..." : ""}`,
      severity: "warning",
      source: "security-collector",
    });
  }

  return events;
}

export async function collectSecurity(): Promise<SecurityData> {
  // Collect SSH logs
  const sshLogOutput = await runCommand(
    `journalctl -u ssh -u sshd --since "1 hour ago" --no-pager -o short-iso 2>/dev/null || ` +
      `journalctl _SYSTEMD_UNIT=ssh.service --since "1 hour ago" --no-pager -o short-iso 2>/dev/null`
  );

  const { success: ssh_success_logins, failed: ssh_failed_logins } =
    parseSshLogs(sshLogOutput);

  // Collect fail2ban status
  const fail2ban_status = await collectFail2ban();

  // Collect UFW rules
  const ufw_rules = await collectUfwRules();

  // Collect listening ports
  const listening_ports = await collectListeningPorts();

  // Generate events
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
