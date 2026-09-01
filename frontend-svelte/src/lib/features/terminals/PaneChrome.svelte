<script lang="ts">
	import {
		Check,
		Bot,
		CheckCircle2,
		Eye,
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
	import type { AlfaWatcher } from '$lib/features/patrol/alfa';
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
		colorOwnerId: string;
		selfWatcher?: AlfaWatcher;
		parentAlfa?: AlfaWatcher;
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
		colorOwnerId,
		selfWatcher,
		parentAlfa,
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
		{#if selfWatcher}
			<span class="pane-chrome__role" data-role="alfa" title={`ALFA patrol · ${selfWatcher.watchedSessionIds.length} target(s)`}><Bot size={11} /> ALFA <b>{selfWatcher.watchedSessionIds.length}</b></span>
		{:else if parentAlfa}
			<span class="pane-chrome__role" data-role="target" title={`Patrol target of ${parentAlfa.label ?? parentAlfa.id.slice(0, 8)}`}><Eye size={11} /> TARGET <b>◄ {parentAlfa.label ?? parentAlfa.id.slice(0, 8)}</b></span>
		{/if}
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
			sessionId={colorOwnerId}
			{color}
			hasOverride={hasColorOverride}
			onPick={onColorPick}
			onClear={onColorClear}
			title={parentAlfa ? `Inherits color from ALFA ${parentAlfa.label ?? parentAlfa.id.slice(0, 8)} — click to change ALFA color` : undefined}
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
			{colorOwnerId}
			colorTitle={parentAlfa ? `Inherits color from ALFA ${parentAlfa.label ?? parentAlfa.id.slice(0, 8)} — click to change ALFA color` : undefined}
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
	}
	.pane-chrome__profile {
		display: inline-flex;
		color: var(--session-color, var(--accent));
	}
	.pane-chrome__title > :global(svg:last-child) { opacity: 0.5; }
	.pane-chrome__role { display: inline-flex; align-items: center; gap: 4px; max-width: 150px; flex: 0 0 auto; border-radius: 5px; padding: 2px 5px; font-size: 8px; font-weight: 800; letter-spacing: .05em; white-space: nowrap; }
	.pane-chrome__role[data-role='alfa'] { background: rgb(139 92 246 / .14); color: rgb(196 181 253); }
	.pane-chrome__role[data-role='target'] { background: color-mix(in srgb, var(--session-color) 13%, transparent); color: var(--session-color); }
	.pane-chrome__role b { max-width: 76px; overflow: hidden; font-size: 8px; font-weight: 650; text-overflow: ellipsis; }
	.pane-chrome__cwd {
		min-width: 0;
		color: var(--ink-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.pane-chrome__activity {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex: 0 0 auto;
		max-width: 150px;
		padding: 2px 7px;
		border: 1px solid;
		border-radius: 999px;
		font-size: 9px;
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.pane-chrome__activity[data-state='working'],
	.pane-chrome__activity[data-state='planning'] {
		border-color: rgb(252 211 77 / 0.32);
		background: rgb(252 211 77 / 0.1);
		color: rgb(252 211 77);
	}
	.pane-chrome__activity[data-state='asking'],
	.pane-chrome__activity[data-state='waiting'] {
		border-color: rgb(125 211 252 / 0.34);
		background: rgb(56 189 248 / 0.1);
		color: rgb(125 211 252);
	}
	.pane-chrome__activity[data-state='done'] {
		border-color: rgb(134 239 172 / 0.34);
		background: rgb(74 222 128 / 0.08);
		color: rgb(167 243 208);
	}
	.pane-chrome__activity[data-state='working'] :global(svg),
	.pane-chrome__activity[data-state='planning'] :global(svg) {
		animation: telemetry-spin 0.9s linear infinite;
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
	.pane-chrome__latency {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 27px;
		padding: 0 6px;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: color-mix(in srgb, var(--bg) 58%, transparent);
		color: var(--ink-muted);
		font-family: var(--font-mono);
		font-size: 9px;
		font-variant-numeric: tabular-nums;
	}
	.pane-chrome__latency-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #f43f5e;
	}
	.pane-chrome__latency[data-state='connected'] .pane-chrome__latency-dot { background: #34d399; }
	.pane-chrome__latency[data-state='connecting'] .pane-chrome__latency-dot,
	.pane-chrome__latency[data-state='reconnecting'] .pane-chrome__latency-dot {
		background: #fbbf24;
		animation: telemetry-pulse 1.2s ease-in-out infinite;
	}
	.pane-chrome__latency[data-tone='good'] { color: #6ee7b7; }
	.pane-chrome__latency[data-tone='warn'] { color: #fcd34d; }
	.pane-chrome__latency[data-tone='slow'] { color: #fda4af; }
	@keyframes telemetry-spin { to { transform: rotate(360deg); } }
	@keyframes telemetry-pulse { 50% { opacity: 0.45; transform: scale(0.78); } }

	.pane-chrome__mobile-actions { display: none; }
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
			gap: 5px;
			padding: 4px 5px 4px 7px;
		}
		.pane-chrome__identity {
			gap: 4px;
		}
		.pane-chrome__cwd,
		.pane-chrome__activity span,
		.pane-chrome__workspace,
		.pane-chrome__zoom span,
		.pane-chrome__role b {
			display: none;
		}
		.pane-chrome__title {
			flex: 1 1 auto;
			max-width: 100%;
		}
		.pane-chrome__rename {
			min-width: 0;
			width: min(220px, 58vw);
		}
		.pane-chrome__actions--desktop {
			display: none;
		}
		.pane-chrome__mobile-actions {
			display: flex;
			align-items: center;
			gap: 4px;
			flex: 0 0 auto;
			margin-left: auto;
		}
		.pane-chrome__mobile-actions .pane-chrome__latency {
			min-height: 27px;
			padding-inline: 5px;
		}
	}
</style>
