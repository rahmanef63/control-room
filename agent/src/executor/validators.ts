import { ALLOWLIST, knownTargets } from "./allowlist.js";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Validate that a string contains only safe characters for shell interpolation.
// This is a belt-and-suspenders check; the allowlist is the primary safety net.
function isSafeTargetId(targetId: string): boolean {
  // Allow alphanumerics, dots, dashes, underscores, slashes (for IPs), colons (for IPv6)
  return /^[a-zA-Z0-9._\-/:]+$/.test(targetId);
}

export function validateCommand(
  action: string,
  target_type: string,
  target_id: string,
  payload?: Record<string, unknown>
): ValidationResult {
  // 1. Check action exists in ALLOWLIST
  const actionDef = ALLOWLIST.get(action);
  if (!actionDef) {
    return {
      valid: false,
      reason: `Action "${action}" is not in the allowlist`,
    };
  }

  // 2. Check target_type matches what the action expects
  if (actionDef.target_type !== target_type) {
    return {
      valid: false,
      reason: `Action "${action}" expects target_type "${actionDef.target_type}", got "${target_type}"`,
    };
  }

  // 3. Sanitize target_id
  if (!target_id || target_id.trim().length === 0) {
    return {
      valid: false,
      reason: "target_id must not be empty",
    };
  }

  if (!isSafeTargetId(target_id)) {
    return {
      valid: false,
      reason: `target_id "${target_id}" contains invalid characters`,
    };
  }

  // 4. Check target_id is in the known targets for that type
  const knownSet = knownTargets.get(target_type);
  if (!knownSet || !knownSet.has(target_id)) {
    return {
      valid: false,
      reason: `target_id "${target_id}" is not a known target of type "${target_type}"`,
    };
  }

  // 5. Action-specific payload validation
  if (action === "container.logs") {
    if (!payload || payload["lines"] === undefined) {
      return {
        valid: false,
        reason: 'container.logs requires payload.lines to be set',
      };
    }
    const lines = payload["lines"];
    const linesNum = Number(lines);
    if (!Number.isFinite(linesNum) || linesNum < 1 || linesNum > 10000) {
      return {
        valid: false,
        reason: `container.logs payload.lines must be a number between 1 and 10000, got: ${String(lines)}`,
      };
    }
  }

  return { valid: true };
}
