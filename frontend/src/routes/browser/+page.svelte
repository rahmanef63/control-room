<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Globe, Play } from 'lucide-svelte';

	import { Button } from '$lib/components/ui/button';

	const EXAMPLE = JSON.stringify(
		{
			steps: [
				{ do: 'navigate', url: 'https://demo.playwright.dev/todomvc/' },
				{ do: 'wait', ms: 1500 },
				{ do: 'clickSelector', selector: '.new-todo' },
				{ do: 'type', text: 'browser-agent CRUD test' },
				{ do: 'key', key: 'Enter' },
				{ do: 'wait', ms: 500 },
				{ do: 'assertText', text: 'browser-agent CRUD test' },
				{ do: 'clickSelector', selector: '.todo-list li .toggle' },
				{ do: 'clickSelector', selector: '.clear-completed' },
				{ do: 'assertText', text: 'browser-agent CRUD test', expect: false }
			]
		},
		null,
		2
	);

	let input = $state(EXAMPLE);
	let result = $state('');
	let busy = $state(false);

	async function run() {
		busy = true;
		result = '';
		try {
			const parsed = JSON.parse(input);
			const response = await fetch('/api/browser/crud', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(parsed)
			});

			if (response.status === 501) {
				result =
					'Browser CRUD is an optional add-on and is not configured.\n\n' +
					'It proxies to a paired os-vps deployment that runs the headless browser.\n' +
					'Set OS_VPS_URL + OS_AGENT_TOKEN in .env.local to enable it, then restart\n' +
					'the agent. See docs/browser-crud.md.';
				return;
			}

			const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
			result = JSON.stringify(payload, null, 2);
		} catch (error) {
			result = `Error: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Browser CRUD · Control Room</title>
</svelte:head>

<main class="browser-crud mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col gap-4">
	<header class="flex min-w-0 items-center gap-2">
		<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
			<Globe class="h-5 w-5 text-cyan-300" aria-hidden="true" />
		</div>
		<div class="min-w-0">
			<p class="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Optional tool</p>
			<h1 class="truncate text-lg font-semibold text-white">Browser CRUD</h1>
		</div>
		<a
			href={resolve('/')}
			class="ml-auto inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
		>
			<ArrowLeft class="h-4 w-4" aria-hidden="true" />
			<span class="hidden sm:inline">Terminals</span>
		</a>
	</header>

	<section class="rounded-2xl border border-white/10 bg-slate-950/45 p-4 shadow-2xl shadow-black/20 sm:p-5">
		<p class="text-sm leading-6 text-slate-400">
			Drive a paired os-vps headless browser through the agent. Set
			<code class="rounded bg-white/5 px-1.5 py-0.5 text-xs text-slate-200">OS_VPS_URL</code>
			and
			<code class="rounded bg-white/5 px-1.5 py-0.5 text-xs text-slate-200">OS_AGENT_TOKEN</code>
			to enable it, edit the step list, then run the flow against a web app's UI.
		</p>

		<label for="browser-crud-input" class="mt-5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
			Step list
		</label>
		<textarea
			id="browser-crud-input"
			bind:value={input}
			spellcheck={false}
			class="mt-2 h-80 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-xs leading-5 text-slate-200 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/15"
		></textarea>

		<div class="mt-3 flex items-center gap-3">
			<Button onclick={run} disabled={busy}>
				<Play class="h-4 w-4" aria-hidden="true" />
				{busy ? 'Running…' : 'Run flow'}
			</Button>
			{#if busy}
				<span class="text-xs text-slate-500" aria-live="polite">Waiting for browser agent…</span>
			{/if}
		</div>
	</section>

	{#if result}
		<section class="min-w-0 rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5" aria-live="polite">
			<div class="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Result</div>
			<pre class="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">{result}</pre>
		</section>
	{/if}
</main>

<style>
	.browser-crud {
		padding-top: calc(1rem + var(--safe-top));
		padding-right: calc(1rem + var(--safe-right));
		padding-bottom: calc(1rem + var(--safe-bottom));
		padding-left: calc(1rem + var(--safe-left));
	}

	@media (min-width: 640px) {
		.browser-crud {
			padding-top: calc(1.5rem + var(--safe-top));
			padding-right: calc(1.5rem + var(--safe-right));
			padding-bottom: calc(1.5rem + var(--safe-bottom));
			padding-left: calc(1.5rem + var(--safe-left));
		}
	}
</style>
