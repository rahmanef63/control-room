import type { TerminalProfile } from '@/shared/types/contracts';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type ActivityState = 'idle' | 'working' | 'waiting' | 'done';

export const SESSION_STORAGE_KEY = 'vps-control-room.terminal-sessions';
export const ACTIVE_SESSION_KEY = 'vps-control-room.terminal-active';
export const FONT_SIZE_STORAGE_KEY = 'vps-control-room.terminal-font-sizes';
export const VIEW_MODE_STORAGE_KEY = 'vps-control-room.terminal-view-mode';
export const GRID_COLS_STORAGE_KEY = 'vps-control-room.terminal-grid-cols';

export const DEFAULT_FONT_SIZE = 13;
export const MIN_FONT_SIZE = 9;
export const MAX_FONT_SIZE = 22;

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(value)));
}

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

export function shortenCwd(cwd: string, maxLength = 42): string {
  if (!cwd) return '~';
  const home = cwd.replace(/^\/home\/[^/]+/, '~');
  if (home.length <= maxLength) return home;
  const parts = home.split('/');
  if (parts.length <= 3) return home;
  return `${parts[0]}/…/${parts.slice(-2).join('/')}`;
}
