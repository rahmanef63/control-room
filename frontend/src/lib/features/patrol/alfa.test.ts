import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	ALFA_DEFAULT_PROMPT,
	activeWatchedCount,
	assignTarget,
	createWatcher,
	normalizeWatcher,
	ownerOfTarget,
	pendingPingGroups,
	pruneWatchers,
	type AlfaWatcher,
	type PatrolPing
} from './alfa';

const watcher = (id: string, targets: string[]): AlfaWatcher => ({
	id,
	label: id,
	watchedSessionIds: targets,
	instructions: Object.fromEntries(targets.map((target) => [target, `prompt:${target}`])),
	defaultInstruction: ALFA_DEFAULT_PROMPT,
	mode: 'static',
	createdAt: 1
});

describe('alfa patrol helpers', () => {
	test('normalizes watcher contract and defaults prompt/mode safely', () => {
		const normalized = normalizeWatcher({ id: 'a', watchedSessionIds: ['x', 'x', 4], instructions: { x: 'go', bad: 3 }, defaultInstruction: '' });
		assert(normalized);
		assert.deepEqual(normalized.watchedSessionIds, ['x']);
		assert.deepEqual(normalized.instructions, { x: 'go' });
		assert.equal(normalized.defaultInstruction, ALFA_DEFAULT_PROMPT);
	});

	test('creates a static watcher without injecting an AI command', () => {
		const value = createWatcher({ id: 'a', title: 'Alpha' }, { workspaceId: 'ws', now: 9 });
		assert.deepEqual(value, {
			id: 'a', label: 'Alpha', watchedSessionIds: [], instructions: {}, defaultInstruction: ALFA_DEFAULT_PROMPT,
			mode: 'static', scopeWorkspaceId: 'ws', createdAt: 9
		});
	});

	test('assignTarget moves a target between alfa groups and removes stale instruction from source', () => {
		const next = assignTarget([watcher('a', ['x']), watcher('b', ['y'])], 'b', 'x');
		assert.deepEqual(next[0].watchedSessionIds, []);
		assert.deepEqual(next[0].instructions, {});
		assert.deepEqual(next[1].watchedSessionIds, ['y', 'x']);
	});

	test('prune removes dead alfa and target references only', () => {
		const result = pruneWatchers([watcher('a', ['x', 'gone']), watcher('dead', ['x'])], ['a', 'x']);
		assert.deepEqual(result.removedIds, ['dead']);
		assert.deepEqual(result.changedIds, ['a']);
		assert.deepEqual(result.watchers[0].watchedSessionIds, ['x']);
		assert.deepEqual(result.watchers[0].instructions, { x: 'prompt:x' });
	});

	test('target ownership/count is deduplicated across watchers', () => {
		const watchers = [watcher('a', ['x']), watcher('b', ['x', 'y'])];
		assert.equal(ownerOfTarget(watchers, 'x')?.id, 'a');
		assert.equal(activeWatchedCount(watchers, [{ id: 'x', status: 'running' }, { id: 'y', status: 'exited' }]), 1);
	});

	test('pending ping groups ignore acknowledged pings and sort newest target first', () => {
		const pings: PatrolPing[] = [
			{ id: '1', alfaId: 'a', sessionId: 'x', title: 'X', prompt: 'p', activityState: 'waiting', firedAt: 1, enqueuedAt: 2, acknowledged: false },
			{ id: '2', alfaId: 'a', sessionId: 'y', title: 'Y', prompt: 'p', activityState: 'done', firedAt: 3, enqueuedAt: 4, acknowledged: false },
			{ id: '3', alfaId: 'a', sessionId: 'x', title: 'X', prompt: 'p', activityState: 'done', firedAt: 5, enqueuedAt: 6, acknowledged: true }
		];
		const groups = pendingPingGroups(pings, [{ id: 'x', title: 'Live X' }]);
		assert.deepEqual(groups.map((group) => group.sessionId), ['y', 'x']);
		assert.equal(groups[1].title, 'Live X');
	});
});
