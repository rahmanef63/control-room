<script lang="ts">
	import { Bot, Power, Rocket, Shield, Sparkles, Zap } from 'lucide-svelte';

	import { buildPaneAgentCommand } from './pane-agent-command';
	import type { RuntimeResolvedAgentProfile } from './types';

	interface Props {
		sessionId: string;
		cwd: string;
		agentProfiles: RuntimeResolvedAgentProfile[];
		boundAgentProfileId?: string;
		runtimeAgentProfileId?: string;
		canSendInput: boolean;
		onTrack: (agentProfileId: string) => void;
		onInject: (agentProfileId: string, command: string) => void;
		onUnbind: () => void;
	}

	let {
		sessionId,
		cwd,
		agentProfiles,
		boundAgentProfileId,
		runtimeAgentProfileId,
		canSendInput,
		onTrack,
		onInject,
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
	let boundLabel = $derived(localBound?.label ?? runtimeBound?.label ?? null);

	function track(profile: RuntimeResolvedAgentProfile): void {
		onTrack(profile.id);
		open = false;
	}

	function inject(profile: RuntimeResolvedAgentProfile, bypass: boolean): void {
		if (!canSendInput) return;
		onInject(profile.id, buildPaneAgentCommand(profile, bypass));
		open = false;
	}
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
	<div class="pane-ai" bind:this={wrapper}>
		<button
			type="button"
			class="pane-ai__trigger"
			data-bound={Boolean(boundLabel) || undefined}
			aria-label={boundLabel ? `AI agent: ${boundLabel}` : 'Run AI agent in this terminal'}
			aria-expanded={open}
			aria-haspopup="dialog"
			title={boundLabel ? `Agent · ${boundLabel} · ${cwd}` : `Run or track AI agent · ${cwd}`}
			onclick={() => (open = !open)}
		>
			<Sparkles size={14} />
			{#if boundLabel}<span>{boundLabel}</span>{/if}
		</button>

		{#if open}
			<div class="pane-ai__popover" role="dialog" aria-label="Run AI agent in pane">
				<header class="pane-ai__header">
					<div>
						<strong>Run agent here</strong>
						<small title={cwd}>{cwd}</small>
					</div>
					{#if localBound}
						<button
							type="button"
							class="pane-ai__unbind"
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
					<p class="pane-ai__runtime">Runtime session · {runtimeBound.label}</p>
				{/if}

				<div class="pane-ai__list">
					{#each agentProfiles as profile (profile.id)}
						<div class="pane-ai__row" data-bound={profile.id === boundAgentProfileId || undefined}>
							<div class="pane-ai__row-head">
								<Bot size={14} />
								<span>
									<strong>{profile.label}</strong>
									<small>{profile.model || profile.terminalProfile}</small>
								</span>
							</div>
							<div class="pane-ai__actions">
								<button type="button" data-tone="track" onclick={() => track(profile)}>
									<Sparkles size={12} /> Track only
								</button>
								<button
									type="button"
									data-tone="regular"
									disabled={!canSendInput}
									onclick={() => inject(profile, false)}
								>
									<Shield size={12} /> Regular
								</button>
								<button
									type="button"
									data-tone="bypass"
									disabled={!canSendInput}
									onclick={() => inject(profile, true)}
								>
									<Zap size={12} /> Bypass
								</button>
							</div>
						</div>
					{/each}
				</div>

				<p class="pane-ai__note">
					<Rocket size={11} /> Regular/Bypass send the agent command + Enter to this PTY. Track only changes pane telemetry metadata and sends nothing.
				</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	.pane-ai { position: relative; display: inline-flex; flex: 0 0 auto; }
	.pane-ai__trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-width: 30px;
		height: 28px;
		max-width: 132px;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: transparent;
		padding: 0 7px;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.pane-ai__trigger[data-bound='true'] {
		border-color: rgb(167 139 250 / 0.42);
		background: rgb(139 92 246 / 0.1);
		color: rgb(196 181 253);
	}
	.pane-ai__trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }
	.pane-ai__popover {
		position: absolute;
		top: calc(100% + 7px);
		right: 0;
		z-index: 90;
		width: min(390px, calc(100vw - 20px));
		border: 1px solid var(--border);
		border-radius: 11px;
		background: color-mix(in srgb, var(--surface) 97%, #07101d);
		box-shadow: 0 18px 48px rgb(0 0 0 / 0.46);
		padding: 9px;
	}
	.pane-ai__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
	.pane-ai__header > div { display: grid; min-width: 0; }
	.pane-ai__header strong { color: var(--ink); font-size: 11px; }
	.pane-ai__header small { overflow: hidden; color: var(--ink-muted); font-family: var(--font-mono); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
	.pane-ai__unbind { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: rgb(253 164 175); font: inherit; font-size: 10px; cursor: pointer; }
	.pane-ai__runtime { margin: 7px 0 0; color: rgb(196 181 253); font-size: 9px; }
	.pane-ai__list { display: grid; gap: 6px; margin-top: 8px; max-height: min(330px, 55dvh); overflow-y: auto; }
	.pane-ai__row {
		display: grid;
		gap: 7px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface-2);
		padding: 8px;
	}
	.pane-ai__row[data-bound='true'] { border-color: rgb(167 139 250 / 0.42); background: rgb(139 92 246 / 0.09); }
	.pane-ai__row-head { display: flex; align-items: center; gap: 7px; color: rgb(196 181 253); }
	.pane-ai__row-head > span { display: grid; min-width: 0; flex: 1; }
	.pane-ai__row-head strong, .pane-ai__row-head small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.pane-ai__row-head strong { color: var(--ink); font-size: 11px; }
	.pane-ai__row-head small { color: var(--ink-muted); font-size: 9px; }
	.pane-ai__actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
	.pane-ai__actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: 0;
		min-height: 30px;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: rgb(255 255 255 / 0.025);
		padding: 4px 6px;
		color: var(--ink-muted);
		font: inherit;
		font-size: 9px;
		font-weight: 650;
		cursor: pointer;
	}
	.pane-ai__actions button[data-tone='track'] { color: rgb(196 181 253); }
	.pane-ai__actions button[data-tone='regular'] { border-color: rgb(56 189 248 / 0.3); color: rgb(186 230 253); }
	.pane-ai__actions button[data-tone='bypass'] { border-color: rgb(251 146 60 / 0.35); color: rgb(253 186 116); }
	.pane-ai__actions button:disabled { opacity: 0.42; cursor: not-allowed; }
	.pane-ai__note { display: flex; align-items: flex-start; gap: 5px; margin: 8px 1px 0; color: var(--ink-muted); font-size: 9px; line-height: 1.45; }
	.pane-ai__note :global(svg) { flex: 0 0 auto; margin-top: 1px; }
	@media (max-width: 680px) {
		.pane-ai__trigger span { display: none; }
		.pane-ai__trigger { width: 28px; min-width: 28px; padding: 0; }
		.pane-ai__popover { position: fixed; top: auto; right: 10px; bottom: max(10px, env(safe-area-inset-bottom)); left: 10px; width: auto; }
	}
	@media (max-width: 380px) {
		.pane-ai__actions { grid-template-columns: 1fr; }
	}
</style>
