import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const MAX_OUTPUT_BYTES = 1_000_000;
const TOOL_TIMEOUT_MS = 60_000;

interface SiCoderToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface SiCoderFunctionManifest extends SiCoderToolDescriptor {
  command: string[];
}

interface SiCoderManifest {
  functions: SiCoderFunctionManifest[];
}

export interface SiCoderSurface {
  installed: boolean;
  version: string | null;
  tools: SiCoderToolDescriptor[];
}

interface SiCoderInstall {
  root: string;
  version: string;
  functions: SiCoderFunctionManifest[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertManifest(value: unknown): SiCoderManifest {
  if (!isRecord(value) || !Array.isArray(value["functions"])) {
    throw new Error("Invalid SI-Coder function manifest");
  }
  const functions = value["functions"].filter((item): item is SiCoderFunctionManifest => {
    if (!isRecord(item)) return false;
    return (
      typeof item["name"] === "string" &&
      typeof item["description"] === "string" &&
      Array.isArray(item["command"]) &&
      item["command"].every((part) => typeof part === "string") &&
      isRecord(item["inputSchema"])
    );
  });
  return { functions };
}

async function installFromRoot(root: string): Promise<SiCoderInstall | null> {
  try {
    const packagePath = path.join(root, "package.json");
    const manifestPath = path.join(root, ".mso", "functions.json");
    const agentPath = path.join(root, "scripts", "sc-agent.js");
    const [pkgRaw, manifestRaw] = await Promise.all([
      fs.readFile(packagePath, "utf8"),
      fs.readFile(manifestPath, "utf8"),
      fs.access(agentPath),
    ]);
    const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    if (pkg["name"] !== "si-coder-agent" || typeof pkg["version"] !== "string") return null;
    const manifest = assertManifest(JSON.parse(manifestRaw));
    const functions = manifest.functions.filter((fn) => {
      if (fn.name === "sc.verify" || !fn.name.startsWith("sc.")) return false;
      return (
        fn.command.length === 3 &&
        fn.command[0] === "node" &&
        fn.command[1] === "scripts/sc-agent.js" &&
        typeof fn.command[2] === "string"
      );
    });
    return { root, version: pkg["version"], functions };
  } catch {
    return null;
  }
}

async function discoverSiCoderInstall(): Promise<SiCoderInstall | null> {
  const candidates = new Set<string>();
  const configured = process.env["SI_CODER_ROOT"]?.trim();
  if (configured) candidates.add(path.resolve(configured));

  const localBin = path.join(os.homedir(), ".local", "bin", "sc");
  try {
    const real = await fs.realpath(localBin);
    candidates.add(path.dirname(path.dirname(real)));
  } catch {
    // Optional integration: no local SC install is a supported state.
  }
  candidates.add(path.join(os.homedir(), ".local", "lib", "node_modules", "si-coder-agent"));

  for (const candidate of candidates) {
    const install = await installFromRoot(candidate);
    if (install) return install;
  }
  return null;
}

export async function listSiCoderTools(): Promise<SiCoderSurface> {
  const install = await discoverSiCoderInstall();
  if (!install) return { installed: false, version: null, tools: [] };
  return {
    installed: true,
    version: install.version,
    tools: install.functions.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  };
}

function collectChildOutput(child: ReturnType<typeof spawn>): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const finishError = (error: Error): void => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(error);
    };

    const timer = setTimeout(() => finishError(new Error("SI-Coder tool timed out")), TOOL_TIMEOUT_MS);
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_OUTPUT_BYTES) return finishError(new Error("SI-Coder stdout exceeded limit"));
      stdout.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_OUTPUT_BYTES) return finishError(new Error("SI-Coder stderr exceeded limit"));
      stderr.push(Buffer.from(chunk));
    });
    child.once("error", finishError);
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
      });
    });
  });
}

export async function callSiCoderTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ ok: boolean; result: unknown; error?: string }> {
  const install = await discoverSiCoderInstall();
  if (!install) throw new Error("SI-Coder is not installed");
  const fn = install.functions.find((item) => item.name === name);
  if (!fn) throw new Error(`Unknown SI-Coder tool ${JSON.stringify(name)}`);
  if (!isRecord(args)) throw new Error("Tool arguments must be an object");

  const action = fn.command[2];
  const agentPath = path.join(install.root, "scripts", "sc-agent.js");
  const child = spawn(process.execPath, [agentPath, action], {
    cwd: install.root,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end(JSON.stringify(args));
  const output = await collectChildOutput(child);

  let result: unknown = output.stdout || output.stderr || null;
  if (output.stdout) {
    try {
      result = JSON.parse(output.stdout);
    } catch {
      result = output.stdout;
    }
  }
  return {
    ok: output.code === 0,
    result,
    ...(output.code === 0 ? {} : { error: output.stderr || `SI-Coder tool exited with ${output.code}` }),
  };
}
