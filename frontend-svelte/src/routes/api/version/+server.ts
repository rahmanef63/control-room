import type { RequestHandler } from '@sveltejs/kit';

// Always-fresh build identifier. The client polls this and reloads when it
// differs from the build it loaded with. `BUILD_ID` is stamped by
// vite.config.ts the same way next.config.ts used to (see
// PUBLIC_BUILD_ID / VersionGuard notes in README-MIGRATION.md).
export const GET: RequestHandler = () => {
	const buildId = process.env.PUBLIC_BUILD_ID || 'unknown';
	return new Response(JSON.stringify({ buildId, deployedAt: new Date().toISOString() }), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
			Pragma: 'no-cache',
			Expires: '0'
		}
	});
};
