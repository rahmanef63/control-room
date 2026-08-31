<script lang="ts">
	import { RotateCcw } from 'lucide-svelte';
	import { SESSION_COLOR_PALETTE } from './session-colors';

	interface Props {
		sessionId: string;
		color: string;
		hasOverride: boolean;
		onPick: (color: string) => void;
		onClear: () => void;
		disabled?: boolean;
		title?: string;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		hideTrigger?: boolean;
	}

	let {
		sessionId,
		color,
		hasOverride,
		onPick,
		onClear,
		disabled = false,
		title,
		open: controlledOpen,
		onOpenChange,
		hideTrigger = false
	}: Props = $props();

	let internalOpen = $state(false);
	let wrapper: HTMLDivElement | undefined = $state();
	let open = $derived(controlledOpen ?? internalOpen);

	function setOpen(next: boolean): void {
		if (onOpenChange) onOpenChange(next);
		else internalOpen = next;
	}

	function pick(swatch: string): void {
		onPick(swatch);
		setOpen(false);
	}

	function clear(): void {
		onClear();
		setOpen(false);
	}
</script>

<svelte:window
	onmousedown={(event) => {
		if (!open || hideTrigger) return;
		if (event.target instanceof Node && !wrapper?.contains(event.target)) setOpen(false);
	}}
	onkeydown={(event) => {
		if (open && event.key === 'Escape') setOpen(false);
	}}
/>

<div class="session-color" bind:this={wrapper}>
	{#if !hideTrigger}
		<button
			type="button"
			class="session-color__trigger"
			style:--session-color={color}
			disabled={disabled}
			data-disabled={disabled || undefined}
			aria-label={`Change color for ${sessionId.slice(0, 8)}`}
			aria-expanded={open}
			aria-haspopup="dialog"
			title={title ?? `Color for ${sessionId.slice(0, 8)} — click to change`}
			onclick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				if (!disabled) setOpen(!open);
			}}
		></button>
	{/if}

	{#if open}
		{#if hideTrigger}
			<div class="session-color__overlay" role="dialog" aria-modal="true" aria-label="Session color">
				<button type="button" class="session-color__backdrop" aria-label="Close color picker" onclick={() => setOpen(false)}></button>
				<div class="session-color__palette session-color__palette--sheet">
					{#each SESSION_COLOR_PALETTE as swatch (swatch)}
						<button
							type="button"
							class="session-color__option"
							style:background={swatch}
							data-active={color === swatch || undefined}
							aria-label={`Use color ${swatch}`}
							onclick={() => pick(swatch)}
						></button>
					{/each}
					{#if hasOverride}
						<button type="button" class="session-color__option session-color__reset" aria-label="Reset session color" onclick={clear}>
							<RotateCcw size={13} />
						</button>
					{/if}
				</div>
			</div>
		{:else}
			<div class="session-color__palette" role="dialog" aria-label="Session color">
				{#each SESSION_COLOR_PALETTE as swatch (swatch)}
					<button
						type="button"
						class="session-color__option"
						style:background={swatch}
						data-active={color === swatch || undefined}
						aria-label={`Use color ${swatch}`}
						onclick={() => pick(swatch)}
					></button>
				{/each}
				{#if hasOverride}
					<button type="button" class="session-color__option session-color__reset" aria-label="Reset session color" onclick={clear}>
						<RotateCcw size={13} />
					</button>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.session-color { position: relative; display: inline-flex; flex: 0 0 auto; }
	.session-color__trigger {
		width: 13px;
		height: 13px;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--session-color) 70%, white 30%);
		border-radius: 999px;
		background: var(--session-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--session-color) 18%, transparent);
		cursor: pointer;
	}
	.session-color__trigger[data-disabled='true'] { cursor: default; opacity: 0.55; }
	.session-color__palette {
		position: absolute;
		top: calc(100% + 7px);
		right: 0;
		z-index: 80;
		display: grid;
		grid-template-columns: repeat(4, 24px);
		gap: 6px;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: color-mix(in srgb, var(--surface) 96%, #07101d);
		box-shadow: 0 14px 36px rgb(0 0 0 / 0.4);
	}
	.session-color__option {
		display: grid;
		width: 24px;
		height: 24px;
		place-items: center;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 999px;
		cursor: pointer;
	}
	.session-color__option[data-active='true'] { border-color: white; box-shadow: 0 0 0 1px rgb(255 255 255 / 0.3); }
	.session-color__reset { background: var(--surface-2); color: var(--ink-muted); }
	.session-color__overlay { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; }
	.session-color__backdrop { position: absolute; inset: 0; border: 0; background: rgb(4 8 16 / 0.62); backdrop-filter: blur(7px); }
	.session-color__palette--sheet { position: relative; top: auto; right: auto; grid-template-columns: repeat(4, 30px); gap: 8px; padding: 12px; }
	.session-color__palette--sheet .session-color__option { width: 30px; height: 30px; }
</style>
