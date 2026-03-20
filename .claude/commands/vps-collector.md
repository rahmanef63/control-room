# VPS Control Room — Host Collector Pattern

Gunakan skill ini saat membuat atau memodifikasi collector di `agent/src/collectors/`.

## Collector File Template

```typescript
// agent/src/collectors/<name>.ts
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../logger";

const execAsync = promisify(exec);

// Tipe output — sesuaikan dengan Convex schema
export interface CollectorOutput {
  // fields sesuai tabel target di Convex
}

export async function collect<Name>(): Promise<CollectorOutput> {
  try {
    // 1. Baca data dari source
    // 2. Parse output
    // 3. Return structured data

    return {
      // structured result
    };
  } catch (err) {
    logger.error(`collector.<name> failed`, { error: String(err) });
    // Return safe default — jangan throw, biar collector lain tetap jalan
    return {
      // safe defaults
    };
  }
}
```

## Reading /proc Files (System Collector)

```typescript
import { readFile } from "fs/promises";

// CPU dari /proc/stat
const stat = await readFile("/proc/stat", "utf-8");
const lines = stat.split("\n");
const cpuLine = lines[0]; // "cpu  user nice system idle iowait irq softirq steal"
const values = cpuLine.split(/\s+/).slice(1).map(Number);
const idle = values[3] + values[4];
const total = values.reduce((a, b) => a + b, 0);
// Hitung delta dari pembacaan sebelumnya untuk persentase

// RAM dari /proc/meminfo
const meminfo = await readFile("/proc/meminfo", "utf-8");
const memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)![1]) * 1024;
const memAvailable = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)![1]) * 1024;
const memUsed = memTotal - memAvailable;

// Uptime dari /proc/uptime
const uptime = await readFile("/proc/uptime", "utf-8");
const uptimeSeconds = parseFloat(uptime.split(" ")[0]);

// Load average dari /proc/loadavg
const loadavg = await readFile("/proc/loadavg", "utf-8");
const [l1, l5, l15] = loadavg.split(" ").slice(0, 3).map(Number);

// Network dari /proc/net/dev
const netdev = await readFile("/proc/net/dev", "utf-8");
// Parse per interface, skip header 2 lines
```

## Docker Socket HTTP (Docker Collector)

```typescript
import http from "http";

function dockerGet<T>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock", path, method: "GET" },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Docker API parse error: ${data.slice(0, 200)}`)); }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// List all containers
const containers = await dockerGet<DockerContainer[]>("/containers/json?all=true");

// Per container: map name, state, health, ports
for (const c of containers) {
  const name = c.Names[0]?.replace(/^\//, "") || "unknown";
  const status = c.State; // "running" | "exited" | "restarting" | ...
  const health = c.Status?.includes("healthy") ? "healthy"
    : c.Status?.includes("unhealthy") ? "unhealthy" : "none";
  const ports = c.Ports?.map((p: any) => ({
    internal: p.PrivatePort,
    published: p.PublicPort || null,
    protocol: p.Type || "tcp",
  })) || [];
}
```

## Command-Based Collector (Security, Agents)

```typescript
// Untuk command yang butuh parse output text
async function runCommand(cmd: string, timeoutMs = 5000): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: timeoutMs });
    return stdout.trim();
  } catch (err: any) {
    // Command bisa gagal (e.g. fail2ban not installed)
    logger.warn(`command failed: ${cmd}`, { error: err.message });
    return "";
  }
}

// fail2ban status
const f2bOutput = await runCommand("sudo fail2ban-client status sshd");
// Parse: "Currently banned: 3"
const bannedMatch = f2bOutput.match(/Currently banned:\s+(\d+)/);
const bannedCount = bannedMatch ? parseInt(bannedMatch[1]) : 0;

// SSH logins dari journalctl
const sshLogs = await runCommand(
  'journalctl -u ssh.service --since "1 hour ago" --no-pager -o json'
);
// Parse tiap line sebagai JSON object

// Listening ports
const ssOutput = await runCommand("ss -tulpn");
// Parse columns: State, Recv-Q, Send-Q, Local Address:Port, Peer Address:Port, Process

// UFW rules
const ufwOutput = await runCommand("sudo ufw status verbose");
```

## Registering in Scheduler (index.ts)

```typescript
// agent/src/index.ts
import { collectSystem } from "./collectors/system";
import { collectDocker } from "./collectors/docker";
import { config } from "./config";
import { mutate } from "./convex-client";

// State untuk CPU delta
let prevCpuValues: number[] | null = null;

async function runSystemCollector() {
  const snapshot = await collectSystem(prevCpuValues);
  prevCpuValues = snapshot._prevValues; // simpan untuk delta berikutnya
  await mutate("snapshots:upsertSystemSnapshot", snapshot.data);
}

async function runDockerCollector() {
  const apps = await collectDocker();
  for (const app of apps) {
    await mutate("appStatus:upsertAppStatus", app);
  }
}

// Start polling
setInterval(runSystemCollector, config.SYSTEM_POLL_INTERVAL_MS);
setInterval(runDockerCollector, config.DOCKER_POLL_INTERVAL_MS);
```

## Rules

- SELALU wrap collector function dalam try/catch. Return safe default on error.
- JANGAN throw dari collector — error satu collector tidak boleh menghentikan yang lain.
- Gunakan `readFile` untuk /proc (lebih cepat dari exec).
- Gunakan Docker socket HTTP, bukan `docker` CLI (menghindari spawn overhead).
- Simpan state sebelumnya (e.g. CPU values) untuk kalkulasi delta/rate.
- Timeout semua exec command (default 5 detik).
- Security commands yang butuh sudo: pastikan sudoers entry sudah ada (lihat PRD section 16.4).
