<script lang="ts">
	import { Plus, X } from 'lucide-svelte';

	import {
		DEFAULT_WORKSPACE_ID,
		type Workspace
	} from '$lib/features/terminals/use-workspaces.svelte';

	interface Props {
		workspaces: Workspace[];
		activeId: string;
		sessionCounts: Record<string, number>;
		onSelect: (id: string) => void;
		onCreate: () => void;
		onRename: (id: string, name: string) => void;
		onDelete: (id: string) => void;
	}

	let { workspaces, activeId, sessionCounts, onSelect, onCreate, onRename, onDelete }: Props = $props();

	let editingId = $state<string | null>(null);
	let editValue = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!editingId || !inputEl) return;
		inputEl.focus();
		inputEl.select();
	});

	function startEdit(workspace: Workspace): void {
		editingId = workspace.id;
		editValue = workspace.name;
	}

	function cancelEdit(): void {
		editingId = null;
		editValue = '';
	}

	function commitEdit(): void {
		if (editingId && editValue.trim()) onRename(editingId, editValue.trim());
		cancelEdit();
	}

	function requestDelete(workspace: Workspace): void {
		if (workspace.id === DEFAULT_WORKSPACE_ID) return;
		if (confirm(`Delete workspace "${workspace.name}"? Sessions stay live and move to default.`)) {
			onDelete(workspace.id);
		}
	}
</script>

<div class="workspace-tabs" role="tablist" aria-label="Workspaces">
	{#each workspaces as workspace (workspace.id)}
		<div class="workspace-tab" data-active={workspace.id === activeId || undefined}>
			{#if editingId === workspace.id}
				<input
					bind:this={inputEl}
					class="workspace-tab__input"
					bind:value={editValue}
					onblur={commitEdit}
					onkeydown={(event) => {
						if (event.key === 'Enter') commitEdit();
						if (event.key === 'Escape') cancelEdit();
					}}
					aria-label={`Rename workspace ${workspace.name}`}
				/>
			{:else}
				<button
					type="button"
					role="tab"
					aria-selected={workspace.id === activeId}
					class="workspace-tab__main"
					onclick={() => {
						if (workspace.id === activeId) startEdit(workspace);
						else onSelect(workspace.id);
					}}
					ondblclick={() => startEdit(workspace)}
					title={workspace.id === activeId ? 'Click again to rename' : `Switch to ${workspace.name}`}
				>
					<span class="workspace-tab__dot" style:background-color={workspace.color}></span>
					<span class="workspace-tab__name">{workspace.name}</span>
					{#if (sessionCounts[workspace.id] ?? 0) > 0}
						<span class="workspace-tab__count">{sessionCounts[workspace.id]}</span>
					{/if}
				</button>
			{/if}

			{#if workspaces.length > 1 && workspace.id !== DEFAULT_WORKSPACE_ID && editingId !== workspace.id}
				<button
					type="button"
					class="workspace-tab__close"
					onclick={() => requestDelete(workspace)}
					aria-label={`Delete workspace ${workspace.name}`}
					title="Delete workspace"
				>
					<X size={12} />
				</button>
			{/if}
		</div>
	{/each}

	<button type="button" class="workspace-tab__add" onclick={onCreate} title="New workspace" aria-label="New workspace">
		<Plus size={14} />
	</button>
</div>

<style>
	.workspace-tabs {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 38px;
		padding: 5px 10px;
		overflow-x: auto;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		scrollbar-width: none;
	}
	.workspace-tabs::-webkit-scrollbar {
		display: none;
	}
	.workspace-tab {
		display: inline-flex;
		align-items: center;
		flex: 0 0 auto;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
	}
	.workspace-tab[data-active='true'] {
		border-color: var(--border);
		background: var(--surface-2);
	}
	.workspace-tab__main {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 28px;
		padding: 4px 8px;
		border: 0;
		background: transparent;
		color: var(--ink-muted);
		font-size: 0.78rem;
		cursor: pointer;
	}
	.workspace-tab[data-active='true'] .workspace-tab__main {
		color: var(--ink);
	}
	.workspace-tab__dot {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--ink-muted);
	}
	.workspace-tab__name {
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.workspace-tab__count {
		min-width: 17px;
		padding: 1px 5px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		font-family: var(--font-mono);
		font-size: 10px;
		text-align: center;
	}
	.workspace-tab__close,
	.workspace-tab__add {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.workspace-tab__close:hover,
	.workspace-tab__add:hover {
		background: color-mix(in srgb, var(--ink) 9%, transparent);
		color: var(--ink);
	}
	.workspace-tab__input {
		width: 120px;
		min-height: 28px;
		border: 0;
		border-radius: 6px;
		outline: 1px solid var(--accent);
		background: var(--surface-2);
		color: var(--ink);
		padding: 4px 7px;
		font-size: 0.78rem;
	}
</style>
