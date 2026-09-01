<script lang="ts">
	import { onMount } from 'svelte';
	import { Loader2, Pencil, Play, Plus, Trash2, X } from 'lucide-svelte';

	import type {
		RuntimeEnvironmentSummary,
		RuntimeResolvedAgentProfile,
		TerminalProfile,
		TerminalProfileDescriptor,
		TerminalSession
	} from '$lib/features/terminals/types';
	import {
		cronEntryToForm,
		cronFormToInput,
		cronRunLabel,
		emptyCronForm,
		type CronCreateInput,
		type CronEntry,
		type CronFormState,
		type CronUpdateInput
	} from './crons';

	interface Props {
		crons: CronEntry[];
		loading: boolean;
		error: string | null;
		profiles: TerminalProfileDescriptor[];
		agentProfiles: RuntimeResolvedAgentProfile[];
		environments: RuntimeEnvironmentSummary[];
		sessions: TerminalSession[];
		onClose: () => void;
		onRefresh: () => Promise<void>;
		onCreate: (input: CronCreateInput) => Promise<CronEntry | null>;
		onUpdate: (id: string, input: CronUpdateInput) => Promise<CronEntry | null>;
		onDelete: (id: string) => Promise<boolean>;
		onRun: (id: string) => Promise<CronEntry | null>;
	}

	let {
		crons,
		loading,
		error,
		profiles,
		agentProfiles,
		environments,
		sessions,
		onClose,
		onRefresh,
		onCreate,
		onUpdate,
		onDelete,
		onRun
	}: Props = $props();

	let form = $state<CronFormState>(emptyCronForm());
	let editing = $state(false);
	let submitting = $state(false);
	let runningId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);

	let runningSessions = $derived(sessions.filter((session) => session.status === 'running'));

	onMount(() => {
		void onRefresh();
	});

	function startCreate(): void {
		form = emptyCronForm();
		editing = true;
	}

	function startEdit(entry: CronEntry): void {
		form = cronEntryToForm(entry);
		editing = true;
	}

	function cancelEdit(): void {
		form = emptyCronForm();
		editing = false;
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (submitting) return;
		submitting = true;
		try {
			const input = cronFormToInput(form);
			const saved = form.id ? await onUpdate(form.id, input) : await onCreate(input);
			if (saved) cancelEdit();
		} finally {
			submitting = false;
		}
	}

	async function runNow(id: string): Promise<void> {
		if (runningId) return;
		runningId = id;
		try {
			await onRun(id);
		} finally {
			runningId = null;
		}
	}

	async function remove(entry: CronEntry): Promise<void> {
		if (deletingId) return;
		if (!confirm(`Delete cron "${entry.name}"?`)) return;
		deletingId = entry.id;
		try {
			await onDelete(entry.id);
		} finally {
			deletingId = null;
		}
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div class="cron-overlay">
	<button class="cron-backdrop" type="button" aria-label="Close cron jobs" onclick={onClose}></button>
	<div class="cron-panel" role="dialog" aria-modal="true" aria-label="Cron jobs">
		<header class="cron-header">
			<div>
				<strong>Automation · cron jobs</strong>
				<small>Schedule a terminal spawn or send input to a live pane.</small>
			</div>
			<div class="cron-header__actions">
				<button type="button" onclick={() => void onRefresh()} aria-label="Refresh cron jobs" title="Refresh">
					<span class:spin={loading}><Loader2 size={15} /></span>
				</button>
				<button type="button" onclick={onClose} aria-label="Close cron jobs"><X size={15} /></button>
			</div>
		</header>

		{#if error}
			<p class="cron-error">{error}</p>
		{/if}

		<div class="cron-body">
			{#if !editing}
				<button type="button" class="cron-primary" onclick={startCreate}><Plus size={15} /> New cron</button>

				{#if loading && crons.length === 0}
					<p class="cron-empty">Loading cron jobs…</p>
				{:else if crons.length === 0}
					<p class="cron-empty">No crons yet. Create one to schedule terminal automation.</p>
				{:else}
					<ul class="cron-list">
						{#each crons as entry (entry.id)}
							<li class="cron-card" data-enabled={entry.enabled || undefined}>
								<div class="cron-card__head">
									<strong title={entry.name}>{entry.name}</strong>
									<code>{entry.cronExpr}</code>
								</div>
								<div class="cron-card__meta">
									<span>{entry.action.type}</span>
									{#if entry.action.type === 'spawn' && entry.action.initialCommand}
										<span class="mono" title={entry.action.initialCommand}>$ {entry.action.initialCommand}</span>
									{:else if entry.action.type === 'send_input'}
										<span class="mono">→ {entry.action.sessionId.slice(0, 8)}</span>
									{/if}
									<span data-ok={entry.lastResult?.ok}>{cronRunLabel(entry)}</span>
									{#if entry.lastRunAt}<span>{new Date(entry.lastRunAt).toLocaleString()}</span>{/if}
								</div>
								<div class="cron-card__actions">
									<button type="button" onclick={() => void runNow(entry.id)} disabled={Boolean(runningId)} aria-label={`Run ${entry.name} now`} title="Run now">
										{#if runningId === entry.id}<span class="spin"><Loader2 size={14} /></span>{:else}<Play size={14} />{/if}
									</button>
									<label class="cron-toggle">
										<input type="checkbox" checked={entry.enabled} onchange={(event) => void onUpdate(entry.id, { enabled: event.currentTarget.checked })} />
										<span>enabled</span>
									</label>
									<button type="button" onclick={() => startEdit(entry)} aria-label={`Edit ${entry.name}`} title="Edit"><Pencil size={14} /></button>
									<button type="button" onclick={() => void remove(entry)} disabled={Boolean(deletingId)} aria-label={`Delete ${entry.name}`} title="Delete">
										{#if deletingId === entry.id}<span class="spin"><Loader2 size={14} /></span>{:else}<Trash2 size={14} />{/if}
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			{:else}
				<form class="cron-form" onsubmit={submit}>
					<label>
						<span>Name</span>
						<input type="text" bind:value={form.name} required maxlength="100" />
					</label>
					<label>
						<span>Cron expression</span>
						<input type="text" bind:value={form.cronExpr} required placeholder="*/5 * * * *" class="mono" />
					</label>
					<p class="cron-help">5 fields: minute · hour · day-of-month · month · day-of-week. Example <code>0 9 * * 1</code> = Monday 09:00.</p>
					<label class="cron-form__check">
						<span>Enabled</span>
						<input type="checkbox" bind:checked={form.enabled} />
					</label>
					<label>
						<span>Action</span>
						<select value={form.actionType} onchange={(event) => (form.actionType = event.currentTarget.value as CronFormState['actionType'])}>
							<option value="spawn">Spawn new terminal</option>
							<option value="send_input">Send input to existing terminal</option>
						</select>
					</label>

					{#if form.actionType === 'spawn'}
						<label>
							<span>Profile</span>
							<select value={form.profile} onchange={(event) => (form.profile = event.currentTarget.value as TerminalProfile)}>
								{#each profiles as profile (profile.profile)}<option value={profile.profile}>{profile.title}</option>{/each}
							</select>
						</label>
						<label>
							<span>Agent profile</span>
							<select bind:value={form.agentProfileId}>
								<option value="">—</option>
								{#each agentProfiles as profile (profile.id)}<option value={profile.id}>{profile.label}</option>{/each}
							</select>
						</label>
						<label>
							<span>Environment</span>
							<select bind:value={form.environmentId}>
								<option value="">—</option>
								{#each environments as environment (environment.id)}<option value={environment.id}>{environment.label}</option>{/each}
							</select>
						</label>
						<label>
							<span>cwd</span>
							<input type="text" bind:value={form.cwd} placeholder="/absolute/path" class="mono" />
						</label>
						<label>
							<span>Initial command</span>
							<input type="text" bind:value={form.initialCommand} placeholder="npm test" class="mono" />
						</label>
					{:else}
						<label>
							<span>Session</span>
							<select bind:value={form.sessionId} required>
								<option value="">—</option>
								{#each runningSessions as session (session.id)}<option value={session.id}>{session.title}</option>{/each}
							</select>
						</label>
						<label>
							<span>Data</span>
							<input type="text" bind:value={form.data} required placeholder="echo hi\r" class="mono" />
						</label>
						<p class="cron-help">Use <code>\r</code> to press Enter. Escape sequences are decoded only when saving.</p>
					{/if}

					<div class="cron-form__actions">
						<button type="submit" class="cron-primary" disabled={submitting}>
							{#if submitting}<span class="spin"><Loader2 size={15} /></span>{/if}{form.id ? 'Save' : 'Create'}
						</button>
						<button type="button" class="cron-secondary" onclick={cancelEdit}>Cancel</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>

<style>
	.cron-overlay { position: fixed; inset: 0; z-index: 130; display: grid; justify-items: end; }
	.cron-backdrop { position: absolute; inset: 0; border: 0; background: rgb(0 0 0 / .54); cursor: default; }
	.cron-panel { position: relative; display: flex; width: min(460px, 100vw); height: 100dvh; min-height: 0; flex-direction: column; border-left: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 97%, #07101d); box-shadow: -18px 0 50px rgb(0 0 0 / .36); }
	.cron-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 14px; border-bottom: 1px solid var(--border); }
	.cron-header > div:first-child { display: grid; min-width: 0; gap: 2px; }
	.cron-header strong { color: var(--ink); font-size: .88rem; }
	.cron-header small { color: var(--ink-muted); font-size: 10px; }
	.cron-header__actions, .cron-card__actions, .cron-form__actions { display: flex; align-items: center; gap: 6px; }
	.cron-header button, .cron-card__actions button { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink-muted); cursor: pointer; }
	.cron-header button:disabled, .cron-card__actions button:disabled { opacity: .55; cursor: not-allowed; }
	.cron-error { margin: 10px 12px 0; padding: 8px 9px; border: 1px solid rgb(244 63 94 / .3); border-radius: 8px; background: rgb(244 63 94 / .08); color: rgb(253 164 175); font-size: 11px; }
	.cron-body { min-height: 0; flex: 1; overflow-y: auto; padding: 12px; }
	.cron-primary, .cron-secondary { display: inline-flex; min-height: 34px; align-items: center; justify-content: center; gap: 7px; border-radius: 8px; padding: 7px 11px; font-size: 11px; font-weight: 600; cursor: pointer; }
	.cron-primary { border: 1px solid rgb(56 189 248 / .36); background: rgb(14 165 233 / .12); color: rgb(125 211 252); }
	.cron-secondary { border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-muted); }
	.cron-primary:disabled { opacity: .55; cursor: not-allowed; }
	.cron-empty { margin: 18px 4px; color: var(--ink-muted); font-size: 11px; text-align: center; }
	.cron-list { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
	.cron-card { display: grid; gap: 8px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; background: var(--surface-2); opacity: .72; }
	.cron-card[data-enabled='true'] { opacity: 1; border-color: color-mix(in srgb, var(--border) 62%, rgb(56 189 248)); }
	.cron-card__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
	.cron-card__head strong { min-width: 0; overflow: hidden; color: var(--ink); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
	.cron-card__head code { flex: 0 0 auto; color: rgb(125 211 252); font-size: 10px; }
	.cron-card__meta { display: flex; flex-wrap: wrap; gap: 5px 9px; color: var(--ink-muted); font-size: 9px; }
	.cron-card__meta span[data-ok='true'] { color: rgb(110 231 183); }
	.cron-card__meta span[data-ok='false'] { color: rgb(253 164 175); }
	.cron-card__meta .mono { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.cron-card__actions { justify-content: flex-end; }
	.cron-toggle { display: inline-flex; align-items: center; gap: 5px; padding: 0 5px; color: var(--ink-muted); font-size: 9px; }
	.cron-form { display: grid; gap: 9px; }
	.cron-form > label { display: grid; grid-template-columns: 110px minmax(0, 1fr); align-items: center; gap: 10px; color: var(--ink-muted); font-size: 10px; }
	.cron-form input[type='text'], .cron-form select { min-width: 0; width: 100%; height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); padding: 0 9px; color: var(--ink); font-size: 11px; outline: none; }
	.cron-form input:focus, .cron-form select:focus { border-color: rgb(56 189 248 / .48); }
	.cron-form__check input { justify-self: start; }
	.cron-help { margin: -2px 0 2px 120px; color: var(--ink-muted); font-size: 9px; line-height: 1.45; }
	.cron-help code { color: var(--ink); }
	.cron-form__actions { margin-top: 4px; justify-content: flex-end; }
	.cron-form__actions .cron-primary { min-width: 96px; }
	.mono { font-family: var(--font-mono); }
	.spin { animation: spin .8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (max-width: 680px) {
		.cron-panel { width: 100vw; border-left: 0; }
		.cron-header { padding-top: max(12px, env(safe-area-inset-top)); }
		.cron-body { padding-bottom: max(14px, env(safe-area-inset-bottom)); }
		.cron-form > label { grid-template-columns: 1fr; gap: 5px; }
		.cron-help { margin-left: 0; }
	}
</style>
