import type { RequestHandler } from './$types';

import { proxyGatewayJson } from '$lib/server/proxy';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const requested = event.url.searchParams.get('path') ?? '~';
	return proxyGatewayJson(`/fs/list?path=${encodeURIComponent(requested)}`);
};
