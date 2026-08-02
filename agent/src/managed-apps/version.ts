import { commandExists, runProgram } from "./process-runner.js";

export async function readCommandVersion(command: string): Promise<string | null> {
  if (!(await commandExists(command))) return null;
  const result = await runProgram(command, ["--version"], 10_000);
  if (result.code !== 0) return null;
  const value = result.stdout.trim().split(/\r?\n/)[0]?.trim() ?? "";
  return value.slice(0, 160) || null;
}

/** Update availability is deliberately conservative: unknown is safer than network guessing. */
export async function updateAvailability(command: string): Promise<boolean | null> {
  if (!(await commandExists(command))) return null;
  const result = await runProgram(command, ["update", "--check"], 15_000);
  if (result.code !== 0) return null;
  return /update available|new version/i.test(`${result.stdout}\n${result.stderr}`);
}
