// Types + fetch helpers backing devices-drawer.svelte. Ported from
// frontend/src/features/terminals/hooks/use-devices.ts, split so the plain
// data-fetching logic lives here and the reactive polling lives directly in
// the component with runes (see devices-drawer.svelte) — Svelte 5's
// convention is to keep $state close to where it's rendered rather than
// wrapping it in a custom-hook-shaped abstraction the way React needed to.
export interface ApprovedDevice {
	label: string;
	approvedAt: number;
	lastSeen?: number;
}

export interface PendingDevice {
	label: string;
	firstSeen: number;
	lastSeen: number;
	ip: string;
	attempts: number;
}

export interface DevicesResponse {
	approved?: Record<string, ApprovedDevice>;
	pending?: Record<string, PendingDevice>;
}

export async function fetchDevices(): Promise<DevicesResponse | null> {
	try {
		const res = await fetch('/api/auth/devices', { cache: 'no-store' });
		if (!res.ok) return null;
		return (await res.json()) as DevicesResponse;
	} catch {
		return null;
	}
}

export async function mutateDevice(
	action: 'approve' | 'revoke',
	deviceId: string,
	label?: string
): Promise<DevicesResponse | null> {
	try {
		const res = await fetch('/api/auth/devices', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, deviceId, label })
		});
		if (!res.ok) return null;
		return (await res.json()) as DevicesResponse;
	} catch {
		return null;
	}
}

export function relativeTime(ts: number): string {
	const diff = Date.now() - ts;
	const min = Math.round(diff / 60000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	return `${Math.round(hr / 24)}d ago`;
}
