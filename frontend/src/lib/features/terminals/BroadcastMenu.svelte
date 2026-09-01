<script lang="ts">
	import { ChevronDown, Keyboard } from 'lucide-svelte';
	import type { TerminalSession } from '$lib/features/terminals/types';

	interface Props {
		sessions: TerminalSession[];
		targets: ReadonlySet<string>;
		onChange: (next: Iterable<string>) => void;
	}
	let { sessions, targets, onChange }: Props = $props();
	let open = $state(false);
	let running = $derived(sessions.filter((session) => session.status === 'running'));
	let selected = $derived(running.filter((session) => targets.has(session.id)));
	let active = $derived(selected.length > 0);

	function panes(count: number): string { return `${count} pane${count === 1 ? '' : 's'}`; }
	function toggleTarget(id: string): void {
		const current = selected.map((session) => session.id);
		onChange(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
	}
	function selectAll(): void { onChange(running.map((session) => session.id)); }
	function selectNone(): void { onChange([]); }
	function setArmed(next: boolean): void { if (next) selectAll(); else selectNone(); }

	function outsideDismiss(node: HTMLElement) {
		function handlePointerDown(event: PointerEvent): void {
			if (open && !node.contains(event.target as Node)) open = false;
		}
		function handleKeyDown(event: KeyboardEvent): void {
			if (open && event.key === 'Escape') open = false;
		}
		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}
</script>

<div class="broadcast-menu" {@attach outsideDismiss}>
	<button type="button" class="broadcast-trigger" data-active={active || undefined} aria-expanded={open}
		aria-haspopup="dialog" title={active ? `Typing is mirrored to ${panes(selected.length)}` : 'Send keys to several terminal panes'}
		onclick={() => (open = !open)}>
		<Keyboard size={14} /><span>Send keys</span>
		{#if active}<span class="broadcast-badge">{selected.length}</span>{/if}
		<span class:rotate={open}><ChevronDown size={12} /></span>
	</button>
	{#if open}
		<div class="broadcast-popover" role="dialog" aria-label="Send keys to terminal panes">
			<button type="button" class="broadcast-status" data-active={active || undefined}
				disabled={!active && running.length === 0} aria-pressed={active} onclick={() => setArmed(!active)}>
				<span class="status-dot"></span>
				<span>{active ? `Sending typing to ${panes(selected.length)} — click to stop` : `Off — click to target all ${panes(running.length)}`}</span>
			</button>
			<p class="broadcast-hint">Type in any pane. Every checked pane receives the same keystrokes, and the source pane always receives them too.</p>
			<div class="broadcast-section-head"><span>Send to</span><div class="broadcast-quick">
				<button type="button" onclick={selectAll} disabled={running.length === 0}>All</button>
				<button type="button" onclick={selectNone} disabled={!active}>None</button>
			</div></div>
			{#if running.length === 0}
				<p class="broadcast-empty">No running panes in this workspace.</p>
			{:else}
				<ul class="broadcast-targets">
					{#each running as session (session.id)}
						<li><label class="broadcast-target"><input type="checkbox" checked={targets.has(session.id)} onchange={() => toggleTarget(session.id)} />
							<span class="target-copy"><strong title={session.cwd}>{session.title || session.profile}</strong><small>{session.inner_agent ?? session.profile}</small></span>
						</label></li>
					{/each}
				</ul>
			{/if}
			<p class="broadcast-hint broadcast-hint--footer">{active ? `${panes(selected.length)} checked, plus whichever pane you type in.` : 'Nothing checked — typing stays in the pane you are using.'}</p>
		</div>
	{/if}
</div>

<style>
	.broadcast-menu { position: relative; flex: 0 0 auto; }
	.broadcast-trigger { display:inline-flex; height:32px; align-items:center; gap:7px; border:1px solid rgb(255 255 255 / .15); border-radius:1.1rem; background:rgb(255 255 255 / .05); padding:0 10px; color:rgb(226 232 240); font-size:12px; font-weight:600; }
	.broadcast-trigger:hover,.broadcast-trigger[aria-expanded='true'] { background:rgb(255 255 255 / .1); }
	.broadcast-trigger[data-active='true'] { border-color:rgb(251 113 133 / .45); background:rgb(127 29 29 / .25); color:rgb(254 205 211); }
	.broadcast-badge { display:inline-grid; min-width:18px; height:18px; place-items:center; border-radius:999px; background:rgb(251 113 133 / .2); padding:0 5px; font-size:10px; }
	.rotate { transform:rotate(180deg); }
	.broadcast-popover { position:absolute; top:calc(100% + 8px); right:0; z-index:40; width:min(360px,calc(100vw - 24px)); border:1px solid rgb(255 255 255 / .14); border-radius:16px; background:rgb(10 18 32 / .98); box-shadow:0 18px 48px rgb(0 0 0 / .35); padding:10px; color:rgb(226 232 240); }
	.broadcast-status { display:flex; width:100%; align-items:center; gap:9px; border:1px solid rgb(255 255 255 / .08); border-radius:11px; background:rgb(255 255 255 / .04); padding:9px 10px; color:inherit; text-align:left; font-size:11px; }
	.broadcast-status[data-active='true'] { border-color:rgb(251 113 133 / .28); background:rgb(127 29 29 / .18); color:rgb(254 205 211); }
	.broadcast-status:disabled,.broadcast-quick button:disabled { opacity:.4; }
	.status-dot { width:7px; height:7px; flex:0 0 auto; border-radius:999px; background:rgb(100 116 139); }
	.broadcast-status[data-active='true'] .status-dot { background:rgb(251 113 133); box-shadow:0 0 0 4px rgb(251 113 133 / .12); }
	.broadcast-hint,.broadcast-empty { margin:8px 2px; color:rgb(148 163 184); font-size:10px; line-height:1.45; }
	.broadcast-section-head { display:flex; align-items:center; justify-content:space-between; gap:8px; border-top:1px solid rgb(255 255 255 / .08); padding:9px 2px 6px; color:rgb(148 163 184); font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
	.broadcast-quick { display:flex; gap:4px; }
	.broadcast-quick button { border-radius:7px; padding:3px 7px; color:rgb(203 213 225); font-size:10px; letter-spacing:0; text-transform:none; }
	.broadcast-quick button:hover:not(:disabled),.broadcast-target:hover { background:rgb(255 255 255 / .06); }
	.broadcast-targets { max-height:min(260px,40dvh); overflow:auto; padding:0; margin:0; list-style:none; }
	.broadcast-target { display:flex; align-items:center; gap:9px; border-radius:9px; padding:7px 6px; cursor:pointer; }
	.broadcast-target input { accent-color:rgb(251 113 133); }
	.target-copy { display:grid; min-width:0; gap:1px; }
	.target-copy strong,.target-copy small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
	.target-copy strong { color:rgb(226 232 240); font-size:11px; font-weight:600; }
	.target-copy small { color:rgb(100 116 139); font-size:9px; }
	.broadcast-hint--footer { border-top:1px solid rgb(255 255 255 / .08); padding-top:8px; margin-bottom:0; }
	@media (max-width:760px) {
		.broadcast-trigger > span:not(.broadcast-badge) { display:none; }
		.broadcast-trigger { width:32px; justify-content:center; padding:0; }
		.broadcast-badge { position:absolute; top:-5px; right:-4px; }
		.broadcast-popover { position:fixed; top:calc(108px + var(--safe-top)); right:calc(12px + var(--safe-right)); left:calc(12px + var(--safe-left)); width:auto; max-height:calc(100dvh - var(--safe-top) - var(--safe-bottom) - 120px); overflow-y:auto; }
	}
</style>
