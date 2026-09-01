import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { resolveBroadcastFanout } from './broadcast';

const sessions = [
	{ id: 'alpha', status: 'running' as const },
	{ id: 'beta', status: 'running' as const },
	{ id: 'done', status: 'exited' as const }
];

describe('resolveBroadcastFanout', () => {
	test('returns empty when no selected running target exists', () => {
		assert.deepEqual(resolveBroadcastFanout('alpha', new Set(), sessions), []);
		assert.deepEqual(resolveBroadcastFanout('alpha', new Set(['missing', 'done']), sessions), []);
	});
	test('includes the running source once broadcast is armed', () => {
		assert.deepEqual(resolveBroadcastFanout('alpha', new Set(['beta']), sessions), ['beta', 'alpha']);
	});
	test('does not duplicate an already-selected source', () => {
		assert.deepEqual(resolveBroadcastFanout('alpha', new Set(['alpha', 'beta']), sessions), ['alpha', 'beta']);
	});
	test('ignores exited and unknown targets', () => {
		assert.deepEqual(resolveBroadcastFanout('beta', new Set(['done', 'alpha', 'missing']), sessions), ['alpha', 'beta']);
	});
});
