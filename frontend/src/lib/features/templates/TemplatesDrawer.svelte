<script lang="ts">
	import { Bookmark, Copy, Pencil, Play, Plus, Trash2, X } from 'lucide-svelte';

	import TerminalProfileIcon from '$lib/features/terminals/TerminalProfileIcon.svelte';
	import type {
		RuntimeEnvironmentSummary,
		RuntimeResolvedAgentProfile,
		TerminalProfile,
		TerminalProfileDescriptor,
		TerminalSession
	} from '$lib/features/terminals/types';
	import type { Workspace } from '$lib/features/terminals/use-workspaces.svelte';
	import {
		templateInputFromSession,
		type TemplateCreateInput,
		type TemplateUpdateInput,
		type TerminalTemplate
	} from './templates';

	interface Props {
		templates: TerminalTemplate[];
		profiles: TerminalProfileDescriptor[];
		agentProfiles: RuntimeResolvedAgentProfile[];
		environments: RuntimeEnvironmentSummary[];
		workspaces: Workspace[];
		activeSession: TerminalSession | null;
		activeWorkspaceId: string;
		onClose: () => void;
		onCreate: (input: TemplateCreateInput) => TerminalTemplate;
		onUpdate: (id: string, input: TemplateUpdateInput) => TerminalTemplate | null;
		onDelete: (id: string) => void;
		onDuplicate: (id: string) => TerminalTemplate | null;
		onLaunch: (template: TerminalTemplate) => Promise<boolean>;
	}

	interface FormState {
		id?: string;
		name: string;
		description: string;
		profile: TerminalProfile;
		agentProfileId: string;
		environmentId: string;
		cwd: string;
		initialCommand: string;
		customTitle: string;
		workspaceId: string;
	}

	let {
		templates,
		profiles,
		agentProfiles,
		environments,
		workspaces,
		activeSession,
		activeWorkspaceId,
		onClose,
		onCreate,
		onUpdate,
		onDelete,
		onDuplicate,
		onLaunch
	}: Props = $props();

	const emptyForm = (): FormState => ({
		name: '',
		description: '',
		profile: 'shell',
		agentProfileId: '',
		environmentId: '',
		cwd: '',
		initialCommand: '',
		customTitle: '',
		workspaceId: ''
	});

	let form = $state<FormState>(emptyForm());
	let editing = $state(false);
	let launchingId = $state<string | null>(null);

	function startCreate(): void {
		form = { ...emptyForm(), workspaceId: activeWorkspaceId };
		editing = true;
	}

	function startCreateFromActive(): void {
		if (!activeSession) {
			startCreate();
			return;
		}
		const input = templateInputFromSession(activeSession, activeWorkspaceId);
		form = {
			name: input.name,
			description: input.description ?? '',
			profile: input.profile ?? 'shell',
			agentProfileId: input.agentProfileId ?? '',
			environmentId: input.environmentId ?? '',
			cwd: input.cwd ?? '',
			initialCommand: input.initialCommand ?? '',
			customTitle: input.customTitle ?? '',
			workspaceId: input.workspaceId ?? ''
		};
		editing = true;
	}

	function startEdit(template: TerminalTemplate): void {
		form = {
			id: template.id,
			name: template.name,
			description: template.description ?? '',
			profile: template.profile ?? 'shell',
			agentProfileId: template.agentProfileId ?? '',
			environmentId: template.environmentId ?? '',
			cwd: template.cwd ?? '',
			initialCommand: template.initialCommand ?? '',
			customTitle: template.customTitle ?? '',
			workspaceId: template.workspaceId ?? ''
		};
		editing = true;
	}

	function cancelEdit(): void {
		form = emptyForm();
		editing = false;
	}

	function formInput(): TemplateCreateInput {
		return {
			name: form.name,
			description: form.description || undefined,
			profile: form.profile || undefined,
			agentProfileId: form.agentProfileId || undefined,
			environmentId: form.environmentId || undefined,
			cwd: form.cwd || undefined,
			initialCommand: form.initialCommand || undefined,
			customTitle: form.customTitle || undefined,
			workspaceId: form.workspaceId || undefined
		};
	}

	function submit(event: SubmitEvent): void {
		event.preventDefault();
		if (form.id) onUpdate(form.id, formInput());
		else onCreate(formInput());
		cancelEdit();
	}

	async function launch(template: TerminalTemplate): Promise<void> {
		if (launchingId) return;
		launchingId = template.id;
		try {
			if (await onLaunch(template)) onClose();
		} finally {
			launchingId = null;
		}
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<button type="button" class="templates-backdrop" aria-label="Close templates" onclick={onClose}></button>
<div class="templates-panel" role="dialog" aria-modal="true" aria-label="Templates">
	<header class="templates-header">
		<div>
			<h2>Templates · quick launch</h2>
			<p>Save a terminal recipe, then relaunch it with the same runtime options.</p>
		</div>
		<button type="button" class="icon-button" aria-label="Close templates" onclick={onClose}><X size={16} /></button>
	</header>

	<div class="templates-body">
		{#if !editing}
			<div class="template-create-actions">
				<button type="button" class="primary-action" onclick={startCreate}><Plus size={15} /> Blank template</button>
				<button type="button" class="secondary-action" disabled={!activeSession} onclick={startCreateFromActive}>
					<Bookmark size={15} /> {activeSession ? `Save “${activeSession.title}”` : 'No active session'}
				</button>
			</div>

			{#if templates.length === 0}
				<p class="templates-empty">No templates yet. Save the current terminal or create a blank template.</p>
			{:else}
				<ul class="template-list">
					{#each templates as template (template.id)}
						<li class="template-card" style:--template-color={template.color ?? '#38bdf8'}>
							<div class="template-card__head">
								<span class="template-dot"></span>
								<span class="template-profile"><TerminalProfileIcon profile={template.profile ?? 'shell'} size={14} /></span>
								<strong>{template.name}</strong>
								<code>{template.profile ?? 'shell'}</code>
							</div>
							{#if template.description}<p>{template.description}</p>{/if}
							<div class="template-meta">
								{#if template.cwd}<span class="mono">{template.cwd}</span>{/if}
								{#if template.initialCommand}<span class="mono">$ {template.initialCommand}</span>{/if}
								{#if template.workspaceId}<span>ws: {workspaces.find((workspace) => workspace.id === template.workspaceId)?.name ?? template.workspaceId}</span>{/if}
							</div>
							<div class="template-actions">
								<button type="button" aria-label={`Launch template ${template.name}`} title="Launch" disabled={Boolean(launchingId)} onclick={() => void launch(template)}>
									<Play size={14} />
								</button>
								<button type="button" aria-label={`Edit template ${template.name}`} title="Edit" onclick={() => startEdit(template)}><Pencil size={14} /></button>
								<button type="button" aria-label={`Duplicate template ${template.name}`} title="Duplicate" onclick={() => onDuplicate(template.id)}><Copy size={14} /></button>
								<button type="button" aria-label={`Delete template ${template.name}`} title="Delete" onclick={() => { if (confirm(`Delete template “${template.name}”?`)) onDelete(template.id); }}><Trash2 size={14} /></button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<form class="template-form" onsubmit={submit}>
				<label><span>Name</span><input required bind:value={form.name} /></label>
				<label><span>Description</span><input bind:value={form.description} /></label>
				<label>
					<span>Profile</span>
					<select bind:value={form.profile}>
						{#each profiles as profile (profile.profile)}<option value={profile.profile}>{profile.title}</option>{/each}
					</select>
				</label>
				<label>
					<span>Agent profile</span>
					<select bind:value={form.agentProfileId}><option value="">—</option>{#each agentProfiles as agent (agent.id)}<option value={agent.id}>{agent.label}</option>{/each}</select>
				</label>
				<label>
					<span>Environment</span>
					<select bind:value={form.environmentId}><option value="">—</option>{#each environments as environment (environment.id)}<option value={environment.id}>{environment.label}</option>{/each}</select>
				</label>
				<label>
					<span>Workspace</span>
					<select bind:value={form.workspaceId}><option value="">— current —</option>{#each workspaces as workspace (workspace.id)}<option value={workspace.id}>{workspace.name}</option>{/each}</select>
				</label>
				<label><span>cwd</span><input class="mono" placeholder="/absolute/path" bind:value={form.cwd} /></label>
				<label><span>Initial command</span><input class="mono" placeholder="npm run dev" bind:value={form.initialCommand} /></label>
				<label><span>Custom title</span><input placeholder="uses session default" bind:value={form.customTitle} /></label>
				<div class="form-actions">
					<button type="submit" class="primary-action">{form.id ? 'Save' : 'Create'}</button>
					<button type="button" class="secondary-action" onclick={cancelEdit}>Cancel</button>
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	.templates-backdrop { position: fixed; inset: 0; z-index: 120; border: 0; background: rgb(4 8 16 / 0.72); backdrop-filter: blur(7px); }
	.templates-panel { position: fixed; z-index: 121; right: 50%; top: 50%; display: flex; width: min(620px, calc(100vw - 24px)); max-height: min(820px, calc(100dvh - 24px)); transform: translate(50%, -50%); flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: color-mix(in srgb, var(--surface) 97%, #07101d); box-shadow: 0 24px 80px rgb(0 0 0 / 0.52); }
	.templates-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
	.templates-header h2, .templates-header p { margin: 0; }
	.templates-header h2 { color: var(--ink); font-size: 13px; }
	.templates-header p { margin-top: 2px; color: var(--ink-muted); font-size: 10px; }
	.icon-button, .template-actions button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--ink-muted); cursor: pointer; }
	.icon-button { width: 32px; height: 32px; flex: 0 0 auto; border-radius: 999px; }
	.templates-body { display: grid; min-height: 0; gap: 10px; overflow-y: auto; padding: 12px; }
	.template-create-actions, .form-actions { display: flex; gap: 8px; }
	.primary-action, .secondary-action { display: inline-flex; min-height: 36px; flex: 1; align-items: center; justify-content: center; gap: 6px; border-radius: 9px; padding: 7px 10px; font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; }
	.primary-action { border: 1px solid rgb(56 189 248 / 0.42); background: rgb(56 189 248 / 0.12); color: #bae6fd; }
	.secondary-action { border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-muted); }
	.primary-action:disabled, .secondary-action:disabled, .template-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
	.templates-empty { margin: 0; border: 1px dashed var(--border); border-radius: 10px; padding: 26px 12px; color: var(--ink-muted); font-size: 11px; text-align: center; }
	.template-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
	.template-card { display: grid; gap: 7px; border: 1px solid var(--border); border-left: 3px solid var(--template-color); border-radius: 11px; background: var(--surface-2); padding: 10px; }
	.template-card__head { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 7px; }
	.template-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--template-color); }
	.template-profile { display: inline-flex; color: var(--template-color); }
	.template-card strong { min-width: 0; overflow: hidden; color: var(--ink); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
	.template-card code { color: var(--ink-muted); font-family: var(--font-mono); font-size: 9px; }
	.template-card p { margin: 0; color: var(--ink-muted); font-size: 10px; line-height: 1.4; }
	.template-meta { display: flex; flex-wrap: wrap; gap: 5px 10px; color: var(--ink-muted); font-size: 9px; }
	.mono { font-family: var(--font-mono); }
	.template-actions { display: flex; justify-content: flex-end; gap: 5px; }
	.template-actions button { width: 30px; height: 28px; }
	.template-form { display: grid; gap: 8px; }
	.template-form label { display: grid; grid-template-columns: 125px minmax(0, 1fr); align-items: center; gap: 9px; color: var(--ink-muted); font-size: 10px; }
	.template-form input, .template-form select { min-width: 0; width: 100%; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); padding: 7px 8px; color: var(--ink); font: inherit; font-size: 10px; outline: none; }
	.template-form input:focus, .template-form select:focus { border-color: rgb(56 189 248 / 0.48); }
	@media (max-width: 640px) {
		.templates-panel { right: 0; top: auto; bottom: 0; width: 100%; max-height: calc(100dvh - max(8px, env(safe-area-inset-top))); transform: none; border-right: 0; border-bottom: 0; border-left: 0; border-radius: 18px 18px 0 0; padding-bottom: env(safe-area-inset-bottom); }
		.template-create-actions, .form-actions { flex-direction: column; }
		.template-form label { grid-template-columns: 1fr; gap: 4px; }
	}
</style>
