<script lang="ts">
	// Svelte 5 runes port of the core of
	// frontend/src/features/terminals/hooks/use-pane-terminal.ts +
	// components/terminal-pane.tsx.
	//
	// Ported: xterm init (+fit +webgl), EventSource stream connect/parse
	// (bootstrap/output/status/error), keystroke → POST input, resize →
	// POST resize, reconnect-with-backoff.
	//
	// NOT ported yet (see README-MIGRATION.md backlog): file upload/drag-drop,
	// RTT latency measurement, activity/idle-state detection, cross-pane
	// broadcast input, in-place rename, pinch-zoom font sizing. The original
	// hook is 662 lines; this covers the part that makes a pane usable at
	// all, not the full feature set.
	import { onDestroy, onMount } from 'svelte';
	import { FitAddon } from '@xterm/addon-fit';
	import { WebglAddon } from '@xterm/addon-webgl';
	import { Terminal as XTerm } from '@xterm/xterm';
	import '@xterm/xterm/css/xterm.css';

	import {
		clampFontSize,
		DEFAULT_FONT_SIZE,
		getStreamUrl,
		TERMINAL_SCROLLBACK,
		type ConnectionState,
		type TerminalGatewayEvent,
		type TerminalSession
	} from '$lib/features/terminals/types';

	interface Props {
		session: TerminalSession;
		fontSize?: number;
		onUpdate?: (session: TerminalSession) => void;
	}

	let { session, fontSize = DEFAULT_FONT_SIZE, onUpdate }: Props = $props();

	let containerEl: HTMLDivElement;
	let term: XTerm | null = null;
	let fitAddon: FitAddon | null = null;
	let eventSource: EventSource | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let reconnectAttempts = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let destroyed = false;

	let connectionState = $state<ConnectionState>('connecting');
	let lastError = $state<string | null>(null);

	function tryLoadWebgl(t: XTerm): void {
		try {
			const addon = new WebglAddon();
			addon.onContextLoss(() => addon.dispose());
			t.loadAddon(addon);
		} catch {
			// No WebGL context available — DOM renderer stays in place.
		}
	}

	function postResize(cols: number, rows: number): void {
		void fetch(`/api/terminals/${encodeURIComponent(session.id)}/resize`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cols, rows })
		});
	}

	function resizeTerminal(): void {
		if (!fitAddon || !term) return;
		fitAddon.fit();
		postResize(term.cols, term.rows);
	}

	function connectStream(): void {
		if (destroyed || !term) return;
		eventSource?.close();
		connectionState = reconnectAttempts === 0 ? 'connecting' : 'reconnecting';

		const es = new EventSource(getStreamUrl(session.id));
		eventSource = es;

		es.onopen = () => {
			reconnectAttempts = 0;
			connectionState = 'connected';
			lastError = null;
			resizeTerminal();
		};

		// Only the "message" channel carries real gateway events — an SSE frame
		// the server sent as a bare `data:` line (no `event:` field). A frame
		// sent as `event: error` (see stream/+server.ts) never reaches this
		// handler at all: per the EventSource spec "error" is a reserved event
		// name, so the browser routes it to the connection-error path below
		// instead of delivering it as a MessageEvent with a readable `.data`.
		// That's why this switch's own 'error' case handles a *logical* error
		// the agent reported inside a normal data frame (contracts'
		// `TerminalGatewayEvent`), which is a different thing from a dropped
		// connection.
		es.onmessage = (ev) => {
			let parsed: TerminalGatewayEvent | null = null;
			try {
				parsed = JSON.parse(ev.data) as TerminalGatewayEvent;
			} catch {
				return;
			}
			if (!parsed || !term) return;
			switch (parsed.type) {
				case 'bootstrap':
					term.reset();
					term.write(parsed.buffer);
					term.options.disableStdin = parsed.session.status !== 'running';
					onUpdate?.(parsed.session);
					break;
				case 'output':
					term.write(parsed.data);
					break;
				case 'status':
					term.options.disableStdin = parsed.session.status !== 'running';
					onUpdate?.(parsed.session);
					if (parsed.session.status === 'exited') {
						term.writeln('');
						term.writeln(
							`\x1b[33m[session exited${parsed.session.exit_code !== undefined ? ` code=${parsed.session.exit_code}` : ''}]\x1b[0m`
						);
					}
					break;
				case 'error':
					lastError = parsed.message ?? 'Terminal gateway error';
					break;
				case 'pong':
					break;
			}
		};

		// Native connection-level failure (network drop, non-2xx, or the
		// server's `event: error` frame — see comment above `onmessage`).
		es.addEventListener('error', () => {
			es.close();
			if (eventSource === es) eventSource = null;
			if (destroyed) return;

			if (session.status === 'running') {
				reconnectAttempts += 1;
				connectionState = 'reconnecting';
				lastError = 'Stream dropped, reconnecting…';
				const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000);
				reconnectTimer = setTimeout(connectStream, delay);
			} else {
				connectionState = 'disconnected';
			}
		});
	}

	onMount(() => {
		term = new XTerm({
			scrollback: TERMINAL_SCROLLBACK,
			fontSize: clampFontSize(fontSize),
			fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace",
			cursorBlink: true,
			allowProposedApi: true,
			theme: {
				background: '#0b1220',
				foreground: '#e6ebf5'
			}
		});
		fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(containerEl);
		tryLoadWebgl(term);
		resizeTerminal();

		term.onData((data) => {
			if (session.status !== 'running') return;
			void fetch(`/api/terminals/${encodeURIComponent(session.id)}/input`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ data })
			});
		});

		resizeObserver = new ResizeObserver(() => resizeTerminal());
		resizeObserver.observe(containerEl);

		connectStream();
	});

	onDestroy(() => {
		destroyed = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		eventSource?.close();
		resizeObserver?.disconnect();
		term?.dispose();
	});

	// Re-render at the new size if the caller changes fontSize after mount.
	$effect(() => {
		if (term) term.options.fontSize = clampFontSize(fontSize);
	});
</script>

<div class="terminal-pane">
	<div class="terminal-pane__status" data-state={connectionState}>
		{connectionState}
	</div>
	{#if lastError}
		<div class="terminal-pane__error">{lastError}</div>
	{/if}
	<div class="terminal-pane__surface" bind:this={containerEl}></div>
</div>

<style>
	.terminal-pane {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: #0b1220;
		border-radius: var(--radius);
		overflow: hidden;
	}
	.terminal-pane__surface {
		flex: 1;
		min-height: 0;
		padding: 8px;
	}
	.terminal-pane__status {
		position: absolute;
		top: 6px;
		right: 10px;
		z-index: 2;
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--ink-muted);
	}
	.terminal-pane__status[data-state='connected'] {
		color: #4ade80;
	}
	.terminal-pane__status[data-state='reconnecting'] {
		color: var(--warning);
	}
	.terminal-pane__error {
		position: absolute;
		bottom: 8px;
		left: 8px;
		right: 8px;
		z-index: 2;
		background: rgba(248, 113, 113, 0.16);
		color: #fca5a5;
		border: 1px solid rgba(248, 113, 113, 0.3);
		border-radius: 8px;
		padding: 6px 10px;
		font-size: 12px;
	}
</style>
