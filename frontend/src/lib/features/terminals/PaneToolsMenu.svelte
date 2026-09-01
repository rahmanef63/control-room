<script lang="ts">
	import { FolderSearch, Loader2, MoreVertical, Sparkles } from 'lucide-svelte';

	import { buildChangeDirectoryCommand, groupSkills, type SkillSummary } from './pane-tools';

	interface Props {
		cwd: string;
		canSendInput: boolean;
		onCommand: (command: string) => void;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		hideTrigger?: boolean;
	}

	let { cwd, canSendInput, onCommand, open: controlledOpen, onOpenChange, hideTrigger = false }: Props = $props();
	let internalOpen = $state(false);
	let open = $derived(controlledOpen ?? internalOpen);
	let tab = $state<'skills' | 'folder'>('skills');
	let wrapper: HTMLDivElement | undefined = $state();
	let skills = $state<SkillSummary[]>([]);
	let loadedFor = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let explorerOpen = $state(false);
	let grouped = $derived(groupSkills(skills));

	function setOpen(next: boolean): void {
		if (onOpenChange) onOpenChange(next);
		else internalOpen = next;
	}

	async function loadSkills(): Promise<void> {
		if (loadedFor === cwd || loading) return;
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/skills?cwd=${encodeURIComponent(cwd)}`);
			const payload = (await response.json().catch(() => ({}))) as { skills?: SkillSummary[]; error?: string };
			if (!response.ok || !Array.isArray(payload.skills)) {
				throw new Error(payload.error ?? `Skills failed (${response.status})`);
			}
			skills = payload.skills;
			loadedFor = cwd;
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Skills failed';
		} finally {
			loading = false;
		}
	}

	function toggle(): void {
		const next = !open;
		setOpen(next);
		if (next && tab === 'skills') void loadSkills();
	}

	function selectTab(next: 'skills' | 'folder'): void {
		tab = next;
		if (next === 'skills') void loadSkills();
	}

	function inject(command: string): void {
		if (!canSendInput || !command.trim()) return;
		onCommand(command);
		setOpen(false);
	}

	function pickDirectory(path: string): void {
		inject(buildChangeDirectoryCommand(path));
		explorerOpen = false;
	}
</script>

<svelte:window
	onmousedown={(event) => {
		if (!open || hideTrigger) return;
		if (event.target instanceof Node && !wrapper?.contains(event.target)) setOpen(false);
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && open) setOpen(false);
	}}
/>

<div class="pane-tools" bind:this={wrapper}>
	{#if !hideTrigger}
		<button
			type="button"
			class="pane-tools__trigger"
			aria-label="Pane tools"
			aria-expanded={open}
			aria-haspopup="dialog"
			title="Skills and folder tools"
			onclick={toggle}
		>
			<MoreVertical size={14} />
		</button>
	{/if}

	{#if open && hideTrigger}
		<button type="button" class="pane-tools__backdrop" aria-label="Close pane tools" onclick={() => setOpen(false)}></button>
	{/if}

	{#if open}
		<div class="pane-tools__popover" class:pane-tools__popover--sheet={hideTrigger} role="dialog" aria-label="Pane tools menu">
			<nav class="pane-tools__tabs" aria-label="Pane tool sections">
				<button type="button" data-active={tab === 'skills' || undefined} onclick={() => selectTab('skills')}>
					<Sparkles size={12} /> Skills
				</button>
				<button type="button" data-active={tab === 'folder' || undefined} onclick={() => selectTab('folder')}>
					<FolderSearch size={12} /> Folder
				</button>
			</nav>

			{#if tab === 'skills'}
				<div class="pane-tools__body">
					{#if loading}
						<p class="pane-tools__empty"><Loader2 size={12} class="pane-tools__spinner" /> Loading skills…</p>
					{:else if error}
						<p class="pane-tools__empty pane-tools__empty--error">{error}</p>
					{:else if skills.length === 0}
						<p class="pane-tools__empty">No skills installed for this directory.</p>
					{:else}
						{#if grouped.project.length > 0}
							<section class="pane-tools__section">
								<p>Project</p>
								{#each grouped.project as skill (`project:${skill.id}`)}
									<button type="button" disabled={!canSendInput} title={skill.source} onclick={() => inject(skill.invocation)}>
										<Sparkles size={12} />
										<span><strong>{skill.name}</strong>{#if skill.description}<small>{skill.description}</small>{/if}</span>
									</button>
								{/each}
							</section>
						{/if}
						{#if grouped.global.length > 0}
							<section class="pane-tools__section">
								<p>Global</p>
								{#each grouped.global as skill (`global:${skill.id}`)}
									<button type="button" disabled={!canSendInput} title={skill.source} onclick={() => inject(skill.invocation)}>
										<Sparkles size={12} />
										<span><strong>{skill.name}</strong>{#if skill.description}<small>{skill.description}</small>{/if}</span>
									</button>
								{/each}
							</section>
						{/if}
					{/if}
				</div>
			{:else}
				<div class="pane-tools__folder">
					<div><strong>Current directory</strong><small title={cwd}>{cwd}</small></div>
					<button type="button" disabled={!canSendInput} onclick={() => { explorerOpen = true; setOpen(false); }}>
						<FolderSearch size={14} /> Browse folders
					</button>
					<p>Only directories allowed by the agent filesystem read roots are listed.</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if explorerOpen}
	{#await import('./FileExplorerDialog.svelte') then explorerModule}
		{@const FileExplorerDialog = explorerModule.default}
		<FileExplorerDialog onClose={() => (explorerOpen = false)} onPick={pickDirectory} />
	{/await}
{/if}

<style>
	.pane-tools { position: relative; display: inline-flex; flex: 0 0 auto; }
	.pane-tools__backdrop { position: fixed; inset: 0; z-index: 118; border: 0; background: rgb(4 8 16 / 0.62); }
	.pane-tools__trigger { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 7px; background: transparent; color: var(--ink-muted); cursor: pointer; }
	.pane-tools__trigger[aria-expanded='true'] { border-color: rgb(56 189 248 / 0.4); background: rgb(56 189 248 / 0.08); color: #bae6fd; }
	.pane-tools__popover { position: absolute; top: calc(100% + 7px); right: 0; z-index: 92; width: min(340px, calc(100vw - 20px)); max-height: min(460px, 70dvh); overflow: hidden; border: 1px solid var(--border); border-radius: 11px; background: color-mix(in srgb, var(--surface) 97%, #07101d); box-shadow: 0 18px 48px rgb(0 0 0 / 0.46); }
	.pane-tools__tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; border-bottom: 1px solid var(--border); padding: 7px; }
	.pane-tools__tabs button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 30px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface-2); color: var(--ink-muted); font: inherit; font-size: 9px; font-weight: 650; cursor: pointer; }
	.pane-tools__tabs button[data-active='true'] { border-color: rgb(56 189 248 / 0.4); color: #bae6fd; }
	.pane-tools__body { display: grid; gap: 10px; max-height: min(390px, 60dvh); overflow-y: auto; padding: 8px; }
	.pane-tools__section { display: grid; gap: 5px; }
	.pane-tools__section > p { margin: 0 2px; color: var(--ink-muted); font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
	.pane-tools__section > button { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 7px; width: 100%; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); padding: 7px 8px; color: rgb(196 181 253); text-align: left; cursor: pointer; }
	.pane-tools__section > button:disabled { opacity: 0.45; cursor: not-allowed; }
	.pane-tools__section > button > span { display: grid; min-width: 0; gap: 1px; }
	.pane-tools__section strong, .pane-tools__section small { overflow: hidden; text-overflow: ellipsis; }
	.pane-tools__section strong { color: var(--ink); font-size: 10px; white-space: nowrap; }
	.pane-tools__section small { color: var(--ink-muted); font-size: 8px; line-height: 1.35; }
	.pane-tools__empty { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0; padding: 24px 8px; color: var(--ink-muted); font-size: 9px; text-align: center; }
	.pane-tools__empty--error { color: #fca5a5; }
	:global(.pane-tools__spinner) { animation: pane-tools-spin 0.8s linear infinite; }
	@keyframes pane-tools-spin { to { transform: rotate(360deg); } }
	.pane-tools__folder { display: grid; gap: 8px; padding: 9px; }
	.pane-tools__folder > div { display: grid; gap: 2px; min-width: 0; }
	.pane-tools__folder strong { color: var(--ink); font-size: 10px; }
	.pane-tools__folder small { overflow: hidden; color: var(--ink-muted); font-family: var(--font-mono); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
	.pane-tools__folder > button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; border: 1px solid rgb(56 189 248 / 0.32); border-radius: 8px; background: rgb(56 189 248 / 0.08); color: #bae6fd; font: inherit; font-size: 9px; font-weight: 650; cursor: pointer; }
	.pane-tools__folder > button:disabled { opacity: 0.45; cursor: not-allowed; }
	.pane-tools__folder > p { margin: 0; color: var(--ink-muted); font-size: 8px; line-height: 1.4; }
	.pane-tools__popover--sheet { position: fixed; z-index: 119; }
	@media (max-width: 680px) { .pane-tools__popover { position: fixed; top: auto; right: calc(10px + var(--safe-right)); bottom: calc(10px + var(--safe-bottom)); left: calc(10px + var(--safe-left)); width: auto; max-height: calc(100dvh - var(--safe-top) - var(--safe-bottom) - 20px); } }
</style>
