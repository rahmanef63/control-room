import type { RequestHandler } from './$types';

import { proxyGatewayJson } from '$lib/server/proxy';
import { requireSession } from '$lib/server/require-session';

export const POST: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	return proxyGatewayJson(`/crons/${encodeURIComponent(event.params.id)}/run`, { method: 'POST' });
};
