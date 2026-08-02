import { promises as fs } from "fs";
import path from "path";

import { backupInstallation, defaultAppPaths, rollbackInstallation } from "../backup.js";
import { commandExists, requireProgram, runProgram } from "../process-runner.js";
import { ManagedAppError, redactManagedAppLog } from "../security.js";
import { runSystemd, systemdState } from "../service-runner.js";
import { readCommandVersion, updateAvailability } from "../version.js";
import type { InstallationType, ManagedAppAdapter, ManagedAppInstallation, ManagedAppLogResult, ManagedAppStatus } from "../types.js";

export interface AdapterDefinition {
  id: "hermes" | "openclaw";
  name: string;
  description: string;
  command: string;
  serviceNames: string[];
  containerNames: string[];
  dashboardUrl: string;
}

export class CliManagedAppAdapter implements ManagedAppAdapter {
  readonly id: AdapterDefinition["id"];
  readonly name: string;
  readonly description: string;
  private readonly definition: AdapterDefinition;

  constructor(definition: AdapterDefinition) {
    this.definition = definition;
    this.id = definition.id;
    this.name = definition.name;
    this.description = definition.description;
  }

  async detect(): Promise<ManagedAppInstallation> {
    const paths = defaultAppPaths(this.id);
    for (const serviceName of this.definition.serviceNames) {
      if (await systemdState(serviceName) !== "missing") {
        return this.installation("systemd", { serviceName }, paths);
      }
    }
    if (await commandExists("docker")) {
      const listed = await runProgram("docker", ["ps", "-a", "--format", "{{.Names}}"], 10_000);
      const names = new Set(listed.stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean));
      const containerName = this.definition.containerNames.find((name) => names.has(name));
      if (containerName) {
        const compose = await runProgram("docker", ["inspect", "--format", "{{ index .Config.Labels \"com.docker.compose.project.config_files\" }}", containerName], 10_000);
        const composeFile = compose.code === 0 ? compose.stdout.trim().split(",")[0] : "";
        if (composeFile && await this.fileExists(composeFile)) return this.installation("docker-compose", { containerName, composeFile }, paths);
        return this.installation("docker-container", { containerName }, paths);
      }
    }
    if (await commandExists(this.definition.command)) return this.installation("package", { command: this.definition.command }, paths);
    return this.installation("not-installed", {}, paths);
  }

  async getStatus(installation: ManagedAppInstallation): Promise<ManagedAppStatus> {
    const installed = installation.installationType !== "not-installed";
    let running = false;
    if (installation.installationType === "systemd" && installation.serviceName) running = (await systemdState(installation.serviceName)) === "active";
    if (installation.installationType === "docker-container" && installation.containerName) {
      const result = await runProgram("docker", ["inspect", "--format", "{{.State.Running}}", installation.containerName], 10_000);
      running = result.code === 0 && result.stdout.trim() === "true";
    }
    if (installation.installationType === "docker-compose" && installation.composeFile && installation.containerName) {
      const result = await runProgram("docker", ["compose", "-f", installation.composeFile, "ps", "--status", "running", "--services"], 15_000);
      running = result.code === 0 && result.stdout.split(/\r?\n/).some((service) => service.trim().length > 0);
    }
    const version = installed ? await readCommandVersion(this.definition.command) : null;
    const updateAvailable = installed ? await updateAvailability(this.definition.command) : null;
    const health = running ? await this.health(installation.dashboardUrl) : "unknown";
    const state = !installed ? "not-installed" : health === "unhealthy" ? "unhealthy" : running ? "running" : "stopped";
    return { installed, running, state, version, updateAvailable, health, dashboardUrl: running ? installation.dashboardUrl ?? null : null };
  }

  async getLogs(installation: ManagedAppInstallation): Promise<ManagedAppLogResult> {
    if (installation.installationType === "systemd" && installation.serviceName) {
      const result = await runProgram("journalctl", ["--user", "-u", installation.serviceName, "-n", "100", "--no-pager", "-o", "short-iso"], 15_000);
      if (result.code === 0) return { available: true, entries: result.stdout.split(/\r?\n/).filter(Boolean).slice(-100).map(redactManagedAppLog) };
      return { available: false, entries: [] };
    }
    if ((installation.installationType === "docker-container" || installation.installationType === "docker-compose") && installation.containerName) {
      const result = await runProgram("docker", ["logs", "--tail", "100", installation.containerName], 15_000);
      return result.code === 0 ? { available: true, entries: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean).slice(-100).map(redactManagedAppLog) } : { available: false, entries: [] };
    }
    return { available: false, entries: [] };
  }

  async backup(installation: ManagedAppInstallation): Promise<void> { await backupInstallation(installation); }
  async start(installation: ManagedAppInstallation): Promise<void> { await this.lifecycle(installation, "start"); }
  async stop(installation: ManagedAppInstallation): Promise<void> { await this.lifecycle(installation, "stop"); }
  async restart(installation: ManagedAppInstallation): Promise<void> { await this.lifecycle(installation, "restart"); }

  async update(installation: ManagedAppInstallation): Promise<void> {
    if (installation.installationType === "not-installed") throw new ManagedAppError("Managed application is not installed", 409);
    if (installation.installationType === "docker-compose" && installation.composeFile) {
      await requireProgram("docker", ["compose", "-f", installation.composeFile, "pull"], 120_000);
      await requireProgram("docker", ["compose", "-f", installation.composeFile, "up", "-d"], 120_000);
      return;
    }
    if (installation.installationType === "docker-container" && installation.containerName) {
      const image = await runProgram("docker", ["inspect", "--format", "{{.Config.Image}}", installation.containerName], 10_000);
      if (image.code !== 0 || !image.stdout.trim()) throw new ManagedAppError("Managed application update is unavailable", 409);
      await requireProgram("docker", ["pull", image.stdout.trim()], 120_000);
      throw new ManagedAppError("Container image was fetched; replacing a container requires explicit installation metadata", 409);
    }
    // The CLI itself chooses its supported package/source updater; no browser command is accepted.
    await requireProgram(this.definition.command, ["update"], 120_000);
  }

  async rollback(installation: ManagedAppInstallation): Promise<void> { await rollbackInstallation(installation); }

  async uninstall(installation: ManagedAppInstallation, preserveData: boolean): Promise<void> {
    await this.stop(installation).catch(() => undefined);
    if (installation.installationType === "docker-compose" && installation.composeFile) await requireProgram("docker", ["compose", "-f", installation.composeFile, "down"], 60_000);
    else if (installation.installationType === "docker-container" && installation.containerName) await requireProgram("docker", ["rm", installation.containerName], 30_000);
    else if (installation.installationType === "systemd") throw new ManagedAppError("Service removal requires the application's own uninstaller", 409);
    else throw new ManagedAppError("Managed application uninstall is unavailable for this installation", 409);
    if (!preserveData) {
      for (const target of [...installation.configPaths, ...installation.dataPaths]) await fs.rm(target, { recursive: true, force: true });
    }
  }

  private installation(type: InstallationType, extra: Partial<ManagedAppInstallation>, paths: ReturnType<typeof defaultAppPaths>): ManagedAppInstallation {
    return { id: this.id, installationType: type, dashboardUrl: this.definition.dashboardUrl, updateChannel: "stable", detectedAt: Date.now(), command: this.definition.command, ...paths, ...extra };
  }

  private async lifecycle(installation: ManagedAppInstallation, action: "start" | "stop" | "restart"): Promise<void> {
    if (installation.installationType === "systemd" && installation.serviceName) return runSystemd(installation.serviceName, action);
    if (installation.installationType === "docker-container" && installation.containerName) {
      const command = action === "restart" ? "restart" : action;
      await requireProgram("docker", [command, installation.containerName], 30_000);
      return;
    }
    if (installation.installationType === "docker-compose" && installation.composeFile) {
      const args = action === "start"
        ? ["compose", "-f", installation.composeFile, "up", "-d"]
        : ["compose", "-f", installation.composeFile, action];
      await requireProgram("docker", args, 60_000);
      return;
    }
    throw new ManagedAppError("Managed application lifecycle control is unavailable for this installation", 409);
  }

  private async fileExists(value: string): Promise<boolean> {
    try { await fs.access(value); return true; } catch { return false; }
  }

  private async health(dashboardUrl?: string): Promise<"healthy" | "unhealthy" | "unknown"> {
    if (!dashboardUrl) return "unknown";
    try {
      const response = await fetch(`${dashboardUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(5_000) });
      return response.ok ? "healthy" : "unhealthy";
    } catch { return "unknown"; }
  }
}
