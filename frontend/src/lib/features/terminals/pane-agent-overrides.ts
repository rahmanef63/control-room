export const PANE_AGENT_OVERRIDES_STORAGE_KEY = 'control-room:pane-agent-overrides';

export interface PaneAgentOverride {
	agentProfileId: string;
	boundAt: number;
}

export type PaneAgentOverrides = Record<string, PaneAgentOverride>;

export function bindPaneAgent(
	current: PaneAgentOverrides,
	sessionId: string,
	agentProfileId: string,
	boundAt = Date.now()
): PaneAgentOverrides {
	return { ...current, [sessionId]: { agentProfileId, boundAt } };
}

export function clearPaneAgent(
	current: PaneAgentOverrides,
	sessionId: string
): PaneAgentOverrides {
	if (!(sessionId in current)) return current;
	const next = { ...current };
	delete next[sessionId];
	return next;
}

export function prunePaneAgents(
	current: PaneAgentOverrides,
	liveSessionIds: readonly string[]
): PaneAgentOverrides {
	const live = new Set(liveSessionIds);
	let changed = false;
	const next: PaneAgentOverrides = {};
	for (const [id, value] of Object.entries(current)) {
		if (live.has(id)) next[id] = value;
		else changed = true;
	}
	return changed ? next : current;
}
