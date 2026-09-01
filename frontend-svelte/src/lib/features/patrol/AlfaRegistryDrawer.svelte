<script lang="ts">
	import { Bot, Eye, Inbox, Loader2, ShieldCheck, X } from 'lucide-svelte';
	import SessionColorPicker from '$lib/features/terminals/SessionColorPicker.svelte';
	import { sessionColors } from '$lib/features/terminals/session-colors.svelte';
	import type { TerminalSession } from '$lib/features/terminals/types';
	import type { Workspace } from '$lib/features/terminals/use-workspaces.svelte';
	import AlfaWatcherCard from './AlfaWatcherCard.svelte';
	import PatrolActivity from './PatrolActivity.svelte';
	import { alfaWatchers } from './alfa-watchers.svelte';
	import { patrolPings } from './patrol-pings.svelte';
	import { assignTarget, createWatcher, type AlfaWatcher } from './alfa';
	import './patrol.css';

	interface Props {
		sessions: TerminalSession[];
		workspaces: Workspace[];
		resolveWorkspace: (sessionId: string) => string;
		onClose: () => void;
		onInjectCommand: (sessionId: string, command: string) => void;
	}
	let { sessions, workspaces, resolveWorkspace, onClose, onInjectCommand }: Props = $props();
	let tab = $state<'registry' | 'activity'>('registry');
	let promotingId = $state<string | null>(null);
	let assigningId = $state<string | null>(null);
	let dragging = $state<{ sourceAlfaId: string | null; targetSessionId: string } | null>(null);
	let dragOver = $state<string | null>(null);

	let running = $derived(sessions.filter((session) => session.status === 'running'));
	let alfaIds = $derived(new Set(alfaWatchers.watchers.map((watcher) => watcher.id)));
	let targetIds = $derived(new Set(alfaWatchers.watchers.flatMap((watcher) => watcher.watchedSessionIds)));
	let promotable = $derived(running.filter((session) => !alfaIds.has(session.id)));
	let unassigned = $derived(running.filter((session) => !alfaIds.has(session.id) && !targetIds.has(session.id)));

	function workspaceName(id?: string): string {
		return workspaces.find((workspace) => workspace.id === id)?.name ?? 'default';
	}

	async function saveWatcher(watcher: AlfaWatcher): Promise<void> {
		await alfaWatchers.registerOrUpdate(watcher);
	}

	async function promote(session: TerminalSession): Promise<void> {
		if (promotingId) return;
		promotingId = session.id;
		try {
			const saved = await alfaWatchers.registerOrUpdate(
				createWatcher(session, { workspaceId: resolveWorkspace(session.id) })
			);
			if (saved && session.inner_agent) onInjectCommand(session.id, '/vps-alfa');
		} finally {
			promotingId = null;
		}
	}

	async function moveTarget(destinationAlfaId: string | null, targetSessionId: string): Promise<void> {
		if (assigningId) return;
		const before = alfaWatchers.watchers;
		const after = assignTarget(before, destinationAlfaId, targetSessionId);
		const changed = after.filter((watcher) => {
			const previous = before.find((entry) => entry.id === watcher.id);
			return !previous || JSON.stringify(previous) !== JSON.stringify(watcher);
		});
		if (changed.length === 0) return;
		assigningId = targetSessionId;
		try {
			// Server writes are read-modify-write, so serialize source/destination updates.
			for (const watcher of changed) await alfaWatchers.registerOrUpdate(watcher);
		} finally {
			assigningId = null;
			dragging = null;
			dragOver = null;
		}
	}

	function dragStart(event: DragEvent, sourceAlfaId: string | null, targetSessionId: string): void {
		dragging = { sourceAlfaId, targetSessionId };
		event.dataTransfer?.setData('text/plain', targetSessionId);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}
	function dragOverGroup(event: DragEvent, groupId: string): void {
		if (!dragging) return;
		event.preventDefault();
		dragOver = groupId;
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}
	function dropOn(event: DragEvent, destinationAlfaId: string | null): void {
		event.preventDefault();
		if (dragging) void moveTarget(destinationAlfaId, dragging.targetSessionId);
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />
<div class="alfa-overlay">
	<button type="button" class="alfa-backdrop" aria-label="Close Alfa patrol" onclick={onClose}></button>
	<div class="alfa-sheet" role="dialog" aria-modal="true" aria-label="Alfa registry">
		<header class="alfa-header"><div><h2>Alfa registry</h2><p><span class="alfa-role" data-role="alfa"><Bot size={11} /> ALFA</span> patrols <span class="alfa-role" data-role="target"><Eye size={11} /> TARGET</span> panes when they become quiet.</p></div><button type="button" class="alfa-icon" onclick={onClose} aria-label="Close Alfa registry"><X size={16} /></button></header>
		<div class="alfa-tabs" role="tablist" aria-label="Alfa registry sections"><button type="button" role="tab" aria-selected={tab === 'registry'} data-active={tab === 'registry' || undefined} onclick={() => (tab = 'registry')}><Bot size={14} /> Registry <span class="alfa-count">{alfaWatchers.watchers.length}</span></button><button type="button" role="tab" aria-selected={tab === 'activity'} data-active={tab === 'activity' || undefined} onclick={() => { tab = 'activity'; void patrolPings.refresh(); }}><Inbox size={14} /> Activity {#if patrolPings.pendingCount > 0}<span class="alfa-count" data-alert="true">{patrolPings.pendingCount}</span>{/if}</button></div>
		{#if alfaWatchers.error || patrolPings.error}<p class="alfa-error">{alfaWatchers.error ?? patrolPings.error}</p>{/if}
		<div class="alfa-body">
			{#if tab === 'activity'}
				<PatrolActivity {sessions} />
			{:else}
				<div class="alfa-stack">
					{#if alfaWatchers.loading && alfaWatchers.watchers.length === 0}<p class="alfa-empty"><Loader2 size={14} /> Loading registry…</p>{:else if alfaWatchers.watchers.length === 0}<div class="alfa-empty"><ShieldCheck size={22} /><strong>No ALFA registered</strong><p>Promote a running pane below. Plain shells are registered only; a pane with a detected AI CLI also receives <code>/vps-alfa</code>.</p></div>{/if}
					{#each alfaWatchers.watchers as watcher (watcher.id)}
						<AlfaWatcherCard {watcher} {sessions} {unassigned} workspaceName={workspaceName(watcher.scopeWorkspaceId)} draggingTargetId={dragging?.targetSessionId ?? null} dragOver={dragOver === watcher.id} {assigningId} onSave={saveWatcher} onDemote={async (id) => { await alfaWatchers.deregister(id); }} onMoveTarget={moveTarget} onDragStart={dragStart} onDragEnd={() => { dragging = null; dragOver = null; }} onDragOver={dragOverGroup} onDragLeave={(id) => dragOver === id && (dragOver = null)} onDrop={(event, id) => dropOn(event, id)} />
					{/each}
					<section role="group" aria-label="Unassigned terminals" class="alfa-unassigned" data-drop={dragOver === '__unassigned' || undefined} ondragover={(event) => dragOverGroup(event, '__unassigned')} ondragleave={() => dragOver === '__unassigned' && (dragOver = null)} ondrop={(event) => dropOn(event, null)}><header><Inbox size={14} /><strong>Unassigned terminals</strong><span class="alfa-count">{unassigned.length}</span></header>{#if unassigned.length === 0}<p>All running non-ALFA terminals are assigned.</p>{:else}<ul>{#each unassigned as session (session.id)}<li draggable="true" ondragstart={(event) => dragStart(event, null, session.id)} ondragend={() => { dragging = null; dragOver = null; }}><span class="alfa-dot" style:background-color={sessionColors.colorOf(session.id)}></span><strong>{session.title}</strong><small>{session.inner_agent ?? session.profile}</small></li>{/each}</ul>{/if}</section>
					{#if promotable.length > 0}<section class="alfa-promote"><header><span>Promote running pane to ALFA</span><small>AI panes auto-run <code>/vps-alfa</code>; plain shells are registered only.</small></header><ul>{#each promotable as session (session.id)}<li><SessionColorPicker sessionId={session.id} color={sessionColors.colorOf(session.id)} hasOverride={sessionColors.hasOverride(session.id)} onPick={(value) => sessionColors.setColor(session.id, value)} onClear={() => sessionColors.clearColor(session.id)} /><div><strong>{session.title}</strong><small>{session.inner_agent ?? 'shell · no AI'} · {workspaceName(resolveWorkspace(session.id))}</small></div><button type="button" class="alfa-primary" disabled={Boolean(promotingId)} onclick={() => void promote(session)}>{#if promotingId === session.id}<span class="alfa-spin"><Loader2 size={13} /></span>{:else}<Bot size={13} />{/if} Turn into ALFA</button></li>{/each}</ul></section>{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
