export interface ActionDefinition {
  command_template: string;
  target_type: "container" | "service" | "agent" | "dokploy-app" | "fail2ban";
  sensitive: boolean;
  timeout_ms: number;
}

export const ALLOWLIST: Map<string, ActionDefinition> = new Map([
  [
    "container.restart",
    {
      command_template: "docker container restart {target_id}",
      target_type: "container",
      sensitive: false,
      timeout_ms: 30000,
    },
  ],
  [
    "container.stop",
    {
      command_template: "docker container stop {target_id}",
      target_type: "container",
      sensitive: true,
      timeout_ms: 30000,
    },
  ],
  [
    "container.logs",
    {
      command_template: "docker logs --tail {lines} {target_id}",
      target_type: "container",
      sensitive: false,
      timeout_ms: 10000,
    },
  ],
  [
    "service.restart",
    {
      command_template: "sudo systemctl restart {target_id}",
      target_type: "service",
      sensitive: true,
      timeout_ms: 30000,
    },
  ],
  [
    "fail2ban.unban",
    {
      command_template: "sudo fail2ban-client set sshd unbanip {target_id}",
      target_type: "fail2ban",
      sensitive: true,
      timeout_ms: 15000,
    },
  ],
]);

/**
 * Map from target_type to a set of known valid target IDs.
 * Populated by updateKnownTargets() when collectors return data.
 */
export const knownTargets: Map<string, Set<string>> = new Map([
  ["container", new Set<string>()],
  ["service", new Set<string>()],
  ["agent", new Set<string>()],
  ["dokploy-app", new Set<string>()],
  ["fail2ban", new Set<string>()],
]);

/**
 * Update the known targets for a given type.
 * Called by collectors as they discover containers, agents, etc.
 */
export function updateKnownTargets(type: string, targets: string[]): void {
  const existing = knownTargets.get(type);
  if (existing) {
    existing.clear();
    for (const t of targets) {
      existing.add(t);
    }
  } else {
    knownTargets.set(type, new Set(targets));
  }
}

/**
 * Build a shell command string from an action name, target_id, and optional payload.
 * Returns null if the action is not found in the allowlist.
 */
export function buildCommand(
  action: string,
  target_id: string,
  payload?: Record<string, unknown>
): string | null {
  const actionDef = ALLOWLIST.get(action);
  if (!actionDef) return null;

  let cmd = actionDef.command_template;

  // Substitute {target_id}
  cmd = cmd.replace(/\{target_id\}/g, target_id);

  // Substitute any additional payload fields like {lines}
  if (payload) {
    for (const [key, value] of Object.entries(payload)) {
      cmd = cmd.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    }
  }

  return cmd;
}
