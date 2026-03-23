import type { TerminalProfile } from '@/lib/types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export const SESSION_STORAGE_KEY = 'vps-control-room.terminal-sessions';

export function getStreamUrl(sessionId: string): string {
  return `/api/terminals/${encodeURIComponent(sessionId)}/stream`;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function connectionBadgeClasses(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    case 'reconnecting':
      return 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20';
    case 'connecting':
      return 'bg-sky-500/10 text-sky-200 border-sky-500/20';
    case 'disconnected':
    default:
      return 'bg-rose-500/10 text-rose-200 border-rose-500/20';
  }
}

export function profileAccent(profile: TerminalProfile): string {
  switch (profile) {
    case 'codex':
      return 'from-cyan-500/20 via-sky-500/10 to-transparent';
    case 'claude':
      return 'from-orange-500/20 via-amber-500/10 to-transparent';
    case 'gemini':
      return 'from-emerald-500/20 via-lime-500/10 to-transparent';
    case 'openclaw':
      return 'from-fuchsia-500/20 via-pink-500/10 to-transparent';
    case 'shell':
    default:
      return 'from-slate-100/10 via-slate-100/5 to-transparent';
  }
}
