import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const root = path.resolve('.svelte-kit/output/client/_app/immutable');
const limits = new Map([
  ['.js', 512 * 1024],
  ['.css', 128 * 1024]
]);
const landingLimits = {
  html: 32 * 1024,
  gzip: 8 * 1024,
  css: 64 * 1024
};

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

const landingPath = path.resolve('build/prerendered/landing.html');
const landingHtml = await readFile(landingPath, 'utf8');
const landingHtmlBytes = Buffer.byteLength(landingHtml);
const landingGzipBytes = gzipSync(landingHtml).byteLength;
const landingStyleHrefs = [...landingHtml.matchAll(/<link href="\.\/(_app\/immutable\/assets\/[^"]+\.css)" rel="stylesheet">/g)]
  .map((match) => match[1]);
let landingCssBytes = 0;
for (const href of landingStyleHrefs) {
  landingCssBytes += (await stat(path.resolve('build/client', href))).size;
}
const landingExecutableScripts = (
  landingHtml.match(/<script(?=[^>]*(?:type="module"|src=))[^>]*>/g) ?? []
).length;

console.log(
  `landing html=${landingHtmlBytes}B/${landingLimits.html}B gzip=${landingGzipBytes}B/${landingLimits.gzip}B css=${landingCssBytes}B/${landingLimits.css}B executable-scripts=${landingExecutableScripts}`
);

if (landingHtmlBytes > landingLimits.html) {
  failed = true;
  console.error(`landing HTML budget exceeded: ${landingHtmlBytes}B > ${landingLimits.html}B`);
}
if (landingGzipBytes > landingLimits.gzip) {
  failed = true;
  console.error(`landing gzip budget exceeded: ${landingGzipBytes}B > ${landingLimits.gzip}B`);
}
if (landingCssBytes > landingLimits.css) {
  failed = true;
  console.error(`landing CSS budget exceeded: ${landingCssBytes}B > ${landingLimits.css}B`);
}
if (landingExecutableScripts > 0) {
  failed = true;
  console.error(`landing must remain zero-CSR: found ${landingExecutableScripts} executable script tag(s)`);
}

if (failed) process.exit(1);
