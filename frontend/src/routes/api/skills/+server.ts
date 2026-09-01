import type { RequestHandler } from './$types';

import { proxyGatewayJson } from '$lib/server/proxy';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const cwd = event.url.searchParams.get('cwd');
	const suffix = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
	return proxyGatewayJson(`/skills${suffix}`);
};
