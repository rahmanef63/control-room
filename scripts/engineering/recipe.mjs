#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENT_ROOT,
  assertNoSensitive,
  nowIso,
  parseArgs,
  readFrontmatterScalar,
  relativeToRoot,
  replaceFrontmatterField,
  slugify,
  walkFiles,
  yamlString
} from './lib.mjs';

const ROOT = path.join(AGENT_ROOT, 'recipes');

function recipeFile(name) {
  return path.join(ROOT, `${slugify(name)}.md`);
}

function observe(args) {
  const name = String(args.name ?? '').trim();
  if (!name) throw new Error('--name is required');
  fs.mkdirSync(ROOT, { recursive: true });
  const file = recipeFile(name);
  const now = nowIso();
  if (!fs.existsSync(file)) {
    const text = `---\nstatus: "observed"\nobservations: 1\nfirst_seen: ${yamlString(now)}\nlast_seen: ${yamlString(now)}\nscript: null\n---\n\n# ${name}\n\n## Purpose\n\n${String(args.summary ?? '').trim()}\n\n## Steps\n\n${String(args.steps ?? '').trim()}\n\n## Preconditions\n\n\n## Verification\n\n\n## Safety / idempotency\n\n`;
    assertNoSensitive(text, 'recipe');
    fs.writeFileSync(file, text, { flag: 'wx' });
  } else {
    let text = fs.readFileSync(file, 'utf8');
    const observations = Number(readFrontmatterScalar(text, 'observations') ?? 0) + 1;
    const current = String(readFrontmatterScalar(text, 'status') ?? 'observed');
    const next = current === 'observed' && observations >= 2 ? 'repeated' : current;
    text = text.replace(/^observations:.*$/m, `observations: ${observations}`);
    text = replaceFrontmatterField(text, 'last_seen', now);
    text = replaceFrontmatterField(text, 'status', next);
    assertNoSensitive(text, 'recipe');
    fs.writeFileSync(file, text);
  }
  console.log(relativeToRoot(file));
}

function promote(args) {
  const name = String(args.name ?? '').trim();
  const status = String(args.status ?? '').trim();
  if (!name) throw new Error('--name is required');
  if (!['verified', 'scripted'].includes(status)) throw new Error('--status must be verified or scripted');
  const file = recipeFile(name);
  if (!fs.existsSync(file)) throw new Error(`Recipe not found: ${name}`);
  let text = fs.readFileSync(file, 'utf8');
  text = replaceFrontmatterField(text, 'status', status);
  text = replaceFrontmatterField(text, 'last_seen', nowIso());
  if (status === 'scripted') {
    const command = String(args.script ?? '').trim();
    if (!command) throw new Error('--script is required when status=scripted');
    text = replaceFrontmatterField(text, 'script', command);
  }
  assertNoSensitive(text, 'recipe');
  fs.writeFileSync(file, text);
  console.log(relativeToRoot(file));
}

function list(args) {
  const rows = walkFiles(ROOT, (file) => file.endsWith('.md')).map((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return {
      path: relativeToRoot(file),
      status: readFrontmatterScalar(text, 'status'),
      observations: Number(readFrontmatterScalar(text, 'observations') ?? 0),
      script: readFrontmatterScalar(text, 'script')
    };
  });
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else rows.forEach((row) => console.log(`${row.status}\t${row.observations}\t${row.path}${row.script ? `\t${row.script}` : ''}`));
}

try {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === 'observe') observe(args);
  else if (command === 'promote') promote(args);
  else if (command === 'list') list(args);
  else console.log('recipe.mjs observe|promote|list');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
