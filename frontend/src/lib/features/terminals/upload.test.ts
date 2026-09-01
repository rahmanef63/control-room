import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
	MAX_UPLOAD_BYTES,
	filesFromDrop,
	imageFileFromBlob,
	partitionBySize,
	quoteShellPath
} from './upload';

function fileOfSize(name: string, bytes: number): File {
	return new File([new Uint8Array(bytes)], name);
}

describe('terminal upload helpers', () => {
	test('quoteShellPath leaves safe paths and ~ untouched', () => {
		assert.equal(quoteShellPath('~'), '~');
		assert.equal(quoteShellPath('~/projects/x'), '~/projects/x');
		assert.equal(quoteShellPath('/home/rahman/a_b-c.txt'), '/home/rahman/a_b-c.txt');
	});

	test('quoteShellPath single-quotes paths with spaces and embedded quotes', () => {
		assert.equal(quoteShellPath('/tmp/my file.png'), "'/tmp/my file.png'");
		assert.equal(quoteShellPath("a'b"), "'a'\\''b'");
	});

	test('partitionBySize splits at the 25 MiB cap', () => {
		const small = fileOfSize('a.txt', 10);
		const big = fileOfSize('b.bin', MAX_UPLOAD_BYTES + 1);
		const atCap = fileOfSize('c.bin', MAX_UPLOAD_BYTES);
		const { ok, tooBig } = partitionBySize([small, big, atCap]);
		assert.deepEqual(ok.map((file) => file.name), ['a.txt', 'c.bin']);
		assert.deepEqual(tooBig.map((file) => file.name), ['b.bin']);
	});

	test('imageFileFromBlob derives a deterministic extension and name', () => {
		const png = imageFileFromBlob(new Blob(['x'], { type: 'image/png' }), 0, 1700000000000);
		assert.equal(png.name, 'pasted-1700000000000.png');
		assert.equal(png.type, 'image/png');
		const jpeg = imageFileFromBlob(new Blob(['y'], { type: 'image/jpeg' }), 2, 1700000000000);
		assert.equal(jpeg.name, 'pasted-1700000000000-2.jpeg');
	});

	test('filesFromDrop skips directories and keeps files', () => {
		const realFile = fileOfSize('keep.txt', 4);
		const transfer = {
			items: [
				{
					kind: 'file',
					getAsFile: () => realFile,
					webkitGetAsEntry: () => ({ isDirectory: false, name: 'keep.txt' })
				},
				{
					kind: 'file',
					getAsFile: () => fileOfSize('folder', 0),
					webkitGetAsEntry: () => ({ isDirectory: true, name: 'folder' })
				},
				{ kind: 'string', getAsFile: () => null }
			],
			files: [realFile]
		};
		const { files, skippedDirs } = filesFromDrop(transfer);
		assert.deepEqual(files.map((file) => file.name), ['keep.txt']);
		assert.deepEqual(skippedDirs, ['folder']);
	});
});
