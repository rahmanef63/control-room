function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

function getEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function getEnvNum(name: string, defaultValue: number): number {
  const val = process.env[name];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${val}`);
  }
  return parsed;
}

export interface Config {
  CONTROL_ROOM_SECRET: string | undefined;
  CONTROL_ROOM_SESSION_SECRET: string | undefined;
  CONVEX_URL: string;
  CONVEX_ADMIN_KEY: string;
  AGENT_HEALTH_PORT: number;
  AGENT_COMMAND_POLL_INTERVAL_MS: number;
  AGENT_COMMAND_TIMEOUT_MS: number;
  AGENT_MAX_CONCURRENT_COMMANDS: number;
  SYSTEM_POLL_INTERVAL_MS: number;
  SECURITY_POLL_INTERVAL_MS: number;
  DOCKER_POLL_INTERVAL_MS: number;
  AGENT_POLL_INTERVAL_MS: number;
  DOCKER_SOCKET_PATH: string;
  DOKPLOY_URL: string | undefined;
  DOKPLOY_API_KEY: string | undefined;
  ALERT_CPU_WARNING_PERCENT: number;
  ALERT_CPU_CRITICAL_PERCENT: number;
  ALERT_RAM_WARNING_PERCENT: number;
  ALERT_RAM_CRITICAL_PERCENT: number;
  ALERT_DISK_WARNING_PERCENT: number;
  ALERT_DISK_CRITICAL_PERCENT: number;
}

export const config: Config = {
  CONTROL_ROOM_SECRET: process.env["CONTROL_ROOM_SECRET"],
  CONTROL_ROOM_SESSION_SECRET: process.env["CONTROL_ROOM_SESSION_SECRET"],
  CONVEX_URL: requireEnv("CONVEX_URL"),
  CONVEX_ADMIN_KEY: requireEnv("CONVEX_ADMIN_KEY"),
  AGENT_HEALTH_PORT: getEnvNum("AGENT_HEALTH_PORT", 4001),
  AGENT_COMMAND_POLL_INTERVAL_MS: getEnvNum("AGENT_COMMAND_POLL_INTERVAL_MS", 2000),
  AGENT_COMMAND_TIMEOUT_MS: getEnvNum("AGENT_COMMAND_TIMEOUT_MS", 30000),
  AGENT_MAX_CONCURRENT_COMMANDS: getEnvNum("AGENT_MAX_CONCURRENT_COMMANDS", 3),
  SYSTEM_POLL_INTERVAL_MS: getEnvNum("SYSTEM_POLL_INTERVAL_MS", 5000),
  SECURITY_POLL_INTERVAL_MS: getEnvNum("SECURITY_POLL_INTERVAL_MS", 10000),
  DOCKER_POLL_INTERVAL_MS: getEnvNum("DOCKER_POLL_INTERVAL_MS", 5000),
  AGENT_POLL_INTERVAL_MS: getEnvNum("AGENT_POLL_INTERVAL_MS", 5000),
  DOCKER_SOCKET_PATH: getEnv("DOCKER_SOCKET_PATH", "/var/run/docker.sock"),
  DOKPLOY_URL: process.env["DOKPLOY_URL"],
  DOKPLOY_API_KEY: process.env["DOKPLOY_API_KEY"],
  ALERT_CPU_WARNING_PERCENT: getEnvNum("ALERT_CPU_WARNING_PERCENT", 80),
  ALERT_CPU_CRITICAL_PERCENT: getEnvNum("ALERT_CPU_CRITICAL_PERCENT", 95),
  ALERT_RAM_WARNING_PERCENT: getEnvNum("ALERT_RAM_WARNING_PERCENT", 85),
  ALERT_RAM_CRITICAL_PERCENT: getEnvNum("ALERT_RAM_CRITICAL_PERCENT", 95),
  ALERT_DISK_WARNING_PERCENT: getEnvNum("ALERT_DISK_WARNING_PERCENT", 80),
  ALERT_DISK_CRITICAL_PERCENT: getEnvNum("ALERT_DISK_CRITICAL_PERCENT", 90),
};
