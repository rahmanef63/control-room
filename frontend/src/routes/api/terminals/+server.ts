import { json, type RequestHandler } from '@sveltejs/kit';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const response = await terminalGatewayFetch('/terminals');
	const payload = await response.json();
	return json(payload, { status: response.status });
};

export const POST: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const body = await event.request.text();
	const response = await terminalGatewayFetch('/terminals', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body
	});
	const payload = await response.json();
	return json(payload, { status: response.status });
};
