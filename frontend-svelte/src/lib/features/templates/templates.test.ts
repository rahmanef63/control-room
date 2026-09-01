import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
	createTemplateEntry,
	duplicateTemplateEntry,
	normalizeTemplates,
	pickTemplateColor,
	templateInputFromSession,
	templateInitialCommandInput,
	templateLaunchRequest,
	updateTemplateEntry,
	type TerminalTemplate
} from './templates';

const base: TerminalTemplate = {
	id: 'tmpl_a',
	name: 'Dev shell',
	color: '#38bdf8',
	profile: 'shell',
	cwd: '/srv/app',
	createdAt: 1,
	updatedAt: 1
};

describe('templates helpers', () => {
	test('normalizes only entries with string ids and rotates the original palette', () => {
		assert.deepEqual(normalizeTemplates([base, null, { name: 'bad' }]), [base]);
		assert.equal(pickTemplateColor([base]), '#a855f7');
	});

	test('create trims fields and preserves the original storage shape', () => {
		const created = createTemplateEntry([base], { name: '  Agent  ', description: ' desc ', profile: 'codex', cwd: ' /tmp/x ', initialCommand: ' npm test ', workspaceId: 'ws_1' }, 10, 'tmpl_b');
		assert.equal(created.name, 'Agent');
		assert.equal(created.description, 'desc');
		assert.equal(created.cwd, '/tmp/x');
		assert.equal(created.initialCommand, 'npm test');
		assert.equal(created.color, '#a855f7');
		assert.equal(created.createdAt, 10);
	});

	test('update and duplicate preserve identity semantics', () => {
		const updated = updateTemplateEntry([base], base.id, { name: 'Changed' }, 20);
		assert.equal(updated.updated?.name, 'Changed');
		assert.equal(updated.updated?.createdAt, 1);
		const duplicated = duplicateTemplateEntry(updated.templates, base.id, 30, 'tmpl_copy');
		assert.equal(duplicated.duplicate?.name, 'Changed (copy)');
		assert.equal(duplicated.duplicate?.id, 'tmpl_copy');
		assert.equal(duplicated.templates.length, 2);
	});

	test('launch request forwards only terminal creation fields', () => {
		assert.deepEqual(templateLaunchRequest({ ...base, profile: 'claude', agentProfileId: 'agent-1', environmentId: 'env-1', customTitle: 'Title', initialCommand: 'pwd' }), {
			profile: 'claude', agentProfileId: 'agent-1', environmentId: 'env-1', cwd: '/srv/app'
		});
	});

	test('initial command ends with a real carriage return, not literal backslash-r', () => {
		const input = templateInitialCommandInput({ ...base, initialCommand: 'echo ready' });
		assert.equal(input, 'echo ready\r');
		assert.equal(input?.charCodeAt(input.length - 1), 13);
		assert.equal(templateInitialCommandInput(base), null);
	});

	test('saving an active session preserves runtime bindings and workspace', () => {
		const input = templateInputFromSession({
			id: 's1', profile: 'shell', title: 'Ops', command: '/bin/bash', pid: 1, cwd: '/srv/ops', rows: 32, cols: 120, status: 'running', created_at: 1, updated_at: 2, agent_profile_id: 'agent-ops', environment_id: 'env-ops'
		}, 'ws_ops');
		assert.deepEqual(input, { name: 'Ops', profile: 'shell', agentProfileId: 'agent-ops', environmentId: 'env-ops', cwd: '/srv/ops', customTitle: 'Ops', workspaceId: 'ws_ops' });
	});
});
