import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const response = await terminalGatewayFetch(`/state/${encodeURIComponent(event.params.key!)}`);
	const payload = await response.json();
	return json(payload, { status: response.status });
};

export const PUT: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;

	// SvelteKit's Web Request body remains readable after async auth checks, so
	// the Next 15.5 body-before-await workaround is deliberately not carried over.
	const body = await event.request.text();
	const response = await terminalGatewayFetch(`/state/${encodeURIComponent(event.params.key!)}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body
	});
	if (response.status === 204) return new Response(null, { status: 204 });
	const payload = await response.json();
	return json(payload, { status: response.status });
};
