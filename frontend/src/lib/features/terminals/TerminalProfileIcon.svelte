<script lang="ts">
	import { Bot, Boxes, Command, Sparkles, SquareTerminal } from 'lucide-svelte';
	import type { TerminalProfile } from './types';

	interface Props {
		profile: TerminalProfile;
		size?: number;
	}

	let { profile, size = 14 }: Props = $props();
</script>

{#if profile === 'shell'}
	<SquareTerminal {size} />
{:else if profile === 'openclaw'}
	<Boxes {size} />
{:else if profile === 'codex'}
	<Command {size} />
{:else if profile === 'claude'}
	<Sparkles {size} />
{:else}
	<Bot {size} />
{/if}
