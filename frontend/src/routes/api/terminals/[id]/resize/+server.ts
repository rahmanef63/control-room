import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

export const POST: RequestHandler = async (event) => {
	const body = await event.request.text();
	const denied = await requireSession(event);
	if (denied) return denied;
	const response = await terminalGatewayFetch(
		`/terminals/${encodeURIComponent(event.params.id!)}/resize`,
		{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
	);
	const payload = await response.json();
	return json(payload, { status: response.status });
};
