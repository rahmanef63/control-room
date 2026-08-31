// Mirrors packages/contracts/index.d.ts (the shared TS contract between
// agent, old Next proxy routes, and now this app) for the terminal slice
// only. Import the full contracts package instead once it's published for
// consumption outside the monorepo's `frontend/` — for now this is a
// hand-copied subset kept intentionally small.

export type TerminalProfile = 'shell' | 'codex' | 'claude' | 'gemini' | 'openclaw';

export interface TerminalProfileDescriptor {
	profile: TerminalProfile;
	title: string;
	description: string;
}

export interface RuntimeEnvironmentSummary {
	id: string;
	label: string;
	description: string;
	cwd: string;
	envText: string;
	tags: string[];
	envVarCount: number;
	envKeys: string[];
}

export interface RuntimeResolvedAgentProfile {
	id: string;
	label: string;
	description: string;
	terminalProfile: TerminalProfile;
	model: string;
	environmentId?: string;
	environmentLabel?: string;
	skills: string[];
	launchCommand?: string;
}

export interface TerminalListResponse {
	profiles?: TerminalProfileDescriptor[];
	sessions?: TerminalSession[];
	environments?: RuntimeEnvironmentSummary[];
	agentProfiles?: RuntimeResolvedAgentProfile[];
}

export interface TerminalSession {
	id: string;
	profile: TerminalProfile;
	title: string;
	command: string;
	pid: number;
	cwd: string;
	rows: number;
	cols: number;
	status: 'running' | 'exited';
	created_at: number;
	updated_at: number;
	environment_id?: string;
	environment_label?: string;
	agent_profile_id?: string;
	model?: string;
	skills?: string[];
	inner_agent?: 'claude' | 'codex' | 'gemini' | 'openclaw' | null;
	exit_code?: number;
	exit_signal?: number;
}

export interface TerminalCreateRequest {
	profile?: TerminalProfile;
	environmentId?: string;
	agentProfileId?: string;
	dangerouslyAllow?: boolean;
	useActiveDir?: boolean;
	cwd?: string;
}

export type TerminalGatewayEvent =
	| { type: 'bootstrap'; buffer: string; session: TerminalSession }
	| { type: 'output'; sessionId: string; data: string }
	| { type: 'status'; session: TerminalSession }
	| { type: 'error'; message: string }
	| { type: 'pong'; ts: number };

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export const DEFAULT_FONT_SIZE = 13;
export const TERMINAL_SCROLLBACK = 1500;

export function clampFontSize(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
	return Math.min(24, Math.max(9, Math.round(value)));
}

export function getStreamUrl(sessionId: string): string {
	return `/api/terminals/${encodeURIComponent(sessionId)}/stream`;
}

// Added for ported feature slices. The rest of the original
// lib/utils.ts storage-key constants (SESSION_STORAGE_KEY, WORKSPACE_*,
// TEMPLATES_*, ALFA_WATCHERS_*) and its
// ActivityState/detectIdleActivity() are intentionally not copied here yet —
// they get ported alongside the feature that actually reads/writes them, to
// avoid dumping a pile of unused constants into this file.
export const APP_SETTINGS_STORAGE_KEY = 'vps-control-room.app-settings';

export const SOFT_KEYBOARD_KEYS = [
	{ id: 'interrupt', label: 'Interrupt (Ctrl+C)' },
	{ id: 'paste', label: 'Paste' },
	{ id: 'copy', label: 'Copy' },
	{ id: 'selectAll', label: 'Select all + copy' },
	{ id: 'enter', label: 'Enter' },
	{ id: 'clear', label: 'Clear' },
	{ id: 'shiftTab', label: 'Shift+Tab' },
	{ id: 'left', label: 'Left' },
	{ id: 'up', label: 'Up' },
	{ id: 'down', label: 'Down' },
	{ id: 'right', label: 'Right' },
	{ id: 'tab', label: 'Tab' },
	{ id: 'ctrlHold', label: 'Ctrl hold' },
	{ id: 'esc', label: 'Esc' }
] as const;

export type SoftKeyboardKey = (typeof SOFT_KEYBOARD_KEYS)[number]['id'];
