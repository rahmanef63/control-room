import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
	HISTORY_MAX_ENTRIES,
	clearHistoryForWorkspace,
	markHistoryClosed,
	normalizeHistory,
	removeHistoryEntries,
	shortenCwd,
	trimHistory,
	upsertHistoryEntry,
	type TerminalHistoryEntry
} from './history';
import type { TerminalSession } from './types';

function session(patch: Partial<TerminalSession> = {}): TerminalSession {
	return {
		id: 'alpha', profile: 'shell', title: 'alpha', command: 'bash', pid: 1,
		cwd: '/home/rahman/projects/control-room', rows: 24, cols: 80,
		status: 'running', created_at: 1, updated_at: 10, ...patch
	};
}

function entry(id: string, updatedAt: number, workspaceId = 'default'): TerminalHistoryEntry {
	return { id, profile: 'shell', title: id, cwd: '/tmp', workspaceId, updatedAt };
}

describe('terminal history helpers', () => {
	test('normalizes malformed storage and keeps valid entries', () => {
		assert.deepEqual(normalizeHistory(null), []);
		assert.deepEqual(normalizeHistory([null, {}, entry('ok', 1)]), [entry('ok', 1)]);
	});

	test('upsert preserves workspace and reopens a closed entry', () => {
		const old = { ...entry('alpha', 5, 'ws-a'), closedAt: 8 };
		const next = upsertHistoryEntry([old], session({ updated_at: 20 }));
		assert.equal(next[0].workspaceId, 'ws-a');
		assert.equal(next[0].closedAt, undefined);
		assert.equal(next[0].updatedAt, 20);
	});

	test('mark/remove/clear preserve unrelated workspace entries', () => {
		const base = [entry('a', 3, 'one'), entry('b', 2, 'two')];
		const closed = markHistoryClosed(base, ['a'], 99);
		assert.equal(closed.find((item) => item.id === 'a')?.closedAt, 99);
		assert.deepEqual(removeHistoryEntries(closed, ['a']).map((item) => item.id), ['b']);
		assert.deepEqual(clearHistoryForWorkspace(base, 'one').map((item) => item.id), ['b']);
	});

	test('history stays newest-first and bounded', () => {
		const many = Array.from({ length: HISTORY_MAX_ENTRIES + 5 }, (_, index) => entry(String(index), index));
		const trimmed = trimHistory(many);
		assert.equal(trimmed.length, HISTORY_MAX_ENTRIES);
		assert.equal(trimmed[0].updatedAt, HISTORY_MAX_ENTRIES + 4);
	});

	test('shortenCwd keeps the home shorthand used by the React drawer', () => {
		assert.equal(shortenCwd('/home/rahman/a/b/c', 4), '~/…/b/c');
		assert.equal(shortenCwd('', 20), '~');
	});
});
