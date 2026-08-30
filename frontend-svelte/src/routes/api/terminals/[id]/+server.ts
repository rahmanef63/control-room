import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const response = await terminalGatewayFetch(`/terminals/${encodeURIComponent(event.params.id!)}`);
	const payload = await response.json();
	return json(payload, { status: response.status });
};

export const DELETE: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const response = await terminalGatewayFetch(`/terminals/${encodeURIComponent(event.params.id!)}`, {
		method: 'DELETE'
	});
	if (response.status === 204) return new Response(null, { status: 204 });
	const payload = await response.json();
	return json(payload, { status: response.status });
};

export const PATCH: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const body = await event.request.text();
	const response = await terminalGatewayFetch(`/terminals/${encodeURIComponent(event.params.id!)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body
	});
	const payload = await response.json();
	return json(payload, { status: response.status });
};
