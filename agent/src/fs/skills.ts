import { promises as fs } from "fs";
import os from "os";
import path from "path";

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  invocation: string;
}

const SKILLS_ROOT = path.join(os.homedir(), ".agents", "skills");

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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}

export async function listSkills(): Promise<SkillSummary[]> {
  let entries: string[];
  try {
    const dirents = await fs.readdir(SKILLS_ROOT, { withFileTypes: true });
    entries = dirents.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }

  const results: SkillSummary[] = [];
  await Promise.all(
    entries.map(async (id) => {
      const skillFile = path.join(SKILLS_ROOT, id, "SKILL.md");
      try {
        const raw = await fs.readFile(skillFile, "utf8");
        const meta = parseFrontmatter(raw);
        const name = meta.name || id;
        const description = meta.description || "";
        results.push({
          id,
          name,
          description,
          invocation: `/${id}`,
        });
      } catch {
        // skip skills without SKILL.md
      }
    })
  );

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
