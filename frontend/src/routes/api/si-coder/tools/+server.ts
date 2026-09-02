import { json, type RequestHandler } from '@sveltejs/kit';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const response = await terminalGatewayFetch('/si-coder/tools');
	const payload = await response.json();
	return json(payload, { status: response.status });
};
