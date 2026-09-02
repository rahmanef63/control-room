import type { ConnectionState, TerminalSession } from '$lib/features/terminals/types';

export type ActivityState = 'idle' | 'working' | 'asking' | 'planning' | 'waiting' | 'done';
export type SessionVisualState = 'running' | 'working' | 'asking' | 'planning' | 'waiting' | 'done' | 'exited';

export interface TerminalTelemetry {
	connectionState: ConnectionState;
	rttMs: number | null;
	activityState: ActivityState;
	activityLabel: string;
	showActivity: boolean;
}

export const ACTIVITY_LABELS: Record<ActivityState, string> = {
	idle: 'Idle',
	working: 'Working…',
	asking: 'Asking confirmation',
	planning: 'Creating plan',
	waiting: 'Waiting for input',
	done: 'Done'
};

const ASKING_PATTERN =
	/(\?\s*$|\(y\/n\)|\[y\/n\]|\(yes\/no\)|\bpress enter\b|\bcontinue\?|\bare you sure\b|\bdo you want\b|\bshould i\b|\bconfirm\?|\bproceed\?)/i;
const PLANNING_PATTERN =
	/(\bplan:|## plan\b|here is (the|my) plan|let me plan|creating plan|i'?ll plan\b|planning step)/i;
// ANSI escape stripping intentionally targets ESC (U+001B).
// eslint-disable-next-line no-control-regex
const STRIP_ANSI = /\x1b\[[0-9;?]*[a-zA-Z]/g;

export function detectIdleActivity(buffer: string): ActivityState {
	if (!buffer) return 'waiting';
	const tail = buffer.replace(STRIP_ANSI, '').slice(-1500);
	if (PLANNING_PATTERN.test(tail)) return 'planning';
	if (ASKING_PATTERN.test(tail.slice(-300))) return 'asking';
	return 'waiting';
}

export function isAgentSession(session: TerminalSession): boolean {
	return session.profile !== 'shell' || Boolean(session.agent_profile_id) || Boolean(session.inner_agent);
}

export function updateRttEwma(previous: number | null, sampleMs: number, alpha = 0.3): number {
	const sample = Number.isFinite(sampleMs) ? Math.max(0, sampleMs) : 0;
	if (previous === null || !Number.isFinite(previous)) return sample;
	return previous * (1 - alpha) + sample * alpha;
}

export function resolveSessionVisualState(
	session: TerminalSession,
	activity: ActivityState | undefined
): SessionVisualState {
	if (session.status === 'exited') return 'exited';
	if (!isAgentSession(session)) return 'running';
	if (activity === 'working' || activity === 'planning' || activity === 'asking' || activity === 'waiting' || activity === 'done') {
		return activity;
	}
	return 'running';
}
