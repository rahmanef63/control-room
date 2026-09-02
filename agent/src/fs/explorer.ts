import { promises as fs } from "fs";
import os from "os";
import path from "path";

interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface FsRoot {
  label: string;
  path: string;
}

export interface FsListResult {
  path: string;
  parent: string | null;
  roots: FsRoot[];
  entries: FsEntry[];
}

function homeDir(): string {
  return os.homedir();
}

function expandHome(p: string): string {
  if (p === "~") return homeDir();
  if (p.startsWith("~/")) return path.join(homeDir(), p.slice(2));
  return p;
}

// READ bounds. Default: home + ~/projects (Control-Room-safe). Override with
// OS_AGENT_FS_READ_ROOTS (colon-separated) — set to "/" to browse the whole VPS
// read-only. This is the same access the pty already grants an authed caller,
// so it adds no exposure beyond the existing trust boundary.
function readRootList(): string[] {
  const env = process.env.OS_AGENT_FS_READ_ROOTS;
  if (env && env.trim())
    return env.split(":").map((s) => s.trim()).filter(Boolean).map(expandHome);
  const h = homeDir();
  return [h, path.join(h, "projects")];
}

function labelFor(p: string): string {
  const h = homeDir();
  if (p === "/") return "Filesystem";
  if (p === h) return "Home";
  if (p === path.join(h, "projects")) return "Projects";
  return path.basename(p) || p;
}

// Display roots: always offer Home + Projects shortcuts, plus any extra read
// roots (e.g. "/") so the UI has handy jump points regardless of the bounds.
function resolveRoots(): FsRoot[] {
  const h = homeDir();
  const base = [
    { label: "Home", path: h },
    { label: "Projects", path: path.join(h, "projects") },
  ];
  const extra = readRootList()
    .filter((p) => p !== h && p !== path.join(h, "projects"))
    .map((p) => ({ label: labelFor(p), path: p }));
  return [...base, ...extra];
}

export function isUnderRoot(target: string, root: string): boolean {
  if (root === "/") return true;
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Resolve a requested path to its realpath and assert it is inside the READ
// bounds. Symlinks are resolved first so a link can't escape an allowed root.
export async function resolveReadable(requested: string): Promise<string> {
  const home = homeDir();
  let absolute: string;
  if (!requested || requested === "~") absolute = home;
  else if (requested === "/") absolute = "/";
  else if (requested.startsWith("~/")) absolute = path.join(home, requested.slice(2));
  else absolute = path.resolve(requested);
  absolute = path.resolve(absolute);

  const real = await fs.realpath(absolute);
  const realRoots = await Promise.all(
    readRootList().map(async (r) => {
      try {
        return await fs.realpath(r);
      } catch {
        return path.resolve(r);
      }
    })
  );
  if (!realRoots.some((r) => isUnderRoot(real, r)))
    throw new Error("Path outside allowed roots");
  return real;
}

export async function listDirectory(
  requested: string,
  includeHidden = false,
): Promise<FsListResult> {
  const realAbsolute = await resolveReadable(requested);

  const stat = await fs.stat(realAbsolute);
  if (!stat.isDirectory()) throw new Error("Not a directory");

  const raw = await fs.readdir(realAbsolute, { withFileTypes: true });
  const entries: FsEntry[] = raw
    .filter((entry) => includeHidden || !entry.name.startsWith("."))
    .map((entry) => ({
      name: entry.name,
      path: path.join(realAbsolute, entry.name),
      isDir: entry.isDirectory() || entry.isSymbolicLink(),
    }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  // Parent is offered only when it is still inside the read bounds.
  const parentCandidate = path.dirname(realAbsolute);
  let parent: string | null = null;
  if (parentCandidate !== realAbsolute) {
    try {
      await resolveReadable(parentCandidate);
      parent = parentCandidate;
    } catch {
      parent = null;
    }
  }

  return { path: realAbsolute, parent, roots: resolveRoots(), entries };
}
