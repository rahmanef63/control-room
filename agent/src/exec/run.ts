import { exec } from "child_process";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

import { isUnderRoot } from "../fs/explorer.js";

// One-shot shell command runner for the os-vps terminal. Same trust boundary as
// the pty manager (the agent already spawns full shells for Control Room), but
// non-interactive: captured stdout/stderr + exit code, bounded time + output.
// cwd is constrained to the home/projects roots; the command itself is the
// caller's (gateway-secret-gated) responsibility.

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 1_000_000; // 1 MiB per stream

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function resolveCwd(requested?: string): Promise<string> {
  const home = os.homedir();
  if (!requested || requested === "~") return home;
  const absolute = requested.startsWith("~/")
    ? path.join(home, requested.slice(2))
    : path.resolve(requested);
  let real: string;
  try {
    real = await fs.realpath(absolute);
  } catch {
    return home; // cwd gone → fall back home rather than fail the command
  }
  const roots = await Promise.all(
    [home, path.join(home, "projects")].map(async (r) => {
      try {
        return await fs.realpath(r);
      } catch {
        return path.resolve(r);
      }
    })
  );
  return roots.some((r) => isUnderRoot(real, r)) ? real : home;
}

export async function runCommand(cmd: string, cwd?: string): Promise<ExecResult> {
  if (typeof cmd !== "string" || !cmd.trim()) throw new Error("Empty command");
  const dir = await resolveCwd(cwd);
  return new Promise<ExecResult>((resolve) => {
    exec(
      cmd,
      {
        cwd: dir,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT,
        env: process.env,
        // Linux/macOS run through bash; Windows has no /bin/bash, so use the
        // platform default (cmd.exe) instead of failing every command outright.
        shell: process.platform === "win32" ? (process.env["ComSpec"] || "cmd.exe") : "/bin/bash",
      },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === "number"
            ? ((err as { code: number }).code)
            : err
              ? 1
              : 0;
        resolve({
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? "") + (err && err.killed ? "\n[timed out after 30s]" : ""),
          code,
        });
      }
    );
  });
}
