<script lang="ts">
	import { Download, Share2, X } from 'lucide-svelte';

	import { Button } from '$lib/components/ui/button';
	import { usePwaInstall } from '$lib/pwa/use-pwa-install.svelte';

	const pwa = usePwaInstall();
	let helpOpen = $state(false);

	async function handleInstall(): Promise<void> {
		if (pwa.canInstall) {
			helpOpen = false;
			await pwa.install();
			return;
		}
		if (pwa.needsManualInstall) helpOpen = !helpOpen;
	}
</script>

{#if pwa.canInstall || pwa.needsManualInstall}
	<div class="install-control">
		<Button
			variant="outline"
			size="sm"
			onclick={() => void handleInstall()}
			aria-expanded={pwa.needsManualInstall ? helpOpen : undefined}
			aria-label={pwa.needsManualInstall ? 'Install VPS Terminals on iPhone or iPad' : 'Install VPS Terminals as an app'}
			aria-haspopup={pwa.needsManualInstall ? 'dialog' : undefined}
			title={pwa.needsManualInstall ? 'Add VPS Terminals to your Home Screen' : 'Install VPS Terminals as an app'}
		>
			<Download size={14} /> <span class="install-control__label">Install</span>
		</Button>

		{#if helpOpen && pwa.needsManualInstall}
			<div class="install-help" role="dialog" aria-label="Install VPS Terminals on iPhone or iPad">
				<div class="install-help__icon"><Share2 size={16} /></div>
				<div class="install-help__copy">
					<strong>Install on iPhone or iPad</strong>
					<span>Tap Share, then choose “Add to Home Screen”.</span>
				</div>
				<button type="button" onclick={() => (helpOpen = false)} aria-label="Close install instructions">
					<X size={14} />
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.install-control {
		position: relative;
		flex: 0 0 auto;
	}
	.install-help {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 80;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: start;
		gap: 9px;
		width: min(330px, calc(100vw - 24px));
		border: 1px solid var(--border);
		border-radius: 12px;
		background: color-mix(in srgb, var(--surface) 96%, #08111f);
		padding: 10px;
		box-shadow: 0 18px 48px rgb(0 0 0 / 0.38);
	}
	.install-help__icon {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--accent) 13%, transparent);
		color: var(--accent);
	}
	.install-help__copy {
		display: grid;
		gap: 3px;
		min-width: 0;
	}
	.install-help__copy strong {
		color: var(--ink);
		font-size: 0.75rem;
	}
	.install-help__copy span {
		color: var(--ink-muted);
		font-size: 0.7rem;
		line-height: 1.4;
	}
	.install-help > button {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.install-help > button:hover {
		background: var(--surface-2);
		color: var(--ink);
	}
	@media (max-width: 680px) {
		.install-control__label {
			display: none;
		}
		.install-help {
			position: fixed;
			top: max(64px, calc(env(safe-area-inset-top) + 52px));
			right: 12px;
			left: 12px;
			width: auto;
		}
	}
</style>
