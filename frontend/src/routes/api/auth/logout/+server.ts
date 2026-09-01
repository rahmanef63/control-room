import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.set('session', '', {
		httpOnly: true,
		sameSite: 'strict',
		path: '/',
		maxAge: 0
	});
	return json({ success: true });
};
