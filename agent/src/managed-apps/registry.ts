import { promises as fs } from "fs";
import path from "path";

import { appendLog } from "../state/log.js";
import { hermesAdapter } from "./adapters/hermes.js";
import { openclawAdapter } from "./adapters/openclaw.js";
import { ManagedAppError, parseManagedAppAction, parseManagedAppId } from "./security.js";
import type { ManagedAppAction, ManagedAppAdapter, ManagedAppId, ManagedAppInstallation, ManagedAppPublic } from "./types.js";

const stateDir = process.env.STATE_DIR ?? path.resolve(process.cwd(), "var");
const metadataPath = path.join(stateDir, "managed-apps.json");
const adapters: Record<ManagedAppId, ManagedAppAdapter> = { hermes: hermesAdapter, openclaw: openclawAdapter };

function supportedActionsFor(installation: ManagedAppInstallation, installed: boolean): ManagedAppAction[] {
  if (!installed) return [];
  if (installation.installationType === "systemd") return ["start", "stop", "restart", "backup", "rollback"];
  if (installation.installationType === "docker-container" || installation.installationType === "docker-compose") {
    return ["start", "stop", "restart", "backup", "rollback", "uninstall"];
  }
  if (installation.installationType === "package" || installation.installationType === "source") return ["backup", "rollback"];
  return [];
}

function publicApp(adapter: ManagedAppAdapter, installation: ManagedAppInstallation, status: Awaited<ReturnType<ManagedAppAdapter["getStatus"]>>): ManagedAppPublic {
  return { id: adapter.id, name: adapter.name, description: adapter.description, installationType: installation.installationType, status, supportedActions: supportedActionsFor(installation, status.installed) };
}

async function readMetadata(): Promise<Partial<Record<ManagedAppId, ManagedAppInstallation>>> {
  try {
    const parsed = JSON.parse(await fs.readFile(metadataPath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<Record<ManagedAppId, ManagedAppInstallation>> = {};
    for (const id of ["hermes", "openclaw"] as const) {
      const item = (parsed as Record<string, unknown>)[id];
      if (item && typeof item === "object" && (item as { id?: unknown }).id === id && Array.isArray((item as { dataPaths?: unknown }).dataPaths) && Array.isArray((item as { configPaths?: unknown }).configPaths)) out[id] = item as ManagedAppInstallation;
    }
    return out;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    return {};
  }
}

async function saveMetadata(metadata: Partial<Record<ManagedAppId, ManagedAppInstallation>>): Promise<void> {
  await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  const tmp = `${metadataPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(metadata), { mode: 0o600 });
  await fs.rename(tmp, metadataPath);
}

export class ManagedAppRegistry {
  private readonly activeOperations = new Map<ManagedAppId, ManagedAppAction>();

  async getInstallation(id: ManagedAppId): Promise<ManagedAppInstallation> {
    const metadata = await readMetadata();
    const saved = metadata[id];
    if (saved && saved.installationType !== "not-installed") return saved;
    const detected = await adapters[id].detect();
    metadata[id] = detected;
    await saveMetadata(metadata);
    return detected;
  }

  async list(): Promise<ManagedAppPublic[]> {
    const apps: ManagedAppPublic[] = [];
    // Detection persists first-run metadata, so serialize this initial pass to
    // avoid competing atomic temp-file promotions.
    for (const id of ["hermes", "openclaw"] as const) apps.push(await this.get(id));
    return apps;
  }

  async get(idValue: string | undefined): Promise<ManagedAppPublic> {
    const id = parseManagedAppId(idValue);
    const adapter = adapters[id];
    const installation = await this.getInstallation(id);
    const status = await adapter.getStatus(installation);
    const operation = this.activeOperations.get(id);
    if (operation === "start") status.state = "starting";
    if (operation === "update") status.state = "updating";
    if (operation === "rollback") status.state = "rolling-back";
    return publicApp(adapter, installation, status);
  }

  async logs(idValue: string | undefined) {
    const id = parseManagedAppId(idValue);
    const installation = await this.getInstallation(id);
    return adapters[id].getLogs(installation);
  }

  async act(idValue: string | undefined, actionValue: unknown, preserveData: unknown): Promise<{ result: { ok: boolean; action: ManagedAppAction; message: string; rolledBack?: boolean }; app: ManagedAppPublic }> {
    const id = parseManagedAppId(idValue);
    const action = parseManagedAppAction(actionValue);
    if (this.activeOperations.has(id)) throw new ManagedAppError("Another managed application operation is already running", 409);
    this.activeOperations.set(id, action);
    try {
      return await this.runAction(id, action, preserveData);
    } finally {
      this.activeOperations.delete(id);
    }
  }

  private async runAction(id: ManagedAppId, action: ManagedAppAction, preserveData: unknown): Promise<{ result: { ok: boolean; action: ManagedAppAction; message: string; rolledBack?: boolean }; app: ManagedAppPublic }> {
    const preserve = preserveData === undefined ? true : typeof preserveData === "boolean" ? preserveData : (() => { throw new ManagedAppError("preserveData must be a boolean"); })();
    const installation = await this.getInstallation(id);
    const adapter = adapters[id];
    if (installation.installationType === "not-installed") throw new ManagedAppError("Managed application is not installed", 409);
    if (!supportedActionsFor(installation, true).includes(action)) {
      throw new ManagedAppError("This operation is unsupported for the detected installation type", 409);
    }
    let rolledBack = false;
    try {
      if (action === "start") await adapter.start(installation);
      if (action === "stop") await adapter.stop(installation);
      if (action === "restart") await adapter.restart(installation);
      if (action === "backup") await adapter.backup(installation);
      if (action === "rollback") { await adapter.rollback(installation); await adapter.restart(installation).catch(() => undefined); }
      if (action === "uninstall") await adapter.uninstall(installation, preserve);
      if (action === "update") {
        await adapter.backup(installation);
        try {
          await adapter.update(installation);
          const status = await adapter.getStatus(installation);
          if (status.health === "unhealthy") throw new ManagedAppError("Updated application failed health check", 502);
        } catch (error) {
          await adapter.rollback(installation);
          await adapter.restart(installation).catch(() => undefined);
          rolledBack = true;
          throw error;
        }
      }
    } catch (error) {
      appendLog({ level: "error", source: "managed-apps", message: "Managed application lifecycle action failed", data: { app: id, action, rolledBack } });
      if (error instanceof ManagedAppError) throw error;
      throw new ManagedAppError("Managed application operation failed", 500);
    }
    const app = await this.get(id);
    appendLog({ level: "info", source: "managed-apps", message: "Managed application lifecycle action completed", data: { app: id, action, rolledBack } });
    return { result: { ok: true, action, message: `Managed application ${action} completed`, rolledBack: rolledBack || undefined }, app };
  }
}

export const managedAppRegistry = new ManagedAppRegistry();

/** Contract check used by tests and to keep accidental command-like actions out of the public boundary. */
export function isManagedAppAction(value: unknown): value is ManagedAppAction {
  try { parseManagedAppAction(value); return true; } catch { return false; }
}
