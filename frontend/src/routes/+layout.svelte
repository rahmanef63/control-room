<script lang="ts">
	import '../app.css';
	import VersionGuard from '$lib/pwa/version-guard.svelte';

	let { children } = $props();

</script>

<svelte:head>
	<title>VPS Terminals</title>
	<meta name="theme-color" content="#111821" />
	<meta name="color-scheme" content="dark" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="mobile-web-app-capable" content="yes" />
</svelte:head>

{@render children?.()}

<VersionGuard />
