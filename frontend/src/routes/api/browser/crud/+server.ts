import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

// Server-side proxy: forwards a CRUD step list to the agent's /browser/crud,
// injecting the gateway secret without exposing it to the browser.
export const POST: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;

	const body = await event.request.text();
	const response = await terminalGatewayFetch('/browser/crud', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body
	});
	const payload = await response.json().catch(() => ({ error: 'bad agent response' }));
	return json(payload, { status: response.status });
};
