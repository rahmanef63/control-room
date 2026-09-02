import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);
const markdown = tracked.filter((file) => file.endsWith('.md'));
const issues = [];
let relativeLinkCount = 0;

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

for (const file of markdown) {
  const text = read(file);
  const linkPattern = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    const raw = match[1].trim();
    if (/^(https?:\/\/|mailto:|#)/i.test(raw)) continue;
    const withoutAnchor = raw.split('#', 1)[0].replace(/^<|>$/g, '');
    if (!withoutAnchor) continue;
    relativeLinkCount += 1;
    const resolved = path.resolve(root, path.dirname(file), withoutAnchor);
    if (!fs.existsSync(resolved)) issues.push(`${file}: broken relative link -> ${raw}`);
  }
}

const versions = Object.fromEntries(
  ['package.json', 'frontend/package.json', 'agent/package.json'].map((file) => [
    file,
    JSON.parse(read(file)).version,
  ]),
);
const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size !== 1) {
  issues.push(`package version mismatch: ${JSON.stringify(versions)}`);
}
const version = versions['package.json'];
for (const file of ['README.md', 'PRD.md', 'SECURITY.md', 'docs/INSTALL.md', 'docs/ONBOARDING.md', 'docs/runbook.md']) {
  if (!read(file).includes(`v${version}`)) issues.push(`${file}: missing current v${version} baseline`);
}

// Exact residue markers that have no valid role in the terminal-first v2 tree.
// Historical architecture words are intentionally not banned: decision/failure memory
// may explain why an old approach was removed.
const staleMarkers = [
  ['bunx rahman-cr', /bunx\s+rahman-cr/i],
  ['provider-store path/name', /provider-store/i],
  ['si-coder path/name', /\bsi-coder\b/i],
  ['browser CRUD route', /(?:\/api)?\/browser\/crud/i],
  ['removed cron env', /CONTROL_ROOM_CRONS_PATH/],
  ['removed Docker socket env', /DOCKER_SOCKET_PATH/],
  ['removed cron migration', /MIGRATE_CRON_STORE/],
  ['removed node-cron dependency', /\bnode-cron\b/],
  ['obsolete fixed cwd', /\/opt\/vps-control-room/],
  ['obsolete access-mode env', /CONTROL_ROOM_ACCESS_MODE=tailscale-only/],
  ['obsolete Docker host env', /DOCKER_HOST=unix:\/\/\/var\/run\/docker\.sock/],
  ['stale Next env wording', /Next reads/i],
];
const textExtensions = new Set(['.md', '.ts', '.js', '.mjs', '.json', '.sh', '.ps1', '.svelte', '.yml', '.yaml']);
for (const file of tracked) {
  if (file === 'scripts/engineering/verify-docs.mjs') continue;
  if (file.startsWith('.agent/memory/')) continue;
  if (!textExtensions.has(path.extname(file))) continue;
  const text = read(file);
  for (const [label, pattern] of staleMarkers) {
    if (pattern.test(text)) issues.push(`${file}: ${label}`);
  }
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, markdownCount: markdown.length, relativeLinkCount, versions, issues }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, markdownCount: markdown.length, relativeLinkCount, version, versions }, null, 2));
