import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.svelte-kit/output/client/_app/immutable');
const limits = new Map([
  ['.js', 512 * 1024],
  ['.css', 128 * 1024]
]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = await walk(root);
let failed = false;
for (const [ext, limit] of limits) {
  const entries = [];
  for (const file of files.filter((item) => item.endsWith(ext))) {
    const { size } = await stat(file);
    entries.push({ file: path.relative(root, file), size });
    if (size > limit) failed = true;
  }
  entries.sort((a, b) => b.size - a.size);
  const largest = entries[0];
  if (largest) {
    console.log(`${ext.slice(1)} largest=${largest.size}B limit=${limit}B file=${largest.file}`);
  }
  for (const entry of entries.filter((item) => item.size > limit)) {
    console.error(`bundle budget exceeded: ${entry.file} ${entry.size}B > ${limit}B`);
  }
}
if (failed) process.exit(1);
