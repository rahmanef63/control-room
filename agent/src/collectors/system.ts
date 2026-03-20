import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SystemSnapshot {
  timestamp: number;
  cpu_total: number;
  cpu_cores: number[];
  ram_total: number;
  ram_used: number;
  ram_available: number;
  disk: Array<{ mount: string; total: number; used: number; available: number }>;
  network: { rx_bytes: number; tx_bytes: number; rx_rate: number; tx_rate: number };
  uptime_seconds: number;
  load_average: number[];
}

interface CpuTimes {
  user: number;
  nice: number;
  system: number;
  idle: number;
  iowait: number;
  irq: number;
  softirq: number;
  steal: number;
}

interface NetworkSample {
  rx_bytes: number;
  tx_bytes: number;
  timestamp: number;
}

// State for delta calculations
let prevCpuTotal: CpuTimes | null = null;
let prevCpuCores: CpuTimes[] = [];
let prevNetwork: NetworkSample | null = null;

function parseCpuLine(line: string): CpuTimes {
  const parts = line.trim().split(/\s+/);
  // parts[0] is "cpu" or "cpu0" etc.
  return {
    user: parseInt(parts[1] ?? "0", 10),
    nice: parseInt(parts[2] ?? "0", 10),
    system: parseInt(parts[3] ?? "0", 10),
    idle: parseInt(parts[4] ?? "0", 10),
    iowait: parseInt(parts[5] ?? "0", 10),
    irq: parseInt(parts[6] ?? "0", 10),
    softirq: parseInt(parts[7] ?? "0", 10),
    steal: parseInt(parts[8] ?? "0", 10),
  };
}

function calcCpuPercent(prev: CpuTimes, curr: CpuTimes): number {
  const prevIdle = prev.idle + prev.iowait;
  const currIdle = curr.idle + curr.iowait;
  const prevTotal =
    prev.user + prev.nice + prev.system + prev.idle + prev.iowait +
    prev.irq + prev.softirq + prev.steal;
  const currTotal =
    curr.user + curr.nice + curr.system + curr.idle + curr.iowait +
    curr.irq + curr.softirq + curr.steal;
  const diffIdle = currIdle - prevIdle;
  const diffTotal = currTotal - prevTotal;
  if (diffTotal === 0) return 0;
  return Math.round(((diffTotal - diffIdle) / diffTotal) * 1000) / 10;
}

async function readCpu(): Promise<{ total: number; cores: number[] }> {
  const content = await fs.readFile("/proc/stat", "utf8");
  const lines = content.split("\n").filter((l) => l.startsWith("cpu"));

  const totalLine = lines.find((l) => /^cpu\s/.test(l));
  const coreLines = lines.filter((l) => /^cpu\d/.test(l));

  if (!totalLine) return { total: 0, cores: [] };

  const currTotal = parseCpuLine(totalLine);
  const currCores = coreLines.map((l) => parseCpuLine(l));

  let total = 0;
  let cores: number[] = currCores.map(() => 0);

  if (prevCpuTotal !== null) {
    total = calcCpuPercent(prevCpuTotal, currTotal);
    cores = currCores.map((curr, i) => {
      const prev = prevCpuCores[i];
      if (!prev) return 0;
      return calcCpuPercent(prev, curr);
    });
  }

  prevCpuTotal = currTotal;
  prevCpuCores = currCores;

  return { total, cores };
}

async function readMeminfo(): Promise<{
  total: number;
  used: number;
  available: number;
}> {
  const content = await fs.readFile("/proc/meminfo", "utf8");
  const lines = content.split("\n");

  function getValue(key: string): number {
    const line = lines.find((l) => l.startsWith(key + ":"));
    if (!line) return 0;
    const parts = line.trim().split(/\s+/);
    return parseInt(parts[1] ?? "0", 10) * 1024; // kB to bytes
  }

  const total = getValue("MemTotal");
  const available = getValue("MemAvailable");
  const used = total - available;

  return { total, used, available };
}

async function readUptime(): Promise<number> {
  const content = await fs.readFile("/proc/uptime", "utf8");
  const parts = content.trim().split(/\s+/);
  return parseFloat(parts[0] ?? "0");
}

async function readLoadAvg(): Promise<number[]> {
  const content = await fs.readFile("/proc/loadavg", "utf8");
  const parts = content.trim().split(/\s+/);
  return [
    parseFloat(parts[0] ?? "0"),
    parseFloat(parts[1] ?? "0"),
    parseFloat(parts[2] ?? "0"),
  ];
}

async function readNetwork(): Promise<{
  rx_bytes: number;
  tx_bytes: number;
  rx_rate: number;
  tx_rate: number;
}> {
  const content = await fs.readFile("/proc/net/dev", "utf8");
  const lines = content.split("\n").slice(2); // skip header lines

  let totalRx = 0;
  let totalTx = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const iface = trimmed.substring(0, colonIdx).trim();
    // Skip loopback
    if (iface === "lo") continue;
    const parts = trimmed.substring(colonIdx + 1).trim().split(/\s+/);
    const rx = parseInt(parts[0] ?? "0", 10);
    const tx = parseInt(parts[8] ?? "0", 10);
    totalRx += rx;
    totalTx += tx;
  }

  const now = Date.now();
  let rx_rate = 0;
  let tx_rate = 0;

  if (prevNetwork !== null) {
    const elapsedSec = (now - prevNetwork.timestamp) / 1000;
    if (elapsedSec > 0) {
      rx_rate = Math.max(0, (totalRx - prevNetwork.rx_bytes) / elapsedSec);
      tx_rate = Math.max(0, (totalTx - prevNetwork.tx_bytes) / elapsedSec);
    }
  }

  prevNetwork = { rx_bytes: totalRx, tx_bytes: totalTx, timestamp: now };

  return { rx_bytes: totalRx, tx_bytes: totalTx, rx_rate, tx_rate };
}

const IMPORTANT_MOUNTS = new Set(["/", "/home", "/var", "/tmp"]);

async function readDisk(): Promise<
  Array<{ mount: string; total: number; used: number; available: number }>
> {
  try {
    const { stdout } = await execAsync(
      "df -B1 --output=target,size,used,avail 2>/dev/null"
    );
    const lines = stdout.split("\n").slice(1); // skip header
    const result: Array<{
      mount: string;
      total: number;
      used: number;
      available: number;
    }> = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const mount = parts[0] ?? "";
      const total = parseInt(parts[1] ?? "0", 10);
      const used = parseInt(parts[2] ?? "0", 10);
      const available = parseInt(parts[3] ?? "0", 10);

      if (!mount || mount === "Filesystem") continue;
      // Include important mounts or any real filesystem (not tmpfs-like that is too small)
      if (IMPORTANT_MOUNTS.has(mount) || (!mount.startsWith("/sys") && !mount.startsWith("/proc") && !mount.startsWith("/dev/pts") && total > 1024 * 1024 * 100)) {
        result.push({ mount, total, used, available });
      }
    }

    return result;
  } catch {
    return [];
  }
}

export async function collectSystem(): Promise<SystemSnapshot> {
  const [cpu, mem, uptime, loadAvg, network, disk] = await Promise.all([
    readCpu(),
    readMeminfo(),
    readUptime(),
    readLoadAvg(),
    readNetwork(),
    readDisk(),
  ]);

  return {
    timestamp: Date.now(),
    cpu_total: cpu.total,
    cpu_cores: cpu.cores,
    ram_total: mem.total,
    ram_used: mem.used,
    ram_available: mem.available,
    disk,
    network,
    uptime_seconds: uptime,
    load_average: loadAvg,
  };
}
