import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { bindPaneAgent, clearPaneAgent, prunePaneAgents } from './pane-agent-overrides';

describe('pane agent overrides', () => {
	test('bind records the selected profile and timestamp without mutating input', () => {
		const current = { other: { agentProfileId: 'old', boundAt: 1 } };
		const next = bindPaneAgent(current, 'pane-a', 'agent-a', 42);
		assert.deepEqual(next['pane-a'], { agentProfileId: 'agent-a', boundAt: 42 });
		assert.equal('pane-a' in current, false);
	});

	test('clear removes only one binding and preserves identity on no-op', () => {
		const current = { pane: { agentProfileId: 'agent', boundAt: 1 } };
		assert.deepEqual(clearPaneAgent(current, 'pane'), {});
		assert.equal(clearPaneAgent(current, 'missing'), current);
	});

	test('prune mirrors React by keeping live session ids only', () => {
		const current = {
			live: { agentProfileId: 'agent-a', boundAt: 1 },
			stale: { agentProfileId: 'agent-b', boundAt: 2 }
		};
		assert.deepEqual(prunePaneAgents(current, ['live']), {
			live: { agentProfileId: 'agent-a', boundAt: 1 }
		});
		assert.equal(prunePaneAgents(current, ['live', 'stale']), current);
	});
});
