// Ported from frontend/src/shared/auth/require-session.ts, adapted to
// SvelteKit's RequestEvent instead of next/headers' cookies(). Same
// defense-in-depth rationale: hooks.server.ts already gates every
// non-public path, but the privileged proxy routes re-verify so a hooks
// bypass can't reach the agent.
import { json, type RequestEvent } from '@sveltejs/kit';

import { isApproved } from '$lib/server/device-store';
import { verifySession } from '$lib/server/session';

export async function requireSession(event: RequestEvent): Promise<Response | null> {
	const secret = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
	const cookie = event.cookies.get('session');
	const payload = cookie ? verifySession(cookie, secret) : null;
	const deviceOk = payload ? !payload.device_id || (await isApproved(payload.device_id)) : false;
	if (!payload || !deviceOk) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return null;
}
