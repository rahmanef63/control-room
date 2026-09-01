// Ported from frontend/app/api/terminals/[id]/stream/route.ts.
//
// IMPORTANT — this is the file the whole "WebSocket risk" in the migration
// plan was actually about, and it turned out simpler than first assessed:
// the BROWSER never opens a WebSocket. It opens a plain `EventSource` (SSE)
// to this route. This server-side handler is the only WebSocket *client* in
// the picture — it dials out to the agent's `/ws/terminals` endpoint with
// `ws` (a normal npm client, works the same under adapter-node as it did
// under Next's Node runtime) and re-emits each message as an SSE `data:`
// frame. No WebSocket *server*/upgrade handling is needed on this side at
// all, so the custom server.js originally flagged as required in the plan
// is NOT needed for this route.
//
// Auth note: unlike the other proxy routes (which attach
// `x-control-room-secret` via terminalGatewayFetch), the agent's terminal
// socket checks the session cookie directly (see
// agent/src/terminal/auth.ts#isAuthorizedTerminalSocket) — so this handler
// forwards the browser's `Cookie` header to the outbound WS handshake
// instead of the gateway secret. That asymmetry is intentional and ported
// as-is.
import WebSocketClient from 'ws';

import { buildGatewaySocketUrl } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;

	const id = event.params.id!;
	const cookieHeader = event.request.headers.get('cookie') ?? '';
	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const socket = new WebSocketClient(buildGatewaySocketUrl(id), {
				headers: cookieHeader ? { Cookie: cookieHeader } : undefined
			});
			let closed = false;

			const heartbeat = setInterval(() => {
				if (!closed) {
					controller.enqueue(encoder.encode(': keepalive\n\n'));
				}
			}, 15000);

			const close = () => {
				if (closed) return;
				closed = true;
				clearInterval(heartbeat);
				if (
					socket.readyState === WebSocketClient.OPEN ||
					socket.readyState === WebSocketClient.CONNECTING
				) {
					socket.close();
				}
				try {
					controller.close();
				} catch {
					// already closed by the consumer side — nothing to do.
				}
			};

			socket.on('message', (message) => {
				if (closed) return;
				// Backpressure: if the browser stalls, this stream's internal queue
				// grows unbounded. Past the cap, drop the stream so EventSource
				// auto-reconnects and re-bootstraps from the agent's bounded
				// session buffer instead of letting memory balloon.
				if ((controller.desiredSize ?? 0) < -2000) {
					close();
					return;
				}
				controller.enqueue(encoder.encode(`data: ${String(message)}\n\n`));
			});

			socket.on('error', (error) => {
				if (!closed) {
					controller.enqueue(
						encoder.encode(
							`event: error\ndata: ${JSON.stringify({
								message: error instanceof Error ? error.message : 'Terminal stream error'
							})}\n\n`
						)
					);
				}
				close();
			});

			socket.on('close', () => {
				close();
			});

			event.request.signal.addEventListener('abort', close);
		},
		cancel() {
			// no-op; request abort (above) closes the upstream socket.
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
