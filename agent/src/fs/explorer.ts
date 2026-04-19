import { promises as fs } from "fs";
import os from "os";
import path from "path";

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface FsListResult {
  path: string;
  parent: string | null;
  roots: Array<{ label: string; path: string }>;
  entries: FsEntry[];
}

function resolveRoots(): Array<{ label: string; path: string }> {
  const home = os.homedir();
  return [
    { label: "Home", path: home },
    { label: "Projects", path: path.join(home, "projects") },
  ];
}

function isUnderRoot(target: string, root: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function listDirectory(requested: string): Promise<FsListResult> {
  const roots = resolveRoots();
  const home = os.homedir();

  let absolute: string;
  if (!requested || requested === "~" || requested === "/") {
    absolute = home;
  } else if (requested.startsWith("~/")) {
    absolute = path.join(home, requested.slice(2));
  } else {
    absolute = path.resolve(requested);
  }
  absolute = path.resolve(absolute);

  const allowed = roots.some((root) => isUnderRoot(absolute, root.path));
  if (!allowed) {
    throw new Error("Path outside allowed roots (home, projects)");
  }

  const stat = await fs.stat(absolute);
  if (!stat.isDirectory()) {
    throw new Error("Not a directory");
  }

  const raw = await fs.readdir(absolute, { withFileTypes: true });
  const entries: FsEntry[] = raw
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => ({
      name: entry.name,
      path: path.join(absolute, entry.name),
      isDir: entry.isDirectory(),
    }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const parentCandidate = path.dirname(absolute);
  const parent =
    parentCandidate !== absolute && roots.some((root) => isUnderRoot(parentCandidate, root.path))
      ? parentCandidate
      : null;

  return { path: absolute, parent, roots, entries };
}
