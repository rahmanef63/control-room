<script lang="ts">
	import { DownloadCloud, RotateCcw, Settings2, ShieldCheck, UploadCloud, X } from 'lucide-svelte';

	import { Button } from '$lib/components/ui/button';
	import { SUPPORTED_SOFT_KEYBOARD_KEYS } from '$lib/features/terminals/soft-keyboard';
	import type { SoftKeyboardKey } from '$lib/features/terminals/types';
	import type {
		NotificationSettings,
		SoftKeyboardSettings
	} from '$lib/features/terminals/use-app-settings.svelte';

	interface Props {
		open: boolean;
		notifications: NotificationSettings;
		softKeyboard: SoftKeyboardSettings;
		onOpenChange: (open: boolean) => void;
		onUpdateNotifications: (patch: Partial<NotificationSettings>) => void;
		onUpdateSoftKeyboard: (patch: Partial<SoftKeyboardSettings>) => void;
		onSetSoftKeyVisible: (key: SoftKeyboardKey, visible: boolean) => void;
		onOpenDevices: () => void;
		onExportBackup: () => void;
		onImportBackup: () => void;
		onResetDefaults: () => void;
	}

	let {
		open,
		notifications,
		softKeyboard,
		onOpenChange,
		onUpdateNotifications,
		onUpdateSoftKeyboard,
		onSetSoftKeyVisible,
		onOpenDevices,
		onExportBackup,
		onImportBackup,
		onResetDefaults
	}: Props = $props();


	function testHeartbeat(): void {
		document.documentElement.setAttribute('data-heartbeat-test', 'on');
		window.setTimeout(() => document.documentElement.removeAttribute('data-heartbeat-test'), 4000);
	}

	function openDevices(): void {
		onOpenChange(false);
		onOpenDevices();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') onOpenChange(false);
	}}
/>

{#if open}
	<div
		class="settings-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) onOpenChange(false);
		}}
	>
		<div
			class="settings-sheet"
			role="dialog"
			aria-modal="true"
			aria-label="Settings"
			tabindex="-1"
		>
			<header class="settings-header">
				<div class="settings-title">
					<Settings2 size={16} />
					<div>
						<h2>Settings</h2>
						<p>Terminal behavior and security</p>
					</div>
				</div>
				<button type="button" class="settings-close" onclick={() => onOpenChange(false)} aria-label="Close settings">
					<X size={16} />
				</button>
			</header>

			<div class="settings-body">
				<section class="settings-section">
					<div class="settings-section__head">
						<h3>Terminal activity</h3>
						<span>Visual feedback</span>
					</div>
					<label class="settings-row">
						<span>
							<strong>Heartbeat glow</strong>
							<small>Pulse the pane edge while an AI agent is working.</small>
						</span>
						<input
							type="checkbox"
							checked={notifications.heartbeatGlow}
							onchange={(event) => onUpdateNotifications({ heartbeatGlow: event.currentTarget.checked })}
						/>
					</label>
					<Button variant="outline" size="sm" onclick={testHeartbeat}>Test heartbeat</Button>
				</section>

				<section class="settings-section">
					<div class="settings-section__head">
						<h3>Terminal shortcuts</h3>
						<span>Touch controls</span>
					</div>
					<label class="settings-row">
						<span>
							<strong>Soft keyboard bar</strong>
							<small>Show terminal shortcut keys below each pane on touch layouts.</small>
						</span>
						<input
							type="checkbox"
							checked={!softKeyboard.hideKeyboard}
							onchange={(event) => onUpdateSoftKeyboard({ hideKeyboard: !event.currentTarget.checked })}
						/>
					</label>
					<div class="settings-key-grid" aria-label="Visible terminal shortcut keys">
						{#each SUPPORTED_SOFT_KEYBOARD_KEYS as key (key.id)}
							<label class="settings-key-row">
								<input
									type="checkbox"
									checked={softKeyboard.visibility[key.id] !== false}
									onchange={(event) => onSetSoftKeyVisible(key.id, event.currentTarget.checked)}
								/>
								<span>{key.label}</span>
							</label>
						{/each}
					</div>
					<small class="settings-note">The old React preferences also carried unused Enter/Ctrl-hold flags; they remain storage-compatible but are hidden until real behavior exists.</small>
				</section>

				<section class="settings-section">
					<div class="settings-section__head">
						<h3>Screen</h3>
						<span>Automatic</span>
					</div>
					<div class="settings-copy-row">
						<strong>Keep screen awake while a terminal is running</strong>
						<small>
							Uses the browser Screen Wake Lock API when supported. It releases automatically when no live terminal remains.
						</small>
					</div>
				</section>

				<section class="settings-section">
					<div class="settings-section__head">
						<h3>Security</h3>
						<span>Sign-in</span>
					</div>
					<button type="button" class="settings-nav" onclick={openDevices}>
						<ShieldCheck size={15} />
						<span>
							<strong>Trusted devices</strong>
							<small>Approve or revoke devices that can sign in.</small>
						</span>
						<span aria-hidden="true">›</span>
					</button>
				</section>

				<section class="settings-section">
					<div class="settings-section__head">
						<h3>Data</h3>
						<span>Backup</span>
					</div>
					<button type="button" class="settings-nav" onclick={onExportBackup}>
						<DownloadCloud size={15} />
						<span>
							<strong>Export dashboard settings</strong>
							<small>Download workspaces, templates, settings, history and pane preferences as one JSON backup.</small>
						</span>
						<span aria-hidden="true">↓</span>
					</button>
					<button type="button" class="settings-nav settings-nav--danger" onclick={onImportBackup}>
						<UploadCloud size={15} />
						<span>
							<strong>Import settings…</strong>
							<small>Replace current dashboard data from a backup, sync workspace state to the host, then reload. No undo — export first.</small>
						</span>
						<span aria-hidden="true">↑</span>
					</button>
				</section>
			</div>

			<footer class="settings-footer">
				<Button variant="ghost" size="sm" onclick={onResetDefaults}>
					<RotateCcw size={13} /> Reset defaults
				</Button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.settings-backdrop {
		position: fixed;
		inset: 0;
		z-index: 110;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgb(4 8 16 / 0.62);
		backdrop-filter: blur(8px);
	}
	.settings-sheet {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 31rem;
		max-height: min(88dvh, calc(100dvh - var(--safe-top)), 720px);
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 1.2rem 1.2rem 0 0;
		background: color-mix(in srgb, var(--surface) 97%, #07101d);
		box-shadow: 0 -20px 60px rgb(0 0 0 / 0.38);
		padding-bottom: var(--safe-bottom);
	}
	.settings-header,
	.settings-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
	}
	.settings-header { border-bottom: 1px solid var(--border); }
	.settings-footer { justify-content: flex-end; border-top: 1px solid var(--border); }
	.settings-title { display: flex; align-items: center; gap: 9px; color: var(--accent); }
	.settings-title h2 { margin: 0; color: var(--ink); font-size: 0.88rem; }
	.settings-title p { margin: 1px 0 0; color: var(--ink-muted); font-size: 0.67rem; }
	.settings-close {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.settings-body { display: grid; gap: 10px; overflow-y: auto; padding: 12px; }
	.settings-section {
		display: grid;
		gap: 9px;
		border: 1px solid var(--border);
		border-radius: 11px;
		background: var(--surface-2);
		padding: 11px;
	}
	.settings-section__head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
	.settings-section__head h3 { margin: 0; color: var(--ink); font-size: 0.74rem; }
	.settings-section__head > span { color: var(--ink-muted); font-size: 0.62rem; }
	.settings-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
	.settings-row > span,
	.settings-copy-row,
	.settings-nav > span:nth-child(2) { display: grid; gap: 2px; min-width: 0; }
	.settings-row strong,
	.settings-copy-row strong,
	.settings-nav strong { color: var(--ink); font-size: 0.72rem; font-weight: 600; }
	.settings-row small,
	.settings-copy-row small,
	.settings-nav small { color: var(--ink-muted); font-size: 0.64rem; line-height: 1.4; }
	.settings-row input { width: 17px; height: 17px; accent-color: var(--accent); }
	.settings-nav {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 9px;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: color-mix(in srgb, var(--surface) 70%, transparent);
		padding: 9px;
		color: var(--ink-muted);
		text-align: left;
		cursor: pointer;
	}
	.settings-nav:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); color: var(--accent); }
	.settings-nav--danger { border-color: rgb(244 63 94 / 0.22); }
	.settings-nav--danger:hover { border-color: rgb(244 63 94 / 0.48); color: rgb(253 164 175); }
	.settings-key-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
	.settings-key-row { display: flex; align-items: center; gap: 7px; min-width: 0; border: 1px solid var(--border); border-radius: 8px; padding: 7px 8px; color: var(--ink-muted); font-size: 0.65rem; }
	.settings-key-row input { width: 15px; height: 15px; flex: 0 0 auto; accent-color: var(--accent); }
	.settings-key-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.settings-note { color: var(--ink-muted); font-size: 0.61rem; line-height: 1.4; }
	@media (min-width: 640px) {
		.settings-backdrop { align-items: center; }
		.settings-sheet { border-radius: 1.2rem; margin-bottom: 7dvh; }
	}
</style>
