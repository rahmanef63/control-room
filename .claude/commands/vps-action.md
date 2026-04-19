# VPS Control Room — Action Pipeline Pattern

Gunakan skill ini saat menambahkan action baru ke pipeline executor.

## Menambah Action Baru — 4 Langkah

### 1. Daftarkan di Allowlist

```typescript
// agent/src/executor/allowlist.ts

export interface ActionDefinition {
  command_template: string;      // {target_id} dan {payload.*} akan di-replace
  target_type: "container" | "service" | "agent" | "dokploy-app" | "fail2ban";
  sensitive: boolean;            // true = butuh confirm dialog di frontend
  timeout_ms: number;
  validate_payload?: (payload: any) => boolean;
}

export const ALLOWLIST: Record<string, ActionDefinition> = {
  "container.restart": {
    command_template: "docker container restart {target_id}",
    target_type: "container",
    sensitive: false,
    timeout_ms: 30000,
  },
  "container.stop": {
    command_template: "docker container stop {target_id}",
    target_type: "container",
    sensitive: true,     // <-- sensitive, butuh konfirmasi
    timeout_ms: 30000,
  },
  "container.logs": {
    command_template: "docker logs --tail {payload.lines} {target_id}",
    target_type: "container",
    sensitive: false,
    timeout_ms: 10000,
    validate_payload: (p) => typeof p?.lines === "number" && p.lines > 0 && p.lines <= 500,
  },
  "service.restart": {
    command_template: "sudo systemctl restart {target_id}",
    target_type: "service",
    sensitive: true,
    timeout_ms: 30000,
  },
  "fail2ban.unban": {
    command_template: "sudo fail2ban-client set sshd unbanip {target_id}",
    target_type: "fail2ban",
    sensitive: true,
    timeout_ms: 10000,
    validate_payload: (p) => true, // target_id divalidasi sebagai IP di validator
  },
  // Dokploy redeploy = HTTP call, bukan shell command
  "dokploy.redeploy": {
    command_template: "__HTTP__", // marker bahwa ini bukan shell command
    target_type: "dokploy-app",
    sensitive: true,
    timeout_ms: 60000,
  },
};
```

### 2. Tambah Validator

```typescript
// agent/src/executor/validators.ts

import { ALLOWLIST } from "./allowlist";

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// knownTargets di-maintain dari collector results
export function validateCommand(
  action: string,
  targetType: string,
  targetId: string,
  payload: any,
  knownTargets: Map<string, Set<string>> // target_type → Set<target_id>
): ValidationResult {
  // 1. Action ada di allowlist?
  const def = ALLOWLIST[action];
  if (!def) return { valid: false, reason: `unknown action: ${action}` };

  // 2. Target type cocok?
  if (def.target_type !== targetType) {
    return { valid: false, reason: `action ${action} expects target_type ${def.target_type}, got ${targetType}` };
  }

  // 3. Target ID dikenali? (dari collector)
  const targets = knownTargets.get(targetType);
  if (!targets?.has(targetId)) {
    return { valid: false, reason: `unknown target: ${targetType}/${targetId}` };
  }

  // 4. Validasi IP format untuk fail2ban
  if (targetType === "fail2ban") {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(targetId)) {
      return { valid: false, reason: `invalid IP format: ${targetId}` };
    }
  }

  // 5. Payload valid?
  if (def.validate_payload && !def.validate_payload(payload)) {
    return { valid: false, reason: `invalid payload for action ${action}` };
  }

  return { valid: true };
}
```

### 3. Handle di Executor

```typescript
// agent/src/executor/index.ts — di dalam loop eksekusi

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function executeCommand(action: string, targetId: string, payload: any): Promise<{ success: boolean; result?: string; error?: string }> {
  const def = ALLOWLIST[action];
  if (!def) return { success: false, error: "not in allowlist" };

  // Special case: HTTP-based actions
  if (def.command_template === "__HTTP__") {
    return await executeHttpAction(action, targetId, payload);
  }

  // Build command dari template
  let cmd = def.command_template.replace("{target_id}", targetId);
  // Replace payload placeholders
  cmd = cmd.replace(/\{payload\.(\w+)\}/g, (_, key) => String(payload?.[key] ?? ""));

  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: def.timeout_ms });
    return { success: true, result: stdout.slice(0, 10000) }; // cap output
  } catch (err: any) {
    return { success: false, error: err.message?.slice(0, 2000) };
  }
}
```

### 4. Tambah di Frontend

```tsx
// Di page yang relevan, tambah button yang trigger action

import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";

function ActionButton({ action, targetType, targetId, sensitive }: Props) {
  const enqueue = useMutation(api.commands.enqueueCommand);
  const [showConfirm, setShowConfirm] = useState(false);

  async function execute() {
    await enqueue({
      action,
      target_type: targetType,
      target_id: targetId,
      payload: {},
      requested_by: "manual-dashboard",
    });
  }

  if (sensitive) {
    return (
      <>
        <Button variant="destructive" onClick={() => setShowConfirm(true)}>
          {action}
        </Button>
        <ConfirmActionDialog
          open={showConfirm}
          action={action}
          target={targetId}
          onConfirm={() => { execute(); setShowConfirm(false); }}
          onCancel={() => setShowConfirm(false)}
        />
      </>
    );
  }

  return <Button onClick={execute}>{action}</Button>;
}
```

## Checklist Tambah Action Baru

1. [ ] Tambah entry di `ALLOWLIST` dengan command_template, target_type, sensitive, timeout
2. [ ] Tambah validasi khusus di `validators.ts` jika perlu (e.g. IP format)
3. [ ] Jika HTTP-based, tambah handler di `executeHttpAction`
4. [ ] Jika butuh sudo, pastikan entry di `/etc/sudoers.d/vps-control-room`
5. [ ] Tambah button/trigger di frontend page yang relevan
6. [ ] Jika sensitive, wrap dengan `ConfirmActionDialog`
7. [ ] Test: trigger action → cek command status → cek audit log
