<script lang="ts">
	// Svelte 5 runes port of the core of
	// frontend/src/features/terminals/hooks/use-pane-terminal.ts +
	// components/terminal-pane.tsx.
	//
	// Ported: xterm init (+fit +webgl), EventSource stream connect/parse
	// (bootstrap/output/status/error), keystroke → POST input, resize →
	// POST resize, reconnect-with-backoff.
	//
	// Ported in the continuation slice: raw-binary upload proxy, file drag/drop,
	// pasted images, 25 MiB client guard, and safe shell-path insertion.
	// Ported in the telemetry slice: input RTT EWMA and agent activity detection
	// (`working` -> `planning`/`asking`/`waiting` after quiet output). Two-finger
	// pinch zoom writes through the same persisted per-session font preference as
	// pane chrome. Cross-pane keyboard
	// broadcast is delegated to the page-level SSOT through `onData`. The original
	// hook is 662 lines; this covers the part that makes a pane usable at
	// all, not the full feature set.
	import { onDestroy, onMount } from 'svelte';
	import { Loader2, UploadCloud } from 'lucide-svelte';
	import { FitAddon } from '@xterm/addon-fit';
	import { WebglAddon } from '@xterm/addon-webgl';
	import { Terminal as XTerm } from '@xterm/xterm';
	import '@xterm/xterm/css/xterm.css';

	import { filesFromDrop, partitionBySize, quoteShellPath } from '$lib/features/terminals/upload';
	import { OrderedTerminalInputQueue } from '$lib/features/terminals/input-queue';
	import { fontSizeForPinch, touchDistance } from '$lib/features/terminals/pinch-zoom';
	import {
		ACTIVITY_LABELS,
		detectIdleActivity,
		isAgentSession,
		updateRttEwma,
		type ActivityState,
		type TerminalTelemetry
	} from '$lib/features/terminals/telemetry';
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
		active?: boolean;
		fontSize?: number;
		onUpdate?: (session: TerminalSession) => void;
		onTelemetry?: (sessionId: string, telemetry: TerminalTelemetry) => void;
		onFontSizeChange?: (sessionId: string, size: number) => void;
		/** Return true when the keystroke was handled by a parent fan-out. */
		onData?: (sourceId: string, data: string) => boolean;
	}

	let {
		session,
		active = true,
		fontSize = DEFAULT_FONT_SIZE,
		onUpdate,
		onTelemetry,
		onFontSizeChange,
		onData
	}: Props = $props();

	let containerEl: HTMLDivElement;
	let term: XTerm | null = null;
	let fitAddon: FitAddon | null = null;
	let eventSource: EventSource | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let reconnectAttempts = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let waitingTimer: ReturnType<typeof setTimeout> | null = null;
	let destroyed = false;
	let mounted = false;
	let started = false;
	const directInputQueue = new OrderedTerminalInputQueue(async (_id, data) => postInput(data));

	let connectionState = $state<ConnectionState>('connecting');
	let rttEwma: number | null = null;
	let rttLastFlush = 0;
	let rttMs = $state<number | null>(null);
	let activityState = $state<ActivityState>('idle');
	let lastOutput = '';
	let lastError = $state<string | null>(null);
	let dragOver = $state(false);
	let uploading = $state(false);
	let canSendInput = $derived(session.status === 'running');
	let isAgent = $derived(isAgentSession(session));
	let showActivity = $derived(isAgent && (activityState !== 'idle' || session.status === 'exited'));
	let activityLabel = $derived(ACTIVITY_LABELS[activityState]);

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

	async function postInput(data: string): Promise<void> {
		const startedAt = performance.now();
		try {
			const response = await fetch(`/api/terminals/${encodeURIComponent(session.id)}/input`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ data })
			});
			if (!response.ok) throw new Error('Terminal input failed');

			const now = performance.now();
			rttEwma = updateRttEwma(rttEwma, now - startedAt);
			if (rttMs === null || now - rttLastFlush > 500) {
				rttLastFlush = now;
				rttMs = Math.round(rttEwma);
			}
		} catch {
			lastError = 'Terminal request failed';
		}
	}

	function trackOutput(chunk: string): void {
		if (!chunk) return;
		lastOutput = `${lastOutput}${chunk}`.slice(-6000);
	}

	function markWorking(): void {
		if (!isAgent) return;
		activityState = 'working';
		if (waitingTimer) clearTimeout(waitingTimer);
		waitingTimer = setTimeout(() => {
			if (activityState === 'working') activityState = detectIdleActivity(lastOutput);
		}, 1400);
	}

	function sendInput(data: string): void {
		if (!canSendInput) return;
		directInputQueue.enqueue(session.id, data);
		term?.focus();
	}

	async function uploadFiles(rawFiles: File[]): Promise<void> {
		if (!canSendInput || rawFiles.length === 0) return;
		lastError = null;

		const { ok: files, tooBig } = partitionBySize(rawFiles);
		if (tooBig.length > 0) {
			lastError = `Too big (max 25 MiB): ${tooBig.map((file) => file.name).join(', ')}`;
		}
		if (files.length === 0) return;

		uploading = true;
		try {
			const paths: string[] = [];
			for (const file of files) {
				try {
					const response = await fetch(
						`/api/terminals/${encodeURIComponent(session.id)}/upload?name=${encodeURIComponent(file.name)}`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/octet-stream' },
							body: file
						}
					);
					const payload = (await response.json().catch(() => ({}))) as {
						path?: string;
						error?: string;
					};
					if (!response.ok || !payload.path) {
						lastError = payload.error ?? `Upload failed: ${file.name}`;
						continue;
					}
					paths.push(payload.path);
				} catch {
					lastError = `Upload failed: ${file.name}`;
				}
			}

			if (paths.length > 0) sendInput(`${paths.map(quoteShellPath).join(' ')} `);
		} finally {
			uploading = false;
		}
	}

	function handleDrop(dataTransfer: DataTransfer): void {
		const { files, skippedDirs } = filesFromDrop(dataTransfer);
		if (skippedDirs.length > 0) {
			lastError = `Folders not supported: ${skippedDirs.join(', ')}`;
		}
		if (files.length > 0) void uploadFiles(files);
	}

	function handlePaste(data: DataTransfer | null): boolean {
		if (!data || !canSendInput) return false;
		const images: File[] = [];
		for (const item of Array.from(data.items)) {
			if (item.kind === 'file' && item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) images.push(file);
			}
		}
		if (images.length === 0) return false;
		void uploadFiles(images);
		return true;
	}

	function resizeTerminal(): void {
		if (!fitAddon || !term) return;
		fitAddon.fit();
		postResize(term.cols, term.rows);
	}

	function pinchZoomAttachment(node: HTMLElement) {
		let startDistance = 0;
		let startFontSize = resolvedFontSize;
		let lastAppliedSize = resolvedFontSize;

		const reset = () => {
			startDistance = 0;
		};

		const start = (event: TouchEvent) => {
			if (!onFontSizeChange || event.touches.length !== 2) {
				reset();
				return;
			}
			startDistance = touchDistance(event.touches[0], event.touches[1]);
			startFontSize = resolvedFontSize;
			lastAppliedSize = resolvedFontSize;
			if (startDistance > 0) event.preventDefault();
		};

		const move = (event: TouchEvent) => {
			if (!onFontSizeChange || startDistance <= 0 || event.touches.length !== 2) return;
			event.preventDefault();
			const next = fontSizeForPinch(
				startFontSize,
				startDistance,
				touchDistance(event.touches[0], event.touches[1])
			);
			if (next === lastAppliedSize) return;
			lastAppliedSize = next;
			onFontSizeChange(session.id, next);
		};

		const end = (event: TouchEvent) => {
			if (event.touches.length < 2) reset();
		};

		node.addEventListener('touchstart', start, { passive: false });
		node.addEventListener('touchmove', move, { passive: false });
		node.addEventListener('touchend', end);
		node.addEventListener('touchcancel', reset);
		return () => {
			node.removeEventListener('touchstart', start);
			node.removeEventListener('touchmove', move);
			node.removeEventListener('touchend', end);
			node.removeEventListener('touchcancel', reset);
		};
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
					trackOutput(parsed.buffer);
					term.write(parsed.buffer);
					term.options.disableStdin = parsed.session.status !== 'running';
					onUpdate?.(parsed.session);
					if (parsed.session.status === 'exited') activityState = 'done';
					else if (isAgentSession(parsed.session) && parsed.buffer) activityState = 'waiting';
					break;
				case 'output':
					trackOutput(parsed.data);
					term.write(parsed.data);
					markWorking();
					break;
				case 'status':
					term.options.disableStdin = parsed.session.status !== 'running';
					onUpdate?.(parsed.session);
					if (parsed.session.status === 'exited') {
						activityState = 'done';
						if (waitingTimer) clearTimeout(waitingTimer);
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

	function startTerminal(): void {
		if (!mounted || started || !containerEl) return;
		started = true;
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
			if (onData?.(session.id, data)) {
				term?.focus();
				return;
			}
			sendInput(data);
		});

		resizeObserver = new ResizeObserver(() => resizeTerminal());
		resizeObserver.observe(containerEl);

		connectStream();
	}

	onMount(() => {
		mounted = true;
		if (active) startTerminal();
	});

	onDestroy(() => {
		destroyed = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		if (waitingTimer) clearTimeout(waitingTimer);
		eventSource?.close();
		resizeObserver?.disconnect();
		term?.dispose();
	});

	// Defer heavy xterm/WebGL/SSE initialization until the pane is first shown.
	// Once armed it stays alive across workspace/view switches, preserving scrollback.
	$effect(() => {
		if (active && mounted) startTerminal();
	});

	let resolvedFontSize = $derived(clampFontSize(fontSize));
	$effect(() => {
		if (!term || term.options.fontSize === resolvedFontSize) return;
		term.options.fontSize = resolvedFontSize;
		requestAnimationFrame(() => resizeTerminal());
	});

	$effect(() => {
		onTelemetry?.(session.id, {
			connectionState,
			rttMs,
			activityState,
			activityLabel,
			showActivity
		});
	});
</script>

<div class="terminal-pane">
	<div class="terminal-pane__status" data-state={connectionState}>
		{connectionState}
	</div>
	{#if lastError}
		<div class="terminal-pane__error">{lastError}</div>
	{/if}
	<div
		class="terminal-pane__screen"
		role="presentation"
		{@attach pinchZoomAttachment}
		onpaste={(event) => {
			if (handlePaste(event.clipboardData)) event.preventDefault();
		}}
		ondragover={(event) => {
			if (!canSendInput || !event.dataTransfer?.types.includes('Files')) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'copy';
			dragOver = true;
		}}
		ondragleave={(event) => {
			const next = event.relatedTarget;
			if (!(next instanceof Node) || !event.currentTarget.contains(next)) dragOver = false;
		}}
		ondrop={(event) => {
			if (!event.dataTransfer?.types.includes('Files')) return;
			event.preventDefault();
			dragOver = false;
			handleDrop(event.dataTransfer);
		}}
	>
		<div class="terminal-pane__surface" bind:this={containerEl}></div>
		{#if dragOver || uploading}
			<div class="terminal-pane__drop-overlay" aria-live="polite">
				{#if uploading}
					<Loader2 size={24} class="terminal-pane__spinner" />
					<span>Uploading…</span>
				{:else}
					<UploadCloud size={24} />
					<span>Drop to upload — path is inserted at the prompt</span>
				{/if}
			</div>
		{/if}
	</div>
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
	.terminal-pane__screen {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	.terminal-pane__surface {
		height: 100%;
		min-height: 0;
		padding: 8px;
	}
	.terminal-pane__drop-overlay {
		position: absolute;
		inset: 8px;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		pointer-events: none;
		border: 1px dashed rgba(125, 211, 252, 0.7);
		border-radius: calc(var(--radius) - 2px);
		background: rgba(8, 18, 32, 0.88);
		color: #bae6fd;
		font-size: 13px;
		font-weight: 600;
	}
	:global(.terminal-pane__spinner) {
		animation: terminal-spin 0.8s linear infinite;
	}
	@keyframes terminal-spin {
		to {
			transform: rotate(360deg);
		}
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
