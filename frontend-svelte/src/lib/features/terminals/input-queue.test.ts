import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { OrderedTerminalInputQueue } from './input-queue';

describe('OrderedTerminalInputQueue', () => {
	test('preserves keystroke order for one terminal', async () => {
		const calls: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const queue = new OrderedTerminalInputQueue(async (_id, data) => {
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
		const queue = new OrderedTerminalInputQueue(async (id, data) => {
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
