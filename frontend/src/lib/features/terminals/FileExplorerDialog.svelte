<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, ChevronRight, Folder, Home, Search, X } from 'lucide-svelte';

	import { buildCrumbs, filterDirectories, type FsListResult } from './pane-tools';

	interface Props {
		onClose: () => void;
		onPick: (absolutePath: string) => void;
	}

	let { onClose, onPick }: Props = $props();
	let result = $state<FsListResult | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let query = $state('');
	let filtered = $derived(result ? filterDirectories(result.entries, query) : []);
	let crumbs = $derived(result ? buildCrumbs(result.path, result.roots) : []);

	async function load(target?: string): Promise<void> {
		loading = true;
		error = null;
		try {
			const suffix = target ? `?path=${encodeURIComponent(target)}` : '';
			const response = await fetch(`/api/fs/list${suffix}`);
			const payload = (await response.json().catch(() => ({}))) as FsListResult & { error?: string };
			if (!response.ok || !payload.path || !Array.isArray(payload.entries)) {
				throw new Error(payload.error ?? `Folder list failed (${response.status})`);
			}
			result = payload;
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Folder list failed';
		} finally {
			loading = false;
		}
	}

	function pick(path: string): void {
		onPick(path);
		onClose();
	}

	onMount(() => void load());
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div
	class="fs-backdrop"
	role="presentation"
	onclick={(event) => {
		if (event.target === event.currentTarget) onClose();
	}}
>
	<div class="fs-sheet" role="dialog" aria-modal="true" aria-label="File explorer" tabindex="-1">
		<header class="fs-header">
			<div>
				<h2>Change directory</h2>
				<p>Browse allowed host folders and inject a safe <code>cd</code> command.</p>
			</div>
			<button type="button" class="fs-close" onclick={onClose} aria-label="Close explorer"><X size={16} /></button>
		</header>

		<div class="fs-toolbar">
			<div class="fs-roots">
				{#each result?.roots ?? [] as root (root.path)}
					<button type="button" onclick={() => void load(root.path)}>
						{#if root.label === 'Home'}<Home size={12} />{:else}<Folder size={12} />{/if}
						{root.label}
					</button>
				{/each}
			</div>
			<label class="fs-search">
				<Search size={14} />
				<input type="search" bind:value={query} placeholder="Filter folders" aria-label="Filter folders" />
			</label>
			<div class="fs-crumbs">
				{#if result?.parent}
					<button type="button" onclick={() => void load(result?.parent ?? undefined)} title="Go up"><ArrowLeft size={12} /> Up</button>
				{/if}
				{#each crumbs as crumb, index (crumb.path)}
					{#if index > 0}<ChevronRight size={11} />{/if}
					<button type="button" onclick={() => void load(crumb.path)}>{crumb.label}</button>
				{/each}
			</div>
		</div>

		<div class="fs-body">
			{#if loading}
				<p class="fs-empty">Loading…</p>
			{:else if error}
				<p class="fs-empty fs-empty--error">{error}</p>
			{:else if filtered.length === 0}
				<p class="fs-empty">No folders here.</p>
			{:else}
				<ul class="fs-list">
					{#each filtered as entry (entry.path)}
						<li>
							<div
								class="fs-entry"
								role="button"
								tabindex="0"
								onclick={() => void load(entry.path)}
								ondblclick={() => pick(entry.path)}
								onkeydown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										void load(entry.path);
									}
								}}
							>
								<Folder size={15} />
								<span>{entry.name}</span>
								<button type="button" onclick={(event) => { event.stopPropagation(); pick(entry.path); }}>cd here</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if result}
			<footer class="fs-footer">
				<span title={result.path}>{result.path}</span>
				<button type="button" onclick={() => pick(result!.path)}>cd here</button>
			</footer>
		{/if}
	</div>
</div>

<style>
	.fs-backdrop { position: fixed; inset: 0; z-index: 140; display: flex; align-items: flex-end; justify-content: center; background: rgb(4 8 16 / 0.68); backdrop-filter: blur(8px); }
	.fs-sheet { display: flex; flex-direction: column; width: 100%; max-width: 42rem; max-height: min(90dvh, calc(100dvh - var(--safe-top)), 760px); overflow: hidden; border: 1px solid var(--border); border-radius: 1.25rem 1.25rem 0 0; background: color-mix(in srgb, var(--surface) 97%, #07101d); box-shadow: 0 -22px 70px rgb(0 0 0 / 0.45); padding-bottom: var(--safe-bottom); }
	.fs-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border); padding: 12px 14px; }
	.fs-header h2, .fs-header p { margin: 0; }
	.fs-header h2 { color: var(--ink); font-size: 0.88rem; }
	.fs-header p { margin-top: 2px; color: var(--ink-muted); font-size: 0.66rem; }
	.fs-header code { font-family: var(--font-mono); color: #bae6fd; }
	.fs-close { display: grid; place-items: center; width: 32px; height: 32px; flex: 0 0 auto; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--ink-muted); cursor: pointer; }
	.fs-toolbar { display: grid; gap: 7px; border-bottom: 1px solid var(--border); padding: 9px 10px; }
	.fs-roots, .fs-crumbs { display: flex; align-items: center; gap: 5px; min-width: 0; overflow-x: auto; }
	.fs-roots button, .fs-crumbs button { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; border: 1px solid var(--border); border-radius: 7px; background: var(--surface-2); padding: 5px 7px; color: var(--ink-muted); font: inherit; font-size: 0.62rem; cursor: pointer; }
	.fs-search { display: flex; align-items: center; gap: 7px; border: 1px solid var(--border); border-radius: 8px; background: rgb(255 255 255 / 0.025); padding: 0 8px; color: var(--ink-muted); }
	.fs-search input { width: 100%; min-width: 0; height: 34px; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; font-size: 0.7rem; }
	.fs-body { min-height: 0; overflow-y: auto; padding: 9px; }
	.fs-list { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
	.fs-entry { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); padding: 7px 8px; color: #fcd34d; cursor: pointer; }
	.fs-entry > span { overflow: hidden; color: var(--ink); font-size: 0.72rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.fs-entry > button, .fs-footer button { border: 1px solid rgb(56 189 248 / 0.32); border-radius: 7px; background: rgb(56 189 248 / 0.08); padding: 5px 7px; color: #bae6fd; font: inherit; font-size: 0.62rem; font-weight: 650; cursor: pointer; }
	.fs-empty { margin: 0; padding: 28px 12px; color: var(--ink-muted); font-size: 0.7rem; text-align: center; }
	.fs-empty--error { color: #fca5a5; }
	.fs-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid var(--border); padding: 8px 10px; }
	.fs-footer span { min-width: 0; overflow: hidden; color: var(--ink-muted); font-family: var(--font-mono); font-size: 0.62rem; text-overflow: ellipsis; white-space: nowrap; }
	@media (min-width: 640px) { .fs-backdrop { align-items: center; padding: calc(16px + var(--safe-top)) calc(16px + var(--safe-right)) calc(16px + var(--safe-bottom)) calc(16px + var(--safe-left)); } .fs-sheet { border-radius: 1.25rem; padding-bottom: 0; } }
</style>
