import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildPaneAgentCommand } from './pane-agent-command';
import type { RuntimeResolvedAgentProfile, TerminalProfile } from './types';

function profile(
	terminalProfile: TerminalProfile,
	launchCommand?: string
): RuntimeResolvedAgentProfile {
	return {
		id: `${terminalProfile}-ops`,
		label: terminalProfile,
		description: '',
		terminalProfile,
		model: '',
		skills: [],
		...(launchCommand ? { launchCommand } : {})
	};
}

describe('pane agent command', () => {
	test('regular uses launchCommand when configured, otherwise terminal profile', () => {
		assert.equal(buildPaneAgentCommand(profile('codex'), false), 'codex');
		assert.equal(buildPaneAgentCommand(profile('codex', 'codex --model gpt-5'), false), 'codex --model gpt-5');
	});

	test('bypass preserves the original per-profile flags', () => {
		assert.equal(buildPaneAgentCommand(profile('codex'), true), 'codex --yolo');
		assert.equal(buildPaneAgentCommand(profile('claude'), true), 'claude --dangerously-skip-permissions');
		assert.equal(buildPaneAgentCommand(profile('gemini'), true), 'gemini --yolo');
		assert.equal(buildPaneAgentCommand(profile('openclaw'), true), 'openclaw');
	});

	test('custom launch commands use the original generic bypass flag', () => {
		assert.equal(
			buildPaneAgentCommand(profile('codex', 'codex --model gpt-5'), true),
			'codex --model gpt-5 --dangerously-skip-permissions'
		);
	});
});
