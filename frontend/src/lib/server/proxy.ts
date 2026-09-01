// Ported verbatim from
// frontend/src/features/terminals/server/gateway-proxy.ts.
import { json } from '@sveltejs/kit';

import { terminalGatewayFetch } from '$lib/server/gateway';

export async function proxyGatewayJson(path: string, init?: RequestInit): Promise<Response> {
	const response = await terminalGatewayFetch(path, init);
	const text = await response.text();
	if (!response.ok) {
		return json({ error: text || `Gateway returned ${response.status}` }, { status: response.status });
	}
	try {
		return json(text.length === 0 ? {} : JSON.parse(text), { status: response.status });
	} catch {
		return json({ error: 'Gateway returned non-JSON body', body: text }, { status: 502 });
	}
}
