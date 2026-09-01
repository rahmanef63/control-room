import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { agentLaunchRequest, environmentLaunchRequest, profileLaunchRequest } from './launcher';

describe('terminal launcher requests', () => {
	test('base profile request preserves the selected profile', () => {
		assert.deepEqual(profileLaunchRequest('codex'), { profile: 'codex' });
	});

	test('environment request always opens a shell in that environment', () => {
		assert.deepEqual(environmentLaunchRequest('project-a'), {
			profile: 'shell',
			environmentId: 'project-a'
		});
	});

	test('agent request preserves regular/YOLO and active-dir flags', () => {
		assert.deepEqual(agentLaunchRequest('codex-ops', { useActiveDir: true }), {
			agentProfileId: 'codex-ops',
			useActiveDir: true
		});
		assert.deepEqual(agentLaunchRequest('codex-ops', { dangerouslyAllow: true, useActiveDir: false }), {
			agentProfileId: 'codex-ops',
			dangerouslyAllow: true,
			useActiveDir: false
		});
	});
});
