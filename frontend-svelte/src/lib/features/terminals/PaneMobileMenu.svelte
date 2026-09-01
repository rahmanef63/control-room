<script lang="ts">
	import {
		ChevronRight,
		CopyPlus,
		Focus,
		Maximize2,
		Minimize2,
		Minus,
		MoreVertical,
		Palette,
		Plus,
		Settings2,
		Sparkles,
		Trash2,
		X
	} from 'lucide-svelte';

	import PaneAiLaunch from './PaneAiLaunch.svelte';
	import PaneToolsMenu from './PaneToolsMenu.svelte';
	import SessionColorPicker from './SessionColorPicker.svelte';
	import { clampFontSize, type RuntimeResolvedAgentProfile } from './types';
	import type { Workspace } from './use-workspaces.svelte';

	interface Props {
		sessionId: string;
		title: string;
		cwd: string;
		canSendInput: boolean;
		runtimeAgentProfileId?: string;
		workspaces: Workspace[];
		currentWorkspaceId: string;
		fontSize: number;
		viewMode: 'single' | 'grid';
		fullscreen: boolean;
		color: string;
		hasColorOverride: boolean;
		colorOwnerId: string;
		colorTitle?: string;
		agentProfiles: RuntimeResolvedAgentProfile[];
		boundAgentProfileId?: string;
		onBindAgent: (agentProfileId: string) => void;
		onInjectAgent: (agentProfileId: string, command: string) => void;
		onCommand: (command: string) => void;
		onUnbindAgent: () => void;
		onColorPick: (color: string) => void;
		onColorClear: () => void;
		onMoveToWorkspace: (workspaceId: string) => void;
		onFontSizeChange: (size: number) => void;
		onFocus: () => void;
		onToggleFullscreen: () => void;
		onDuplicate: () => Promise<void>;
		onClose: () => Promise<void>;
	}

	let {
		sessionId,
		title,
		cwd,
		canSendInput,
		runtimeAgentProfileId,
		workspaces,
		currentWorkspaceId,
		fontSize,
		viewMode,
		fullscreen,
		color,
		hasColorOverride,
		colorOwnerId,
		colorTitle,
		agentProfiles,
		boundAgentProfileId,
		onBindAgent,
		onInjectAgent,
		onCommand,
		onUnbindAgent,
		onColorPick,
		onColorClear,
		onMoveToWorkspace,
		onFontSizeChange,
		onFocus,
		onToggleFullscreen,
		onDuplicate,
		onClose
	}: Props = $props();

	type Submenu = 'color' | 'ai' | 'tools' | null;
	let menuOpen = $state(false);
	let submenu = $state<Submenu>(null);
	let busy = $state<'duplicate' | 'close' | null>(null);
	let wrapper = $state<HTMLDivElement | undefined>();
	let hasAi = $derived(agentProfiles.length > 0 || Boolean(runtimeAgentProfileId));

	function closeMenu(): void {
		menuOpen = false;
	}

	function openSubmenu(next: Exclude<Submenu, null>): void {
		menuOpen = false;
		submenu = next;
	}

	function run(action: () => void): void {
		closeMenu();
		action();
	}

	async function duplicate(): Promise<void> {
		if (busy) return;
		busy = 'duplicate';
		closeMenu();
		try {
			await onDuplicate();
		} finally {
			busy = null;
		}
	}

	async function closePane(): Promise<void> {
		if (busy) return;
		busy = 'close';
		closeMenu();
		try {
			await onClose();
		} finally {
			busy = null;
		}
	}
</script>

<svelte:window
	onmousedown={(event) => {
		if (!menuOpen) return;
		if (event.target instanceof Node && !wrapper?.contains(event.target)) closeMenu();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && menuOpen) closeMenu();
	}}
/>

<div class="pane-mobile-menu" bind:this={wrapper}>
	<button
		type="button"
		class="pane-mobile-menu__trigger"
		aria-label={`Open actions for ${title}`}
		aria-expanded={menuOpen}
		aria-haspopup="menu"
		title="Pane actions"
		onclick={() => (menuOpen = !menuOpen)}
	>
		<MoreVertical size={15} />
	</button>

	{#if menuOpen}
		<button type="button" class="pane-mobile-menu__backdrop" aria-label="Close pane actions" onclick={closeMenu}></button>
		<div class="pane-mobile-menu__sheet" role="menu" aria-label={`Actions for ${title}`}>
			<header class="pane-mobile-menu__header">
				<div>
					<strong>{title}</strong>
					<small title={cwd}>{cwd}</small>
				</div>
				<button type="button" aria-label="Close pane actions" onclick={closeMenu}><X size={15} /></button>
			</header>

			<div class="pane-mobile-menu__group">
				<button type="button" role="menuitem" onclick={() => openSubmenu('color')}>
					<Palette size={14} /><span>Color</span><ChevronRight size={13} />
				</button>
				{#if hasAi}
					<button type="button" role="menuitem" onclick={() => openSubmenu('ai')}>
						<Sparkles size={14} /><span>AI agents</span><ChevronRight size={13} />
					</button>
				{/if}
				<button type="button" role="menuitem" onclick={() => openSubmenu('tools')}>
					<Settings2 size={14} /><span>Skills & folders</span><ChevronRight size={13} />
				</button>
			</div>

			{#if workspaces.length > 1}
				<label class="pane-mobile-menu__workspace">
					<span>Workspace</span>
					<select
						value={currentWorkspaceId}
						onchange={(event) => {
							onMoveToWorkspace(event.currentTarget.value);
							closeMenu();
						}}
						aria-label={`Workspace for ${title}`}
					>
						{#each workspaces as workspace (workspace.id)}
							<option value={workspace.id}>{workspace.name}</option>
						{/each}
					</select>
				</label>
			{/if}

			<div class="pane-mobile-menu__zoom" aria-label="Terminal font size">
				<button
					type="button"
					disabled={fontSize <= 9}
					aria-label="Decrease terminal font size"
					onclick={() => onFontSizeChange(clampFontSize(fontSize - 1))}
				><Minus size={14} /></button>
				<span>{fontSize}px</span>
				<button
					type="button"
					disabled={fontSize >= 24}
					aria-label="Increase terminal font size"
					onclick={() => onFontSizeChange(clampFontSize(fontSize + 1))}
				><Plus size={14} /></button>
			</div>

			<div class="pane-mobile-menu__group pane-mobile-menu__group--secondary">
				{#if viewMode === 'grid'}
					<button type="button" role="menuitem" onclick={() => run(onFocus)}>
						<Focus size={14} /><span>Focus this pane</span>
					</button>
				{/if}
				<button type="button" role="menuitem" onclick={() => run(onToggleFullscreen)}>
					{#if fullscreen}<Minimize2 size={14} />{:else}<Maximize2 size={14} />{/if}
					<span>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
				</button>
				<button type="button" role="menuitem" disabled={busy === 'duplicate'} onclick={() => void duplicate()}>
					<CopyPlus size={14} /><span>Duplicate pane</span>
				</button>
				<button class="pane-mobile-menu__danger" type="button" role="menuitem" disabled={busy === 'close'} onclick={() => void closePane()}>
					<Trash2 size={14} /><span>Close terminal</span>
				</button>
			</div>
		</div>
	{/if}

	<SessionColorPicker
	sessionId={colorOwnerId}
	{color}
	hasOverride={hasColorOverride}
	onPick={onColorPick}
	onClear={onColorClear}
	title={colorTitle}
	hideTrigger
	open={submenu === 'color'}
	onOpenChange={(next) => (submenu = next ? 'color' : null)}
	/>

	<PaneAiLaunch
	{sessionId}
	{cwd}
	{agentProfiles}
	{boundAgentProfileId}
	{runtimeAgentProfileId}
	{canSendInput}
	onTrack={onBindAgent}
	onInject={onInjectAgent}
	onUnbind={onUnbindAgent}
	hideTrigger
	open={submenu === 'ai'}
	onOpenChange={(next) => (submenu = next ? 'ai' : null)}
	/>

	<PaneToolsMenu
	{cwd}
	{canSendInput}
	{onCommand}
	hideTrigger
	open={submenu === 'tools'}
	onOpenChange={(next) => (submenu = next ? 'tools' : null)}
	/>
</div>

<style>
	.pane-mobile-menu { display: none; position: relative; flex: 0 0 auto; }
	.pane-mobile-menu__trigger { display: grid; width: 29px; height: 29px; place-items: center; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface-2) 82%, transparent); color: var(--ink-muted); }
	.pane-mobile-menu__trigger[aria-expanded='true'] { border-color: rgb(56 189 248 / .42); color: #bae6fd; }
	.pane-mobile-menu__backdrop { position: fixed; inset: 0; z-index: 112; border: 0; background: rgb(4 8 16 / .62); }
	.pane-mobile-menu__sheet { position: fixed; right: calc(10px + var(--safe-right)); bottom: calc(10px + var(--safe-bottom)); left: calc(10px + var(--safe-left)); z-index: 113; display: grid; gap: 8px; max-height: calc(100dvh - var(--safe-top) - var(--safe-bottom) - 20px); overflow-y: auto; border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--surface) 98%, #07101d); padding: 10px; box-shadow: 0 20px 60px rgb(0 0 0 / .5); }
	.pane-mobile-menu__header { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; padding: 2px 2px 8px; border-bottom: 1px solid var(--border); }
	.pane-mobile-menu__header > div { display: grid; min-width: 0; gap: 1px; }
	.pane-mobile-menu__header strong, .pane-mobile-menu__header small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.pane-mobile-menu__header strong { color: var(--ink); font-size: 12px; }
	.pane-mobile-menu__header small { color: var(--ink-muted); font-family: var(--font-mono); font-size: 9px; }
	.pane-mobile-menu__header > button { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-2); color: var(--ink-muted); }
	.pane-mobile-menu__group { display: grid; gap: 5px; }
	.pane-mobile-menu__group > button { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 38px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); padding: 7px 9px; color: var(--ink-muted); font: inherit; font-size: 10px; font-weight: 650; text-align: left; }
	.pane-mobile-menu__group > button > span { color: var(--ink); }
	.pane-mobile-menu__group--secondary > button { grid-template-columns: auto minmax(0, 1fr); }
	.pane-mobile-menu__workspace { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; color: var(--ink-muted); font-size: 10px; }
	.pane-mobile-menu__workspace select { min-width: 0; height: 36px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink); padding: 0 8px; }
	.pane-mobile-menu__zoom { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: stretch; min-height: 38px; overflow: hidden; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
	.pane-mobile-menu__zoom button { display: grid; place-items: center; border: 0; background: transparent; color: var(--ink-muted); }
	.pane-mobile-menu__zoom button:first-child { border-right: 1px solid var(--border); }
	.pane-mobile-menu__zoom button:last-child { border-left: 1px solid var(--border); }
	.pane-mobile-menu__zoom span { display: grid; place-items: center; color: var(--ink); font-family: var(--font-mono); font-size: 10px; }
	.pane-mobile-menu__danger { color: #fca5a5 !important; }
	.pane-mobile-menu button { cursor: pointer; touch-action: manipulation; }
	.pane-mobile-menu button:disabled { cursor: default; opacity: .45; }

	@media (max-width: 680px) {
		.pane-mobile-menu { display: inline-flex; }
	}
</style>
