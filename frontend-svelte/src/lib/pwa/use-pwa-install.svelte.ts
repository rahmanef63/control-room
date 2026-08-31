import { onMount } from 'svelte';

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export function usePwaInstall() {
	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let installed = $state(false);
	let appleMobile = $state(false);

	onMount(() => {
		const standaloneMql = window.matchMedia('(display-mode: standalone)');
		const minimalMql = window.matchMedia('(display-mode: minimal-ui)');
		const nav = navigator as Navigator & { standalone?: boolean };
		appleMobile =
			/iPhone|iPad|iPod/i.test(nav.userAgent) ||
			(nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);

		const checkInstalled = () => {
			installed = standaloneMql.matches || minimalMql.matches || nav.standalone === true;
			if (installed) deferredPrompt = null;
		};
		checkInstalled();

		const handlePrompt = (event: Event) => {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
		};
		const handleInstalled = () => {
			installed = true;
			deferredPrompt = null;
		};

		standaloneMql.addEventListener('change', checkInstalled);
		minimalMql.addEventListener('change', checkInstalled);
		window.addEventListener('beforeinstallprompt', handlePrompt);
		window.addEventListener('appinstalled', handleInstalled);

		return () => {
			standaloneMql.removeEventListener('change', checkInstalled);
			minimalMql.removeEventListener('change', checkInstalled);
			window.removeEventListener('beforeinstallprompt', handlePrompt);
			window.removeEventListener('appinstalled', handleInstalled);
		};
	});

	async function install(): Promise<PwaInstallOutcome> {
		const prompt = deferredPrompt;
		if (!prompt || installed) return 'unavailable';
		await prompt.prompt();
		const { outcome } = await prompt.userChoice;
		// A BeforeInstallPromptEvent is one-shot even when the user dismisses it.
		deferredPrompt = null;
		return outcome;
	}

	return {
		get canInstall() {
			return !!deferredPrompt && !installed;
		},
		get needsManualInstall() {
			return appleMobile && !installed && !deferredPrompt;
		},
		get installed() {
			return installed;
		},
		install
	};
}
