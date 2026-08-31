import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { BroadcastInputQueue, resolveBroadcastFanout } from './broadcast';

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


describe('BroadcastInputQueue', () => {
	test('preserves keystroke order for one terminal', async () => {
		const calls: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const queue = new BroadcastInputQueue(async (_id, data) => {
			calls.push(data);
			if (data === 'a') await new Promise<void>((resolve) => { releaseFirst = resolve; });
		});

		queue.enqueue('alpha', 'a');
		queue.enqueue('alpha', 'b');
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.deepEqual(calls, ['a']);
		releaseFirst?.();
		await queue.flush('alpha');
		assert.deepEqual(calls, ['a', 'b']);
	});

	test('does not serialize unrelated terminal targets together', async () => {
		const calls: string[] = [];
		let releaseAlpha: (() => void) | undefined;
		const queue = new BroadcastInputQueue(async (id, data) => {
			calls.push(`${id}:${data}`);
			if (id === 'alpha') await new Promise<void>((resolve) => { releaseAlpha = resolve; });
		});

		queue.enqueue('alpha', 'a');
		queue.enqueue('beta', 'b');
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.ok(calls.includes('alpha:a'));
		assert.ok(calls.includes('beta:b'));
		releaseAlpha?.();
		await queue.flush();
	});
});
