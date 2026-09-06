import { promises as fs } from "fs";
import os from "os";
import path from "path";

type SkillScope = "global" | "project";

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  invocation: string;
  scope: SkillScope;
  source: string;
}

// Keep this aligned with the Agent Skills roots used by MSO/SI-Coder so a skill
// installed once is immediately available to Control Room's /<skill> picker.
const GLOBAL_ROOTS = [
  path.join(os.homedir(), ".mso", "skills"),
  path.join(os.homedir(), ".agents", "skills"),
  path.join(os.homedir(), ".claude", "skills"),
  path.join(os.homedir(), ".hermes", "skills"),
  path.join(os.homedir(), ".codex", "skills"),
  path.join(os.homedir(), ".openclaw", "workspace", "skills"),
];

const PROJECT_SUBDIRS = [
  "skills",
  path.join(".mso", "skills"),
  path.join(".claude", "skills"),
  path.join(".agents", "skills"),
  path.join(".hermes", "skills"),
  path.join(".codex", "skills"),
];

const PROJECT_MARKERS = [".git", "package.json", "deno.json", "pyproject.toml", "Cargo.toml", "go.mod"];
const SAFE_SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function parseFrontmatter(raw: string): Record<string, string> {
  if (!raw.startsWith("---")) return {};
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return {};
  const block = raw.slice(3, end).trim();
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value) as string; } catch { value = value.slice(1, -1); }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/''/g, "'");
    }
    result[match[1]] = value;
  }
  return result;
}

async function isPathInsideHome(target: string): Promise<boolean> {
  const home = os.homedir();
  const resolved = path.resolve(target);
  return resolved === home || resolved.startsWith(home + path.sep);
}

async function findProjectRoot(cwd: string): Promise<string | null> {
  let current = path.resolve(cwd);
  if (!(await isPathInsideHome(current))) return null;

  const home = os.homedir();
  while (current && current !== home && current !== path.dirname(current)) {
    for (const marker of PROJECT_MARKERS) {
      try {
        await fs.access(path.join(current, marker));
        return current;
      } catch {
        // marker missing, continue
      }
    }
    current = path.dirname(current);
  }
  return null;
}

async function readSkillsFromDir(
  root: string,
  scope: SkillScope,
  sourceLabel: string
): Promise<SkillSummary[]> {
  let entries: string[];
  try {
    const dirents = await fs.readdir(root, { withFileTypes: true });
    entries = dirents.filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name);
  } catch {
    return [];
  }

  const results: SkillSummary[] = [];
  await Promise.all(
    entries.map(async (id) => {
      const skillFile = path.join(root, id, "SKILL.md");
      try {
        const raw = await fs.readFile(skillFile, "utf8");
        const meta = parseFrontmatter(raw);
        const name = SAFE_SKILL_NAME.test(meta.name || "") ? meta.name : id;
        results.push({
          id,
          name,
          description: meta.description || "",
          invocation: `/${name}`,
          scope,
          source: sourceLabel,
        });
      } catch {
        // skip skills without SKILL.md
      }
    })
  );

  return results;
}

export async function listSkills(cwd?: string): Promise<SkillSummary[]> {
  const globalLists = await Promise.all(
    GLOBAL_ROOTS.map((root) =>
      readSkillsFromDir(root, "global", path.relative(os.homedir(), root) || root)
    )
  );

  const projectRoot = cwd ? await findProjectRoot(cwd) : null;
  let projectList: SkillSummary[] = [];
  if (projectRoot) {
    const projectLists = await Promise.all(
      PROJECT_SUBDIRS.map((sub) => {
        const root = path.join(projectRoot, sub);
        const label = `${path.basename(projectRoot)}/${sub}`;
        return readSkillsFromDir(root, "project", label);
      })
    );
    projectList = projectLists.flat();
  }

  // Project roots win over global roots. Within one scope, root order above is
  // precedence; duplicate names from another registry are intentionally hidden.
  const seen = new Set<string>();
  const all = [...projectList, ...globalLists.flat()].filter((skill) => {
    const key = `${skill.scope}:${skill.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return all.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === "project" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
