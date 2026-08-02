import { ManagedAppError } from "./security.js";
import { runProgram } from "./process-runner.js";

export async function systemdState(serviceName: string): Promise<"active" | "inactive" | "missing"> {
  for (const args of [["--user", "is-active", serviceName], ["is-active", serviceName]]) {
    const result = await runProgram("systemctl", args, 10_000);
    if (result.code === 0 && result.stdout.trim() === "active") return "active";
    if (!/could not be found|not-found/i.test(`${result.stdout}\n${result.stderr}`)) return "inactive";
  }
  return "missing";
}

export async function runSystemd(serviceName: string, action: "start" | "stop" | "restart"): Promise<void> {
  for (const args of [["--user", action, serviceName], [action, serviceName]]) {
    const result = await runProgram("systemctl", args, 30_000);
    if (result.code === 0) return;
  }
  throw new ManagedAppError("Managed application service operation is unavailable", 409);
}
