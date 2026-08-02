import { randomUUID } from "crypto";

import cron from "node-cron";
import type { ScheduledTask } from "node-cron";

import { logger } from "../logger.js";
import { terminalManager } from "../terminal/manager.js";
import type { TerminalProfile } from "../../../packages/contracts/index.js";
import { readAll, writeAll } from "./store.js";
import { validateAction } from "./validate.js";
import type {
  CronAction,
  CronCreateInput,
  CronEntry,
  CronUpdateInput,
} from "./types.js";

class CronManager {
  private entries: CronEntry[] = [];
  private tasks = new Map<string, ScheduledTask>();
  private started = false;

  start(): void {
    if (this.started) return;
    this.entries = readAll();
    for (const entry of this.entries) {
      if (entry.enabled) this.scheduleEntry(entry);
    }
    this.started = true;
    logger.info("Cron manager started", { count: this.entries.length });
  }

  stop(): void {
    for (const task of this.tasks.values()) {
      try {
        task.stop();
      } catch {
        // ignore
      }
    }
    this.tasks.clear();
    this.started = false;
  }

  list(): CronEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  get(id: string): CronEntry | undefined {
    const entry = this.entries.find((e) => e.id === id);
    return entry ? { ...entry } : undefined;
  }

  create(input: CronCreateInput): CronEntry {
    if (!cron.validate(input.cronExpr)) {
      throw new Error(`Invalid cron expression: ${input.cronExpr}`);
    }
    validateAction(input.action);

    const now = Date.now();
    const entry: CronEntry = {
      id: `cron_${randomUUID()}`,
      name: input.name.trim() || "untitled",
      cronExpr: input.cronExpr,
      enabled: input.enabled ?? true,
      workspaceId: input.workspaceId,
      action: input.action,
      createdAt: now,
      updatedAt: now,
    };
    this.entries.push(entry);
    this.persist();
    if (entry.enabled) this.scheduleEntry(entry);
    return { ...entry };
  }

  update(id: string, input: CronUpdateInput): CronEntry {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Cron not found: ${id}`);

    const current = this.entries[idx];
    const next: CronEntry = {
      ...current,
      ...input,
      action: input.action ?? current.action,
      updatedAt: Date.now(),
    };

    if (input.cronExpr && !cron.validate(input.cronExpr)) {
      throw new Error(`Invalid cron expression: ${input.cronExpr}`);
    }
    if (input.action) validateAction(input.action);

    this.entries[idx] = next;
    this.persist();
    this.unscheduleEntry(id);
    if (next.enabled) this.scheduleEntry(next);
    return { ...next };
  }

  delete(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    this.persist();
    this.unscheduleEntry(id);
    return true;
  }

  async runNow(id: string): Promise<CronEntry> {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new Error(`Cron not found: ${id}`);
    await this.runEntry(entry);
    return { ...entry };
  }

  private scheduleEntry(entry: CronEntry): void {
    try {
      const task = cron.schedule(entry.cronExpr, () => {
        this.runEntry(entry).catch((err) => {
          logger.error("Cron tick failed", { id: entry.id, error: String(err) });
        });
      });
      this.tasks.set(entry.id, task);
    } catch (err) {
      logger.error("Failed to schedule cron", { id: entry.id, error: String(err) });
    }
  }

  private unscheduleEntry(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      try {
        task.stop();
      } catch {
        // ignore
      }
      this.tasks.delete(id);
    }
  }

  private async runEntry(entry: CronEntry): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    if (idx === -1) return;
    const now = Date.now();
    let lastResult: CronEntry["lastResult"];
    try {
      const sessionId = await this.executeAction(entry.action);
      lastResult = { ok: true, sessionId };
      logger.info("Cron fired", { id: entry.id, name: entry.name, sessionId });
    } catch (err) {
      lastResult = { ok: false, message: String(err) };
      logger.error("Cron action failed", { id: entry.id, error: String(err) });
    }
    this.entries[idx] = {
      ...this.entries[idx],
      lastRunAt: now,
      lastResult,
    };
    this.persist();
  }

  private async executeAction(action: CronAction): Promise<string | undefined> {
    if (action.type === "spawn") {
      const session = terminalManager.createSession({
        profile: action.profile as TerminalProfile | undefined,
        agentProfileId: action.agentProfileId,
        environmentId: action.environmentId,
        cwd: action.cwd,
      });
      if (action.initialCommand) {
        // small delay so the shell is ready
        await new Promise((resolve) => setTimeout(resolve, 350));
        terminalManager.sendInput(session.id, `${action.initialCommand}\r`);
      }
      return session.id;
    }
    if (action.type === "send_input") {
      terminalManager.sendInput(action.sessionId, action.data);
      return action.sessionId;
    }
    throw new Error("Unknown cron action");
  }

  private persist(): void {
    writeAll(this.entries);
  }
}

export const cronManager = new CronManager();
