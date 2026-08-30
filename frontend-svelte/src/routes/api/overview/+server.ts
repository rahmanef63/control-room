import { json, type RequestHandler } from '@sveltejs/kit';

import { terminalGatewayFetch } from '$lib/server/gateway';

// Authenticated host overview (full telemetry). hooks.server.ts already gates
// every non-public path behind a valid session.
export const GET: RequestHandler = async () => {
	try {
		const response = await terminalGatewayFetch('/health', {}, { authenticate: true });
		const payload = await response.json().catch(() => ({}));
		return json(payload, { status: response.status });
	} catch {
		return json({ status: 'unreachable' }, { status: 503 });
	}
};
