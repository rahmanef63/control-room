import { json, type RequestHandler } from '@sveltejs/kit';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

// Authenticated host overview (full telemetry). hooks.server.ts gates globally;
// this privileged proxy re-verifies the session for defense in depth.
export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	try {
		const response = await terminalGatewayFetch('/health', {}, { authenticate: true });
		const payload = await response.json().catch(() => ({}));
		return json(payload, { status: response.status });
	} catch {
		return json({ status: 'unreachable' }, { status: 503 });
	}
};
