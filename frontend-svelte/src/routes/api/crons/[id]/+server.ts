import type { RequestHandler } from './$types';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { proxyGatewayJson } from '$lib/server/proxy';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	return proxyGatewayJson(`/crons/${encodeURIComponent(event.params.id)}`);
};

export const PATCH: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const body = await event.request.text();
	return proxyGatewayJson(`/crons/${encodeURIComponent(event.params.id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body
	});
};

export const DELETE: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const response = await terminalGatewayFetch(`/crons/${encodeURIComponent(event.params.id)}`, { method: 'DELETE' });
	if (response.status === 204) return new Response(null, { status: 204 });
	const text = await response.text();
	return new Response(text || JSON.stringify({ error: `Gateway returned ${response.status}` }), {
		status: response.status,
		headers: { 'Content-Type': 'application/json' }
	});
};
