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
  GATEWAY_SECRET: string | undefined;
  AGENT_HEALTH_PORT: number;
  AGENT_HEALTH_HOST: string;
  HOST_TELEMETRY_INTERVAL_MS: number;
  DOCKER_SOCKET_PATH: string;
}

/** Minimum length for the privileged gateway secret. */
const MIN_SECRET_LEN = 32;

export const config: Config = {
  // Machine-to-machine bearer the frontend sends to the agent. Defaults to the
  // login secret for backward-compat; set AGENT_GATEWAY_SECRET (shared root
  // .env.local, so both processes see it) to stop the human login password from
  // doubling as the gateway credential.
  GATEWAY_SECRET: process.env["AGENT_GATEWAY_SECRET"] ?? process.env["CONTROL_ROOM_SECRET"],
  AGENT_HEALTH_PORT: getEnvNum("AGENT_HEALTH_PORT", 4001),
  // Loopback by default: the frontend reaches the agent over 127.0.0.1, so the
  // privileged host-control API must not be exposed on every interface. Set to
  // 0.0.0.0 only for a genuine cross-host deployment (and use a real authn layer).
  AGENT_HEALTH_HOST: getEnv("AGENT_HEALTH_HOST", "127.0.0.1"),
  HOST_TELEMETRY_INTERVAL_MS: getEnvNum("HOST_TELEMETRY_INTERVAL_MS", 15000),
  DOCKER_SOCKET_PATH: getEnv("DOCKER_SOCKET_PATH", "/var/run/docker.sock"),
};

/**
 * Fail-closed boot guard. A missing or short secret would silently weaken (or,
 * for an empty signing key, fully break) auth on the privileged host-control
 * gateway — so refuse to start instead of running open. Called from index.ts.
 */
export function assertConfigSecrets(): void {
  const checks: Array<[string, string | undefined]> = [
    ["AGENT_GATEWAY_SECRET / CONTROL_ROOM_SECRET", config.GATEWAY_SECRET],
  ];
  const bad = checks.filter(([, v]) => !v || v.length < MIN_SECRET_LEN);
  if (bad.length > 0) {
    const names = bad.map(([n]) => n).join(", ");
    throw new Error(
      `Refusing to start: auth secret(s) missing or shorter than ${MIN_SECRET_LEN} chars: ${names}. ` +
        `Generate with: openssl rand -hex 32`,
    );
  }
}
