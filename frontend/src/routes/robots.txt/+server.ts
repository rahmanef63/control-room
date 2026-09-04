import type { RequestHandler } from './$types';

const body = `User-agent: *
Allow: /landing
Disallow: /api/
Disallow: /login
Disallow: /view/

Sitemap: https://vps.rahmanef.com/sitemap.xml
`;

export const prerender = true;

export const GET: RequestHandler = () =>
	new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
