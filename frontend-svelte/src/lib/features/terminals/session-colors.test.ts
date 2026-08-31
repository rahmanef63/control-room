import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
	SESSION_COLOR_PALETTE,
	defaultColorFor,
	pruneSessionColors
} from './session-colors';

describe('session colors', () => {
	test('default color is deterministic and from the shared palette', () => {
		const first = defaultColorFor('session-alpha');
		assert.equal(defaultColorFor('session-alpha'), first);
		assert.ok(SESSION_COLOR_PALETTE.includes(first as (typeof SESSION_COLOR_PALETTE)[number]));
	});

	test('pruning removes only stale overrides', () => {
		assert.deepEqual(
			pruneSessionColors({ alpha: '#111111', beta: '#222222' }, ['beta']),
			{ beta: '#222222' }
		);
	});

	test('pruning preserves object identity when nothing changes', () => {
		const colors = { alpha: '#111111' };
		assert.equal(pruneSessionColors(colors, ['alpha']), colors);
	});
});
