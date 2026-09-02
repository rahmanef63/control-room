#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENT_ROOT,
  asList,
  findSensitive,
  gitCommit,
  gitDirty,
  nowIso,
  parseArgs,
  redactSensitive,
  relativeToRoot,
  slugify,
  walkFiles
} from './lib.mjs';

const RECEIPTS = path.join(AGENT_ROOT, 'evidence', 'receipts');
const SCAN_ROOTS = [path.join(AGENT_ROOT, 'memory'), path.join(AGENT_ROOT, 'recipes'), RECEIPTS];

function parsePairs(value) {
  const entries = {};
  for (const pair of asList(value)) {
    const index = pair.indexOf('=');
    if (index < 1) throw new Error(`Expected key=value, got ${pair}`);
    entries[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return entries;
}

function parseAssertions(value) {
  return asList(value).map((item) => {
    const index = item.lastIndexOf('=');
    if (index < 1) throw new Error(`Expected claim=status, got ${item}`);
    return { claim: item.slice(0, index), status: item.slice(index + 1) };
  });
}

function create(args) {
  const target = String(args.target ?? '').trim();
  if (!target) throw new Error('--target is required');
  const generatedAt = nowIso();
  const receipt = {
    schema_version: 1,
    generated_at: generatedAt,
    repo: path.basename(process.cwd()),
    commit: gitCommit(),
    dirty: gitDirty(),
    environment: String(args.environment ?? 'development'),
    target,
    assertions: parseAssertions(args.assert),
    checks: parsePairs(args.check),
    browser: {
      result: args.browser ? String(args.browser) : null,
      console_errors: Number(args.console_errors ?? 0),
      network_errors: Number(args.network_errors ?? 0)
    },
    deployment_state: args.deployment ? String(args.deployment) : null,
    artifacts: asList(args.artifact),
    notes: args.notes ? redactSensitive(String(args.notes)) : null
  };
  fs.mkdirSync(RECEIPTS, { recursive: true });
  const stamp = generatedAt.replace(/[:.]/g, '-');
  const file = path.join(RECEIPTS, `${stamp}-${slugify(target)}.json`);
  const text = `${JSON.stringify(receipt, null, 2)}\n`;
  const sensitive = findSensitive(text);
  if (sensitive.length > 0) throw new Error(`Receipt still contains sensitive-looking material: ${sensitive.map((m) => m.rule).join(', ')}`);
  fs.writeFileSync(file, text, { flag: 'wx' });
  console.log(relativeToRoot(file));
}

function check() {
  const issues = [];
  let receiptCount = 0;
  for (const root of SCAN_ROOTS) {
    for (const file of walkFiles(root, (candidate) => candidate.endsWith('.md') || candidate.endsWith('.json'))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of findSensitive(text)) issues.push(`${relativeToRoot(file)}:${match.rule}`);
      if (file.startsWith(RECEIPTS) && file.endsWith('.json')) {
        receiptCount += 1;
        try {
          const payload = JSON.parse(text);
          for (const key of ['schema_version', 'generated_at', 'commit', 'environment', 'target', 'assertions', 'checks']) {
            if (!(key in payload)) issues.push(`${relativeToRoot(file)}:missing-${key}`);
          }
        } catch {
          issues.push(`${relativeToRoot(file)}:invalid-json`);
        }
      }
    }
  }
  if (issues.length > 0) {
    console.error(JSON.stringify({ ok: false, receiptCount, issues }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, receiptCount, scannedRoots: SCAN_ROOTS.map(relativeToRoot) }, null, 2));
}

try {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === 'create') create(args);
  else if (command === 'check') check();
  else console.log('evidence.mjs create|check');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
