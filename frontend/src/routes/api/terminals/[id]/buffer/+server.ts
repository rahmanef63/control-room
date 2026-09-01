import type { RequestHandler } from './$types';

import { proxyGatewayJson } from '$lib/server/proxy';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const linesParam = event.url.searchParams.get('lines');
	const suffix = linesParam ? `?lines=${encodeURIComponent(linesParam)}` : '';
	return proxyGatewayJson(`/terminals/${encodeURIComponent(event.params.id!)}/buffer${suffix}`);
};
