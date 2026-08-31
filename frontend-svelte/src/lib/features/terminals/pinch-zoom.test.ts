import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { fontSizeForPinch, touchDistance } from './pinch-zoom';

describe('terminal pinch zoom', () => {
	test('measures two touch points', () => {
		assert.equal(touchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 }), 5);
	});

	test('ignores small scale jitter under one font step', () => {
		assert.equal(fontSizeForPinch(13, 100, 111), 13);
		assert.equal(fontSizeForPinch(13, 100, 90), 13);
	});

	test('converts pinch in and out to discrete font steps', () => {
		assert.equal(fontSizeForPinch(13, 100, 126), 15);
		assert.equal(fontSizeForPinch(13, 100, 78), 11);
	});

	test('clamps extreme gestures to terminal font bounds', () => {
		assert.equal(fontSizeForPinch(23, 100, 1000), 24);
		assert.equal(fontSizeForPinch(10, 100, 10), 9);
	});
});
