import { TEMPLATES_STORAGE_KEY, normalizeTemplates } from '$lib/features/templates/templates';
import { APP_SETTINGS_STORAGE_KEY } from './types';
import { HISTORY_STORAGE_KEY, normalizeHistory } from './history';
import { PANE_AGENT_OVERRIDES_STORAGE_KEY } from './pane-agent-overrides';
import { SESSION_COLORS_STORAGE_KEY } from './session-colors';
import {
	FONT_SIZE_STORAGE_KEY,
	GRID_COLS_STORAGE_KEY,
	VIEW_MODE_STORAGE_KEY,
	WORKSPACES_STORAGE_KEY,
	WORKSPACE_ACTIVE_KEY,
	WORKSPACE_SESSION_MAP_KEY
} from './storage-keys';

const LEGACY_BACKUP_KEYS = [
	WORKSPACES_STORAGE_KEY,
	WORKSPACE_ACTIVE_KEY,
	WORKSPACE_SESSION_MAP_KEY,
	HISTORY_STORAGE_KEY,
	APP_SETTINGS_STORAGE_KEY,
	TEMPLATES_STORAGE_KEY
] as const;

/**
 * Version 1 stays compatible with the React backup payload. Svelte adds only
 * allowlisted local UI state; older files import cleanly and unknown keys are
 * ignored rather than written into localStorage.
 */
export const BACKUP_KEYS = [
	...LEGACY_BACKUP_KEYS,
	FONT_SIZE_STORAGE_KEY,
	VIEW_MODE_STORAGE_KEY,
	GRID_COLS_STORAGE_KEY,
	SESSION_COLORS_STORAGE_KEY,
	PANE_AGENT_OVERRIDES_STORAGE_KEY
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

export interface BackupPayload {
	version: 1;
	exportedAt: number;
	appName: string;
	data: Record<string, unknown>;
}

export interface WorkspaceBackupState {
	workspaces: Array<{ id: string; name: string; color?: string; createdAt: number }>;
	sessionMap: Record<string, string>;
	activeId: string;
}

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface ImportBackupOptions {
	merge?: boolean;
	storage?: StorageLike;
	fetcher?: typeof fetch;
}

const DEFAULT_WORKSPACE = {
	id: 'default',
	name: 'default',
	color: '#38bdf8',
	createdAt: 0
} as const;
const GRID_COL_VALUES = new Set(['auto', '1', '2', '3', '4']);
const WORKSPACE_KEYS = new Set<string>([
	WORKSPACES_STORAGE_KEY,
	WORKSPACE_ACTIVE_KEY,
	WORKSPACE_SESSION_MAP_KEY
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseStoredValue(raw: string | null): unknown {
	if (raw == null) return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}

function backupStoredValue(key: BackupKey, raw: string): unknown {
	// These keys are intentionally plain strings in localStorage. In particular,
	// JSON.parse('2') would turn the grid-column value into number 2 and make an
	// exported backup fail its own validator on re-import.
	if (key === WORKSPACE_ACTIVE_KEY || key === VIEW_MODE_STORAGE_KEY || key === GRID_COLS_STORAGE_KEY) {
		return raw;
	}
	return parseStoredValue(raw);
}

function validateStringRecord(value: unknown, label: string): void {
	if (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== 'string')) {
		throw new Error(`Invalid ${label} in backup`);
	}
}

function validateBackupValue(key: BackupKey, value: unknown): void {
	switch (key) {
		case WORKSPACES_STORAGE_KEY: {
			if (!Array.isArray(value)) throw new Error('Invalid workspaces in backup');
			for (const workspace of value) {
				if (
					!isRecord(workspace) ||
					typeof workspace.id !== 'string' ||
					!workspace.id ||
					typeof workspace.name !== 'string' ||
					!workspace.name ||
					typeof workspace.createdAt !== 'number' ||
					!Number.isFinite(workspace.createdAt) ||
					(workspace.color !== undefined && typeof workspace.color !== 'string')
				) {
					throw new Error('Invalid workspaces in backup');
				}
			}
			return;
		}
		case WORKSPACE_ACTIVE_KEY:
			if (typeof value !== 'string') throw new Error('Invalid active workspace in backup');
			return;
		case WORKSPACE_SESSION_MAP_KEY:
			validateStringRecord(value, 'workspace session map');
			return;
		case HISTORY_STORAGE_KEY:
			if (!Array.isArray(value) || normalizeHistory(value).length !== value.length) {
				throw new Error('Invalid terminal history in backup');
			}
			return;
		case TEMPLATES_STORAGE_KEY:
			if (!Array.isArray(value) || normalizeTemplates(value).length !== value.length) {
				throw new Error('Invalid templates in backup');
			}
			return;
		case APP_SETTINGS_STORAGE_KEY: {
			if (!isRecord(value)) throw new Error('Invalid app settings in backup');
			const notifications = value.notifications;
			if (notifications !== undefined) {
				if (!isRecord(notifications)) throw new Error('Invalid app settings in backup');
				if (notifications.heartbeatGlow !== undefined && typeof notifications.heartbeatGlow !== 'boolean') {
					throw new Error('Invalid app settings in backup');
				}
			}
			const keyboard = value.softKeyboard;
			if (keyboard !== undefined) {
				if (!isRecord(keyboard)) throw new Error('Invalid app settings in backup');
				if (keyboard.hideKeyboard !== undefined && typeof keyboard.hideKeyboard !== 'boolean') {
					throw new Error('Invalid app settings in backup');
				}
				if (keyboard.visibility !== undefined) {
					if (!isRecord(keyboard.visibility) || Object.values(keyboard.visibility).some((entry) => typeof entry !== 'boolean')) {
						throw new Error('Invalid app settings in backup');
					}
				}
			}
			return;
		}
		case FONT_SIZE_STORAGE_KEY:
			if (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
				throw new Error('Invalid terminal font sizes in backup');
			}
			return;
		case VIEW_MODE_STORAGE_KEY:
			if (value !== 'single' && value !== 'grid') throw new Error('Invalid terminal view mode in backup');
			return;
		case GRID_COLS_STORAGE_KEY:
			if (typeof value !== 'string' || !GRID_COL_VALUES.has(value)) throw new Error('Invalid grid columns in backup');
			return;
		case SESSION_COLORS_STORAGE_KEY:
			validateStringRecord(value, 'session colors');
			return;
		case PANE_AGENT_OVERRIDES_STORAGE_KEY:
			if (!isRecord(value)) throw new Error('Invalid pane agent bindings in backup');
			for (const binding of Object.values(value)) {
				if (
					!isRecord(binding) ||
					typeof binding.agentProfileId !== 'string' ||
					!binding.agentProfileId ||
					typeof binding.boundAt !== 'number' ||
					!Number.isFinite(binding.boundAt)
				) {
					throw new Error('Invalid pane agent bindings in backup');
				}
			}
			return;
	}
}

function validateBackupPayload(value: unknown): BackupPayload {
	if (!isRecord(value) || value.version !== 1 || !isRecord(value.data)) {
		throw new Error('Unsupported backup format');
	}
	for (const [key, entry] of Object.entries(value.data)) {
		if (!BACKUP_KEYS.includes(key as BackupKey)) continue;
		validateBackupValue(key as BackupKey, entry);
	}
	return value as unknown as BackupPayload;
}

export function parseBackupText(text: string): BackupPayload {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('Backup file is not valid JSON');
	}
	return validateBackupPayload(parsed);
}

export function buildBackupFromStorage(storage: StorageLike, now = Date.now()): BackupPayload {
	const data: Record<string, unknown> = {};
	for (const key of BACKUP_KEYS) {
		const raw = storage.getItem(key);
		if (raw == null) continue;
		data[key] = backupStoredValue(key, raw);
	}
	return { version: 1, exportedAt: now, appName: 'vps-control-room', data };
}

function buildBackup(): BackupPayload {
	if (typeof window === 'undefined') {
		return { version: 1, exportedAt: Date.now(), appName: 'vps-control-room', data: {} };
	}
	return buildBackupFromStorage(window.localStorage);
}

export function downloadBackup(): void {
	if (typeof window === 'undefined') return;
	const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	anchor.download = `vps-control-room-backup-${stamp}.json`;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

function backupValue(
	storage: StorageLike,
	data: Record<string, unknown>,
	key: BackupKey,
	merge: boolean
): unknown {
	if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
	const raw = storage.getItem(key);
	return merge && raw != null ? backupStoredValue(key, raw) : undefined;
}

export function workspaceStateForImport(
	storage: StorageLike,
	payload: BackupPayload,
	merge = false
): WorkspaceBackupState {
	const workspaceValue = backupValue(storage, payload.data, WORKSPACES_STORAGE_KEY, merge);
	let workspaces = Array.isArray(workspaceValue)
		? workspaceValue.map((entry) => ({ ...(entry as WorkspaceBackupState['workspaces'][number]) }))
		: [];
	if (!workspaces.some((workspace) => workspace.id === DEFAULT_WORKSPACE.id)) {
		workspaces = [{ ...DEFAULT_WORKSPACE }, ...workspaces];
	}
	if (workspaces.length === 0) workspaces = [{ ...DEFAULT_WORKSPACE }];

	const ids = new Set(workspaces.map((workspace) => workspace.id));
	const sessionValue = backupValue(storage, payload.data, WORKSPACE_SESSION_MAP_KEY, merge);
	const sessionMap: Record<string, string> = {};
	if (isRecord(sessionValue)) {
		for (const [sessionId, workspaceId] of Object.entries(sessionValue)) {
			if (typeof workspaceId === 'string' && ids.has(workspaceId) && workspaceId !== DEFAULT_WORKSPACE.id) {
				sessionMap[sessionId] = workspaceId;
			}
		}
	}
	const activeValue = backupValue(storage, payload.data, WORKSPACE_ACTIVE_KEY, merge);
	const activeId = typeof activeValue === 'string' && ids.has(activeValue) ? activeValue : DEFAULT_WORKSPACE.id;
	return { workspaces, sessionMap, activeId };
}

function snapshotStorage(storage: StorageLike): Map<BackupKey, string | null> {
	return new Map(BACKUP_KEYS.map((key) => [key, storage.getItem(key)]));
}

function restoreSnapshot(storage: StorageLike, snapshot: Map<BackupKey, string | null>): void {
	for (const [key, raw] of snapshot) {
		if (raw == null) storage.removeItem(key);
		else storage.setItem(key, raw);
	}
}

export function applyBackupToStorage(storage: StorageLike, payload: BackupPayload, merge = false): BackupKey[] {
	validateBackupPayload(payload);
	if (!merge) {
		for (const key of BACKUP_KEYS) storage.removeItem(key);
	}
	const imported: BackupKey[] = [];
	for (const [key, value] of Object.entries(payload.data)) {
		if (!BACKUP_KEYS.includes(key as BackupKey)) continue;
		const typedKey = key as BackupKey;
		validateBackupValue(typedKey, value);
		storage.setItem(typedKey, typeof value === 'string' ? value : JSON.stringify(value));
		imported.push(typedKey);
	}
	return imported;
}

async function syncWorkspaceState(state: WorkspaceBackupState, fetcher: typeof fetch): Promise<void> {
	const response = await fetcher('/api/state/workspaces', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(state)
	});
	if (!response.ok) throw new Error(`Workspace backup sync failed (${response.status})`);
}

export async function importBackupPayload(
	payload: BackupPayload,
	options: ImportBackupOptions = {}
): Promise<{ payload: BackupPayload; importedKeys: BackupKey[] }> {
	const storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
	if (!storage) throw new Error('Backup import requires a browser environment');
	validateBackupPayload(payload);
	const merge = options.merge ?? false;
	const snapshot = snapshotStorage(storage);
	const workspaceState = workspaceStateForImport(storage, payload, merge);
	const shouldSyncWorkspace = !merge || Object.keys(payload.data).some((key) => WORKSPACE_KEYS.has(key));

	try {
		const importedKeys = applyBackupToStorage(storage, payload, merge);
		if (shouldSyncWorkspace) {
			const fetcher = options.fetcher ?? fetch;
			await syncWorkspaceState(workspaceState, fetcher);
		}
		return { payload, importedKeys };
	} catch (error) {
		restoreSnapshot(storage, snapshot);
		throw error;
	}
}

async function importBackupFromFile(
	file: File,
	options: ImportBackupOptions = {}
): Promise<{ payload: BackupPayload; importedKeys: BackupKey[] }> {
	return importBackupPayload(parseBackupText(await file.text()), options);
}

export async function pickAndImportBackup(
	options: ImportBackupOptions = {}
): Promise<{ payload: BackupPayload; importedKeys: BackupKey[] } | null> {
	if (typeof window === 'undefined') return null;
	return await new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json,.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			try {
				resolve(await importBackupFromFile(file, options));
			} catch (error) {
				reject(error);
			}
		};
		input.click();
	});
}
