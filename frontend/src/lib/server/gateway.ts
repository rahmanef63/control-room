import { randomUUID } from 'node:crypto';

const TERMINAL_GATEWAY_URL = process.env.TERMINAL_GATEWAY_URL || 'http://127.0.0.1:4001';

function buildGatewayUrl(pathname: string): string {
  return `${TERMINAL_GATEWAY_URL}${pathname}`;
}

function getGatewaySecret(): string | undefined {
  return process.env.AGENT_GATEWAY_SECRET ?? process.env.CONTROL_ROOM_SECRET;
}

export async function terminalGatewayFetch(
  pathname: string,
  init: RequestInit = {},
  options: { authenticate?: boolean; requestId?: string } = {}
): Promise<Response> {
  const { authenticate = true, requestId } = options;
  const headers = new Headers(init.headers);
  const gatewaySecret = getGatewaySecret();
  if (authenticate && gatewaySecret) headers.set('x-control-room-secret', gatewaySecret);
  headers.set('x-request-id', requestId || headers.get('x-request-id') || randomUUID());

  return fetch(buildGatewayUrl(pathname), {
    ...init,
    headers,
    cache: 'no-store'
  });
}

export function buildGatewaySocketUrl(sessionId: string): string {
  const gateway = TERMINAL_GATEWAY_URL;
  const wsBase = gateway.startsWith('https://')
    ? gateway.replace(/^https:/, 'wss:')
    : gateway.replace(/^http:/, 'ws:');
  return `${wsBase}/ws/terminals?sessionId=${encodeURIComponent(sessionId)}`;
}

export function buildGatewaySocketHeaders(requestId?: string): Record<string, string> {
  const headers: Record<string, string> = { 'x-request-id': requestId || randomUUID() };
  const secret = getGatewaySecret();
  if (secret) headers['x-control-room-secret'] = secret;
  return headers;
}
