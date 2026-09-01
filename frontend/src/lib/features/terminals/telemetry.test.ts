import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { TerminalSession } from './types';
import {
	detectIdleActivity,
	isAgentSession,
	resolveSessionVisualState,
	updateRttEwma
} from './telemetry';

function session(overrides: Partial<TerminalSession> = {}): TerminalSession {
	return {
		id: 's1',
		profile: 'shell',
		title: 'Shell',
		command: '/bin/bash',
		pid: 1,
		cwd: '/tmp',
		rows: 24,
		cols: 80,
		status: 'running',
		created_at: 1,
		updated_at: 1,
		...overrides
	};
}

describe('terminal telemetry helpers', () => {
	test('detectIdleActivity classifies confirmation and planning tails', () => {
		assert.equal(detectIdleActivity(''), 'waiting');
		assert.equal(detectIdleActivity('\u001b[32mapply these changes? (y/n)\u001b[0m'), 'asking');
		assert.equal(detectIdleActivity('Here is my plan:\n1. inspect\n2. patch'), 'planning');
		assert.equal(detectIdleActivity('normal terminal output'), 'waiting');
	});

	test('isAgentSession includes explicit profiles, bound profiles and detected inner agents', () => {
		assert.equal(isAgentSession(session()), false);
		assert.equal(isAgentSession(session({ profile: 'codex' })), true);
		assert.equal(isAgentSession(session({ agent_profile_id: 'dev' })), true);
		assert.equal(isAgentSession(session({ inner_agent: 'claude' })), true);
	});

	test('updateRttEwma seeds from first sample and smooths later samples', () => {
		assert.equal(updateRttEwma(null, 100), 100);
		assert.equal(updateRttEwma(100, 200), 130);
		assert.equal(updateRttEwma(100, -20), 70);
	});

	test('resolveSessionVisualState keeps shell simple and exposes agent activity', () => {
		assert.equal(resolveSessionVisualState(session(), 'working'), 'running');
		assert.equal(resolveSessionVisualState(session({ profile: 'codex' }), 'working'), 'working');
		assert.equal(resolveSessionVisualState(session({ inner_agent: 'gemini' }), 'asking'), 'asking');
		assert.equal(resolveSessionVisualState(session({ profile: 'codex', status: 'exited' }), 'done'), 'exited');
	});
});
