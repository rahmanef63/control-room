<script lang="ts">
	import { onMount } from 'svelte';
	import { Activity, Cpu, Gauge, HardDrive, MemoryStick, Network, Server, X } from 'lucide-svelte';

	import {
		formatBytes,
		formatUptime,
		usagePercent,
		usageTone,
		type HostOverview
	} from './overview';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();
	let data = $state<HostOverview | null>(null);
	let loading = $state(true);
	let error = $state(false);
	let telemetry = $derived(data?.telemetry ?? null);
	let ramPercent = $derived(telemetry ? usagePercent(telemetry.ram_used, telemetry.ram_total) : 0);

	async function load(): Promise<void> {
		try {
			const response = await fetch('/api/overview', { cache: 'no-store' });
			if (!response.ok) throw new Error(`Overview ${response.status}`);
			data = (await response.json()) as HostOverview;
			error = false;
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
		const interval = window.setInterval(() => void load(), 5000);
		return () => window.clearInterval(interval);
	});
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<button class="overview-backdrop" type="button" aria-label="Close system overview" onclick={onClose}></button>
<div class="overview-sheet" role="dialog" aria-modal="true" aria-label="System overview">
	<header class="overview-header">
		<div class="overview-title">
			<Gauge size={17} />
			<div>
				<strong>System overview</strong>
				<small>
					{#if error}
						Agent unreachable
					{:else if telemetry}
						Uptime {formatUptime(telemetry.uptime_seconds)} · live
					{:else}
						Loading…
					{/if}
				</small>
			</div>
		</div>
		<button class="overview-close" type="button" aria-label="Close overview" onclick={onClose}><X size={16} /></button>
	</header>

	<div class="overview-body">
		{#if error && !telemetry}
			<p class="overview-empty">Couldn’t reach the agent. Check the host agent service.</p>
		{:else if loading && !telemetry}
			<p class="overview-empty">Loading host metrics…</p>
		{:else if telemetry}
			<section class="metric-card">
				<div class="metric-row">
					<span class="metric-label"><Cpu size={14} /> CPU</span>
					<span class="metric-value">{telemetry.cpu_total.toFixed(0)}% · {telemetry.cpu_cores.length} cores</span>
				</div>
				<div class="usage-bar" data-tone={usageTone(telemetry.cpu_total)}><span style:width={`${usagePercent(telemetry.cpu_total, 100)}%`}></span></div>
			</section>

			<section class="metric-card">
				<div class="metric-row">
					<span class="metric-label"><MemoryStick size={14} /> Memory</span>
					<span class="metric-value">{formatBytes(telemetry.ram_used)} / {formatBytes(telemetry.ram_total)}</span>
				</div>
				<div class="usage-bar" data-tone={usageTone(ramPercent)}><span style:width={`${ramPercent}%`}></span></div>
			</section>

			<section class="metric-grid">
				<div class="metric-card metric-card--compact">
					<span class="metric-label"><Activity size={14} /> Load avg</span>
					<strong class="metric-big">{telemetry.load_average.map((value) => value.toFixed(2)).join('  ')}</strong>
				</div>
				<div class="metric-card metric-card--compact">
					<span class="metric-label"><Server size={14} /> Uptime</span>
					<strong class="metric-big">{formatUptime(telemetry.uptime_seconds)}</strong>
				</div>
			</section>

			<section class="metric-card">
				<div class="metric-row">
					<span class="metric-label"><Network size={14} /> Network</span>
					<span class="metric-value">↓ {formatBytes(telemetry.network.rx_rate)}/s · ↑ {formatBytes(telemetry.network.tx_rate)}/s</span>
				</div>
			</section>

			{#if telemetry.disk.length > 0}
				<section class="metric-card">
					<span class="metric-label metric-label--heading"><HardDrive size={14} /> Disk</span>
					<ul class="disk-list">
						{#each telemetry.disk as disk (disk.mount)}
							{@const percent = usagePercent(disk.used, disk.total)}
							<li>
								<div class="metric-row metric-row--small">
									<span class="metric-value">{disk.mount}</span>
									<span class="metric-value">{formatBytes(disk.used)} / {formatBytes(disk.total)}</span>
								</div>
								<div class="usage-bar" data-tone={usageTone(percent)}><span style:width={`${percent}%`}></span></div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if data?.runtime}
				<section class="runtime-grid" aria-label="Runtime counts">
					<span>Sessions <strong>{data.runtime.terminal_sessions}</strong></span>
					<span>Agents <strong>{data.runtime.agent_profiles}</strong></span>
					<span>Profiles <strong>{data.runtime.terminal_profiles}</strong></span>
					<span>Envs <strong>{data.runtime.environments}</strong></span>
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	.overview-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		border: 0;
		background: rgb(3 7 18 / 0.72);
		backdrop-filter: blur(6px);
	}
	.overview-sheet {
		position: fixed;
		z-index: 91;
		right: 50%;
		top: 50%;
		display: flex;
		width: min(540px, calc(100vw - 24px));
		max-height: min(760px, calc(100dvh - 24px));
		transform: translate(50%, -50%);
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: color-mix(in srgb, var(--surface) 97%, #07101d);
		box-shadow: 0 24px 80px rgb(0 0 0 / 0.5);
	}
	.overview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
	}
	.overview-title { display: flex; min-width: 0; align-items: center; gap: 9px; color: var(--ink); }
	.overview-title > div { display: grid; min-width: 0; }
	.overview-title strong { font-size: 13px; }
	.overview-title small { color: var(--ink-muted); font-size: 10px; }
	.overview-close {
		display: inline-flex;
		width: 32px;
		height: 32px;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.overview-body { display: grid; min-height: 0; gap: 10px; overflow-y: auto; padding: 12px; }
	.overview-empty { margin: 0; padding: 28px 12px; text-align: center; color: var(--ink-muted); font-size: 11px; }
	.metric-card {
		display: grid;
		gap: 8px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: color-mix(in srgb, var(--surface-2) 82%, transparent);
		padding: 10px 11px;
	}
	.metric-card--compact { min-width: 0; }
	.metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
	.metric-row { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 10px; }
	.metric-row--small { font-size: 10px; }
	.metric-label { display: inline-flex; align-items: center; gap: 6px; color: var(--ink); font-size: 11px; font-weight: 600; }
	.metric-label--heading { margin-bottom: 2px; }
	.metric-value { min-width: 0; overflow: hidden; color: var(--ink-muted); font-family: var(--font-mono); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.metric-big { margin-top: 2px; color: var(--ink); font-family: var(--font-mono); font-size: 13px; font-weight: 500; }
	.usage-bar { height: 6px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--border) 62%, transparent); }
	.usage-bar span { display: block; height: 100%; border-radius: inherit; background: #34d399; transition: width 180ms ease; }
	.usage-bar[data-tone='warn'] span { background: #fbbf24; }
	.usage-bar[data-tone='danger'] span { background: #fb7185; }
	.disk-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
	.runtime-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; padding: 2px 4px 0; color: var(--ink-muted); font-size: 10px; }
	.runtime-grid span { display: flex; justify-content: space-between; gap: 8px; }
	.runtime-grid strong { color: var(--ink); font-family: var(--font-mono); font-weight: 500; }
	@media (max-width: 640px) {
		.overview-sheet {
			right: 0;
			top: auto;
			bottom: 0;
			width: 100%;
			max-height: calc(100dvh - max(8px, env(safe-area-inset-top)));
			transform: none;
			border-right: 0;
			border-bottom: 0;
			border-left: 0;
			border-radius: 18px 18px 0 0;
			padding-bottom: env(safe-area-inset-bottom);
		}
		.metric-grid { grid-template-columns: 1fr; }
	}
</style>
