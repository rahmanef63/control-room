import { readLocal, writeLocal } from '$lib/local-storage';
import {
	PANE_AGENT_OVERRIDES_STORAGE_KEY,
	bindPaneAgent,
	clearPaneAgent,
	prunePaneAgents,
	type PaneAgentOverride,
	type PaneAgentOverrides
} from './pane-agent-overrides';

/** App-wide pane-agent binding SSOT, matching the original React localStorage hook. */
class PaneAgentOverridesState {
	overrides = $state<PaneAgentOverrides>({});
	hydrated = $state(false);

	init(): void {
		if (this.hydrated || typeof window === 'undefined') return;
		this.overrides = readLocal<PaneAgentOverrides>(PANE_AGENT_OVERRIDES_STORAGE_KEY, {});
		this.hydrated = true;
	}

	overrideOf(sessionId: string): PaneAgentOverride | undefined {
		return this.overrides[sessionId];
	}

	bind(sessionId: string, agentProfileId: string): void {
		this.#publish(bindPaneAgent(this.overrides, sessionId, agentProfileId));
	}

	clear(sessionId: string): void {
		this.#publish(clearPaneAgent(this.overrides, sessionId));
	}

	pruneTo(liveSessionIds: readonly string[]): void {
		this.#publish(prunePaneAgents(this.overrides, liveSessionIds));
	}

	#publish(next: PaneAgentOverrides): void {
		if (next === this.overrides) return;
		this.overrides = next;
		writeLocal(PANE_AGENT_OVERRIDES_STORAGE_KEY, next);
	}
}

export const paneAgentOverrides = new PaneAgentOverridesState();
