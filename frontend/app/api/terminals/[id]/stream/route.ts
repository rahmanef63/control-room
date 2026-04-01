import { NextRequest } from 'next/server';
import NodeWebSocket from 'ws';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

function buildAgentSocketUrl(sessionId: string): string {
  const gateway = process.env.TERMINAL_GATEWAY_URL || 'http://127.0.0.1:4001';
  const wsBase = gateway.startsWith('https://')
    ? gateway.replace(/^https:/, 'wss:')
    : gateway.replace(/^http:/, 'ws:');
  return `${wsBase}/ws/terminals?sessionId=${encodeURIComponent(sessionId)}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const id = await resolveId(context);
  const cookieHeader = request.headers.get('cookie') ?? '';
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const socket = new NodeWebSocket(buildAgentSocketUrl(id), {
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
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
          socket.readyState === NodeWebSocket.OPEN ||
          socket.readyState === NodeWebSocket.CONNECTING
        ) {
          socket.close();
        }
        controller.close();
      };

      socket.on('message', (message) => {
        if (!closed) {
          controller.enqueue(encoder.encode(`data: ${String(message)}\n\n`));
        }
      });

      socket.on('error', (error) => {
        if (!closed) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                message: error instanceof Error ? error.message : 'Terminal stream error',
              })}\n\n`
            )
          );
        }
        close();
      });

      socket.on('close', () => {
        close();
      });

      request.signal.addEventListener('abort', close);
    },
    cancel() {
      // no-op; request abort closes the upstream socket
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
