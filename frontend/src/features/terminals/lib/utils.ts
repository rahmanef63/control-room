import type { TerminalProfile } from '@/shared/types/contracts';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type ActivityState = 'idle' | 'working' | 'asking' | 'planning' | 'waiting' | 'done';

const ASKING_PATTERN =
  /(\?\s*$|\(y\/n\)|\[y\/n\]|\(yes\/no\)|\bpress enter\b|\bcontinue\?|\bare you sure\b|\bdo you want\b|\bshould i\b|\bconfirm\?|\bproceed\?)/i;

const PLANNING_PATTERN =
  /(\bplan:|## plan\b|here is (the|my) plan|let me plan|creating plan|i'?ll plan\b|planning step)/i;

const STRIP_ANSI = /\x1b\[[0-9;?]*[a-zA-Z]/g;

export function detectIdleActivity(buffer: string): ActivityState {
  if (!buffer) return 'waiting';
  const tail = buffer.replace(STRIP_ANSI, '').slice(-1500);
  if (PLANNING_PATTERN.test(tail)) return 'planning';
  if (ASKING_PATTERN.test(tail.slice(-300))) return 'asking';
  return 'waiting';
}

export const SESSION_STORAGE_KEY = 'vps-control-room.terminal-sessions';
export const ACTIVE_SESSION_KEY = 'vps-control-room.terminal-active';
export const FONT_SIZE_STORAGE_KEY = 'vps-control-room.terminal-font-sizes';
export const VIEW_MODE_STORAGE_KEY = 'vps-control-room.terminal-view-mode';
export const GRID_COLS_STORAGE_KEY = 'vps-control-room.terminal-grid-cols';
export const HISTORY_STORAGE_KEY = 'vps-control-room.terminal-history';
export const HISTORY_MAX_ENTRIES = 40;
export const WORKSPACES_STORAGE_KEY = 'vps-control-room.workspaces';
export const WORKSPACE_ACTIVE_KEY = 'vps-control-room.workspace-active';
export const WORKSPACE_SESSION_MAP_KEY = 'vps-control-room.workspace-session-map';
export const DEFAULT_WORKSPACE_ID = 'default';
export const DEFAULT_WORKSPACE_NAME = 'default';
export const APP_SETTINGS_STORAGE_KEY = 'vps-control-room.app-settings';
export const TEMPLATES_STORAGE_KEY = 'vps-control-room.templates';
export const ALFA_WATCHERS_STORAGE_KEY = 'control-room:alfa-watchers';
export const PANE_AGENT_OVERRIDES_STORAGE_KEY = 'control-room:pane-agent-overrides';

export const SOFT_KEYBOARD_KEYS = [
  { id: 'interrupt', label: 'Interrupt (Ctrl+C)' },
  { id: 'paste', label: 'Paste' },
  { id: 'copy', label: 'Copy' },
  { id: 'selectAll', label: 'Select all + copy' },
  { id: 'enter', label: 'Enter' },
  { id: 'clear', label: 'Clear' },
  { id: 'shiftTab', label: 'Shift+Tab' },
  { id: 'left', label: 'Left' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'right', label: 'Right' },
  { id: 'tab', label: 'Tab' },
  { id: 'ctrlHold', label: 'Ctrl hold' },
  { id: 'esc', label: 'Esc' },
] as const;

export type SoftKeyboardKey = (typeof SOFT_KEYBOARD_KEYS)[number]['id'];

export const DEFAULT_FONT_SIZE = 13;
export const MIN_FONT_SIZE = 9;
export const MAX_FONT_SIZE = 22;

// xterm.js holds every scrollback line as a packed Uint32Array (~12 bytes/cell),
// so per-terminal buffer memory scales linearly with this. Every session keeps a
// live Terminal even while hidden, so the cost is multiplied by pane count. The
// agent only replays ~250KB (~2k lines) on reconnect, so a larger client buffer
// can never be re-filled anyway — keep it modest.
export const TERMINAL_SCROLLBACK = 1500;

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
