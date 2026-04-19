'use client';

import '@xterm/xterm/css/xterm.css';

import { startTransition, useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

import type { TerminalSession } from '@/shared/types/contracts';
import { getStreamUrl } from '@/features/terminals/lib/utils';

interface SocketEvent {
  type: 'bootstrap' | 'output' | 'status' | 'error' | 'pong';
  buffer?: string;
  data?: string;
  message?: string;
  session?: TerminalSession;
}

export function ReadOnlyTerminalView({ id }: { id: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [title, setTitle] = useState<string>('Shared terminal');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      disableStdin: true,
      convertEol: true,
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.18,
      scrollback: 8000,
      theme: {
        background: '#08111f',
        foreground: '#d7e3f6',
        cursor: '#08111f',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    const observer = new ResizeObserver(() => {
      startTransition(() => {
        try {
          fitAddon.fit();
        } catch {
          // ignore
        }
      });
    });
    observer.observe(containerRef.current);

    const eventSource = new EventSource(getStreamUrl(id));
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (message) => {
      const payload = JSON.parse(message.data) as SocketEvent;
      switch (payload.type) {
        case 'bootstrap':
          term.reset();
          if (payload.buffer) term.write(payload.buffer);
          if (payload.session?.title) setTitle(payload.session.title);
          break;
        case 'output':
          if (payload.data) term.write(payload.data);
          break;
        case 'status':
          if (payload.session?.title) setTitle(payload.session.title);
          break;
        case 'error':
          setError(payload.message ?? 'Stream error');
          break;
        default:
          break;
      }
    };

    eventSource.addEventListener('error', () => {
      setConnected(false);
    });

    return () => {
      observer.disconnect();
      eventSource.close();
      term.dispose();
    };
  }, [id]);

  return (
    <article className="terminal-pane-mobile" data-view-mode="single">
      <header className="terminal-pane-header">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-[11px] text-muted-foreground">
            {connected ? 'Live · read-only' : 'Reconnecting…'}
          </p>
        </div>
      </header>
      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
          {error}
        </div>
      ) : null}
      <div className="terminal-pane-screen">
        <div
          ref={containerRef}
          className="relative z-10 h-full w-full overflow-hidden rounded-[calc(var(--radius)+0.25rem)] border border-border/60 bg-[#101418]"
        />
      </div>
    </article>
  );
}
