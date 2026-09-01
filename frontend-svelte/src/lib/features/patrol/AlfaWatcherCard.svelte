<script lang="ts">
	import { Bot, ChevronRight, Eye, Loader2, Power, Save } from 'lucide-svelte';
	import SessionColorPicker from '$lib/features/terminals/SessionColorPicker.svelte';
	import { sessionColors } from '$lib/features/terminals/session-colors.svelte';
	import type { TerminalSession } from '$lib/features/terminals/types';
	import {
		ALFA_DEFAULT_PROMPT,
		ALFA_PATROL_SENIOR_FULLSTACK_PROMPT,
		type AlfaPatrolMode,
		type AlfaWatcher
	} from './alfa';

	interface Props {
		watcher: AlfaWatcher;
		sessions: TerminalSession[];
		unassigned: TerminalSession[];
		workspaceName: string;
		draggingTargetId?: string | null;
		dragOver?: boolean;
		assigningId?: string | null;
		onSave: (watcher: AlfaWatcher) => Promise<void>;
		onDemote: (id: string) => Promise<void>;
		onMoveTarget: (destinationAlfaId: string | null, targetSessionId: string) => Promise<void>;
		onDragStart: (event: DragEvent, sourceAlfaId: string | null, targetSessionId: string) => void;
		onDragEnd: () => void;
		onDragOver: (event: DragEvent, groupId: string) => void;
		onDragLeave: (groupId: string) => void;
		onDrop: (event: DragEvent, destinationAlfaId: string) => void;
	}

	let {
		watcher,
		sessions,
		unassigned,
		workspaceName,
		draggingTargetId = null,
		dragOver = false,
		assigningId = null,
		onSave,
		onDemote,
		onMoveTarget,
		onDragStart,
		onDragEnd,
		onDragOver,
		onDragLeave,
		onDrop
	}: Props = $props();

	let expanded = $state(false);
	let expandedTarget = $state<string | null>(null);
	let saving = $state(false);
	let draft = $state<AlfaWatcher>({ id: '', watchedSessionIds: [], instructions: {}, defaultInstruction: ALFA_DEFAULT_PROMPT, mode: 'static', createdAt: 0 });
	let lastRemote = $state('');
	let draftTouched = $state(false);
	let dirty = $derived(draftTouched && JSON.stringify(draft) !== JSON.stringify(watcher));
	let color = $derived(sessionColors.colorOf(watcher.id));
	let alfaSession = $derived(sessions.find((session) => session.id === watcher.id));

	$effect(() => {
		const serialized = JSON.stringify(watcher);
		if (serialized === lastRemote) return;
		if (!draftTouched) {
			draft = cloneWatcher(watcher);
		} else {
			// Assignment/demotion can arrive while an editor field is dirty. Merge
			// structural target changes so saving a label/prompt never resurrects or
			// drops target relationships from a newer remote watcher.
			const instructions: Record<string, string> = {};
			for (const id of watcher.watchedSessionIds) {
				const value = draft.instructions[id] ?? watcher.instructions[id];
				if (value !== undefined) instructions[id] = value;
			}
			draft = { ...draft, watchedSessionIds: [...watcher.watchedSessionIds], instructions };
		}
		lastRemote = serialized;
	});

	function cloneWatcher(value: AlfaWatcher): AlfaWatcher {
		return { ...value, watchedSessionIds: [...value.watchedSessionIds], instructions: { ...value.instructions } };
	}

	function target(id: string): TerminalSession | undefined {
		return sessions.find((session) => session.id === id);
	}

	function patch(next: Partial<AlfaWatcher>): void {
		draftTouched = true;
		draft = { ...draft, ...next };
	}

	function setInstruction(targetId: string, text: string): void {
		draftTouched = true;
		draft = { ...draft, instructions: { ...draft.instructions, [targetId]: text } };
	}

	function changeMode(mode: AlfaPatrolMode): void {
		let defaultInstruction = draft.defaultInstruction;
		if (mode === 'static' && defaultInstruction === ALFA_PATROL_SENIOR_FULLSTACK_PROMPT) defaultInstruction = ALFA_DEFAULT_PROMPT;
		if (mode === 'patrol-senior-fullstack' && (!defaultInstruction || defaultInstruction === ALFA_DEFAULT_PROMPT)) defaultInstruction = ALFA_PATROL_SENIOR_FULLSTACK_PROMPT;
		patch({ mode, defaultInstruction });
	}

	async function save(): Promise<void> {
		if (!dirty || saving) return;
		saving = true;
		try {
			await onSave(cloneWatcher(draft));
			draftTouched = false;
			draft = cloneWatcher(watcher);
			lastRemote = JSON.stringify(watcher);
		} finally {
			saving = false;
		}
	}
</script>

<section
	role="group"
	aria-label={`Alfa ${alfaSession?.title ?? watcher.label ?? watcher.id.slice(0, 8)}`}
	class="alfa-group"
	style:--session-color={color}
	data-drop={dragOver || undefined}
	ondragover={(event) => onDragOver(event, watcher.id)}
	ondragleave={() => onDragLeave(watcher.id)}
	ondrop={(event) => onDrop(event, watcher.id)}
>
	<header class="alfa-group-head">
		<button type="button" class="alfa-chevron" onclick={() => (expanded = !expanded)} aria-label={expanded ? 'Collapse alfa detail' : 'Expand alfa detail'}><ChevronRight size={14} /></button>
		<SessionColorPicker sessionId={watcher.id} {color} hasOverride={sessionColors.hasOverride(watcher.id)} onPick={(value) => sessionColors.setColor(watcher.id, value)} onClear={() => sessionColors.clearColor(watcher.id)} />
		<span class="alfa-role" data-role="alfa"><Bot size={11} /> ALFA</span>
		<div class="alfa-group-copy"><strong>{alfaSession?.title ?? watcher.label ?? watcher.id.slice(0, 8)}</strong><small>{watcher.watchedSessionIds.length} watched · {workspaceName}</small></div>
		<button type="button" class="alfa-small-btn alfa-danger" onclick={() => void onDemote(watcher.id)}><Power size={12} /> Demote</button>
	</header>

	{#if expanded}
		<div class="alfa-editor">
			<label><span>Label</span><input value={draft.label ?? ''} oninput={(event) => patch({ label: event.currentTarget.value })} /></label>
			<label><span>Patrol mode</span><select value={draft.mode ?? 'static'} onchange={(event) => changeMode(event.currentTarget.value as AlfaPatrolMode)}><option value="static">Static prompt</option><option value="patrol-senior-fullstack">Senior Fullstack · context-aware</option></select></label>
			<label><span>Quiet threshold</span><select value={String(draft.silenceThresholdMs ?? 30000)} onchange={(event) => patch({ silenceThresholdMs: Number(event.currentTarget.value) })}><option value="10000">10s</option><option value="30000">30s</option><option value="60000">1m</option><option value="120000">2m</option><option value="300000">5m</option><option value="3600000">1h</option><option value="86400000">24h</option></select></label>
			<label class="alfa-wide"><span>{draft.mode === 'patrol-senior-fullstack' ? 'Patrol meta-template' : 'Default instruction'}</span><textarea rows={draft.mode === 'patrol-senior-fullstack' ? 5 : 3} value={draft.defaultInstruction} oninput={(event) => patch({ defaultInstruction: event.currentTarget.value })}></textarea></label>
			<div class="alfa-save-row"><button type="button" class="alfa-primary" disabled={!dirty || saving} onclick={() => void save()}>{#if saving}<span class="alfa-spin"><Loader2 size={13} /></span>{:else}<Save size={13} />{/if}{dirty ? 'Save ALFA' : 'No changes'}</button></div>
		</div>
	{/if}

	<ul class="alfa-targets">
		{#each watcher.watchedSessionIds as targetId (targetId)}
			{@const targetSession = target(targetId)}
			{#if targetSession}
				<li draggable="true" ondragstart={(event) => onDragStart(event, watcher.id, targetId)} ondragend={onDragEnd} data-dragging={draggingTargetId === targetId || undefined}>
					<div class="alfa-target-row">
						<button type="button" class="alfa-chevron" onclick={() => (expandedTarget = expandedTarget === targetId ? null : targetId)} aria-label={expandedTarget === targetId ? 'Collapse target detail' : 'Expand target detail'}><ChevronRight size={13} /></button>
						<span class="alfa-dot" style:background-color={color}></span><span class="alfa-role" data-role="target"><Eye size={11} /> TARGET</span>
						<div class="alfa-target-copy"><strong>{targetSession.title}</strong><small>{targetSession.inner_agent ?? targetSession.profile} · drag to another ALFA</small></div>
						<button type="button" class="alfa-small-btn" disabled={assigningId === targetId} onclick={() => void onMoveTarget(null, targetId)}>Unassign</button>
					</div>
					{#if expandedTarget === targetId}
						<div class="alfa-target-editor"><label><span>Per-target instruction</span><textarea rows="2" value={draft.instructions[targetId] ?? ''} placeholder={`Falls back to: ${draft.defaultInstruction}`} oninput={(event) => setInstruction(targetId, event.currentTarget.value)}></textarea></label><button type="button" class="alfa-primary" disabled={!dirty || saving} onclick={() => void save()}><Save size={13} /> Save</button></div>
					{/if}
				</li>
			{/if}
		{/each}
	</ul>

	{#if unassigned.length > 0}
		<label class="alfa-add-target"><span>Add target</span><select value="" onchange={(event) => { const id = event.currentTarget.value; event.currentTarget.value = ''; if (id) void onMoveTarget(watcher.id, id); }}><option value="">Choose running pane…</option>{#each unassigned as candidate (candidate.id)}<option value={candidate.id}>{candidate.title}</option>{/each}</select></label>
	{/if}
</section>
