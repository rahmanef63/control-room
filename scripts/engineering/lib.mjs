import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const AGENT_ROOT = path.join(ROOT, '.agent');

export function nowIso() {
  return new Date().toISOString();
}

export function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'record';
}

export function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function gitDirty() {
  try {
    return execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim().length > 0;
  } catch {
    return null;
  }
}

export function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    const key = rawKey.replace(/-/g, '_');
    let value = inlineValue;
    if (value === undefined && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      value = argv[++i];
    }
    if (value === undefined) value = true;
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function asList(value) {
  if (value === undefined || value === null || value === '') return [];
  return (Array.isArray(value) ? value : [value]).flatMap((item) =>
    String(item)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

export function ensureInsideAgent(candidate) {
  const resolved = path.resolve(candidate);
  const root = path.resolve(AGENT_ROOT) + path.sep;
  if (resolved !== path.resolve(AGENT_ROOT) && !resolved.startsWith(root)) {
    throw new Error(`Path must stay inside ${AGENT_ROOT}`);
  }
  return resolved;
}

export function yamlString(value) {
  if (value === null || value === undefined) return 'null';
  return JSON.stringify(String(value));
}

export function yamlArray(values) {
  return `[${values.map((value) => yamlString(value)).join(', ')}]`;
}

const SECRET_RULES = [
  { name: 'private-key', pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g },
  { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: 'openai-style-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi },
  {
    name: 'assigned-secret',
    pattern: /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret)\b\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{12,}["']?/gi
  }
];

export function findSensitive(text) {
  const matches = [];
  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      matches.push({ rule: rule.name, index: match.index, sample: match[0].slice(0, 24) });
      if (match[0].length === 0) rule.pattern.lastIndex += 1;
    }
  }
  return matches;
}

export function redactSensitive(text) {
  let output = String(text);
  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0;
    output = output.replace(rule.pattern, `[REDACTED:${rule.name}]`);
  }
  return output;
}

export function assertNoSensitive(text, label = 'content') {
  const matches = findSensitive(text);
  if (matches.length > 0) {
    throw new Error(`${label} contains sensitive-looking material (${matches.map((item) => item.rule).join(', ')})`);
  }
}

export function walkFiles(root, predicate = () => true) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full, predicate));
    else if (entry.isFile() && predicate(full)) files.push(full);
  }
  return files;
}

export function relativeToRoot(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

export function replaceFrontmatterField(text, key, value) {
  const rendered = Array.isArray(value) ? yamlArray(value) : yamlString(value);
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  if (!pattern.test(text)) throw new Error(`Missing frontmatter field ${key}`);
  return text.replace(pattern, `${key}: ${rendered}`);
}

export function readTitle(text, fallback) {
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

export function readFrontmatterScalar(text, key) {
  const raw = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!raw || raw === 'null') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^['"]|['"]$/g, '');
  }
}
