const TERMINAL_GATEWAY_URL =
  process.env.TERMINAL_GATEWAY_URL || "http://127.0.0.1:4001";

function buildGatewayUrl(pathname: string): string {
  return `${TERMINAL_GATEWAY_URL}${pathname}`;
}

export async function terminalGatewayFetch(
  pathname: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (process.env.CONTROL_ROOM_SECRET) {
    headers.set("x-control-room-secret", process.env.CONTROL_ROOM_SECRET);
  }

  return fetch(buildGatewayUrl(pathname), {
    ...init,
    headers,
    cache: "no-store",
  });
}
