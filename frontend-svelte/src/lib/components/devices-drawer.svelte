<script lang="ts">
	// Svelte 5 runes port of
	// frontend/src/features/terminals/components/devices-drawer.tsx +
	// use-devices.ts. Lets an already-trusted device approve a new device's
	// pending request or revoke trust, without needing CLI access to the
	// VPS — the backend (/api/auth/devices) was already ported in Phase 2.
	//
	// Polling lives directly in this component as an $effect keyed on the
	// `open` prop, replacing the original's `useDevices(enabled)` hook —
	// there's only one consumer, so a shared module singleton (like
	// terminal-sessions.svelte.ts) would be the wrong shape here.
	import { Check, ShieldCheck, ShieldQuestion, Smartphone, Trash2, X } from 'lucide-svelte';

	import {
		fetchDevices,
		mutateDevice,
		relativeTime,
		type ApprovedDevice,
		type PendingDevice
	} from '$lib/features/terminals/devices';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}

	let { open, onOpenChange }: Props = $props();

	const POLL_INTERVAL_MS = 8000;

	let approved = $state<Record<string, ApprovedDevice>>({});
	let pending = $state<Record<string, PendingDevice>>({});
	let loading = $state(false);
	let busy = $state<string | null>(null);
	let inflight = false;

	async function refresh(): Promise<void> {
		if (inflight) return;
		inflight = true;
		loading = true;
		try {
			const payload = await fetchDevices();
			if (payload) {
				approved = payload.approved ?? {};
				pending = payload.pending ?? {};
			}
		} finally {
			loading = false;
			inflight = false;
		}
	}

	// Poll only while the drawer is open, same as the original's `enabled` flag.
	$effect(() => {
		if (!open) return;
		void refresh();
		const id = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
		return () => window.clearInterval(id);
	});

	async function act(action: 'approve' | 'revoke', id: string, label?: string): Promise<void> {
		busy = id;
		try {
			const payload = await mutateDevice(action, id, label);
			if (payload) {
				approved = payload.approved ?? approved;
				pending = payload.pending ?? pending;
			} else {
				await refresh();
			}
		} finally {
			busy = null;
		}
	}

	let pendingEntries = $derived(
		Object.entries(pending).sort((a, b) => b[1].lastSeen - a[1].lastSeen)
	);
	let approvedEntries = $derived(
		Object.entries(approved).sort((a, b) => b[1].approvedAt - a[1].approvedAt)
	);
	let pendingCount = $derived(Object.keys(pending).length);
</script>

{#if open}
	<div
		class="devices-backdrop"
		role="presentation"
		onclick={() => onOpenChange(false)}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Trusted devices"
			onclick={(event) => event.stopPropagation()}
			class="devices-sheet"
		>
			<div class="devices-header">
				<div class="devices-header__title">
					<ShieldCheck size={16} color="#7dd3fc" />
					<div>
						<p class="devices-header__label">Trusted devices</p>
						<p class="devices-header__hint">
							{pendingCount > 0
								? `${pendingCount} awaiting approval`
								: 'Approve or revoke devices that can sign in'}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => onOpenChange(false)}
					class="devices-close"
					aria-label="Close devices"
				>
					<X size={16} />
				</button>
			</div>

			<div class="devices-body">
				<section>
					<p class="devices-section-label devices-section-label--warning">
						<ShieldQuestion size={14} /> Pending approval
					</p>
					{#if pendingEntries.length === 0}
						<p class="devices-empty">{loading ? 'Loading…' : 'No devices waiting.'}</p>
					{:else}
						<ul class="devices-list">
							{#each pendingEntries as [id, d] (id)}
								<li class="devices-item devices-item--pending">
									<Smartphone size={16} color="#fcd34d" />
									<div class="devices-item__body">
										<p class="devices-item__label">{d.label}</p>
										<p class="devices-item__id">{id}</p>
										<p class="devices-item__meta">
											ip {d.ip} · {d.attempts} attempt{d.attempts === 1 ? '' : 's'} ·
											{relativeTime(d.lastSeen)}
										</p>
									</div>
									<div class="devices-item__actions">
										<!-- Dismiss reuses revoke: revokeDevice() already deletes the
											pending record too, so no new endpoint is needed. It
											clears the request, it does not blocklist the device —
											the same id reappears here if it retries the password. -->
										<button
											type="button"
											disabled={busy === id}
											onclick={() => void act('revoke', id)}
											title="Clear this request. The device can ask again."
											class="devices-btn devices-btn--muted"
										>
											<X size={14} /> Dismiss
										</button>
										<button
											type="button"
											disabled={busy === id}
											onclick={() => void act('approve', id, d.label)}
											class="devices-btn devices-btn--approve"
										>
											<Check size={14} /> Approve
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section>
					<p class="devices-section-label">
						<ShieldCheck size={14} /> Approved ({approvedEntries.length})
					</p>
					{#if approvedEntries.length === 0}
						<p class="devices-empty">No trusted devices yet.</p>
					{:else}
						<ul class="devices-list">
							{#each approvedEntries as [id, d] (id)}
								<li class="devices-item">
									<ShieldCheck size={16} color="#6ee7b7" />
									<div class="devices-item__body">
										<p class="devices-item__label">{d.label}</p>
										<p class="devices-item__id">{id}</p>
										<p class="devices-item__meta">
											approved {relativeTime(d.approvedAt)}
											{d.lastSeen ? ` · last seen ${relativeTime(d.lastSeen)}` : ''}
										</p>
									</div>
									<button
										type="button"
										disabled={busy === id}
										onclick={() => void act('revoke', id)}
										class="devices-icon-btn"
										aria-label="Revoke device"
										title="Revoke trust"
									>
										<Trash2 size={14} />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		</div>
	</div>
{/if}

<style>
	.devices-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(4, 8, 16, 0.6);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	@media (min-width: 640px) {
		.devices-backdrop {
			align-items: center;
		}
	}
	.devices-sheet {
		width: 100%;
		max-width: 28rem;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 1.25rem 1.25rem 0 0;
		overflow: hidden;
	}
	@media (min-width: 640px) {
		.devices-sheet {
			border-radius: 1.25rem;
			margin-bottom: 10vh;
		}
	}
	.devices-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid var(--border);
		padding: 12px 16px;
	}
	.devices-header__title {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.devices-header__label {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink);
	}
	.devices-header__hint {
		margin: 0;
		font-size: 0.68rem;
		color: var(--ink-muted);
	}
	.devices-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--border);
		color: var(--ink-muted);
	}
	.devices-body {
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.devices-section-label {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 8px 4px;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-muted);
	}
	.devices-section-label--warning {
		color: var(--warning);
	}
	.devices-empty {
		text-align: center;
		padding: 12px 8px;
		font-size: 0.75rem;
		color: var(--ink-muted);
	}
	.devices-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.devices-item {
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: 0.65rem;
		border: 1px solid var(--border);
		background: var(--surface-2);
		padding: 8px 10px;
	}
	.devices-item--pending {
		border-color: rgba(251, 191, 36, 0.3);
		background: rgba(251, 191, 36, 0.1);
	}
	.devices-item__body {
		min-width: 0;
		flex: 1;
	}
	.devices-item__label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.devices-item__id {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--ink-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.devices-item__meta {
		margin: 0;
		font-size: 0.62rem;
		color: var(--ink-muted);
	}
	.devices-item__actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.devices-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		padding: 6px 10px;
		font-size: 0.72rem;
		font-weight: 500;
	}
	.devices-btn:disabled {
		opacity: 0.5;
	}
	.devices-btn--muted {
		color: var(--ink-muted);
		background: rgba(255, 255, 255, 0.04);
	}
	.devices-btn--approve {
		border-color: rgba(52, 211, 153, 0.4);
		background: rgba(52, 211, 153, 0.15);
		color: #a7f3d0;
	}
	.devices-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		color: var(--ink-muted);
	}
	.devices-icon-btn:hover {
		color: #fca5a5;
	}
</style>
