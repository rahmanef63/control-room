import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
	BACKUP_KEYS,
	applyBackupToStorage,
	buildBackupFromStorage,
	importBackupPayload,
	parseBackupText,
	workspaceStateForImport,
	type BackupPayload,
	type StorageLike
} from './backup';
import {
	FONT_SIZE_STORAGE_KEY,
	GRID_COLS_STORAGE_KEY,
	VIEW_MODE_STORAGE_KEY,
	WORKSPACES_STORAGE_KEY,
	WORKSPACE_ACTIVE_KEY,
	WORKSPACE_SESSION_MAP_KEY
} from './storage-keys';
import { APP_SETTINGS_STORAGE_KEY } from './types';
import { HISTORY_STORAGE_KEY } from './history';
import { TEMPLATES_STORAGE_KEY } from '$lib/features/templates/templates';

class MemoryStorage implements StorageLike {
	data = new Map<string, string>();
	getItem(key: string): string | null { return this.data.get(key) ?? null; }
	setItem(key: string, value: string): void { this.data.set(key, value); }
	removeItem(key: string): void { this.data.delete(key); }
}

function legacyPayload(data: Record<string, unknown>): BackupPayload {
	return { version: 1, exportedAt: 123, appName: 'vps-control-room', data };
}

const coreData = {
	[WORKSPACES_STORAGE_KEY]: [
		{ id: 'default', name: 'default', color: '#38bdf8', createdAt: 0 },
		{ id: 'ws_a', name: 'A', color: '#a855f7', createdAt: 1 }
	],
	[WORKSPACE_ACTIVE_KEY]: 'ws_a',
	[WORKSPACE_SESSION_MAP_KEY]: { terminal_1: 'ws_a' },
	[HISTORY_STORAGE_KEY]: [{ id: 'old', profile: 'shell', title: 'Old', cwd: '/tmp', updatedAt: 1 }],
	[APP_SETTINGS_STORAGE_KEY]: { notifications: { heartbeatGlow: false }, softKeyboard: { hideKeyboard: false, visibility: {} } },
	[TEMPLATES_STORAGE_KEY]: [{ id: 'tmpl', name: 'Saved', createdAt: 1, updatedAt: 1 }]
};

describe('backup helpers', () => {
	test('builds a version-1 backup and preserves React-compatible core keys plus Svelte preferences', () => {
		const storage = new MemoryStorage();
		storage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(coreData[WORKSPACES_STORAGE_KEY]));
		storage.setItem(WORKSPACE_ACTIVE_KEY, 'ws_a');
		storage.setItem(FONT_SIZE_STORAGE_KEY, JSON.stringify({ terminal_1: 15 }));
		storage.setItem(VIEW_MODE_STORAGE_KEY, 'grid');
		storage.setItem(GRID_COLS_STORAGE_KEY, '2');
		const backup = buildBackupFromStorage(storage, 99);
		assert.equal(backup.version, 1);
		assert.equal(backup.exportedAt, 99);
		assert.equal(backup.data[WORKSPACE_ACTIVE_KEY], 'ws_a');
		assert.deepEqual(backup.data[FONT_SIZE_STORAGE_KEY], { terminal_1: 15 });
		assert.equal(backup.data[VIEW_MODE_STORAGE_KEY], 'grid');
		assert.equal(backup.data[GRID_COLS_STORAGE_KEY], '2');
	});

	test('accepts a legacy version-1 payload and ignores unknown keys on apply', () => {
		const payload = parseBackupText(JSON.stringify(legacyPayload({ ...coreData, 'future.unknown': { keepOut: true } })));
		const storage = new MemoryStorage();
		const imported = applyBackupToStorage(storage, payload);
		assert(imported.includes(WORKSPACES_STORAGE_KEY));
		assert.equal(storage.getItem('future.unknown'), null);
		assert.equal(storage.getItem(WORKSPACE_ACTIVE_KEY), 'ws_a');
	});

	test('rejects malformed known values before clearing existing storage', () => {
		const storage = new MemoryStorage();
		storage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify([{ id: 'keep', name: 'Keep', createdAt: 1, updatedAt: 1 }]));
		const invalid = legacyPayload({ ...coreData, [VIEW_MODE_STORAGE_KEY]: 'mosaic' });
		assert.throws(() => applyBackupToStorage(storage, invalid), /Invalid terminal view mode/);
		assert.match(storage.getItem(TEMPLATES_STORAGE_KEY) ?? '', /keep/);
	});

	test('replace clears newer keys absent from an old backup while merge preserves them', () => {
		const replaceStorage = new MemoryStorage();
		replaceStorage.setItem(VIEW_MODE_STORAGE_KEY, 'grid');
		applyBackupToStorage(replaceStorage, legacyPayload(coreData), false);
		assert.equal(replaceStorage.getItem(VIEW_MODE_STORAGE_KEY), null);

		const mergeStorage = new MemoryStorage();
		mergeStorage.setItem(VIEW_MODE_STORAGE_KEY, 'grid');
		applyBackupToStorage(mergeStorage, legacyPayload(coreData), true);
		assert.equal(mergeStorage.getItem(VIEW_MODE_STORAGE_KEY), 'grid');
	});

	test('derives a safe authoritative workspace state and drops stale mappings', () => {
		const storage = new MemoryStorage();
		const payload = legacyPayload({
			[WORKSPACES_STORAGE_KEY]: [{ id: 'ws_only', name: 'Only', createdAt: 1 }],
			[WORKSPACE_ACTIVE_KEY]: 'missing',
			[WORKSPACE_SESSION_MAP_KEY]: { keep: 'ws_only', stale: 'missing', defaulted: 'default' }
		});
		const state = workspaceStateForImport(storage, payload, false);
		assert.deepEqual(state.workspaces.map((workspace) => workspace.id), ['default', 'ws_only']);
		assert.equal(state.activeId, 'default');
		assert.deepEqual(state.sessionMap, { keep: 'ws_only' });
	});

	test('rolls local state back when authoritative workspace sync fails', async () => {
		const storage = new MemoryStorage();
		storage.setItem(WORKSPACE_ACTIVE_KEY, 'before');
		const payload = legacyPayload(coreData);
		const fetcher = async () => new Response('nope', { status: 503 });
		await assert.rejects(() => importBackupPayload(payload, { storage, fetcher }), /Workspace backup sync failed/);
		assert.equal(storage.getItem(WORKSPACE_ACTIVE_KEY), 'before');
	});

	test('syncs the effective workspace state before returning a successful import', async () => {
		const storage = new MemoryStorage();
		let requestBody: unknown = null;
		let requestUrl = '';
		const fetcher: typeof fetch = async (input, init) => {
			requestUrl = String(input);
			requestBody = JSON.parse(String(init?.body));
			return new Response(null, { status: 204 });
		};
		const result = await importBackupPayload(legacyPayload(coreData), { storage, fetcher });
		assert.equal(requestUrl, '/api/state/workspaces');
		assert.deepEqual(requestBody, {
			workspaces: coreData[WORKSPACES_STORAGE_KEY],
			sessionMap: { terminal_1: 'ws_a' },
			activeId: 'ws_a'
		});
		assert(result.importedKeys.length >= 6);
	});

	test('backup key list stays unique', () => {
		assert.equal(new Set(BACKUP_KEYS).size, BACKUP_KEYS.length);
	});
});
