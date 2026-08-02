import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_UPLOAD_BYTES,
  filesFromDrop,
  imageFileFromBlob,
  partitionBySize,
  quoteShellPath,
} from './upload';

function fileOfSize(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name);
}

test('quoteShellPath leaves safe paths and ~ untouched', () => {
  assert.equal(quoteShellPath('~'), '~');
  assert.equal(quoteShellPath('~/projects/x'), '~/projects/x');
  assert.equal(quoteShellPath('/home/rahman/a_b-c.txt'), '/home/rahman/a_b-c.txt');
});

test('quoteShellPath single-quotes paths with spaces/specials', () => {
  assert.equal(quoteShellPath('/tmp/my file.png'), "'/tmp/my file.png'");
  // embedded single quote is escaped
  assert.equal(quoteShellPath("a'b"), "'a'\\''b'");
});

test('partitionBySize splits at the cap', () => {
  const small = fileOfSize('a.txt', 10);
  const big = fileOfSize('b.bin', MAX_UPLOAD_BYTES + 1);
  const atCap = fileOfSize('c.bin', MAX_UPLOAD_BYTES);
  const { ok, tooBig } = partitionBySize([small, big, atCap]);
  assert.deepEqual(
    ok.map((f) => f.name),
    ['a.txt', 'c.bin']
  );
  assert.deepEqual(
    tooBig.map((f) => f.name),
    ['b.bin']
  );
});

test('imageFileFromBlob derives extension + deterministic name', () => {
  const png = imageFileFromBlob(new Blob(['x'], { type: 'image/png' }), 0, 1700000000000);
  assert.equal(png.name, 'pasted-1700000000000.png');
  assert.equal(png.type, 'image/png');
  const jpg = imageFileFromBlob(new Blob(['y'], { type: 'image/jpeg' }), 2, 1700000000000);
  assert.equal(jpg.name, 'pasted-1700000000000-2.jpeg');
  const fallback = imageFileFromBlob(new Blob(['z'], { type: '' }), 0, 1700000000000);
  assert.equal(fallback.name, 'pasted-1700000000000.png');
});

test('filesFromDrop skips directory entries, keeps files', () => {
  const realFile = fileOfSize('keep.txt', 4);
  const dt = {
    items: [
      { kind: 'file', getAsFile: () => realFile, webkitGetAsEntry: () => ({ isDirectory: false, name: 'keep.txt' }) },
      { kind: 'file', getAsFile: () => fileOfSize('folder', 0), webkitGetAsEntry: () => ({ isDirectory: true, name: 'folder' }) },
      { kind: 'string', getAsFile: () => null },
    ],
    files: [realFile],
  };
  const { files, skippedDirs } = filesFromDrop(dt as unknown as DataTransfer);
  assert.deepEqual(
    files.map((f) => f.name),
    ['keep.txt']
  );
  assert.deepEqual(skippedDirs, ['folder']);
});

test('filesFromDrop falls back to flat file list without items API', () => {
  const a = fileOfSize('a', 1);
  const { files, skippedDirs } = filesFromDrop({ files: [a] } as unknown as DataTransfer);
  assert.deepEqual(
    files.map((f) => f.name),
    ['a']
  );
  assert.deepEqual(skippedDirs, []);
});
