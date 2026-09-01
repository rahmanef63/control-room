import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { cronEntryToForm, cronFormToInput, cronRunLabel, decodeCronInputData, emptyCronForm, encodeCronInputData, type CronEntry } from './crons';

const spawn: CronEntry = {
	id: 'cron_spawn',
	name: 'Build',
	cronExpr: '0 9 * * 1',
	enabled: true,
	action: { type: 'spawn', profile: 'codex', environmentId: 'env-1', cwd: '/srv/app', initialCommand: 'npm test' },
	createdAt: 1,
	updatedAt: 2
};

const send: CronEntry = {
	id: 'cron_send',
	name: 'Ping shell',
	cronExpr: '*/5 * * * *',
	enabled: false,
	action: { type: 'send_input', sessionId: 'session-1', data: 'echo hi\r' },
	createdAt: 1,
	updatedAt: 2
};

describe('cron helpers', () => {
	test('empty form matches the original React defaults', () => {
		assert.deepEqual(emptyCronForm(), {
			name: '', cronExpr: '*/5 * * * *', enabled: true, actionType: 'spawn', profile: 'shell',
			agentProfileId: '', environmentId: '', cwd: '', initialCommand: '', sessionId: '', data: ''
		});
	});

	test('spawn entries round-trip through the original form shape', () => {
		const form = cronEntryToForm(spawn);
		assert.equal(form.actionType, 'spawn');
		assert.equal(form.profile, 'codex');
		assert.equal(form.initialCommand, 'npm test');
		assert.deepEqual(cronFormToInput(form), {
			name: 'Build', cronExpr: '0 9 * * 1', enabled: true,
			action: { type: 'spawn', profile: 'codex', agentProfileId: undefined, environmentId: 'env-1', cwd: '/srv/app', initialCommand: 'npm test' }
		});
	});

	test('send_input preserves the exact data bytes', () => {
		const form = cronEntryToForm(send);
		assert.equal(form.actionType, 'send_input');
		assert.equal(form.data, 'echo hi\\r');
		const input = cronFormToInput(form);
		assert.deepEqual(input.action, { type: 'send_input', sessionId: 'session-1', data: 'echo hi\r' });
		assert.equal((input.action as { data: string }).data.charCodeAt(7), 13);
	});

	test('control-character escapes round-trip through the form', () => {
		const raw = 'a\rb\nc\t\\';
		assert.equal(encodeCronInputData(raw), 'a\\rb\\nc\\t\\\\');
		assert.equal(decodeCronInputData('a\\rb\\nc\\t\\\\'), raw);
	});

	test('run label reflects the persisted result', () => {
		assert.equal(cronRunLabel(send), 'Never run');
		assert.equal(cronRunLabel({ ...send, lastRunAt: 3, lastResult: { ok: true } }), 'Last run succeeded');
		assert.equal(cronRunLabel({ ...send, lastRunAt: 3, lastResult: { ok: false, message: 'oops' } }), 'oops');
	});
});
