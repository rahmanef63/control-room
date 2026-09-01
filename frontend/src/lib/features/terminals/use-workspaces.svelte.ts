import { onMount } from 'svelte';

import { readLocal, writeLocal } from '$lib/local-storage';
import { WORKSPACES_STORAGE_KEY, WORKSPACE_ACTIVE_KEY, WORKSPACE_SESSION_MAP_KEY } from './storage-keys';

export const DEFAULT_WORKSPACE_ID = 'default';
export const DEFAULT_WORKSPACE_NAME = 'default';
const REMOTE_STATE_KEY = 'workspaces';
const REMOTE_DEBOUNCE_MS = 600;
const WORKSPACE_COLORS = ['#38bdf8', '#a855f7', '#f59e0b', '#34d399', '#fb7185', '#818cf8'];

export interface Workspace {
	id: string;
	name: string;
	color?: string;
	createdAt: number;
}

export type SessionWorkspaceMap = Record<string, string>;

interface RemoteWorkspaceState {
	workspaces: Workspace[];
	sessionMap: SessionWorkspaceMap;
	activeId: string;
}

function defaultWorkspace(): Workspace {
	return {
		id: DEFAULT_WORKSPACE_ID,
		name: DEFAULT_WORKSPACE_NAME,
		color: WORKSPACE_COLORS[0],
		createdAt: 0
	};
}

function normalizeWorkspaces(input: Workspace[]): Workspace[] {
	const valid = input.filter((workspace) => workspace?.id && workspace?.name);
	if (!valid.some((workspace) => workspace.id === DEFAULT_WORKSPACE_ID)) {
		return [defaultWorkspace(), ...valid];
	}
	return valid.length > 0 ? valid : [defaultWorkspace()];
}

function makeWorkspaceId(): string {
	return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickColor(existing: Workspace[]): string {
	const used = new Set(existing.map((workspace) => workspace.color).filter(Boolean));
	return (
		WORKSPACE_COLORS.find((color) => !used.has(color)) ??
		WORKSPACE_COLORS[existing.length % WORKSPACE_COLORS.length]
	);
}

async function fetchRemoteState(): Promise<RemoteWorkspaceState | null> {
	try {
		const response = await fetch(`/api/state/${REMOTE_STATE_KEY}`, { cache: 'no-store' });
		if (!response.ok) return null;
		const payload = (await response.json()) as { value?: RemoteWorkspaceState | null };
		return payload.value ?? null;
	} catch {
		return null;
	}
}

async function pushRemoteState(state: RemoteWorkspaceState): Promise<void> {
	try {
		await fetch(`/api/state/${REMOTE_STATE_KEY}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(state)
		});
	} catch {
		// localStorage remains the offline fallback.
	}
}

export function useWorkspaces() {
	let workspaces = $state<Workspace[]>([defaultWorkspace()]);
	let activeId = $state(DEFAULT_WORKSPACE_ID);
	let sessionMap = $state<SessionWorkspaceMap>({});
	let hydrated = $state(false);
	let remoteSaveTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		let cancelled = false;

		const storedWorkspaces = normalizeWorkspaces(readLocal<Workspace[]>(WORKSPACES_STORAGE_KEY, []));
		const storedMap = readLocal<SessionWorkspaceMap>(WORKSPACE_SESSION_MAP_KEY, {});
		const storedActive = window.localStorage.getItem(WORKSPACE_ACTIVE_KEY);

		workspaces = storedWorkspaces;
		sessionMap = storedMap;
		activeId =
			storedActive && storedWorkspaces.some((workspace) => workspace.id === storedActive)
				? storedActive
				: DEFAULT_WORKSPACE_ID;

		void fetchRemoteState().then((remote) => {
			if (cancelled) return;
			if (remote) {
				const remoteWorkspaces = normalizeWorkspaces(remote.workspaces ?? []);
				workspaces = remoteWorkspaces;
				sessionMap = remote.sessionMap ?? {};
				activeId = remoteWorkspaces.some((workspace) => workspace.id === remote.activeId)
					? remote.activeId
					: DEFAULT_WORKSPACE_ID;
			}
			hydrated = true;
		});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!hydrated) return;
		const state: RemoteWorkspaceState = { workspaces, sessionMap, activeId };
		writeLocal(WORKSPACES_STORAGE_KEY, workspaces);
		writeLocal(WORKSPACE_SESSION_MAP_KEY, sessionMap);
		if (typeof window !== 'undefined') window.localStorage.setItem(WORKSPACE_ACTIVE_KEY, activeId);

		if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
		remoteSaveTimer = setTimeout(() => void pushRemoteState(state), REMOTE_DEBOUNCE_MS);
		return () => {
			if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
		};
	});

	function setActive(id: string): void {
		if (workspaces.some((workspace) => workspace.id === id)) activeId = id;
	}

	function createWorkspace(name?: string): Workspace {
		const trimmed = name?.trim();
		const workspace: Workspace = {
			id: makeWorkspaceId(),
			name: trimmed || `workspace ${workspaces.length + 1}`,
			color: pickColor(workspaces),
			createdAt: Date.now()
		};
		workspaces = [...workspaces, workspace];
		activeId = workspace.id;
		return workspace;
	}

	function renameWorkspace(id: string, name: string): void {
		const trimmed = name.trim();
		if (!trimmed) return;
		workspaces = workspaces.map((workspace) =>
			workspace.id === id ? { ...workspace, name: trimmed } : workspace
		);
	}

	function deleteWorkspace(id: string): void {
		// Keep the default workspace as the stable home for unmapped/legacy sessions.
		if (id === DEFAULT_WORKSPACE_ID || workspaces.length <= 1) return;
		workspaces = workspaces.filter((workspace) => workspace.id !== id);
		const nextMap: SessionWorkspaceMap = {};
		for (const [sessionId, workspaceId] of Object.entries(sessionMap)) {
			if (workspaceId !== id) nextMap[sessionId] = workspaceId;
		}
		sessionMap = nextMap;
		if (activeId === id) activeId = DEFAULT_WORKSPACE_ID;
	}

	function assignSession(sessionId: string, workspaceId = activeId): void {
		if (!workspaces.some((workspace) => workspace.id === workspaceId)) return;
		if (workspaceId === DEFAULT_WORKSPACE_ID) {
			if (!(sessionId in sessionMap)) return;
			const next = { ...sessionMap };
			delete next[sessionId];
			sessionMap = next;
			return;
		}
		if (sessionMap[sessionId] !== workspaceId) {
			sessionMap = { ...sessionMap, [sessionId]: workspaceId };
		}
	}

	function unassignSession(sessionId: string): void {
		if (!(sessionId in sessionMap)) return;
		const next = { ...sessionMap };
		delete next[sessionId];
		sessionMap = next;
	}

	function resolveSessionWorkspace(sessionId: string): string {
		return sessionMap[sessionId] ?? DEFAULT_WORKSPACE_ID;
	}

	return {
		get workspaces() {
			return workspaces;
		},
		get activeId() {
			return activeId;
		},
		get sessionMap() {
			return sessionMap;
		},
		get hydrated() {
			return hydrated;
		},
		setActive,
		createWorkspace,
		renameWorkspace,
		deleteWorkspace,
		assignSession,
		unassignSession,
		resolveSessionWorkspace
	};
}
