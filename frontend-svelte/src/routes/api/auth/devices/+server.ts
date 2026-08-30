import { json, type RequestHandler } from '@sveltejs/kit';

import { approveDevice, isValidDeviceId, listDevices, revokeDevice } from '$lib/server/device-store';
import { requireSession } from '$lib/server/require-session';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;
	const { approved, pending } = await listDevices();
	return json({ approved, pending });
};

export const POST: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;

	let body: { action?: string; deviceId?: string; label?: string };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { action, deviceId, label } = body;
	if (!isValidDeviceId(deviceId)) {
		return json({ error: 'Missing or invalid device id' }, { status: 400 });
	}

	if (action === 'approve') {
		await approveDevice(deviceId, typeof label === 'string' ? label : undefined);
	} else if (action === 'revoke') {
		await revokeDevice(deviceId);
	} else {
		return json({ error: 'action must be approve or revoke' }, { status: 400 });
	}

	const { approved, pending } = await listDevices();
	return json({ ok: true, approved, pending });
};
