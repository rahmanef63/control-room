import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { deleteWatcher } from '$lib/server/alfa-watchers';
import { requireSession } from '$lib/server/require-session';

export const DELETE: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const removed = await deleteWatcher(event.params.id!);
	if (!removed) return json({ error: 'Watcher not found' }, { status: 404 });
	return new Response(null, { status: 204 });
};
