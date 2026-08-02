export const APP_SOURCE_VALUES = ["dokploy", "docker", "systemd"];
export const APP_RUNTIME_STATUS_VALUES = [
  "running",
  "stopped",
  "restarting",
  "error",
  "unknown",
];
export const APP_HEALTH_STATUS_VALUES = [
  "healthy",
  "unhealthy",
  "none",
  "unknown",
];

export const AGENT_STATUS_VALUES = ["running", "stopped", "unknown"];
export const AGENT_DETECTION_SOURCE_VALUES = [
  "process",
  "container",
  "systemd",
  "pidfile",
];

export const ALERT_SEVERITY_VALUES = ["warning", "error", "critical"];
export const ALERT_STATUS_VALUES = ["active", "resolved", "acknowledged"];

export const EVENT_SEVERITY_VALUES = ["info", "warning", "error", "critical"];

export const AUDIT_RESULT_VALUES = ["success", "failed", "cancelled"];
export const AUDIT_SEVERITY_VALUES = ["info", "warning", "critical"];
export const AUDIT_TRIGGER_VALUES = [
  "manual-dashboard",
  "manual-cli",
  "manual-tui",
  "system-agent",
  "scheduled-check",
];

export const COMMAND_TARGET_TYPE_VALUES = [
  "container",
  "service",
  "agent",
  "dokploy-app",
  "fail2ban",
];
export const COMMAND_STATUS_VALUES = [
  "queued",
  "running",
  "success",
  "failed",
  "cancelled",
  "timeout",
];

export const TERMINAL_PROFILE_VALUES = [
  "shell",
  "codex",
  "claude",
  "gemini",
  "openclaw",
];

export const ALFA_DEFAULT_PROMPT =
  "please continue as ur recommended, ultrathink";

export const ALFA_PATROL_SENIOR_FULLSTACK_PROMPT = [
  "[PATROL-MODE: SENIOR-FULLSTACK]",
  "Read the target pane's recent buffer. Infer project context (Convex,",
  "Next.js App Router, Clerk migration, design system, deploy pipeline,",
  "etc.). Pick the next concrete step a senior fullstack engineer would",
  "take. Invoke any relevant skill (/audit-bp, /rr-prep, /rr-send,",
  "/sc-git, /sc-convex, /sc-dokploy, /verify, ...) when it actually helps.",
  "Continue autonomously, ultrathink.",
].join(" ");

export const ALFA_PATROL_MODES = Object.freeze([
  "static",
  "patrol-senior-fullstack",
]);
