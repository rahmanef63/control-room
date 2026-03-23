import { terminalManager } from '@/lib/server/terminal-manager';

export const runtime = 'nodejs';

const encoder = new TextEncoder();

function encodeEvent(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = await resolveId(context);
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const unsubscribe = terminalManager.subscribe(id, (event) => {
          controller.enqueue(encodeEvent(event));
        });

        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        }, 15_000);

        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
        };

        controller.enqueue(
          encodeEvent({
            type: 'connected',
            id,
          })
        );
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return new Response('Terminal session not found', { status: 404 });
  }
}
