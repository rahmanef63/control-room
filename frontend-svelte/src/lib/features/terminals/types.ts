// Mirrors packages/contracts/index.d.ts (the shared TS contract between
// agent, old Next proxy routes, and now this app) for the terminal slice
// only. Import the full contracts package instead once it's published for
// consumption outside the monorepo's `frontend/` — for now this is a
// hand-copied subset kept intentionally small.

export type TerminalProfile = 'shell' | 'codex' | 'claude' | 'gemini' | 'openclaw';

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
