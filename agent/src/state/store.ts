import { promises as fs } from "fs";
import path from "path";

const DEFAULT_DIR = path.resolve(process.cwd(), "var");
const STATE_DIR = process.env.STATE_DIR ?? DEFAULT_DIR;

export function pathFor(key: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    throw new Error(`Invalid state key: ${key}`);
  }
  return path.join(STATE_DIR, `${key}.json`);
}

export async function readJsonState<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(pathFor(key), "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeJsonState(key: string, data: unknown): Promise<void> {
  // Absence is represented by a missing file — readJsonState maps ENOENT to
  // null — so `null` is never a meaningful value to persist. It only ever
  // arrives from a dropped/empty request body, and writing it silently destroys
  // the stored state. Refuse, so that path can never be a data-loss bug again.
  if (data === null || data === undefined) {
    throw new Error(`Refusing to write empty state for key: ${key}`);
  }
  await fs.mkdir(STATE_DIR, { recursive: true });
  const dest = pathFor(key);
  const tmp = `${dest}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, dest);
}
