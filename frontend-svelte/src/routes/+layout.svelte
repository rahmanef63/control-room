<script lang="ts">
	import '../app.css';
	import VersionGuard from '$lib/pwa/version-guard.svelte';

	let { children } = $props();

</script>

<svelte:head>
	<title>VPS Terminals</title>
	<meta
		name="description"
		content="Mobile-first PWA to drive your VPS from anywhere — multi-pane terminals + AI-agent launchers, behind one secret on a Tailscale-only domain."
	/>
	<meta name="theme-color" content="#111821" />
	<meta name="color-scheme" content="dark" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="VPS Control Room" />
	<meta property="og:image" content="/og-card.png" />
</svelte:head>

{@render children?.()}

<VersionGuard />
