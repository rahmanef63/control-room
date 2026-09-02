import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { isUnderRoot, resolveReadable } from "./explorer.js";

// Filesystem MUTATIONS for the Control Room app. WRITES are bounded to home +
// ~/projects (overridable via OS_AGENT_FS_WRITE_ROOTS) — narrower than READ so
// the UI can't accidentally clobber system files; use exec for anything else.
// READS (readFileText, diskUsage) follow the explorer's READ bounds instead.
// Every call is gated upstream by the gateway secret.

function roots(): string[] {
  const env = process.env.OS_AGENT_FS_WRITE_ROOTS;
  if (env && env.trim())
    return env
      .split(":")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => (p === "~" ? os.homedir() : p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p));
  const home = os.homedir();
  return [home, path.join(home, "projects")];
}

async function realRoots(): Promise<string[]> {
  return Promise.all(
    roots().map(async (r) => {
      try {
        return await fs.realpath(r);
      } catch {
        return path.resolve(r);
      }
    })
  );
}

function toAbsolute(requested: string): string {
  const home = os.homedir();
  if (!requested || requested === "~" || requested === "/") return home;
  if (requested.startsWith("~/")) return path.join(home, requested.slice(2));
  return path.resolve(requested);
}

// Resolve a path and assert it stays inside the allowed roots. When `mustExist`
// is false (create ops) the parent dir is checked instead, since the target
// itself does not exist yet. Symlinks are resolved before the bounds check so a
// link can't be used to escape an allowed root.
async function safePath(requested: string, mustExist: boolean): Promise<string> {
  const absolute = toAbsolute(requested);
  const rr = await realRoots();
  if (mustExist) {
    const real = await fs.realpath(absolute);
    if (!rr.some((r) => isUnderRoot(real, r)))
      throw new Error("Path outside allowed roots (home, projects)");
    return real;
  }
  const parent = await fs.realpath(path.dirname(absolute));
  if (!rr.some((r) => isUnderRoot(parent, r)))
    throw new Error("Path outside allowed roots (home, projects)");
  return path.join(parent, path.basename(absolute));
}

async function assertNotRoot(p: string): Promise<void> {
  const rr = await realRoots();
  if (rr.some((r) => r === p)) throw new Error("Refusing to modify a root directory");
}

export async function readFileText(requested: string): Promise<{ path: string; content: string }> {
  const p = await resolveReadable(requested); // read bounds (browse-anywhere)
  const stat = await fs.stat(p);
  if (stat.isDirectory()) throw new Error("Is a directory");
  if (stat.size > 5_000_000) throw new Error("File too large to read (max 5 MiB)");
  return { path: p, content: await fs.readFile(p, "utf8") };
}

export async function writeFileText(requested: string, content: string): Promise<{ ok: true; path: string }> {
  const p = await safePath(requested, false);
  await assertNotRoot(p);
  const tmp = p + ".tmp-" + process.pid;
  await fs.writeFile(tmp, content ?? "", { mode: 0o644 });
  await fs.rename(tmp, p);
  return { ok: true, path: p };
}

export async function makeDir(requested: string): Promise<{ ok: true; path: string }> {
  const p = await safePath(requested, false);
  await fs.mkdir(p, { recursive: true });
  return { ok: true, path: p };
}

export async function removePath(requested: string): Promise<{ ok: true }> {
  const p = await safePath(requested, true);
  await assertNotRoot(p);
  await fs.rm(p, { recursive: true, force: true });
  return { ok: true };
}

export async function movePath(from: string, to: string): Promise<{ ok: true }> {
  const src = await safePath(from, true);
  await assertNotRoot(src);
  const dest = await safePath(to, false);
  try {
    await fs.rename(src, dest);
  } catch (err) {
    // Cross-device rename → copy then remove.
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      await fs.cp(src, dest, { recursive: true });
      await fs.rm(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
  return { ok: true };
}

export async function copyPath(from: string, to: string): Promise<{ ok: true }> {
  const src = await safePath(from, true);
  const dest = await safePath(to, false);
  await fs.cp(src, dest, { recursive: true });
  return { ok: true };
}

export async function diskUsage(requested: string): Promise<{ used: number; total: number }> {
  const p = await resolveReadable(requested || "~");
  const s = await fs.statfs(p);
  const total = s.blocks * s.bsize;
  const free = s.bfree * s.bsize;
  return { used: total - free, total };
}
