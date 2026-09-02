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
// The browser session is verified here, then the server-to-agent WebSocket
// authenticates with AGENT_GATEWAY_SECRET. The privileged agent never needs a
// browser cookie and can stay loopback-only.
import WebSocketClient from 'ws';

import { buildGatewaySocketHeaders, buildGatewaySocketUrl } from '$lib/server/gateway';
import { requireSession } from '$lib/server/require-session';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const denied = await requireSession(event);
	if (denied) return denied;

	const id = event.params.id!;
	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const socket = new WebSocketClient(buildGatewaySocketUrl(id), {
				headers: buildGatewaySocketHeaders(event.locals.requestId)
			});
			let closed = false;

			const heartbeat = setInterval(() => {
				void (async () => {
					if (closed) return;
					// Device revocation must terminate an already-open read stream too,
					// not only block the next mutating API call.
					if (await requireSession(event)) {
						close();
						return;
					}
					controller.enqueue(encoder.encode(': keepalive\n\n'));
				})();
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
