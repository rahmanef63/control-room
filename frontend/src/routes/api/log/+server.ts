import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;

	const params = new URLSearchParams();
	for (const key of ['since', 'level', 'limit']) {
		const value = event.url.searchParams.get(key);
		if (value) params.set(key, value);
	}
	const suffix = params.size > 0 ? `?${params.toString()}` : '';
	const response = await terminalGatewayFetch(`/log${suffix}`);
	const payload = await response.json();
	return json(payload, { status: response.status });
};

export const DELETE: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;

	const response = await terminalGatewayFetch('/log', { method: 'DELETE' });
	const payload = await response.json();
	return json(payload, { status: response.status });
};
