<script lang="ts">
	import './terminal.css';
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
	import PaneSoftKeyboard from '$lib/features/terminals/PaneSoftKeyboard.svelte';
	import PaneScrollRail from '$lib/features/terminals/PaneScrollRail.svelte';
	import type { FitAddon } from '@xterm/addon-fit';
	import type { Terminal as XTerm } from '@xterm/xterm';

	import { filesFromDrop, imageFileFromBlob, partitionBySize, quoteShellPath } from '$lib/features/terminals/upload';
	import { OrderedTerminalInputQueue } from '$lib/features/terminals/input-queue';
	import type { SoftKeyboardAction } from '$lib/features/terminals/soft-keyboard';
	import { attachTerminalPinchZoom } from '$lib/features/terminals/terminal-pinch-attachment';
	import { attachWebgl, createXtermRuntime } from '$lib/features/terminals/xterm-runtime';
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
		type ConnectionState,
		type TerminalGatewayEvent,
		type TerminalSession,
		type SoftKeyboardKey
	} from '$lib/features/terminals/types';

	interface Props {
		session: TerminalSession;
		active?: boolean;
		fontSize?: number;
		fullscreen?: boolean;
		keyboardVisible?: boolean;
		softKeyVisible?: Partial<Record<SoftKeyboardKey, boolean>>;
		boundAgentProfileId?: string;
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
		fullscreen = false,
		keyboardVisible = false,
		softKeyVisible = {},
		boundAgentProfileId,
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
	let resizeFrame: number | null = null;
	let resizeFollowupFrame: number | null = null;
	let lastPostedCols = 0;
	let lastPostedRows = 0;
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
	let isAgent = $derived(Boolean(boundAgentProfileId) || isAgentSession(session));
	let showActivity = $derived(isAgent && (activityState !== 'idle' || session.status === 'exited'));
	let activityLabel = $derived(ACTIVITY_LABELS[activityState]);

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

	function sendControlKey(key: string): void {
		if (!/^[a-z]$/i.test(key)) return;
		sendInput(String.fromCharCode(key.toUpperCase().charCodeAt(0) & 0x1f));
	}

	async function pasteFromClipboard(): Promise<void> {
		if (!canSendInput) return;

		if (navigator.clipboard?.read) {
			try {
				const items = await navigator.clipboard.read();
				const images: File[] = [];
				for (const item of items) {
					const imageType = item.types.find((type) => type.startsWith('image/'));
					if (imageType) images.push(imageFileFromBlob(await item.getType(imageType), images.length));
				}
				if (images.length > 0) {
					await uploadFiles(images);
					return;
				}
			} catch {
				// Permission denied or no rich clipboard item — fall through to text.
			}
		}

		if (!navigator.clipboard?.readText) return;
		try {
			const text = await navigator.clipboard.readText();
			if (text) sendInput(text);
		} catch {
			lastError = 'Clipboard read blocked';
		}
	}

	async function copyTerminalContent(): Promise<void> {
		if (!term || !navigator.clipboard?.writeText) return;
		const selected = term.hasSelection() ? term.getSelection() : '';
		const text = selected || lastOutput;
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			lastError = 'Clipboard write blocked';
		}
	}

	async function selectAndCopyAll(): Promise<void> {
		if (!term || !navigator.clipboard?.writeText) return;
		try {
			term.selectAll();
		} catch {
			// xterm selection can be unavailable before the pane is fully armed.
		}
		const text = term.hasSelection() ? term.getSelection() : lastOutput;
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			lastError = 'Clipboard write blocked';
		}
	}

	function clearTerminal(): void {
		term?.clear();
		sendControlKey('l');
	}

	function railScroll(lines: number): void {
		term?.scrollLines(lines);
	}

	function handleSoftKeyboardAction(action: SoftKeyboardAction): void {
		switch (action.kind) {
			case 'input':
				sendInput(action.data);
				break;
			case 'control':
				sendControlKey(action.key);
				break;
			case 'clear':
				clearTerminal();
				break;
			case 'paste':
				void pasteFromClipboard();
				break;
			case 'copy':
				void copyTerminalContent();
				break;
			case 'selectAll':
				void selectAndCopyAll();
				break;
		}
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

	function resizeTerminalNow(): void {
		if (!fitAddon || !term || !containerEl || !active) return;
		if (containerEl.offsetParent === null) return;
		const rect = containerEl.getBoundingClientRect();
		if (rect.width < 2 || rect.height < 2) return;
		try {
			fitAddon.fit();
		} catch {
			return;
		}
		if (term.cols <= 0 || term.rows <= 0) return;
		if (term.cols === lastPostedCols && term.rows === lastPostedRows) return;
		lastPostedCols = term.cols;
		lastPostedRows = term.rows;
		postResize(term.cols, term.rows);
	}

	function resizeTerminal(followup = false): void {
		if (typeof window === 'undefined') return;
		if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
		resizeFrame = requestAnimationFrame(() => {
			resizeFrame = null;
			resizeTerminalNow();
			if (!followup) return;
			if (resizeFollowupFrame !== null) cancelAnimationFrame(resizeFollowupFrame);
			resizeFollowupFrame = requestAnimationFrame(() => {
				resizeFollowupFrame = null;
				resizeTerminalNow();
			});
		});
	}

	function pinchZoomAttachment(node: HTMLElement): () => void {
		return attachTerminalPinchZoom(node, () => resolvedFontSize, (size) => onFontSizeChange?.(session.id, size));
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
			resizeTerminal(true);
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
			let parsed: TerminalGatewayEvent;
			try {
				parsed = JSON.parse(ev.data) as TerminalGatewayEvent;
			} catch {
				return;
			}
			if (!term) return;
			switch (parsed.type) {
				case 'bootstrap':
					term.reset();
					trackOutput(parsed.buffer);
					if (parsed.buffer) {
						term.write(parsed.buffer, () => {
							resizeTerminal(true);
							term?.scrollToBottom();
						});
					} else {
						resizeTerminal(true);
					}
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
		const runtime = createXtermRuntime(fontSize);
		term = runtime.term;
		fitAddon = runtime.fitAddon;
		term.open(containerEl);
		attachWebgl(term);
		resizeTerminal(true);

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

		const handleViewportResize = () => resizeTerminal(true);
		window.addEventListener('resize', handleViewportResize, { passive: true });
		window.addEventListener('orientationchange', handleViewportResize);
		window.visualViewport?.addEventListener('resize', handleViewportResize, { passive: true });
		window.visualViewport?.addEventListener('scroll', handleViewportResize, { passive: true });
		void document.fonts?.ready.then(() => resizeTerminal(true));

		return () => {
			window.removeEventListener('resize', handleViewportResize);
			window.removeEventListener('orientationchange', handleViewportResize);
			window.visualViewport?.removeEventListener('resize', handleViewportResize);
			window.visualViewport?.removeEventListener('scroll', handleViewportResize);
		};
	});

	onDestroy(() => {
		destroyed = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		if (waitingTimer) clearTimeout(waitingTimer);
		if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
		if (resizeFollowupFrame !== null) cancelAnimationFrame(resizeFollowupFrame);
		eventSource?.close();
		resizeObserver?.disconnect();
		term?.dispose();
	});

	// Defer heavy xterm/WebGL/SSE initialization until the pane is first shown.
	// Once armed it stays alive across workspace/view switches, preserving scrollback.
	$effect(() => {
		if (!active || !mounted) return;
		startTerminal();
		if (term) resizeTerminal(true);
	});

	let resolvedFontSize = $derived(clampFontSize(fontSize));
	$effect(() => {
		if (!term || term.options.fontSize === resolvedFontSize) return;
		term.options.fontSize = resolvedFontSize;
		resizeTerminal(true);
	});

	// Fullscreen hides/shows shell chrome and changes the pane viewport even in
	// CSS fallback mode. Re-fit the existing xterm instead of remounting it so
	// scrollback and the live SSE connection are preserved.
	$effect(() => {
		const layoutActive = fullscreen || keyboardVisible || active;
		if (layoutActive && term && active) resizeTerminal(true);
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

<div class="terminal-pane-shell">
<div class="terminal-pane">
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
	{#if keyboardVisible}
		<PaneSoftKeyboard
			{canSendInput}
			{softKeyVisible}
			onAction={handleSoftKeyboardAction}
			onAttachFiles={(files) => void uploadFiles(files)}
		/>
	{/if}
</div>
<PaneScrollRail onScroll={railScroll} />
</div>
