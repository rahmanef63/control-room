import { version } from '$app/environment';
import type { RequestHandler } from '@sveltejs/kit';

// Always-fresh deployment identity. This is the exact same deterministic value
// baked into the client and service worker by `kit.version.name`.
export const GET: RequestHandler = () => {
	return new Response(JSON.stringify({ buildId: version, deployedAt: new Date().toISOString() }), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
			Pragma: 'no-cache',
			Expires: '0'
		}
	});
};
