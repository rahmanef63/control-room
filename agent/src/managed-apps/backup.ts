import { promises as fs } from "fs";
import os from "os";
import path from "path";

import type { ManagedAppInstallation } from "./types.js";
import { ManagedAppError } from "./security.js";

const stateDir = process.env.STATE_DIR ?? path.resolve(process.cwd(), "var");
const backupRoot = path.join(stateDir, "managed-app-backups");

function safeStamp(): string { return new Date().toISOString().replace(/[:.]/g, "-"); }
function relName(value: string, index: number): string { return `${index}-${path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "_")}`; }

async function assertNoSymlinks(root: string): Promise<void> {
  const stat = await fs.lstat(root);
  if (stat.isSymbolicLink()) throw new ManagedAppError("Managed application backup path contains a symbolic link", 409);
  if (!stat.isDirectory()) return;
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const child = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new ManagedAppError("Managed application backup path contains a symbolic link", 409);
    if (entry.isDirectory()) await assertNoSymlinks(child);
  }
}

function assertRegisteredPaths(installation: ManagedAppInstallation, paths: string[]): void {
  const allowed = new Set([...installation.configPaths, ...installation.dataPaths].map((value) => path.resolve(value)));
  if (paths.some((value) => !allowed.has(path.resolve(value)))) {
    throw new ManagedAppError("Managed application backup contains an unregistered path", 409);
  }
}

export async function backupInstallation(installation: ManagedAppInstallation): Promise<void> {
  const root = path.join(backupRoot, installation.id, safeStamp());
  const paths = [...new Set([...installation.configPaths, ...installation.dataPaths])];
  const copied: string[] = [];
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  for (const [index, source] of paths.entries()) {
    try {
      await fs.access(source);
      await assertNoSymlinks(source);
      const destination = path.join(root, relName(source, index));
      await fs.cp(source, destination, { recursive: true, preserveTimestamps: true });
      copied.push(source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (copied.length === 0) throw new ManagedAppError("No managed application data is available to back up", 409);
  await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify({ id: installation.id, createdAt: Date.now(), paths: copied }), { mode: 0o600 });
}

export async function rollbackInstallation(installation: ManagedAppInstallation): Promise<void> {
  const appRoot = path.join(backupRoot, installation.id);
  let backups: string[];
  try { backups = (await fs.readdir(appRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); }
  catch { throw new ManagedAppError("No managed application backup is available", 409); }
  const latest = backups.at(-1);
  if (!latest) throw new ManagedAppError("No managed application backup is available", 409);
  const root = path.join(appRoot, latest);
  const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8")) as { paths?: unknown };
  if (!Array.isArray(manifest.paths) || manifest.paths.some((item) => typeof item !== "string")) throw new ManagedAppError("Managed application backup is invalid", 409);
  const destinations = manifest.paths as string[];
  assertRegisteredPaths(installation, destinations);
  for (const [index, destination] of destinations.entries()) {
    const source = path.join(root, relName(destination, index));
    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, { recursive: true, preserveTimestamps: true });
  }
}

export function defaultAppPaths(id: ManagedAppInstallation["id"]): { dataPaths: string[]; configPaths: string[] } {
  const home = os.homedir();
  return id === "hermes"
    ? { dataPaths: [path.join(home, ".hermes")], configPaths: [path.join(home, ".hermes")] }
    : { dataPaths: [path.join(home, ".openclaw")], configPaths: [path.join(home, ".openclaw")] };
}
