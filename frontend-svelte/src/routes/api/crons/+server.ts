import type { RequestHandler } from './$types';

import { proxyGatewayJson } from '$lib/server/proxy';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	return proxyGatewayJson('/crons');
};

export const POST: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const body = await event.request.text();
	return proxyGatewayJson('/crons', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body
	});
};
