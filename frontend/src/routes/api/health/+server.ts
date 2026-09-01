import { json, type RequestHandler } from '@sveltejs/kit';

import { terminalGatewayFetch } from '$lib/server/gateway';

// Public, unauthenticated liveness probe only — listed in hooks.server.ts's
// PUBLIC_PATHS. Deliberately does not forward the gateway secret.
export const GET: RequestHandler = async () => {
	try {
		const response = await terminalGatewayFetch('/health', {}, { authenticate: false });
		const payload = (await response.json().catch(() => ({}))) as {
			status?: string;
			uptime?: number;
		};
		return json({ status: payload.status ?? 'ok', uptime: payload.uptime }, { status: response.status });
	} catch {
		return json({ status: 'unreachable' }, { status: 503 });
	}
};
