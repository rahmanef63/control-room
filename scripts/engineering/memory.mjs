#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENT_ROOT,
  ROOT,
  asList,
  assertNoSensitive,
  dateStamp,
  ensureInsideAgent,
  gitCommit,
  nowIso,
  parseArgs,
  readFrontmatterScalar,
  readTitle,
  relativeToRoot,
  replaceFrontmatterField,
  slugify,
  walkFiles,
  yamlArray,
  yamlString
} from './lib.mjs';

const TYPES = new Set(['task', 'debug', 'test', 'decision', 'failure']);
const FOLDERS = { task: 'tasks', debug: 'debug', test: 'tests', decision: 'decisions', failure: 'failures' };
const STATUS = new Set(['active', 'confirmed', 'superseded', 'archived']);

function usage() {
  console.log(`Engineering memory\n\nCommands:\n  new --type <task|debug|test|decision|failure> --title <text> [--scope x] [--tags a,b] [--source agent|user-manual]\n  query <terms...> [--type debug] [--status active] [--limit 10] [--json]\n  supersede --file <.agent/...md> --by <.agent/...md>\n  verify --file <.agent/...md>`);
}

function sectionsFor(type) {
  switch (type) {
    case 'task':
      return ['## Task', '', '## Scope', '', '## Result', '', '## Affected files', '', '## Verification', '', '## Remaining issue', ''];
    case 'debug':
      return ['## Symptoms', '', '## Reproduction', '', '## Root cause', '', '## Attempts', '', '## Failed approaches', '', '## Final fix', '', '## Regression tests', '', '## Evidence', '', '## Environment', ''];
    case 'test':
      return ['## Target', '', '## Environment', '', '## Steps', '', '## Result', '', '## Observation', '', '## Related areas', '', '## Evidence', ''];
    case 'decision':
      return ['## Decision', '', '## Context', '', '## Rationale', '', '## Consequences', '', '## Verification / review trigger', ''];
    case 'failure':
      return ['## Goal', '', '## Attempt', '', '## Why it failed', '', '## Evidence', '', '## Do not repeat until', ''];
    default:
      return [];
  }
}

function newMemory(args) {
  const type = String(args.type ?? '');
  const title = String(args.title ?? '').trim();
  if (!TYPES.has(type)) throw new Error(`Unknown memory type: ${type}`);
  if (!title) throw new Error('--title is required');
  const status = String(args.status ?? (type === 'decision' ? 'confirmed' : 'active'));
  if (!STATUS.has(status)) throw new Error(`Unknown status: ${status}`);
  const created = nowIso();
  const tags = asList(args.tags);
  const folder = path.join(AGENT_ROOT, 'memory', FOLDERS[type]);
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${dateStamp()}-${slugify(title)}.md`);
  if (fs.existsSync(file) && !args.force) throw new Error(`Memory already exists: ${relativeToRoot(file)}`);
  const body = [
    '---',
    `type: ${yamlString(type)}`,
    `status: ${yamlString(status)}`,
    `confidence: ${yamlString(args.confidence ?? 'medium')}`,
    `created_at: ${yamlString(created)}`,
    `updated_at: ${yamlString(created)}`,
    'last_verified: null',
    `scope: ${yamlString(args.scope ?? 'repository')}`,
    `tags: ${yamlArray(tags)}`,
    `commit: ${yamlString(args.commit ?? gitCommit())}`,
    'supersedes: null',
    'superseded_by: null',
    `source: ${yamlString(args.source ?? 'agent')}`,
    '---',
    '',
    `# ${title}`,
    '',
    ...sectionsFor(type)
  ].join('\n');
  assertNoSensitive(body, 'memory');
  fs.writeFileSync(file, `${body}\n`, { encoding: 'utf8', flag: args.force ? 'w' : 'wx' });
  console.log(relativeToRoot(file));
}

function queryMemory(args) {
  const terms = [...args._].join(' ').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) throw new Error('query requires search terms');
  const typeFilter = args.type ? String(args.type) : null;
  const statusFilter = args.status ? String(args.status) : null;
  const limit = Math.max(1, Math.min(50, Number(args.limit ?? 10)) || 10);
  const files = walkFiles(path.join(AGENT_ROOT, 'memory'), (file) => file.endsWith('.md'));
  const rows = files.flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const type = readFrontmatterScalar(text, 'type');
    const status = readFrontmatterScalar(text, 'status');
    if (typeFilter && type !== typeFilter) return [];
    if (statusFilter && status !== statusFilter) return [];
    const haystack = text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const occurrences = haystack.split(term).length - 1;
      score += Math.min(occurrences, 8) * 2;
      if (readTitle(text, '').toLowerCase().includes(term)) score += 5;
    }
    if (status === 'active' || status === 'confirmed') score += 1;
    if (score === 0) return [];
    return [{ path: relativeToRoot(file), title: readTitle(text, path.basename(file)), type, status, score }];
  }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else rows.forEach((row) => console.log(`${row.score}\t${row.type}\t${row.status}\t${row.path}\t${row.title}`));
}

function resolveMemoryFile(value) {
  if (!value) throw new Error('--file is required');
  const raw = String(value);
  const absolute = ensureInsideAgent(path.isAbsolute(raw) ? raw : path.join(ROOT, raw));
  if (!absolute.includes(`${path.sep}memory${path.sep}`) || !absolute.endsWith('.md')) throw new Error('Expected a memory Markdown file');
  if (!fs.existsSync(absolute)) throw new Error(`Memory not found: ${raw}`);
  return absolute;
}

function supersedeMemory(args) {
  const file = resolveMemoryFile(args.file);
  if (!args.by) throw new Error('--by is required');
  const by = resolveMemoryFile(args.by);
  let text = fs.readFileSync(file, 'utf8');
  text = replaceFrontmatterField(text, 'status', 'superseded');
  text = replaceFrontmatterField(text, 'superseded_by', relativeToRoot(by));
  text = replaceFrontmatterField(text, 'updated_at', nowIso());
  assertNoSensitive(text, 'memory');
  fs.writeFileSync(file, text);
  console.log(relativeToRoot(file));
}

function verifyMemory(args) {
  const file = resolveMemoryFile(args.file);
  let text = fs.readFileSync(file, 'utf8');
  const now = nowIso();
  text = replaceFrontmatterField(text, 'last_verified', now);
  text = replaceFrontmatterField(text, 'updated_at', now);
  assertNoSensitive(text, 'memory');
  fs.writeFileSync(file, text);
  console.log(relativeToRoot(file));
}

try {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (!command || command === 'help' || command === '--help') usage();
  else if (command === 'new') newMemory(args);
  else if (command === 'query') queryMemory(args);
  else if (command === 'supersede') supersedeMemory(args);
  else if (command === 'verify') verifyMemory(args);
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
