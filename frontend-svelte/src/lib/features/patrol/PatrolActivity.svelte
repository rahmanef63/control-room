<script lang="ts">
	import { Inbox, Loader2, Sparkles, Trash2 } from 'lucide-svelte';
	import type { TerminalSession } from '$lib/features/terminals/types';
	import { pendingPingGroups } from './alfa';
	import { patrolPings } from './patrol-pings.svelte';

	interface Props { sessions: TerminalSession[]; }
	let { sessions }: Props = $props();
	let groups = $derived(pendingPingGroups(patrolPings.pings, sessions));

	async function ackGroup(sessionId: string): Promise<void> {
		for (const ping of patrolPings.pings) {
			if (!ping.acknowledged && ping.sessionId === sessionId) await patrolPings.acknowledge(ping.id);
		}
	}
	async function ackAll(): Promise<void> {
		for (const ping of patrolPings.pings) if (!ping.acknowledged) await patrolPings.acknowledge(ping.id);
	}
	function relativeTime(timestamp: number): string {
		const delta = Math.max(0, Date.now() - timestamp);
		if (delta < 60_000) return 'now';
		if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
		if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
		return `${Math.floor(delta / 86_400_000)}d ago`;
	}
</script>

<section class="alfa-activity">
	<header><div><strong>Activity feed</strong><small>{patrolPings.pendingCount} pending</small></div>{#if patrolPings.pendingCount > 0}<button type="button" class="alfa-small-btn" onclick={() => void ackAll()}><Trash2 size={12} /> Clear all</button>{/if}</header>
	{#if patrolPings.loading && patrolPings.pings.length === 0}
		<p class="alfa-empty"><Loader2 size={14} /> Loading activity…</p>
	{:else if groups.length === 0}
		<div class="alfa-empty"><Sparkles size={20} /><strong>No pending activity</strong><p>Waiting/done pings from the agent scheduler will appear here.</p></div>
	{:else}
		<div class="alfa-ping-groups">
			{#each groups as group (group.sessionId)}
				<article class="alfa-ping-group">
					<header><div><strong>{group.title}</strong><small>{group.items.length} pending · {relativeTime(group.latestAt)}</small></div><button type="button" class="alfa-small-btn" onclick={() => void ackGroup(group.sessionId)}>Clear</button></header>
					<ul>
						{#each group.items as ping (ping.id)}
							<li><span class="alfa-event" data-event={ping.activityState}>{ping.activityState}</span><div><strong>{ping.title}</strong><p>{ping.prompt}</p></div><button type="button" class="alfa-small-btn" onclick={() => void patrolPings.acknowledge(ping.id)}>ack</button></li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	{/if}
</section>
