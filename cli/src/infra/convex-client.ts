import { ConvexHttpClient } from 'convex/browser';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export async function createClient(): Promise<ConvexHttpClient> {
  const client = new ConvexHttpClient(getEnv('CONVEX_URL'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).setAdminAuth(getEnv('CONVEX_ADMIN_KEY'));
  return client;
}

export async function query<T>(
  client: ConvexHttpClient,
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (client as any).query(name, args)) as T;
}

export async function mutation<T>(
  client: ConvexHttpClient,
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (client as any).mutation(name, args)) as T;
}
