import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';

const staticUrl = new URL('../../../static/', import.meta.url);

function pngSize(buffer: Buffer): [number, number] {
	assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
	return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

describe('PWA install assets', () => {
	test('manifest icon declarations point to real PNGs with matching dimensions', async () => {
		const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', staticUrl), 'utf8')) as {
			icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
		};
		assert.equal(manifest.icons.length, 4);
		for (const icon of manifest.icons) {
			assert.equal(icon.type, 'image/png');
			const [declaredWidth, declaredHeight] = icon.sizes.split('x').map(Number);
			const file = await readFile(new URL(icon.src.replace(/^\//, ''), staticUrl));
			assert.deepEqual(pngSize(file), [declaredWidth, declaredHeight]);
		}
		assert.equal(manifest.icons.some((icon) => icon.purpose === 'maskable'), true);
	});

	test('app shell links the manifest and Apple touch icon', async () => {
		const html = await readFile(new URL('../../../src/app.html', import.meta.url), 'utf8');
		assert.match(html, /rel="manifest"/);
		assert.match(html, /rel="apple-touch-icon"[^>]+apple-touch-icon\.png/);
		assert.match(html, /interactive-widget=resizes-content/);
	});
});
