<script lang="ts">
	import './pane-chrome.css';
	import {
		Check,
		CheckCircle2,
		CopyPlus,
		Focus,
		Loader2,
		Maximize2,
		MessageCircleQuestion,
		Minimize2,
		Minus,
		Pencil,
		Plus,
		Trash2,
		X
	} from 'lucide-svelte';

	import PaneAiLaunch from '$lib/features/terminals/PaneAiLaunch.svelte';
	import PaneMobileMenu from '$lib/features/terminals/PaneMobileMenu.svelte';
	import PaneToolsMenu from '$lib/features/terminals/PaneToolsMenu.svelte';
	import SessionColorPicker from '$lib/features/terminals/SessionColorPicker.svelte';
	import TerminalProfileIcon from '$lib/features/terminals/TerminalProfileIcon.svelte';
	import {
		clampFontSize,
		type ConnectionState,
		type RuntimeResolvedAgentProfile,
		type TerminalSession
	} from '$lib/features/terminals/types';
	import type { ActivityState } from '$lib/features/terminals/telemetry';
	import type { Workspace } from '$lib/features/terminals/use-workspaces.svelte';

	interface Props {
		session: TerminalSession;
		workspaces: Workspace[];
		currentWorkspaceId: string;
		fontSize: number;
		viewMode: 'single' | 'grid';
		connectionState: ConnectionState;
		rttMs: number | null;
		activityState: ActivityState;
		activityLabel: string;
		showActivity: boolean;
		fullscreen: boolean;
		color: string;
		hasColorOverride: boolean;
		agentProfiles: RuntimeResolvedAgentProfile[];
		boundAgentProfileId?: string;
		onBindAgent: (agentProfileId: string) => void;
		onInjectAgent: (agentProfileId: string, command: string) => void;
		onCommand: (command: string) => void;
		onUnbindAgent: () => void;
		onColorPick: (color: string) => void;
		onColorClear: () => void;
		onRename: (id: string, title: string) => Promise<void>;
		onDuplicate: (session: TerminalSession) => Promise<void>;
		onMoveToWorkspace: (sessionId: string, workspaceId: string) => void;
		onFontSizeChange: (sessionId: string, size: number) => void;
		onFocus: (sessionId: string) => void;
		onToggleFullscreen: () => void;
		onClose: (id: string) => Promise<void>;
	}

	let {
		session,
		workspaces,
		currentWorkspaceId,
		fontSize,
		viewMode,
		connectionState,
		rttMs,
		activityState,
		activityLabel,
		showActivity,
		fullscreen,
		color,
		hasColorOverride,
		agentProfiles,
		boundAgentProfileId,
		onBindAgent,
		onInjectAgent,
		onCommand,
		onUnbindAgent,
		onColorPick,
		onColorClear,
		onRename,
		onDuplicate,
		onMoveToWorkspace,
		onFontSizeChange,
		onFocus,
		onToggleFullscreen,
		onClose
	}: Props = $props();

	let renaming = $state(false);
	let renameValue = $state('');
	let renameBusy = $state(false);
	let duplicateBusy = $state(false);

	let latencyTone = $derived(
		rttMs === null ? 'unknown' : rttMs < 80 ? 'good' : rttMs < 200 ? 'warn' : 'slow'
	);
	let connectionLabel = $derived(
		connectionState === 'connected'
			? 'Stream connected'
			: connectionState === 'connecting'
				? 'Connecting…'
				: connectionState === 'reconnecting'
					? 'Reconnecting…'
					: 'Disconnected'
	);

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

{#snippet latencyBadge()}
	<span
		class="pane-chrome__latency"
		data-state={connectionState}
		data-tone={latencyTone}
		title={`${connectionLabel}${rttMs === null ? '' : ` · input round-trip ~${rttMs}ms`}`}
	>
		<span class="pane-chrome__latency-dot"></span>
		<span>{rttMs === null ? '—' : `${rttMs}ms`}</span>
	</span>
{/snippet}

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
				<span class="pane-chrome__profile"><TerminalProfileIcon profile={session.profile} size={13} /></span>
				<span>{session.title || session.profile}</span>
				<Pencil size={12} />
			</button>
		{/if}
		<span class="pane-chrome__cwd" title={session.cwd}>{session.cwd}</span>
		{#if showActivity}
			<span class="pane-chrome__activity" data-state={activityState} title={activityLabel}>
				{#if activityState === 'working' || activityState === 'planning'}
					<Loader2 size={12} />
				{:else if activityState === 'asking' || activityState === 'waiting'}
					<MessageCircleQuestion size={12} />
				{:else if activityState === 'done'}
					<CheckCircle2 size={12} />
				{/if}
				<span>{activityLabel}</span>
			</span>
		{/if}
	</div>

	<div class="pane-chrome__actions pane-chrome__actions--desktop">
		<SessionColorPicker
			sessionId={session.id}
			{color}
			hasOverride={hasColorOverride}
			onPick={onColorPick}
			onClear={onColorClear}
		/>
		<PaneAiLaunch
			sessionId={session.id}
			cwd={session.cwd}
			{agentProfiles}
			{boundAgentProfileId}
			runtimeAgentProfileId={session.agent_profile_id}
			canSendInput={session.status === 'running'}
			onTrack={onBindAgent}
			onInject={onInjectAgent}
			onUnbind={onUnbindAgent}
		/>
		<PaneToolsMenu
			cwd={session.cwd}
			canSendInput={session.status === 'running'}
			{onCommand}
		/>
		{@render latencyBadge()}
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
		<button
			type="button"
			onclick={onToggleFullscreen}
			aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
			title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
		>
			{#if fullscreen}<Minimize2 size={14} />{:else}<Maximize2 size={14} />{/if}
		</button>
		<button type="button" onclick={() => void duplicate()} disabled={duplicateBusy} aria-label="Duplicate terminal" title="Duplicate terminal">
			<CopyPlus size={14} />
		</button>
		<button type="button" class="pane-chrome__danger" onclick={() => void onClose(session.id)} aria-label="Close terminal" title="Close terminal">
			<Trash2 size={14} />
		</button>
	</div>

	<div class="pane-chrome__mobile-actions">
		{@render latencyBadge()}
		<PaneMobileMenu
			sessionId={session.id}
			title={session.title || session.profile}
			cwd={session.cwd}
			canSendInput={session.status === 'running'}
			runtimeAgentProfileId={session.agent_profile_id}
			{workspaces}
			{currentWorkspaceId}
			{fontSize}
			{viewMode}
			{fullscreen}
			{color}
			{hasColorOverride}
			{agentProfiles}
			{boundAgentProfileId}
			{onBindAgent}
			{onInjectAgent}
			{onCommand}
			{onUnbindAgent}
			{onColorPick}
			{onColorClear}
			onMoveToWorkspace={(workspaceId) => onMoveToWorkspace(session.id, workspaceId)}
			onFontSizeChange={(size) => onFontSizeChange(session.id, size)}
			onFocus={() => onFocus(session.id)}
			{onToggleFullscreen}
			onDuplicate={() => duplicate()}
			onClose={() => onClose(session.id)}
		/>
	</div>
</header>
