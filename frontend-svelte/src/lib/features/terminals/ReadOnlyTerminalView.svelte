<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { FitAddon } from '@xterm/addon-fit';
	import { WebglAddon } from '@xterm/addon-webgl';
	import { Terminal as XTerm } from '@xterm/xterm';
	import '@xterm/xterm/css/xterm.css';

	import {
		getStreamUrl,
		TERMINAL_SCROLLBACK,
		type TerminalGatewayEvent
	} from '$lib/features/terminals/types';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();
	let containerEl: HTMLDivElement;
	let term: XTerm | null = null;
	let fitAddon: FitAddon | null = null;
	let eventSource: EventSource | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let title = $state('Shared terminal');
	let error = $state<string | null>(null);
	let connected = $state(false);

	function tryLoadWebgl(terminal: XTerm): void {
		try {
			const addon = new WebglAddon();
			addon.onContextLoss(() => addon.dispose());
			terminal.loadAddon(addon);
		} catch {
			// DOM renderer remains the fallback when WebGL is unavailable.
		}
	}

	function fit(): void {
		try {
			fitAddon?.fit();
		} catch {
			// The container can briefly have no measurable size during navigation.
		}
	}

	function handleEvent(payload: TerminalGatewayEvent): void {
		if (!term) return;
		switch (payload.type) {
			case 'bootstrap':
				term.reset();
				if (payload.buffer) term.write(payload.buffer);
				if (payload.session.title) title = payload.session.title;
				break;
			case 'output':
				if (payload.data) term.write(payload.data);
				break;
			case 'status':
				if (payload.session.title) title = payload.session.title;
				break;
			case 'error':
				error = payload.message || 'Stream error';
				break;
			case 'pong':
				break;
		}
	}

	onMount(() => {
		term = new XTerm({
			cursorBlink: false,
			disableStdin: true,
			screenReaderMode: true,
			convertEol: true,
			fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
			fontSize: 13,
			lineHeight: 1.18,
			scrollback: TERMINAL_SCROLLBACK,
			theme: {
				background: '#08111f',
				foreground: '#d7e3f6',
				cursor: '#08111f'
			}
		});
		fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(containerEl);
		tryLoadWebgl(term);
		fit();

		resizeObserver = new ResizeObserver(() => fit());
		resizeObserver.observe(containerEl);

		eventSource = new EventSource(getStreamUrl(id));
		eventSource.onopen = () => {
			connected = true;
			error = null;
		};
		eventSource.onmessage = (message) => {
			try {
				handleEvent(JSON.parse(message.data) as TerminalGatewayEvent);
			} catch {
				error = 'Invalid stream event';
			}
		};
		eventSource.addEventListener('error', () => {
			connected = false;
		});
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		eventSource?.close();
		term?.dispose();
	});
</script>

<article class="readonly-terminal" data-view-mode="single" data-connected={connected || undefined}>
	<header class="readonly-terminal__header">
		<div class="readonly-terminal__identity">
			<h2>{title}</h2>
			<p>{connected ? 'Live · read-only' : 'Reconnecting…'}</p>
		</div>
		<span class="readonly-terminal__badge">READ ONLY</span>
	</header>

	{#if error}
		<div class="readonly-terminal__error" role="status">{error}</div>
	{/if}

	<div class="readonly-terminal__screen">
		<div class="readonly-terminal__xterm" bind:this={containerEl}></div>
	</div>
</article>

<style>
	.readonly-terminal {
		display: flex;
		min-width: 0;
		min-height: 0;
		height: 100%;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
	}
	.readonly-terminal__header {
		display: flex;
		min-width: 0;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 9px 11px;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--surface-2) 82%, transparent);
	}
	.readonly-terminal__identity { display: grid; min-width: 0; gap: 2px; }
	.readonly-terminal__identity h2 {
		margin: 0;
		overflow: hidden;
		color: var(--ink);
		font-size: 12px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.readonly-terminal__identity p { margin: 0; color: var(--ink-muted); font-size: 10px; }
	.readonly-terminal__badge {
		flex: 0 0 auto;
		border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
		border-radius: 999px;
		padding: 3px 7px;
		color: var(--ink-muted);
		font-family: var(--font-mono);
		font-size: 8px;
		letter-spacing: 0.12em;
	}
	.readonly-terminal__error {
		border-bottom: 1px solid rgb(251 113 133 / 0.22);
		background: rgb(127 29 29 / 0.18);
		padding: 6px 10px;
		color: rgb(254 205 211);
		font-size: 10px;
	}
	.readonly-terminal__screen {
		position: relative;
		min-height: 0;
		flex: 1;
		padding: 7px;
		background: #08111f;
	}
	.readonly-terminal__xterm {
		height: 100%;
		width: 100%;
		overflow: hidden;
		border-radius: 8px;
		background: #08111f;
	}
	@media (max-width: 640px) {
		.readonly-terminal { border-right: 0; border-left: 0; border-radius: 0; }
		.readonly-terminal__header { padding-inline: 9px; }
		.readonly-terminal__screen { padding: 4px; }
	}
</style>
