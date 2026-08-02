import { spawn } from "child_process";

import { ManagedAppError } from "./security.js";

const MAX_OUTPUT = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface ProgramResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs only application-owned, server-selected programs and argument arrays. Never accepts browser input. */
export function runProgram(command: string, args: readonly string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ProgramResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const finish = (result: ProgramResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    let child;
    try {
      child = spawn(command, [...args], { stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true });
    } catch {
      reject(new ManagedAppError("Managed application runtime is unavailable", 503));
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish({ code: 124, stdout, stderr: "operation timed out" });
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < MAX_OUTPUT) stdout += chunk.toString("utf8").slice(0, MAX_OUTPUT - stdout.length); });
    child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < MAX_OUTPUT) stderr += chunk.toString("utf8").slice(0, MAX_OUTPUT - stderr.length); });
    child.on("error", () => finish({ code: 127, stdout, stderr: "runtime unavailable" }));
    child.on("close", (code) => finish({ code: code ?? 1, stdout, stderr }));
    child.on("close", () => clearTimeout(timer));
  });
}

export async function requireProgram(command: string, args: readonly string[], timeoutMs?: number): Promise<ProgramResult> {
  const result = await runProgram(command, args, timeoutMs);
  if (result.code !== 0) throw new ManagedAppError("Managed application operation is unavailable", 409);
  return result;
}

export async function commandExists(command: string): Promise<boolean> {
  const result = await runProgram("which", [command], 5_000);
  return result.code === 0;
}
