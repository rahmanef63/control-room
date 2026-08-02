import fs from "fs";
import os from "os";
import path from "path";

import type { CronEntry } from "./types.js";

function defaultStorePath(): string {
  if (process.env.CONTROL_ROOM_CRONS_PATH) {
    return process.env.CONTROL_ROOM_CRONS_PATH;
  }
  return path.join(os.homedir(), ".config", "vps-control-room", "crons.json");
}

export function getStorePath(): string {
  return defaultStorePath();
}

export function readAll(): CronEntry[] {
  const file = getStorePath();
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry: unknown) => isCronEntry(entry)) as CronEntry[];
  } catch {
    return [];
  }
}

export function writeAll(entries: CronEntry[]): void {
  const file = getStorePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(entries, null, 2));
}

function isCronEntry(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.cronExpr === "string" &&
    typeof v.enabled === "boolean" &&
    typeof v.action === "object"
  );
}
