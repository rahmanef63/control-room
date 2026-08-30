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
	// Body read first — mirrors the original's ordering (a Next-specific body-
	// clone race under 15.5). SvelteKit's Request doesn't have that bug, but
	// keeping the same order is harmless and keeps this a faithful port.
	const body = await event.request.text();
	const denied = await requireSession(event);
	if (denied) return denied;
	const response = await terminalGatewayFetch(`/state/${encodeURIComponent(event.params.key!)}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body
	});
	if (response.status === 204) return new Response(null, { status: 204 });
	const payload = await response.json();
	return json(payload, { status: response.status });
};
