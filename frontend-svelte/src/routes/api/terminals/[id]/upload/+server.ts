import { json } from '@sveltejs/kit';

import { terminalGatewayFetch } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

import type { RequestHandler } from './$types';

// Proxy one raw-binary upload to the unchanged agent. Unlike the old Next.js
// handler, SvelteKit does not need the request-body-before-await workaround, so
// authenticate first and avoid reading a large body for an expired session.
export const POST: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;

	const name = event.url.searchParams.get('name') ?? 'upload.bin';
	const body = Buffer.from(await event.request.arrayBuffer());
	const response = await terminalGatewayFetch(
		`/terminals/${encodeURIComponent(event.params.id)}/upload?name=${encodeURIComponent(name)}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/octet-stream' },
			body
		}
	);
	const payload = await response.json();
	return json(payload, { status: response.status });
};
