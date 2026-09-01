<script lang="ts">
	import {
		ArrowDown,
		ArrowLeft,
		ArrowRight,
		ArrowUp,
		Ban,
		Clipboard,
		ClipboardPaste,
		CopyCheck,
		Eraser,
		Paperclip
	} from 'lucide-svelte';

	import {
		isClipboardSoftKey,
		resolveSoftKeyboardAction,
		SOFT_KEYBOARD_ROW_1,
		SOFT_KEYBOARD_ROW_2,
		type SoftKeyboardAction
	} from './soft-keyboard';
	import type { SoftKeyboardKey } from './types';

	interface Props {
		canSendInput: boolean;
		softKeyVisible: Partial<Record<SoftKeyboardKey, boolean>>;
		onAction: (action: SoftKeyboardAction) => void;
		onAttachFiles?: (files: File[]) => void;
	}

	let { canSendInput, softKeyVisible, onAction, onAttachFiles }: Props = $props();
	let fileInput = $state<HTMLInputElement>();

	function fileInputAttachment(node: HTMLInputElement) {
		fileInput = node;
		return () => {
			if (fileInput === node) fileInput = undefined;
		};
	}

	function activate(id: SoftKeyboardKey): void {
		const action = resolveSoftKeyboardAction(id);
		if (action) onAction(action);
	}

	function visible(id: SoftKeyboardKey): boolean {
		return softKeyVisible[id] !== false && resolveSoftKeyboardAction(id) !== null;
	}
</script>

<div class="terminal-pane-controls" aria-label="Terminal shortcut keyboard">
	{#if onAttachFiles}
		<input
			{@attach fileInputAttachment}
			type="file"
			multiple
			class="sr-only-file"
			tabindex="-1"
			aria-hidden="true"
			onchange={(event) => {
				const files = Array.from(event.currentTarget.files ?? []);
				if (files.length > 0) onAttachFiles?.(files);
				event.currentTarget.value = '';
			}}
		/>
	{/if}

	<div class="kbd-row">
		{#each SOFT_KEYBOARD_ROW_1 as id (id)}
			{#if visible(id)}
				<button
					type="button"
					class:kbd-key-tab={id === 'tab'}
					class="kbd-key"
					data-tone={id === 'interrupt' ? 'warning' : id === 'tab' ? 'accent' : undefined}
					disabled={!canSendInput && !isClipboardSoftKey(id)}
					aria-label={id === 'interrupt' ? 'Interrupt Ctrl+C' : id === 'shiftTab' ? 'Shift+Tab' : id === 'tab' ? 'Tab' : 'Escape'}
					title={id === 'interrupt' ? 'Interrupt (Ctrl+C)' : id === 'shiftTab' ? 'Shift+Tab' : id === 'tab' ? 'Tab' : 'Esc'}
					onclick={() => activate(id)}
				>
					{#if id === 'interrupt'}
						<Ban size={16} />
					{:else if id === 'tab'}
						<span class="kbd-tab-content"><span>⇥</span><strong>TAB</strong></span>
					{:else if id === 'shiftTab'}
						<span class="kbd-glyph-text">⇤</span>
					{:else}
						<span class="kbd-glyph-text">Esc</span>
					{/if}
				</button>
			{/if}

			{#if id === 'tab' && onAttachFiles && canSendInput}
				<button
					type="button"
					class="kbd-key kbd-key-attach"
					data-tone="accent"
					aria-label="Attach file"
					title="Attach file (upload and insert path)"
					onclick={() => fileInput?.click()}
				>
					<Paperclip size={16} />
				</button>
			{/if}
		{/each}
	</div>

	<div class="kbd-row">
		{#each SOFT_KEYBOARD_ROW_2 as id (id)}
			{#if visible(id)}
				<button
					type="button"
					class="kbd-key"
					data-tone={id === 'selectAll' ? 'accent' : undefined}
					disabled={!canSendInput && !isClipboardSoftKey(id)}
					aria-label={id === 'selectAll' ? 'Select all and copy' : id === 'clear' ? 'Clear terminal' : id[0].toUpperCase() + id.slice(1)}
					title={id === 'selectAll' ? 'Select all + copy' : id === 'clear' ? 'Clear screen' : id[0].toUpperCase() + id.slice(1)}
					onclick={() => activate(id)}
				>
					{#if id === 'left'}
						<ArrowLeft size={16} />
					{:else if id === 'up'}
						<ArrowUp size={16} />
					{:else if id === 'down'}
						<ArrowDown size={16} />
					{:else if id === 'right'}
						<ArrowRight size={16} />
					{:else if id === 'clear'}
						<Eraser size={16} />
					{:else if id === 'paste'}
						<ClipboardPaste size={16} />
					{:else if id === 'copy'}
						<Clipboard size={16} />
					{:else if id === 'selectAll'}
						<CopyCheck size={16} />
					{/if}
				</button>
			{/if}
		{/each}
	</div>
</div>

<style>
	.terminal-pane-controls {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		gap: 0.35rem;
		width: 100%;
		border-top: 1px solid var(--border);
		background: color-mix(in srgb, var(--surface) 94%, #07101d);
		padding: 0.4rem 0.45rem;
		padding-bottom: max(0.4rem, calc(0.4rem + env(safe-area-inset-bottom)));
	}
	.kbd-row {
		display: flex;
		align-items: stretch;
		gap: 0.3rem;
		width: 100%;
	}
	.kbd-key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 0%;
		min-width: 0;
		height: 2.4rem;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		border-radius: 0.55rem;
		background: color-mix(in srgb, var(--surface-2) 86%, transparent);
		padding: 0 0.3rem;
		color: var(--ink);
		font: inherit;
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
		touch-action: manipulation;
		transition: background 100ms, border-color 100ms, transform 80ms;
	}
	.kbd-key:active:not(:disabled) { transform: scale(0.96); }
	.kbd-key:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }
	.kbd-key:disabled { cursor: default; opacity: 0.42; }
	.kbd-key[data-tone='warning'] { border-color: rgb(251 146 60 / 0.45); color: rgb(253 186 116); }
	.kbd-key[data-tone='accent'] { border-color: color-mix(in srgb, var(--accent) 48%, transparent); color: #a5f3fc; }
	.kbd-key-tab { flex: 1.6 1 0%; background: color-mix(in srgb, var(--accent) 12%, transparent); }
	.kbd-key-attach { flex: 0.8 1 0%; }
	.kbd-glyph-text,
	.kbd-tab-content { font-family: var(--font-mono); }
	.kbd-glyph-text { font-size: 0.78rem; }
	.kbd-tab-content { display: inline-flex; align-items: center; gap: 0.28rem; }
	.kbd-tab-content > span { font-size: 1rem; line-height: 1; }
	.kbd-tab-content strong { font-size: 0.68rem; letter-spacing: 0.06em; }
	.sr-only-file { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
	@media (min-width: 901px) and (pointer: fine) {
		.terminal-pane-controls { display: none; }
	}
	@media (max-width: 480px) {
		.terminal-pane-controls { padding: 0.3rem; padding-bottom: max(0.3rem, calc(0.3rem + env(safe-area-inset-bottom))); }
		.kbd-row { gap: 0.25rem; }
		.kbd-key { height: 2.3rem; padding: 0 0.2rem; }
	}
</style>
