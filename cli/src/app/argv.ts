import type { CommandArgs } from './types.js';

export function parseArgv(argv: string[]): CommandArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) {
      positional.push(part);
      continue;
    }

    const key = part.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }

  return { _: positional, flags };
}
