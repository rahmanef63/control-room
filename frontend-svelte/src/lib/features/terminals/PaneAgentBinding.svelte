<script lang="ts">
	import { Bot, Power, Sparkles } from 'lucide-svelte';
	import type { RuntimeResolvedAgentProfile } from './types';

	interface Props {
		sessionId: string;
		cwd: string;
		agentProfiles: RuntimeResolvedAgentProfile[];
		boundAgentProfileId?: string;
		runtimeAgentProfileId?: string;
		onBind: (agentProfileId: string) => void;
		onUnbind: () => void;
	}

	let {
		sessionId,
		cwd,
		agentProfiles,
		boundAgentProfileId,
		runtimeAgentProfileId,
		onBind,
		onUnbind
	}: Props = $props();

	let open = $state(false);
	let wrapper: HTMLDivElement | undefined = $state();
	let localBound = $derived(
		boundAgentProfileId
			? agentProfiles.find((profile) => profile.id === boundAgentProfileId)
			: undefined
	);
	let runtimeBound = $derived(
		runtimeAgentProfileId
			? agentProfiles.find((profile) => profile.id === runtimeAgentProfileId)
			: undefined
	);
	let label = $derived(localBound?.label ?? runtimeBound?.label ?? null);
</script>

<svelte:window
	onmousedown={(event) => {
		if (!open) return;
		if (event.target instanceof Node && !wrapper?.contains(event.target)) open = false;
	}}
	onkeydown={(event) => {
		if (open && event.key === 'Escape') open = false;
	}}
/>

{#if agentProfiles.length > 0 || runtimeAgentProfileId}
	<div class="agent-binding" bind:this={wrapper}>
		<button
			type="button"
			class="agent-binding__trigger"
			data-bound={Boolean(label) || undefined}
			aria-label={label ? `Agent binding: ${label}` : 'Bind agent tracking to this pane'}
			aria-expanded={open}
			aria-haspopup="dialog"
			title={label ? `Agent tracking · ${label}` : 'Bind agent tracking (does not launch an agent)'}
			onclick={() => (open = !open)}
		>
			<Sparkles size={14} />
			{#if label}<span>{label}</span>{/if}
		</button>

		{#if open}
			<div class="agent-binding__popover" role="dialog" aria-label="Pane agent tracking">
				<header>
					<div>
						<strong>Agent tracking</strong>
						<small title={cwd}>{cwd}</small>
					</div>
					{#if localBound}
						<button
							type="button"
							class="agent-binding__unbind"
							onclick={() => {
								onUnbind();
								open = false;
							}}
						>
							<Power size={12} /> Unbind
						</button>
					{/if}
				</header>

				{#if runtimeBound && !localBound}
					<p class="agent-binding__runtime">Runtime session · {runtimeBound.label}</p>
				{/if}
				<p class="agent-binding__note">Tracking only. This does not launch an agent or send a prompt.</p>
				<div class="agent-binding__list">
					{#each agentProfiles as profile (profile.id)}
						<button
							type="button"
							class="agent-binding__option"
							data-active={profile.id === boundAgentProfileId || undefined}
							onclick={() => {
								onBind(profile.id);
								open = false;
							}}
						>
							<Bot size={14} />
							<span>
								<strong>{profile.label}</strong>
								<small>{profile.model || profile.terminalProfile}</small>
							</span>
							{#if profile.id === boundAgentProfileId}<em>bound</em>{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.agent-binding { position: relative; display: inline-flex; flex: 0 0 auto; }
	.agent-binding__trigger {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-width: 30px;
		height: 28px;
		max-width: 130px;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: transparent;
		padding: 0 7px;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.agent-binding__trigger[data-bound='true'] {
		border-color: rgb(167 139 250 / 0.4);
		background: rgb(139 92 246 / 0.1);
		color: rgb(196 181 253);
	}
	.agent-binding__trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }
	.agent-binding__popover {
		position: absolute;
		top: calc(100% + 7px);
		right: 0;
		z-index: 85;
		width: min(320px, calc(100vw - 20px));
		border: 1px solid var(--border);
		border-radius: 11px;
		background: color-mix(in srgb, var(--surface) 97%, #07101d);
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.42);
		padding: 9px;
	}
	.agent-binding__popover header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
	.agent-binding__popover header > div { display: grid; min-width: 0; }
	.agent-binding__popover header strong { color: var(--ink); font-size: 11px; }
	.agent-binding__popover header small { overflow: hidden; color: var(--ink-muted); font-family: var(--font-mono); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
	.agent-binding__unbind { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: rgb(253 164 175); font-size: 10px; cursor: pointer; }
	.agent-binding__note, .agent-binding__runtime { margin: 8px 0 0; font-size: 9px; line-height: 1.4; }
	.agent-binding__note { color: var(--ink-muted); }
	.agent-binding__runtime { color: rgb(196 181 253); }
	.agent-binding__list { display: grid; gap: 5px; margin-top: 8px; max-height: 250px; overflow-y: auto; }
	.agent-binding__option {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 7px;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
		padding: 7px 8px;
		color: var(--ink-muted);
		text-align: left;
		cursor: pointer;
	}
	.agent-binding__option[data-active='true'] { border-color: rgb(167 139 250 / 0.42); background: rgb(139 92 246 / 0.12); }
	.agent-binding__option > span { display: grid; min-width: 0; }
	.agent-binding__option strong, .agent-binding__option small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.agent-binding__option strong { color: var(--ink); font-size: 11px; }
	.agent-binding__option small { color: var(--ink-muted); font-size: 9px; }
	.agent-binding__option em { color: rgb(196 181 253); font-size: 9px; font-style: normal; text-transform: uppercase; }
	@media (max-width: 680px) {
		.agent-binding__trigger span { display: none; }
		.agent-binding__trigger { width: 28px; min-width: 28px; padding: 0; }
		.agent-binding__popover { position: fixed; top: auto; right: 10px; bottom: max(10px, env(safe-area-inset-bottom)); left: 10px; width: auto; }
	}
</style>
