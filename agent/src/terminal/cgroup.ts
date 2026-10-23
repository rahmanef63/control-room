// Per-pane cgroup isolation.
//
// WHY: node-pty spawns every pane as a CHILD of this service, so without this
// module all panes share the agent's single cgroup. One runaway pane therefore
// pushes the WHOLE cgroup past MemoryHigh and the kernel throttles every other
// pane — and the agent itself — into memcg reclaim. That is not theoretical:
// on 2026-08-18 a single 13.5 GB `ugrep` (86% of the 14G MemoryHigh) froze 9
// unrelated tasks at memory.pressure full=90 for ~an hour while the culprit
// itself burned only 0.08 core. loadavg read 17; real CPU use was ~0.1.
//
// Putting each pane in its own child cgroup converts that collective punishment
// into a local one: the runaway hits ITS OWN ceiling and gets OOM-killed inside
// its own pane, and every other pane keeps typing.
//
// Bonus: `cgroup.kill` closes the escape hatch that killSessionTree() documents
// but cannot fix — a child that double-forks + setsid() leaves the process group
// and survives a group kill, but it CANNOT leave the cgroup.
//
// Requires `Delegate=memory pids` on the unit (see scripts/install-systemd.sh).
// Degrades silently to a no-op when delegation is unavailable (dev laptop,
// cgroup v1, container without delegation) — panes still work, just unisolated.

import fs from "fs";
import path from "path";

import { logger } from "../logger.js";

const CGROUP_MOUNT = "/sys/fs/cgroup";
// The agent itself is moved here so the parent can carry controllers. cgroup v2
// forbids a cgroup from holding BOTH processes and controller-enabled children
// ("no internal processes" rule), so the supervisor subdir is mandatory, not
// cosmetic.
const SUPERVISOR_DIR = "supervisor";
const PANE_PREFIX = "pane-";

// Sizing for a 31 GiB / 8 vCPU box where the agent cgroup is capped at 14G/18G.
// A pane running Claude Code costs ~0.5-1 GB; a `next build` peaks around 4 GB.
// max=8G is the hard stop: it would have killed the 13.5 GB ugrep well before it
// could starve its neighbours. swap is kept tight for the same reason the unit
// does it — swap-bombs stall the host far worse than an OOM kill does.
//
// memory.high is deliberately DISABLED by default. Measured here on 2026-08-18
// with high=6G: a runaway parked at 6.16 GB and never died, sitting in permanent
// reclaim thrash that pushed HOST memory.pressure to 47% — the same failure the
// unit file's 2026-05-28 note describes, merely contained to one pane. Throttling
// only helps when the pressure is reclaimable page cache; a runaway's memory is
// anon, so reclaim spins with nothing to free. Going straight to memory.max means
// the runaway is OOM-killed in its own pane in seconds instead of degrading the
// box for as long as it runs. Set PANE_MEMORY_HIGH to re-enable soft throttling.
const PANE_MEMORY_HIGH = process.env.PANE_MEMORY_HIGH ?? "max";
const PANE_MEMORY_MAX = process.env.PANE_MEMORY_MAX ?? "8G";
const PANE_MEMORY_SWAP_MAX = process.env.PANE_MEMORY_SWAP_MAX ?? "256M";
const PANE_PIDS_MAX = process.env.PANE_PIDS_MAX ?? "4096";

let delegatedRoot: string | null = null;
let initialised = false;

function readSelfCgroup(): string | null {
  try {
    const raw = fs.readFileSync("/proc/self/cgroup", "utf8");
    for (const line of raw.split("\n")) {
      // cgroup v2 always exposes exactly one line: "0::<path>"
      if (line.startsWith("0::")) return line.slice(3).trim();
    }
  } catch {
    /* not Linux, or /proc unavailable */
  }
  return null;
}

function write(file: string, value: string): void {
  fs.writeFileSync(file, value);
}

/**
 * Detect the delegated cgroup, move the agent into a `supervisor/` child, and
 * enable the memory + pids controllers for pane children.
 *
 * Idempotent and non-throwing: any failure disables per-pane isolation and
 * leaves the pre-existing (shared-cgroup) behaviour untouched.
 */
export function initPaneCgroups(): boolean {
  if (initialised) return delegatedRoot !== null;
  initialised = true;

  const rel = readSelfCgroup();
  if (!rel) return false;

  const root = path.join(CGROUP_MOUNT, rel);
  try {
    // Delegation makes the directory writable by the service user. Without it
    // the mkdir below fails with EACCES, which is exactly the signal we want.
    fs.accessSync(path.join(root, "cgroup.procs"), fs.constants.W_OK);
  } catch {
    logger.info("Per-pane cgroups disabled: cgroup not delegated", {
      source: "terminal",
      cgroup: rel,
    });
    return false;
  }

  try {
    const supervisor = path.join(root, SUPERVISOR_DIR);
    fs.mkdirSync(supervisor, { recursive: true });

    // subtree_control refuses (EBUSY) while ANY process remains in the parent,
    // so drain every pid first — normally just this process, but a restart that
    // raced a pane teardown can leave stragglers.
    const stuck = fs
      .readFileSync(path.join(root, "cgroup.procs"), "utf8")
      .split("\n")
      .filter(Boolean);
    for (const pid of stuck) {
      try {
        write(path.join(supervisor, "cgroup.procs"), pid);
      } catch {
        // A pid that exited between read and write is fine; anything else will
        // surface as the EBUSY below, which we handle as "no isolation".
      }
    }

    const enabled = fs.readFileSync(path.join(root, "cgroup.subtree_control"), "utf8");
    const missing = ["memory", "pids"].filter((c) => !enabled.includes(c));
    if (missing.length > 0) {
      write(path.join(root, "cgroup.subtree_control"), missing.map((c) => `+${c}`).join(" "));
    }

    delegatedRoot = root;
    logger.info("Per-pane cgroups enabled", {
      source: "terminal",
      cgroup: rel,
      memoryHigh: PANE_MEMORY_HIGH,
      memoryMax: PANE_MEMORY_MAX,
    });
    return true;
  } catch (err) {
    logger.warn("Per-pane cgroups unavailable, panes share the agent cgroup", {
      source: "terminal",
      error: String(err),
    });
    delegatedRoot = null;
    return false;
  }
}

function paneDir(sessionId: string): string | null {
  if (!delegatedRoot) return null;
  // Session ids are randomUUID(), but never trust an id straight into a path.
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(sessionId)) return null;
  return path.join(delegatedRoot, `${PANE_PREFIX}${sessionId}`);
}

/**
 * Place a freshly spawned pty into its own memory-capped cgroup. Children the
 * shell forks later inherit it automatically.
 */
export function attachPaneToCgroup(sessionId: string, pid: number): void {
  const dir = paneDir(sessionId);
  if (!dir) return;
  try {
    fs.mkdirSync(dir, { recursive: true });
    // Limits must land BEFORE the pid: a process moved in first could allocate
    // past the ceiling in the window before it is applied.
    write(path.join(dir, "memory.high"), PANE_MEMORY_HIGH);
    write(path.join(dir, "memory.max"), PANE_MEMORY_MAX);
    write(path.join(dir, "memory.swap.max"), PANE_MEMORY_SWAP_MAX);
    write(path.join(dir, "pids.max"), PANE_PIDS_MAX);
    write(path.join(dir, "cgroup.procs"), String(pid));
  } catch (err) {
    // Never let isolation failure block opening a terminal — a pane without a
    // cap is strictly better than no pane.
    logger.warn("Could not isolate pane in its own cgroup", {
      source: "terminal",
      sessionId,
      pid,
      error: String(err),
    });
  }
}

/**
 * Kill every process in the pane's cgroup, including children that escaped the
 * process group via double-fork + setsid(). Returns false when isolation is off,
 * so the caller knows it must still fall back to the process-group kill.
 */
export function killPaneCgroup(sessionId: string): boolean {
  const dir = paneDir(sessionId);
  if (!dir || !fs.existsSync(dir)) return false;
  try {
    write(path.join(dir, "cgroup.kill"), "1");
    return true;
  } catch (err) {
    logger.warn("cgroup.kill failed for pane", {
      source: "terminal",
      sessionId,
      error: String(err),
    });
    return false;
  }
}

/** Remove the pane's cgroup directory once empty. Safe to call repeatedly. */
export function removePaneCgroup(sessionId: string): void {
  const dir = paneDir(sessionId);
  if (!dir) return;
  try {
    // rmdir fails with EBUSY while any task remains, which is the correct
    // outcome: a leftover directory is a visible signal that a kill did not
    // take, and the next teardown retries it.
    fs.rmdirSync(dir);
  } catch {
    /* still populated, or already gone */
  }
}

/**
 * Drop pane cgroups left behind by a previous agent process. Called at startup
 * so a crash-restart does not accumulate empty directories forever.
 */
export function reapStalePaneCgroups(): void {
  if (!delegatedRoot) return;
  try {
    for (const entry of fs.readdirSync(delegatedRoot)) {
      if (!entry.startsWith(PANE_PREFIX)) continue;
      try {
        fs.rmdirSync(path.join(delegatedRoot, entry));
      } catch {
        /* still has tasks — a pane that outlived the agent; leave it alone */
      }
    }
  } catch {
    /* directory vanished */
  }
}
