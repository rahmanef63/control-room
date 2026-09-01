<script lang="ts">
	import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp } from 'lucide-svelte';

	interface Props {
		onScroll: (lines: number) => void;
	}

	let { onScroll }: Props = $props();
</script>

<aside class="terminal-pane-rail" aria-label="Scroll controls">
	<div class="rail-group">
		<button type="button" class="rail-btn" onclick={() => onScroll(-1)} aria-label="Scroll up 1 line" title="Scroll up 1 line">
			<ChevronUp size={16} />
		</button>
		<button type="button" class="rail-btn" onclick={() => onScroll(-10)} aria-label="Scroll up many lines" title="Scroll up many lines">
			<ChevronsUp size={16} />
		</button>
	</div>
	<div class="rail-group">
		<button type="button" class="rail-btn" onclick={() => onScroll(10)} aria-label="Scroll down many lines" title="Scroll down many lines">
			<ChevronsDown size={16} />
		</button>
		<button type="button" class="rail-btn" onclick={() => onScroll(1)} aria-label="Scroll down 1 line" title="Scroll down 1 line">
			<ChevronDown size={16} />
		</button>
	</div>
</aside>

<style>
	.terminal-pane-rail { display: none; }

	@media (max-width: 768px) {
		.terminal-pane-rail {
			display: flex;
			flex: 0 0 64px;
			width: 64px;
			align-self: stretch;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.6rem;
			border-left: 1px solid var(--border);
			background: linear-gradient(180deg, rgba(11, 18, 32, 0.72), rgba(11, 18, 32, 0.44), rgba(11, 18, 32, 0.72));
			padding: 1rem 0.4rem;
		}
		.rail-group {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
			border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
			border-radius: 1rem;
			background: color-mix(in srgb, var(--surface) 62%, transparent);
			padding: 0.4rem 0.3rem;
			box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
		}
		.rail-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 44px;
			height: 52px;
			border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
			border-radius: 12px;
			background: color-mix(in srgb, var(--surface-2) 78%, transparent);
			color: var(--ink-muted);
			cursor: pointer;
			touch-action: manipulation;
			transition: background 120ms ease, color 120ms ease, transform 80ms ease;
		}
		.rail-btn:active {
			transform: scale(0.96);
			background: var(--surface-2);
			color: var(--ink);
		}
	}

	@media (max-width: 380px) {
		.terminal-pane-rail { width: 52px; flex-basis: 52px; padding-inline: 0.25rem; }
		.rail-btn { width: 38px; height: 44px; }
	}
</style>
