import type { TerminalCreateRequest, TerminalProfile } from './types';

export type LauncherTab = 'base' | 'agents' | 'envs';

export function profileLaunchRequest(profile: TerminalProfile): TerminalCreateRequest {
	return { profile };
}

export function environmentLaunchRequest(environmentId: string): TerminalCreateRequest {
	return { profile: 'shell', environmentId };
}

export function agentLaunchRequest(
	agentProfileId: string,
	options: { dangerouslyAllow?: boolean; useActiveDir?: boolean } = {}
): TerminalCreateRequest {
	return { agentProfileId, ...options };
}
