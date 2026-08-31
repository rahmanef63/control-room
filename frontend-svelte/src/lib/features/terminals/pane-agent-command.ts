import type { RuntimeResolvedAgentProfile } from './types';

const BYPASS_FLAGS: Partial<Record<RuntimeResolvedAgentProfile['terminalProfile'], string>> = {
	codex: '--yolo',
	claude: '--dangerously-skip-permissions',
	gemini: '--yolo'
};

/** Preserve the React pane-ai-launch command semantics exactly. */
export function buildPaneAgentCommand(
	profile: RuntimeResolvedAgentProfile,
	bypass: boolean
): string {
	const base = profile.launchCommand || profile.terminalProfile;
	if (!bypass) return base;
	if (profile.launchCommand) return `${base} --dangerously-skip-permissions`;
	const flag = BYPASS_FLAGS[profile.terminalProfile];
	return flag ? `${base} ${flag}` : base;
}
