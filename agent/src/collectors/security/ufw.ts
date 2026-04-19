import { runSecurityCommand } from './shell.js';

export async function collectUfwRules(): Promise<string[]> {
  const output = await runSecurityCommand('ufw status verbose 2>/dev/null');
  if (!output.trim()) return [];

  const lines = output.split('\n');
  const rules: string[] = [];
  let inRules = false;

  for (const line of lines) {
    if (line.startsWith('To ') || line.startsWith('--')) {
      inRules = true;
      continue;
    }
    if (inRules && line.trim()) {
      rules.push(line.trim());
    }
    if (!line.trim() && inRules) {
      break;
    }
  }

  if (rules.length === 0) {
    return lines.filter((entry) => entry.trim()).slice(0, 30);
  }

  return rules;
}
