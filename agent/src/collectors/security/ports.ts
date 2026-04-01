import { runSecurityCommand } from './shell.js';
import type { ListeningPort } from './types.js';

export async function collectListeningPorts(): Promise<ListeningPort[]> {
  const output = await runSecurityCommand('ss -tulpn 2>/dev/null');
  if (!output.trim()) return [];

  const lines = output.split('\n').slice(1);
  const ports: ListeningPort[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const netid = parts[0] ?? '';
    const localAddr = parts[4] ?? '';
    const processInfo = parts.slice(6).join(' ');

    const portMatch = localAddr.match(/:(\d+)$/);
    if (!portMatch) continue;

    const port = parseInt(portMatch[1] ?? '0', 10);
    if (port === 0) continue;

    const protocol =
      netid === 'tcp' || netid === 'tcp6'
        ? 'tcp'
        : netid === 'udp' || netid === 'udp6'
          ? 'udp'
          : netid;

    const procNameMatch = processInfo.match(/\(\("([^"]+)"/);
    const procName = procNameMatch?.[1] ?? 'unknown';

    const key = `${port}:${protocol}`;
    if (!seen.has(key)) {
      seen.add(key);
      ports.push({ port, protocol, process: procName });
    }
  }

  return ports.sort((a, b) => a.port - b.port);
}
