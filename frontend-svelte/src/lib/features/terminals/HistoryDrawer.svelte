<script lang="ts">
	import { History, RotateCcw, Trash2, X } from 'lucide-svelte';
	import TerminalProfileIcon from './TerminalProfileIcon.svelte';
	import { relativeHistoryTime, shortenCwd, type TerminalHistoryEntry } from './history';

	interface Props {
		open: boolean;
		history: TerminalHistoryEntry[];
		liveIds: ReadonlySet<string>;
		restoring?: boolean;
		onOpenChange: (open: boolean) => void;
		onOpenEntry: (entry: TerminalHistoryEntry) => void;
		onRemoveEntry: (id: string) => void;
		onClearHistory: () => void;
	}

	let {
		open,
		history,
		liveIds,
		restoring = false,
		onOpenChange,
		onOpenEntry,
		onRemoveEntry,
		onClearHistory
	}: Props = $props();

	let sorted = $derived([...history].sort((a, b) => b.updatedAt - a.updatedAt));
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') onOpenChange(false);
	}}
/>

{#if open}
	<div
		class="history-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) onOpenChange(false);
		}}
	>
		<div class="history-sheet" role="dialog" aria-modal="true" aria-label="Terminal history" tabindex="-1">
			<header class="history-header">
				<div class="history-title">
					<History size={16} />
					<div>
						<h2>Terminal history</h2>
						<p>{sorted.length} entr{sorted.length === 1 ? 'y' : 'ies'} · focus or restore</p>
					</div>
				</div>
				<div class="history-header__actions">
					{#if sorted.length > 0}
						<button type="button" class="history-clear" onclick={onClearHistory} title="Clear all history">
							<Trash2 size={13} /> Clear
						</button>
					{/if}
					<button type="button" class="history-close" onclick={() => onOpenChange(false)} aria-label="Close history">
						<X size={16} />
					</button>
				</div>
			</header>

			<div class="history-body">
				{#if sorted.length === 0}
					<p class="history-empty">No history yet. Terminals you open will be listed here.</p>
				{:else}
					<ul class="history-list">
						{#each sorted as entry (entry.id)}
							{@const live = liveIds.has(entry.id)}
							<li class="history-item" data-live={live || undefined}>
								<span class="history-profile"><TerminalProfileIcon profile={entry.profile} size={15} /></span>
								<div class="history-item__copy">
									<div class="history-item__title">
										<strong>{entry.title}</strong>
										<span data-live={live || undefined}>{live ? 'open' : 'closed'}</span>
									</div>
									<p>{shortenCwd(entry.cwd, 40)} · {relativeHistoryTime(entry.updatedAt)}</p>
								</div>
								<button
									type="button"
									class="history-restore"
									disabled={restoring}
									title={live ? 'Focus this pane' : 'Restore this terminal'}
									onclick={() => {
										onOpenEntry(entry);
										onOpenChange(false);
									}}
								>
									<RotateCcw size={13} /> {live ? 'Focus' : 'Restore'}
								</button>
								<button
									type="button"
									class="history-remove"
									onclick={() => onRemoveEntry(entry.id)}
									aria-label={`Remove ${entry.title} from history`}
									title="Remove from history"
								>
									<Trash2 size={13} />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.history-backdrop {
		position: fixed;
		inset: 0;
		z-index: 115;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgb(4 8 16 / 0.62);
		backdrop-filter: blur(8px);
	}
	.history-sheet {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 38rem;
		max-height: min(88dvh, 760px);
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 1.2rem 1.2rem 0 0;
		background: color-mix(in srgb, var(--surface) 97%, #07101d);
		box-shadow: 0 -20px 60px rgb(0 0 0 / 0.38);
	}
	.history-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
	}
	.history-title { display: flex; align-items: center; gap: 9px; color: var(--accent); }
	.history-title h2 { margin: 0; color: var(--ink); font-size: 0.88rem; }
	.history-title p { margin: 1px 0 0; color: var(--ink-muted); font-size: 0.67rem; }
	.history-header__actions { display: flex; align-items: center; gap: 6px; }
	.history-clear,
	.history-close,
	.history-restore,
	.history-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--ink-muted);
		cursor: pointer;
	}
	.history-clear { min-height: 30px; border-radius: 8px; padding: 0 9px; font-size: 11px; }
	.history-close { width: 32px; height: 32px; border-radius: 999px; }
	.history-body { overflow-y: auto; padding: 12px; }
	.history-empty { margin: 0; padding: 34px 12px; text-align: center; color: var(--ink-muted); font-size: 12px; }
	.history-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
	.history-item {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: color-mix(in srgb, var(--surface-2) 82%, transparent);
		padding: 8px 9px;
	}
	.history-item[data-live='true'] { border-color: rgb(52 211 153 / 0.28); }
	.history-profile { display: inline-flex; color: var(--ink-muted); }
	.history-item__copy { min-width: 0; }
	.history-item__title { display: flex; align-items: center; gap: 6px; min-width: 0; }
	.history-item__title strong { overflow: hidden; color: var(--ink); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
	.history-item__title span {
		flex: 0 0 auto;
		border-radius: 4px;
		background: rgb(148 163 184 / 0.13);
		padding: 1px 5px;
		color: var(--ink-muted);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
	}
	.history-item__title span[data-live='true'] { background: rgb(52 211 153 / 0.14); color: rgb(110 231 183); }
	.history-item__copy p { overflow: hidden; margin: 2px 0 0; color: var(--ink-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.history-restore { min-height: 30px; border-color: rgb(56 189 248 / 0.3); border-radius: 8px; background: rgb(56 189 248 / 0.1); padding: 0 8px; color: rgb(186 230 253); font-size: 11px; }
	.history-restore:disabled { opacity: 0.5; }
	.history-remove { width: 30px; height: 30px; border-radius: 8px; }
	.history-remove:hover, .history-clear:hover { color: rgb(253 164 175); }
	@media (min-width: 640px) {
		.history-backdrop { align-items: center; }
		.history-sheet { border-radius: 1.2rem; margin-bottom: 6vh; }
	}
	@media (max-width: 520px) {
		.history-item { grid-template-columns: auto minmax(0, 1fr) auto; }
		.history-remove { grid-column: 3; }
		.history-restore { grid-column: 1 / -1; }
	}
</style>
