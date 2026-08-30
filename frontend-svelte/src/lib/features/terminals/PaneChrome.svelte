<script lang="ts">
	import {
		Check,
		CopyPlus,
		Focus,
		Minus,
		Pencil,
		Plus,
		Trash2,
		X
	} from 'lucide-svelte';

	import { clampFontSize, type TerminalSession } from '$lib/features/terminals/types';
	import type { Workspace } from '$lib/features/terminals/use-workspaces.svelte';

	interface Props {
		session: TerminalSession;
		workspaces: Workspace[];
		currentWorkspaceId: string;
		fontSize: number;
		viewMode: 'single' | 'grid';
		onRename: (id: string, title: string) => Promise<void>;
		onDuplicate: (session: TerminalSession) => Promise<void>;
		onMoveToWorkspace: (sessionId: string, workspaceId: string) => void;
		onFontSizeChange: (sessionId: string, size: number) => void;
		onFocus: (sessionId: string) => void;
		onClose: (id: string) => Promise<void>;
	}

	let {
		session,
		workspaces,
		currentWorkspaceId,
		fontSize,
		viewMode,
		onRename,
		onDuplicate,
		onMoveToWorkspace,
		onFontSizeChange,
		onFocus,
		onClose
	}: Props = $props();

	let renaming = $state(false);
	let renameValue = $state('');
	let renameBusy = $state(false);
	let duplicateBusy = $state(false);

	function startRename(): void {
		renameValue = session.title || session.profile;
		renaming = true;
	}

	function cancelRename(): void {
		renaming = false;
		renameValue = '';
	}

	async function submitRename(): Promise<void> {
		const title = renameValue.trim();
		if (!title || renameBusy) return;
		renameBusy = true;
		try {
			await onRename(session.id, title);
			cancelRename();
		} finally {
			renameBusy = false;
		}
	}

	async function duplicate(): Promise<void> {
		if (duplicateBusy) return;
		duplicateBusy = true;
		try {
			await onDuplicate(session);
		} finally {
			duplicateBusy = false;
		}
	}
</script>

<header class="pane-chrome">
	<div class="pane-chrome__identity">
		{#if renaming}
			<div class="pane-chrome__rename">
				<input
					bind:value={renameValue}
					maxlength="80"
					disabled={renameBusy}
					aria-label={`Rename terminal ${session.title || session.profile}`}
					onkeydown={(event) => {
						if (event.key === 'Enter') void submitRename();
						if (event.key === 'Escape') cancelRename();
					}}
				/>
				<button type="button" onclick={() => void submitRename()} disabled={renameBusy} aria-label="Save terminal name">
					<Check size={13} />
				</button>
				<button type="button" onclick={cancelRename} disabled={renameBusy} aria-label="Cancel terminal rename">
					<X size={13} />
				</button>
			</div>
		{:else}
			<button type="button" class="pane-chrome__title" onclick={startRename} title={`${session.title} · ${session.cwd}`}>
				<span>{session.title || session.profile}</span>
				<Pencil size={12} />
			</button>
		{/if}
		<span class="pane-chrome__cwd" title={session.cwd}>{session.cwd}</span>
	</div>

	<div class="pane-chrome__actions">
		{#if workspaces.length > 1}
			<label class="pane-chrome__workspace">
				<span class="sr-only">Move terminal to workspace</span>
				<select
					value={currentWorkspaceId}
					onchange={(event) => onMoveToWorkspace(session.id, event.currentTarget.value)}
					aria-label={`Workspace for ${session.title || session.profile}`}
					title="Move to workspace"
				>
					{#each workspaces as workspace (workspace.id)}
						<option value={workspace.id}>{workspace.name}</option>
					{/each}
				</select>
			</label>
		{/if}

		<div class="pane-chrome__zoom" aria-label="Terminal font size">
			<button
				type="button"
				onclick={() => onFontSizeChange(session.id, clampFontSize(fontSize - 1))}
				disabled={fontSize <= 9}
				aria-label="Decrease terminal font size"
				title="Smaller text"
			>
				<Minus size={13} />
			</button>
			<span>{fontSize}</span>
			<button
				type="button"
				onclick={() => onFontSizeChange(session.id, clampFontSize(fontSize + 1))}
				disabled={fontSize >= 24}
				aria-label="Increase terminal font size"
				title="Larger text"
			>
				<Plus size={13} />
			</button>
		</div>

		{#if viewMode === 'grid'}
			<button type="button" onclick={() => onFocus(session.id)} aria-label="Focus terminal" title="Focus terminal">
				<Focus size={14} />
			</button>
		{/if}
		<button type="button" onclick={() => void duplicate()} disabled={duplicateBusy} aria-label="Duplicate terminal" title="Duplicate terminal">
			<CopyPlus size={14} />
		</button>
		<button type="button" class="pane-chrome__danger" onclick={() => void onClose(session.id)} aria-label="Close terminal" title="Close terminal">
			<Trash2 size={14} />
		</button>
	</div>
</header>

<style>
	.pane-chrome {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 4px 6px 4px 9px;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--surface) 94%, #0b1220);
	}
	.pane-chrome__identity {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex: 1 1 auto;
	}
	.pane-chrome__title {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
		max-width: min(42vw, 280px);
		border: 0;
		background: transparent;
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 650;
		cursor: text;
	}
	.pane-chrome__title span,
	.pane-chrome__cwd {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pane-chrome__title :global(svg) {
		flex: 0 0 auto;
		opacity: 0.5;
	}
	.pane-chrome__cwd {
		min-width: 0;
		color: var(--ink-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.pane-chrome__rename {
		display: flex;
		align-items: center;
		gap: 3px;
		min-width: min(340px, 45vw);
	}
	.pane-chrome__rename input {
		min-width: 100px;
		flex: 1;
		height: 27px;
		border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border));
		border-radius: 6px;
		outline: none;
		background: var(--bg);
		color: var(--ink);
		padding: 0 7px;
		font-size: 0.74rem;
	}
	.pane-chrome__actions,
	.pane-chrome__zoom {
		display: flex;
		align-items: center;
		gap: 3px;
		flex: 0 0 auto;
	}
	.pane-chrome__actions button,
	.pane-chrome__rename button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 27px;
		height: 27px;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.pane-chrome__actions button:hover,
	.pane-chrome__rename button:hover {
		border-color: var(--border);
		background: var(--surface-2);
		color: var(--ink);
	}
	.pane-chrome__actions button:disabled,
	.pane-chrome__rename button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.pane-chrome__zoom {
		min-height: 27px;
		border: 1px solid var(--border);
		border-radius: 7px;
		padding: 0 2px;
		color: var(--ink-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.pane-chrome__zoom button {
		width: 22px;
		height: 23px;
		border: 0;
	}
	.pane-chrome__workspace select {
		max-width: 112px;
		height: 27px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface-2);
		color: var(--ink-muted);
		padding: 0 5px;
		font-size: 10px;
	}
	.pane-chrome__danger:hover {
		color: #fca5a5 !important;
		border-color: color-mix(in srgb, #ef4444 35%, var(--border)) !important;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 680px) {
		.pane-chrome {
			gap: 4px;
			padding-inline: 5px;
		}
		.pane-chrome__cwd,
		.pane-chrome__workspace,
		.pane-chrome__zoom span {
			display: none;
		}
		.pane-chrome__title {
			max-width: 35vw;
		}
		.pane-chrome__rename {
			min-width: min(210px, 48vw);
		}
	}
</style>
