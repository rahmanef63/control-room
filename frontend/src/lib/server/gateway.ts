// Ported verbatim from
// frontend/src/features/terminals/server/terminal-gateway.ts.
const TERMINAL_GATEWAY_URL = process.env.TERMINAL_GATEWAY_URL || 'http://127.0.0.1:4001';

function buildGatewayUrl(pathname: string): string {
	return `${TERMINAL_GATEWAY_URL}${pathname}`;
}

export async function terminalGatewayFetch(
	pathname: string,
	init: RequestInit = {},
	options: { authenticate?: boolean } = {}
): Promise<Response> {
	const { authenticate = true } = options;
	const headers = new Headers(init.headers);

	// Falls back to the login secret for backward-compat; set AGENT_GATEWAY_SECRET
	// to decouple the gateway bearer from the human login password.
	const gatewaySecret = process.env.AGENT_GATEWAY_SECRET ?? process.env.CONTROL_ROOM_SECRET;
	if (authenticate && gatewaySecret) {
		headers.set('x-control-room-secret', gatewaySecret);
	}

	return fetch(buildGatewayUrl(pathname), {
		...init,
		headers,
		cache: 'no-store'
	});
}

/** Build the ws:// / wss:// URL for the agent's terminal-output socket. */
export function buildGatewaySocketUrl(sessionId: string): string {
	const gateway = TERMINAL_GATEWAY_URL;
	const wsBase = gateway.startsWith('https://')
		? gateway.replace(/^https:/, 'wss:')
		: gateway.replace(/^http:/, 'ws:');
	return `${wsBase}/ws/terminals?sessionId=${encodeURIComponent(sessionId)}`;
}
