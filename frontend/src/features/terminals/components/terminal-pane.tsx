'use client';

import '@xterm/xterm/css/xterm.css';

import { startTransition, useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  Check,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  Clipboard,
  ClipboardPaste,
  Command,
  CornerDownLeft,
  Eraser,
  Link2,
  Loader2,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  Minus,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';

import type { RuntimeResolvedAgentProfile, TerminalSession } from '@/shared/types/contracts';
import { Button } from '@/components/ui/button';

import {
  clampFontSize,
  connectionBadgeClasses,
  DEFAULT_FONT_SIZE,
  getStreamUrl,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  shortenCwd,
  type ActivityState,
  type ConnectionState,
} from '@/features/terminals/lib/utils';
import { AgentInjectMenu } from '@/features/terminals/components/agent-inject-menu';
import { SkillsMenu } from '@/features/terminals/components/skills-menu';
import { FileExplorerDialog } from '@/features/terminals/components/file-explorer-dialog';

interface TerminalSocketEvent {
  type: 'bootstrap' | 'output' | 'status' | 'error' | 'pong';
  buffer?: string;
  data?: string;
  message?: string;
  session?: TerminalSession;
}

export interface FolderItem {
  label: string;
  path: string;
  kind: 'home' | 'env' | 'agent' | 'recent';
}

function quoteShellPath(path: string): string {
  if (path === '~' || /^~\/[\w@%+=:,./~-]*$/.test(path)) return path;
  if (/^[\w@%+=:,./~-]+$/.test(path)) return path;
  return `'${path.replace(/'/g, `'\\''`)}'`;
}

export function TerminalPane({
  session,
  active,
  onUpdate,
  onClose,
  fullscreen,
  onToggleFullscreen,
  fontSize,
  onFontSizeChange,
  onActivityChange,
  viewMode,
  onRequestFocus,
  agentProfiles,
  broadcast,
  onBroadcastInput,
}: {
  session: TerminalSession;
  active: boolean;
  onUpdate: (session: TerminalSession) => void;
  onClose: (id: string) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  fontSize: number;
  onFontSizeChange: (id: string, size: number) => void;
  onActivityChange: (id: string, state: ActivityState) => void;
  viewMode: 'single' | 'grid';
  onRequestFocus: (id: string) => void;
  agentProfiles: RuntimeResolvedAgentProfile[];
  broadcast: boolean;
  onBroadcastInput: (data: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const sessionRef = useRef(session);
  const isUnmountingRef = useRef(false);
  const lastOutputRef = useRef('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [ctrlHold, setCtrlHold] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title);
  const [renameBusy, setRenameBusy] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const broadcastRef = useRef(broadcast);
  const onBroadcastInputRef = useRef(onBroadcastInput);
  const [activityState, setActivityState] = useState<ActivityState>('idle');
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivityChangeRef = useRef(onActivityChange);
  const canSendInput = session.status === 'running';
  const locationLabel = shortenCwd(session.cwd);
  const isAgent = session.profile !== 'shell';
  const resolvedFontSize = clampFontSize(fontSize || DEFAULT_FONT_SIZE);

  useEffect(() => {
    onActivityChangeRef.current = onActivityChange;
  }, [onActivityChange]);

  useEffect(() => {
    broadcastRef.current = broadcast;
  }, [broadcast]);

  useEffect(() => {
    onBroadcastInputRef.current = onBroadcastInput;
  }, [onBroadcastInput]);

  useEffect(() => {
    onActivityChangeRef.current(session.id, activityState);
  }, [activityState, session.id]);

  function markWorking() {
    if (!isAgent) return;
    setActivityState('working');
    if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
    waitingTimerRef.current = setTimeout(() => {
      setActivityState((current) => (current === 'working' ? 'waiting' : current));
    }, 1400);
  }

  const focusTerminal = () => {
    terminalRef.current?.focus();
  };

  async function postAction(pathname: 'input' | 'resize', payload: Record<string, unknown>) {
    try {
      await fetch(`/api/terminals/${encodeURIComponent(session.id)}/${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      setError('Terminal request failed');
    }
  }

  function sendInput(data: string) {
    if (!canSendInput) return;
    void postAction('input', { data });
    focusTerminal();
  }

  function sendControlKey(key: string) {
    if (!/^[a-z]$/i.test(key)) return;
    sendInput(String.fromCharCode(key.toUpperCase().charCodeAt(0) & 0x1f));
  }

  function sendMobileKey(key: string) {
    if (ctrlHold && /^[a-z]$/i.test(key)) {
      sendControlKey(key);
      setCtrlHold(false);
      return;
    }

    sendInput(key);
  }

  function trackOutput(chunk: string) {
    if (!chunk) return;
    const next = `${lastOutputRef.current}${chunk}`;
    lastOutputRef.current = next.slice(-6000);
  }

  function startRename() {
    setRenameValue(session.title);
    setRenaming(true);
  }

  function cancelRename() {
    setRenaming(false);
    setRenameValue(session.title);
  }

  async function submitRename() {
    const next = renameValue.trim();
    if (!next || next === session.title) {
      cancelRename();
      return;
    }
    setRenameBusy(true);
    try {
      const response = await fetch(`/api/terminals/${encodeURIComponent(session.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      const payload = (await response.json()) as { session?: TerminalSession; error?: string };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error || 'Rename failed');
      }
      onUpdateRef.current({ ...payload.session, skills: payload.session.skills ?? [] });
      setRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setRenameBusy(false);
    }
  }

  async function pasteFromClipboard() {
    if (!canSendInput || !navigator?.clipboard?.readText) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sendInput(text);
      }
    } catch {
      setError('Clipboard read blocked');
    }
  }

  async function copyTerminalContent() {
    const terminal = terminalRef.current;
    if (!terminal || !navigator?.clipboard?.writeText) return;

    const selected = terminal.hasSelection() ? terminal.getSelection() : '';
    const text = selected || lastOutputRef.current;

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Clipboard write blocked');
    }
  }

  function clearTerminal() {
    terminalRef.current?.clear();
    sendControlKey('l');
  }

  function changeDir(path: string) {
    if (!canSendInput) return;
    sendInput(`cd ${quoteShellPath(path)}\r`);
  }

  function injectCommand(raw: string) {
    if (!canSendInput || !raw) return;
    sendInput(`${raw}\r`);
  }

  async function copyShareUrl() {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      setError('Clipboard unavailable');
      return;
    }
    try {
      const url = `${window.location.origin}/view/${encodeURIComponent(session.id)}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setError('Copy blocked');
    }
  }

  function scrollViewUp() {
    terminalRef.current?.scrollLines(-10);
  }

  function scrollViewBottom() {
    terminalRef.current?.scrollToBottom();
  }

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!renaming) {
      setRenameValue(session.title);
    }
  }, [session.title, renaming]);

  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => {
      const fitAddon = fitAddonRef.current;
      const term = terminalRef.current;
      const container = containerRef.current;
      if (!fitAddon || !term || !container) return;
      if (container.offsetParent === null) return;
      try {
        fitAddon.fit();
      } catch {
        return;
      }
      if (term.cols > 0 && term.rows > 0) {
        void postAction('resize', { cols: term.cols, rows: term.rows });
      }
      term.focus();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, session.id, fullscreen]);


  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: resolvedFontSize,
      lineHeight: 1.18,
      scrollback: 8000,
      theme: {
        background: '#08111f',
        foreground: '#d7e3f6',
        cursor: '#f8fafc',
        black: '#08111f',
        red: '#fb7185',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#f472b6',
        cyan: '#22d3ee',
        white: '#d7e3f6',
        brightBlack: '#334155',
        brightRed: '#fda4af',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#f9a8d4',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc',
      },
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    terminalRef.current = term;

    const resizeTerminal = () => {
      const fitAddon = fitAddonRef.current;
      const term = terminalRef.current;
      const container = containerRef.current;
      if (!fitAddon || !term || !container) return;
      if (container.offsetParent === null) return;
      try {
        fitAddon.fit();
      } catch {
        return;
      }
      if (term.cols > 0 && term.rows > 0) {
        void postAction('resize', { cols: term.cols, rows: term.rows });
      }
    };

    const connect = () => {
      if (isUnmountingRef.current) return;

      setConnectionState(reconnectAttemptsRef.current === 0 ? 'connecting' : 'reconnecting');

      const eventSource = new EventSource(getStreamUrl(session.id));
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnectionState('connected');
        setError(null);
        resizeTerminal();
      };

      eventSource.onmessage = (message) => {
        const payload = JSON.parse(message.data) as TerminalSocketEvent;

        switch (payload.type) {
          case 'bootstrap':
            term.reset();
            if (payload.buffer) {
              trackOutput(payload.buffer);
              term.write(payload.buffer);
              if (isAgent) setActivityState('waiting');
            }
            if (payload.session) {
              term.options.disableStdin = payload.session.status !== 'running';
              onUpdateRef.current(payload.session);
              if (payload.session.status === 'exited') setActivityState('done');
            }
            break;
          case 'output':
            if (payload.data) {
              trackOutput(payload.data);
              term.write(payload.data);
              markWorking();
            }
            break;
          case 'status':
            if (payload.session) {
              term.options.disableStdin = payload.session.status !== 'running';
              onUpdateRef.current(payload.session);
              if (payload.session.status === 'exited') {
                term.writeln('');
                term.writeln(
                  `\x1b[33m[session exited${payload.session.exit_code !== undefined ? ` code=${payload.session.exit_code}` : ''}]\x1b[0m`
                );
                setActivityState('done');
                if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
              }
            }
            break;
          case 'error':
            setError(payload.message ?? 'Terminal gateway error');
            break;
          case 'pong':
          default:
            break;
        }
      };

      eventSource.addEventListener('error', () => {
        eventSourceRef.current = null;

        if (isUnmountingRef.current) {
          return;
        }

        if (sessionRef.current.status === 'running') {
          reconnectAttemptsRef.current += 1;
          setConnectionState('reconnecting');
          setError('Stream dropped, reconnecting…');
        } else {
          setConnectionState('disconnected');
        }
      });
    };

    term.onData((data) => {
      if (broadcastRef.current) {
        onBroadcastInputRef.current(data);
        return;
      }
      void postAction('input', { data });
    });

    resizeObserverRef.current = new ResizeObserver(() => {
      startTransition(() => {
        resizeTerminal();
      });
    });
    resizeObserverRef.current.observe(containerRef.current);

    connect();

    return () => {
      isUnmountingRef.current = true;
      resizeObserverRef.current?.disconnect();
      eventSourceRef.current?.close();
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    if (term.options.fontSize === resolvedFontSize) return;
    term.options.fontSize = resolvedFontSize;
    const fitAddon = fitAddonRef.current;
    const container = containerRef.current;
    if (!fitAddon || !container || container.offsetParent === null) return;
    try {
      fitAddon.fit();
    } catch {
      return;
    }
    if (term.cols > 0 && term.rows > 0) {
      void postAction('resize', { cols: term.cols, rows: term.rows });
    }
  }, [resolvedFontSize]);

  function zoom(delta: number) {
    const next = clampFontSize(resolvedFontSize + delta);
    if (next !== resolvedFontSize) onFontSizeChange(session.id, next);
  }

  const activityLabel: Record<ActivityState, string> = {
    idle: 'Idle',
    working: 'Working…',
    waiting: 'Waiting for input',
    done: 'Done',
  };
  const showActivity = isAgent && (activityState !== 'idle' || session.status === 'exited');

  return (
    <article
      data-profile={session.profile}
      data-activity={showActivity ? activityState : undefined}
      data-view-mode={viewMode}
      className="terminal-pane-mobile"
    >
      <header className="terminal-pane-header">
        <div className="min-w-0 flex-1 space-y-1">
          {renaming ? (
            <div className="flex items-center gap-1.5">
              <input
                value={renameValue}
                autoFocus
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submitRename();
                  if (event.key === 'Escape') cancelRename();
                }}
                className="min-w-0 flex-1 rounded-md border border-border/80 bg-background/70 px-2 py-1 text-sm font-semibold text-foreground outline-none focus:border-sky-400/50"
                placeholder="Container name"
                maxLength={80}
                disabled={renameBusy}
              />
              <button
                type="button"
                onClick={() => void submitRename()}
                disabled={renameBusy}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 disabled:opacity-60"
                aria-label="Save name"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={cancelRename}
                disabled={renameBusy}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground disabled:opacity-60"
                aria-label="Cancel rename"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startRename}
              className="group flex min-w-0 max-w-full items-center gap-1.5 text-left"
              title="Rename terminal"
            >
              <h2 className="truncate text-sm font-semibold text-foreground">{session.title}</h2>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
          )}
          <p className="truncate font-mono text-[11px] text-muted-foreground" title={session.cwd}>
            {locationLabel}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="dashboard-chip" data-tone={session.profile === 'shell' ? undefined : 'accent'}>
              {session.profile}
            </span>
            {session.model ? (
              <span className="dashboard-chip" data-tone="accent">
                {session.model}
              </span>
            ) : null}
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${connectionBadgeClasses(
                connectionState
              )}`}
            >
              {connectionState}
            </span>
            {showActivity ? <ActivityChip state={activityState} label={activityLabel[activityState]} /> : null}
            <span className="hidden sm:inline">
              {session.cols}x{session.rows} · {resolvedFontSize}px
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExplorerOpen(true)}
            disabled={!canSendInput}
            className="pane-action-btn"
            title="Browse folders"
            aria-label="Browse folders"
          >
            <Search className="h-4 w-4" />
          </button>

          <AgentInjectMenu
            agentProfiles={agentProfiles}
            disabled={!canSendInput}
            onInject={injectCommand}
          />

          <SkillsMenu disabled={!canSendInput} onInject={injectCommand} />

          <button
            type="button"
            onClick={() => void copyShareUrl()}
            className="pane-action-btn"
            title={shareCopied ? 'Link copied' : 'Copy share link'}
            aria-label="Copy share link"
            data-tone={shareCopied ? 'accent' : undefined}
          >
            {shareCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          </button>

          <div className="pane-zoom-group" role="group" aria-label="Zoom">
            <button
              type="button"
              onClick={() => zoom(-1)}
              disabled={resolvedFontSize <= MIN_FONT_SIZE}
              className="pane-zoom-btn"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => zoom(1)}
              disabled={resolvedFontSize >= MAX_FONT_SIZE}
              className="pane-zoom-btn"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {viewMode === 'grid' ? (
            <button
              type="button"
              onClick={() => onRequestFocus(session.id)}
              className="pane-action-btn"
              title="Focus this terminal"
              aria-label="Focus this terminal"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="pane-action-btn"
              title={fullscreen ? 'Exit full screen' : 'Maximize terminal'}
              aria-label={fullscreen ? 'Exit full screen' : 'Maximize terminal'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}

          <Button
            onClick={() => onClose(session.id)}
            variant="outline"
            size="sm"
            className="h-9 rounded-full px-3 text-xs"
          >
            Close
          </Button>
        </div>
      </header>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
          {error}
        </div>
      ) : null}

      {broadcast ? (
        <div className="pane-broadcast-banner">Broadcast input on — typing fans out to every running pane.</div>
      ) : null}

      <FileExplorerDialog
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        onPick={(path) => changeDir(path)}
      />

      <div className="terminal-pane-screen" onClick={focusTerminal}>
        <div
          ref={containerRef}
          className="relative z-10 h-full w-full overflow-hidden rounded-[calc(var(--radius)+0.25rem)] border border-border/60 bg-[#101418]"
        />
      </div>

      <div className="terminal-pane-controls">
        <div className="mx-auto grid w-full max-w-2xl gap-1.5">
          <div className="grid grid-cols-7 gap-1.5">
            <Button
              type="button"
              title="Interrupt (Ctrl+C)"
              aria-label="Interrupt"
              onClick={() => sendControlKey('c')}
              disabled={!canSendInput}
              variant="outline"
              data-tone={canSendInput ? 'warning' : undefined}
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <Ban className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Paste"
              aria-label="Paste"
              onClick={() => void pasteFromClipboard()}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <ClipboardPaste className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Copy"
              aria-label="Copy"
              onClick={() => void copyTerminalContent()}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Enter"
              aria-label="Enter"
              onClick={() => sendInput('\r')}
              disabled={!canSendInput}
              variant="outline"
              data-tone="accent"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <CornerDownLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Clear"
              aria-label="Clear"
              onClick={clearTerminal}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Scroll up"
              aria-label="Scroll up"
              onClick={scrollViewUp}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <ChevronsUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Scroll bottom"
              aria-label="Scroll bottom"
              onClick={scrollViewBottom}
              variant="outline"
              data-tone="accent"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <ChevronsDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-8 gap-1.5">
            <Button
              type="button"
              title="Shift+Tab"
              aria-label="Shift tab"
              onClick={() => sendInput('\x1b[Z')}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2 text-[10px] font-semibold"
            >
              ⇤
            </Button>
            <Button
              type="button"
              title="Left"
              aria-label="Left"
              onClick={() => sendInput('\x1b[D')}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Up"
              aria-label="Up"
              onClick={() => sendInput('\x1b[A')}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Down"
              aria-label="Down"
              onClick={() => sendInput('\x1b[B')}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Right"
              aria-label="Right"
              onClick={() => sendInput('\x1b[C')}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Tab"
              aria-label="Tab"
              onClick={() => sendInput('\t')}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2 text-[10px] font-semibold"
            >
              ⇥
            </Button>
            <Button
              type="button"
              title={ctrlHold ? 'Ctrl hold active' : 'Enable ctrl hold'}
              aria-label="Ctrl hold"
              onClick={() => setCtrlHold((value) => !value)}
              disabled={!canSendInput}
              variant="outline"
              data-tone={ctrlHold ? 'accent' : undefined}
              className="dashboard-terminal-control h-11 rounded-xl px-2"
            >
              <Command className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Esc"
              aria-label="Escape"
              onClick={() => sendInput('\x1b')}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-11 rounded-xl px-2 text-[10px] font-semibold"
            >
              Esc
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ActivityChip({ state, label }: { state: ActivityState; label: string }) {
  return (
    <span className="activity-chip" data-state={state} title={label}>
      {state === 'working' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {state === 'waiting' ? <MessageCircleQuestion className="h-3 w-3" /> : null}
      {state === 'done' ? <CheckCircle2 className="h-3 w-3" /> : null}
      <span>{label}</span>
    </span>
  );
}
