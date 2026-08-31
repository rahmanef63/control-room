<script lang="ts">
	import { ChevronDown, Cpu, Folder, Rocket, SquareTerminal, X, Zap } from 'lucide-svelte';

	import TerminalProfileIcon from './TerminalProfileIcon.svelte';
	import type { LauncherTab } from './launcher';
	import type {
		RuntimeEnvironmentSummary,
		RuntimeResolvedAgentProfile,
		TerminalProfile,
		TerminalProfileDescriptor
	} from './types';

	interface Props {
		open: boolean;
		tab: LauncherTab;
		profiles: TerminalProfileDescriptor[];
		environments: RuntimeEnvironmentSummary[];
		agentProfiles: RuntimeResolvedAgentProfile[];
		creatingKey: string | null;
		onOpenChange: (open: boolean) => void;
		onTabChange: (tab: LauncherTab) => void;
		onLaunchProfile: (profile: TerminalProfile) => Promise<boolean>;
		onLaunchEnvironment: (environmentId: string) => Promise<boolean>;
		onLaunchAgent: (
			agentId: string,
			options: { dangerouslyAllow?: boolean; useActiveDir?: boolean }
		) => Promise<boolean>;
	}

	let {
		open,
		tab,
		profiles,
		environments,
		agentProfiles,
		creatingKey,
		onOpenChange,
		onTabChange,
		onLaunchProfile,
		onLaunchEnvironment,
		onLaunchAgent
	}: Props = $props();

	let useActiveDir = $state(false);
	let openAgentMenu = $state<string | null>(null);

	function close(): void {
		openAgentMenu = null;
		onOpenChange(false);
	}

	async function launchProfile(profile: TerminalProfile): Promise<void> {
		if (await onLaunchProfile(profile)) close();
	}

	async function launchEnvironment(id: string): Promise<void> {
		if (await onLaunchEnvironment(id)) close();
	}

	async function launchAgent(
		id: string,
		options: { dangerouslyAllow?: boolean; useActiveDir?: boolean }
	): Promise<void> {
		openAgentMenu = null;
		if (await onLaunchAgent(id, options)) close();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') close();
	}}
/>

{#if open}
	<div
		class="launcher-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) close();
		}}
	>
		<div class="launcher-sheet" role="dialog" aria-modal="true" aria-label="Launch terminal" tabindex="-1">
			<header class="launcher-header">
				<div>
					<h2>Launch terminal</h2>
					<p>Pick a base profile, agent preset, or runtime environment.</p>
				</div>
				<button type="button" class="launcher-close" onclick={close} aria-label="Close launcher">
					<X size={16} />
				</button>
			</header>

			<nav class="launcher-tabs" aria-label="Launcher sections">
				<button type="button" data-active={tab === 'base' || undefined} onclick={() => onTabChange('base')}>
					<SquareTerminal size={14} /> Base
				</button>
				<button type="button" data-active={tab === 'agents' || undefined} onclick={() => onTabChange('agents')}>
					<Cpu size={14} /> Agents
				</button>
				<button type="button" data-active={tab === 'envs' || undefined} onclick={() => onTabChange('envs')}>
					<Folder size={14} /> Envs
				</button>
			</nav>

			<div class="launcher-body">
				{#if tab === 'base'}
					<div class="launcher-list">
						{#if profiles.length === 0}
							<p class="launcher-empty">No base profiles available.</p>
						{:else}
							{#each profiles as profile (profile.profile)}
								{@const busy = creatingKey === `profile:${profile.profile}`}
								<button
									type="button"
									class="launch-row"
									data-profile={profile.profile}
									disabled={busy}
									onclick={() => void launchProfile(profile.profile)}
								>
									<span class="launch-icon"><TerminalProfileIcon profile={profile.profile} size={18} /></span>
									<span class="launch-copy">
										<strong>{busy ? 'Launching…' : profile.title}</strong>
										<small>{profile.description}</small>
									</span>
									<span class="launch-chip">{profile.profile}</span>
								</button>
							{/each}
						{/if}
					</div>
				{:else if tab === 'agents'}
					<div class="agents-pane">
						<div class="launcher-option-row">
							<span>
								<strong>Working directory</strong>
								<small>{useActiveDir ? 'Use agent default directory' : 'Use configured environment cwd'}</small>
							</span>
							<button
								type="button"
								data-active={useActiveDir || undefined}
								onclick={() => (useActiveDir = !useActiveDir)}
							>
								{useActiveDir ? 'Agent default' : 'Env cwd'}
							</button>
						</div>

						<div class="launcher-list">
							{#if agentProfiles.length === 0}
								<p class="launcher-empty">No agent presets configured.</p>
							{:else}
								{#each agentProfiles as agent (agent.id)}
									{@const busy = creatingKey === `agent:${agent.id}`}
									<div class="agent-card" data-profile={agent.terminalProfile}>
										<div class="agent-card__head">
											<span class="launch-icon"><TerminalProfileIcon profile={agent.terminalProfile} size={18} /></span>
											<span class="launch-copy">
												<strong>{agent.label}</strong>
												<small>{agent.description}</small>
												<span class="agent-meta">
													<span>{agent.model}</span>
													{#if agent.environmentLabel}<span>{agent.environmentLabel}</span>{/if}
													{#if agent.skills.length > 0}<span>{agent.skills.length} skills</span>{/if}
												</span>
											</span>
										</div>
										<div class="agent-launch-wrap">
											<button
												type="button"
												class="agent-launch-trigger"
												disabled={busy}
												aria-expanded={openAgentMenu === agent.id}
												onclick={() => (openAgentMenu = openAgentMenu === agent.id ? null : agent.id)}
											>
												<Rocket size={14} /> {busy ? 'Starting…' : 'Launch'} <ChevronDown size={12} />
											</button>
											{#if openAgentMenu === agent.id}
												<div class="agent-launch-menu">
													<button type="button" disabled={busy} onclick={() => void launchAgent(agent.id, { useActiveDir })}>
														<Rocket size={14} />
														<span><strong>Regular</strong><small>Safe mode with prompts</small></span>
													</button>
													<button
														type="button"
														data-tone="danger"
														disabled={busy}
														onclick={() => void launchAgent(agent.id, { dangerouslyAllow: true, useActiveDir })}
													>
														<Zap size={14} />
														<span><strong>YOLO</strong><small>Skip permission prompts</small></span>
													</button>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{:else}
					<div class="launcher-list">
						{#if environments.length === 0}
							<p class="launcher-empty">No environments configured.</p>
						{:else}
							{#each environments as environment (environment.id)}
								{@const busy = creatingKey === `env:${environment.id}`}
								<button
									type="button"
									class="launch-row"
									disabled={busy}
									onclick={() => void launchEnvironment(environment.id)}
								>
									<span class="launch-icon"><Folder size={18} /></span>
									<span class="launch-copy">
										<strong>{busy ? 'Opening…' : environment.label}</strong>
										<small class="mono">{environment.cwd}</small>
									</span>
									<span class="launch-chip">{environment.envVarCount} env</span>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.launcher-backdrop {
		position: fixed;
		inset: 0;
		z-index: 120;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgb(4 8 16 / 0.68);
		backdrop-filter: blur(8px);
	}
	.launcher-sheet {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 40rem;
		max-height: min(92dvh, 760px);
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 1.25rem 1.25rem 0 0;
		background: color-mix(in srgb, var(--surface) 97%, #07101d);
		box-shadow: 0 -24px 80px rgb(0 0 0 / 0.45);
	}
	.launcher-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid var(--border);
		padding: 12px 14px;
	}
	.launcher-header h2,
	.launcher-header p { margin: 0; }
	.launcher-header h2 { color: var(--ink); font-size: 0.9rem; }
	.launcher-header p { margin-top: 2px; color: var(--ink-muted); font-size: 0.68rem; }
	.launcher-close {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		flex: 0 0 auto;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.launcher-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--border); padding: 8px 10px; }
	.launcher-tabs button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-width: 0;
		flex: 1 1 0;
		min-height: 34px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface-2);
		color: var(--ink-muted);
		font: inherit;
		font-size: 0.72rem;
		font-weight: 650;
		cursor: pointer;
	}
	.launcher-tabs button[data-active='true'] { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: rgb(34 211 238 / 0.1); color: #cffafe; }
	.launcher-body { min-height: 0; overflow-y: auto; padding: 11px; }
	.launcher-list, .agents-pane { display: grid; gap: 8px; }
	.launch-row, .agent-card {
		width: 100%;
		min-width: 0;
		border: 1px solid var(--border);
		border-radius: 11px;
		background: var(--surface-2);
		color: var(--ink);
	}
	.launch-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		text-align: left;
		cursor: pointer;
	}
	.launch-row:hover:not(:disabled), .agent-card:hover { border-color: color-mix(in srgb, var(--accent) 34%, var(--border)); }
	.launch-row:disabled, .agent-launch-trigger:disabled { opacity: 0.55; cursor: wait; }
	.launch-row[data-profile='codex'], .agent-card[data-profile='codex'] { border-left: 3px solid #60a5fa; }
	.launch-row[data-profile='claude'], .agent-card[data-profile='claude'] { border-left: 3px solid #fb923c; }
	.launch-row[data-profile='gemini'], .agent-card[data-profile='gemini'] { border-left: 3px solid #4ade80; }
	.launch-row[data-profile='openclaw'], .agent-card[data-profile='openclaw'] { border-left: 3px solid #e879f9; }
	.launch-icon {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		flex: 0 0 auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: rgb(255 255 255 / 0.035);
		color: var(--accent);
	}
	.launch-copy { display: grid; gap: 2px; min-width: 0; flex: 1 1 auto; }
	.launch-copy strong { overflow: hidden; color: var(--ink); font-size: 0.78rem; text-overflow: ellipsis; white-space: nowrap; }
	.launch-copy small { overflow: hidden; color: var(--ink-muted); font-size: 0.66rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
	.launch-copy small.mono { font-family: var(--font-mono); }
	.launch-chip, .agent-meta span {
		border: 1px solid var(--border);
		border-radius: 999px;
		background: rgb(255 255 255 / 0.035);
		padding: 3px 6px;
		color: var(--ink-muted);
		font-size: 0.58rem;
		white-space: nowrap;
	}
	.launcher-empty { margin: 0; border: 1px dashed var(--border); border-radius: 10px; padding: 24px 12px; color: var(--ink-muted); font-size: 0.72rem; text-align: center; }
	.launcher-option-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: rgb(255 255 255 / 0.025);
		padding: 9px 10px;
	}
	.launcher-option-row > span { display: grid; gap: 2px; }
	.launcher-option-row strong { color: var(--ink); font-size: 0.7rem; }
	.launcher-option-row small { color: var(--ink-muted); font-size: 0.62rem; }
	.launcher-option-row button {
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--surface-2);
		padding: 5px 8px;
		color: var(--ink-muted);
		font: inherit;
		font-size: 0.62rem;
		font-weight: 700;
		cursor: pointer;
	}
	.launcher-option-row button[data-active='true'] { border-color: rgb(56 189 248 / 0.45); color: #bae6fd; }
	.agent-card { padding: 10px; }
	.agent-card__head { display: flex; align-items: flex-start; gap: 10px; }
	.agent-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
	.agent-launch-wrap { position: relative; margin-top: 9px; }
	.agent-launch-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		min-height: 36px;
		border: 1px solid rgb(56 189 248 / 0.35);
		border-radius: 8px;
		background: rgb(56 189 248 / 0.1);
		color: #dbeafe;
		font: inherit;
		font-size: 0.7rem;
		font-weight: 650;
		cursor: pointer;
	}
	.agent-launch-menu {
		position: absolute;
		z-index: 10;
		inset: calc(100% + 5px) 0 auto 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface);
		box-shadow: 0 18px 45px rgb(0 0 0 / 0.45);
	}
	.agent-launch-menu button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		border: 0;
		background: transparent;
		padding: 9px 10px;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.agent-launch-menu button + button { border-top: 1px solid var(--border); }
	.agent-launch-menu button:hover { background: rgb(255 255 255 / 0.05); }
	.agent-launch-menu button[data-tone='danger'] { color: #fdba74; }
	.agent-launch-menu button span { display: grid; gap: 1px; }
	.agent-launch-menu strong { font-size: 0.7rem; }
	.agent-launch-menu small { color: var(--ink-muted); font-size: 0.6rem; }
	@media (min-width: 640px) {
		.launcher-backdrop { align-items: center; padding: 16px; }
		.launcher-sheet { border-radius: 1.25rem; }
	}
	@media (max-width: 480px) {
		.launch-row { flex-wrap: wrap; align-items: flex-start; }
		.launch-icon { align-self: center; }
		.launch-chip { margin-left: 46px; }
	}
</style>
