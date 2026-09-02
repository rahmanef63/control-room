#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const target = String(args.target ?? 'ui verification');
const environment = String(args.environment ?? 'development');
const record = Boolean(args.record);
const steps = [
  ['frontend-check', ['bun', 'run', '--cwd', 'frontend', 'check']],
  ['frontend-lint', ['bun', 'run', '--cwd', 'frontend', 'lint']],
  ['frontend-test', ['bun', 'run', '--cwd', 'frontend', 'test']],
  ['frontend-build', ['bun', 'run', '--cwd', 'frontend', 'build']],
  ['playwright', ['bun', 'run', '--cwd', 'frontend', 'test:e2e']]
];

const results = {};
let failed = false;
for (const [name, command] of steps) {
  const started = Date.now();
  const result = spawnSync(command[0], command.slice(1), { cwd: process.cwd(), stdio: 'inherit', env: process.env });
  results[name] = { status: result.status === 0 ? 'passed' : 'failed', duration_ms: Date.now() - started };
  if (result.status !== 0) {
    failed = true;
    break;
  }
}

const summary = { ok: !failed, target, environment, checks: results };
console.log(`\n${JSON.stringify(summary, null, 2)}`);

if (record) {
  const checkArgs = Object.entries(results).flatMap(([name, result]) => ['--check', `${name}=${result.status}`]);
  const artifactArgs = (Array.isArray(args.artifact) ? args.artifact : args.artifact ? [args.artifact] : []).flatMap((artifact) => ['--artifact', String(artifact)]);
  const evidence = spawnSync(
    'bun',
    ['scripts/engineering/evidence.mjs', 'create', '--target', target, '--environment', environment, '--browser', failed ? 'failed' : 'passed', ...checkArgs, ...artifactArgs],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  if (evidence.stdout) process.stdout.write(evidence.stdout);
  if (evidence.stderr) process.stderr.write(evidence.stderr);
  if (evidence.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
