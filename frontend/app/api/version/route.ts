/** Always-fresh build identifier. The client polls this and triggers a
 *  reload when the value differs from the build it loaded with.
 *  Cache headers are explicit to defeat any intermediate proxy. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID || 'unknown';
  return Response.json(
    { buildId, deployedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
