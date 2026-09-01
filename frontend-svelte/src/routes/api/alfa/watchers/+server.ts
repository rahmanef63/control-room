import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { ALFA_DEFAULT_PROMPT, ALFA_PATROL_MODES, type AlfaPatrolMode } from '$lib/features/patrol/alfa';
import { listWatchers, upsertWatcher } from '$lib/server/alfa-watchers';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	return json({ watchers: await listWatchers() });
};

export const POST: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const body = await event.request.json().catch(() => null) as Record<string, unknown> | null;
	if (!body || typeof body.id !== 'string' || !body.id) {
		return json({ error: 'id is required' }, { status: 400 });
	}
	const mode =
		typeof body.mode === 'string' && (ALFA_PATROL_MODES as readonly string[]).includes(body.mode)
			? (body.mode as AlfaPatrolMode)
			: undefined;
	const watcher = await upsertWatcher({
		id: body.id,
		...(typeof body.label === 'string' ? { label: body.label } : {}),
		watchedSessionIds: Array.isArray(body.watchedSessionIds)
			? body.watchedSessionIds.filter((value): value is string => typeof value === 'string')
			: [],
		instructions:
			body.instructions && typeof body.instructions === 'object' && !Array.isArray(body.instructions)
				? Object.fromEntries(
						Object.entries(body.instructions).filter(
							(entry): entry is [string, string] => typeof entry[1] === 'string'
						)
					)
				: {},
		defaultInstruction:
			typeof body.defaultInstruction === 'string' ? body.defaultInstruction : ALFA_DEFAULT_PROMPT,
		...(mode ? { mode } : {}),
		...(typeof body.scopeWorkspaceId === 'string' ? { scopeWorkspaceId: body.scopeWorkspaceId } : {}),
		...(typeof body.createdAt === 'number' ? { createdAt: body.createdAt } : {}),
		...(typeof body.silenceThresholdMs === 'number' ? { silenceThresholdMs: body.silenceThresholdMs } : {})
	});
	return json({ watcher });
};
