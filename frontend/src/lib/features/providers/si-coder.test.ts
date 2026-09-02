import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chooseInitialSiCoderUser, providerStateTone, type SiCoderUsersResponse } from './si-coder';

const users = [{ name: 'first' }] as SiCoderUsersResponse['users'];

test('SI-Coder user selection prefers default, then current, then first user', () => {
	assert.equal(chooseInitialSiCoderUser({ defaultUser: 'default', currentUser: 'current', currentReason: '', users }, 'first'), 'first');
	assert.equal(chooseInitialSiCoderUser({ defaultUser: 'default', currentUser: 'current', currentReason: '', users }), 'default');
	assert.equal(chooseInitialSiCoderUser({ defaultUser: null, currentUser: 'current', currentReason: '', users }), 'current');
	assert.equal(chooseInitialSiCoderUser({ defaultUser: null, currentUser: null, currentReason: '', users }), 'first');
});

test('SI-Coder provider readiness maps to stable UI tones', () => {
	assert.equal(providerStateTone('ready'), 'ready');
	assert.equal(providerStateTone('incomplete'), 'warn');
	assert.equal(providerStateTone('invalid'), 'danger');
	assert.equal(providerStateTone('empty'), 'muted');
});

test('SI-Coder client loads the tool surface and unwraps tool results', async () => {
	const originalFetch = globalThis.fetch;
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		if (url === '/api/si-coder/tools') {
			return new Response(JSON.stringify({ installed: true, version: 'test', tools: [] }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		}
		return new Response(JSON.stringify({ ok: true, result: { users: [] } }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	}) as typeof fetch;
	try {
		const { loadSiCoderSurface, callSiCoderTool } = await import('./si-coder');
		const surface = await loadSiCoderSurface();
		assert.equal(surface.installed, true);
		assert.equal(surface.version, 'test');
		const result = await callSiCoderTool<{ users: unknown[] }>('sc.user.list');
		assert.deepEqual(result, { users: [] });
		assert.equal(calls[1].url, '/api/si-coder/tools/call');
		assert.equal(calls[1].init?.method, 'POST');
		assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { name: 'sc.user.list', arguments: {} });
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('SI-Coder client propagates safe tool errors without exposing a fallback value', async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async () => new Response(
		JSON.stringify({ ok: false, result: null, error: 'provider verification failed' }),
		{ status: 422, headers: { 'content-type': 'application/json' } }
	)) as typeof fetch;
	try {
		const { callSiCoderTool } = await import('./si-coder');
		await assert.rejects(() => callSiCoderTool('sc.user.provider.verify', { user: 'u' }), /provider verification failed/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
