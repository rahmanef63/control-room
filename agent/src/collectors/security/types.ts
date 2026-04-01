export interface SshLoginEntry {
  timestamp: string;
  user: string;
  from_ip: string;
}

export interface Fail2banStatus {
  active: boolean;
  jails: string[];
  banned_ips: string[];
}

export interface ListeningPort {
  port: number;
  protocol: string;
  process: string;
}

export interface SecurityEvent {
  type: string;
  message: string;
  severity: string;
  source: string;
}

export interface SecurityData {
  ssh_success_logins: SshLoginEntry[];
  ssh_failed_logins: SshLoginEntry[];
  fail2ban_status: Fail2banStatus;
  ufw_rules: string[];
  listening_ports: ListeningPort[];
  events_to_emit: SecurityEvent[];
}

export interface ParsedSshLogs {
  success: SshLoginEntry[];
  failed: SshLoginEntry[];
}
