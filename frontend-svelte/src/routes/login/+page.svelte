<script lang="ts">
	// Svelte 5 runes port of frontend/app/login/page.tsx. Kept as a plain
	// client-side fetch() (not a SvelteKit form action) deliberately — the
	// original's exact status-code branching (400/401/403/429) drives UI
	// state (pending-device banner, rate-limit message) that a form action
	// would need extra plumbing to preserve faithfully. Visual design is a
	// simplified version of the original's glass-panel cockpit look; the
	// full two-column marketing layout is left for a follow-up pass (see
	// README-MIGRATION.md).
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';

	const DEVICE_ID_KEY = 'vps.device.id';

	function getOrCreateDeviceId(): string {
		try {
			let id = window.localStorage.getItem(DEVICE_ID_KEY);
			if (!id || !/^[a-f0-9]{16,}$/i.test(id)) {
				const bytes = new Uint8Array(16);
				crypto.getRandomValues(bytes);
				id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
				window.localStorage.setItem(DEVICE_ID_KEY, id);
			}
			return id;
		} catch {
			return '';
		}
	}

	function deviceLabel(): string {
		const ua = navigator.userAgent;
		const os = /Windows/.test(ua)
			? 'Windows'
			: /Mac/.test(ua)
				? 'macOS'
				: /Android/.test(ua)
					? 'Android'
					: /iPhone|iPad/.test(ua)
						? 'iOS'
						: /Linux/.test(ua)
							? 'Linux'
							: 'device';
		const browser = /Edg/.test(ua)
			? 'Edge'
			: /Chrome/.test(ua)
				? 'Chrome'
				: /Firefox/.test(ua)
					? 'Firefox'
					: /Safari/.test(ua)
						? 'Safari'
						: 'browser';
		return `${os} · ${browser}`;
	}

	let secret = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);
	let pendingId = $state<string | null>(null);
	let copied = $state(false);

	let approveCommand = $derived(pendingId ? `node scripts/approve-device.js ${pendingId}` : '');

	async function copyId(): Promise<void> {
		if (!pendingId) return;
		try {
			await navigator.clipboard.writeText(approveCommand);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			error = 'Clipboard blocked — copy the id manually';
		}
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const normalizedSecret = secret.trim();
		if (!normalizedSecret || loading) return;

		error = null;
		pendingId = null;
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					secret: normalizedSecret,
					deviceId: getOrCreateDeviceId(),
					deviceLabel: deviceLabel()
				})
			});

			if (res.ok) {
				await goto('/', { invalidateAll: true });
			} else if (res.status === 403) {
				const payload = (await res.json().catch(() => ({}))) as { deviceId?: string };
				pendingId = payload.deviceId ?? getOrCreateDeviceId();
			} else if (res.status === 401) {
				error = 'Invalid secret';
			} else if (res.status === 429) {
				error = 'Too many attempts, try again later';
			} else if (res.status === 400) {
				error = 'Device id could not be generated (enable storage)';
			} else {
				error = 'An unexpected error occurred';
			}
		} catch {
			error = 'Failed to connect to server';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in — Control Room</title>
</svelte:head>

<div class="login-shell">
	<div class="login-card glass-panel">
		<h1>Enter the control room</h1>
		<p class="login-sub">Authenticate with the shared secret to access the live VPS cockpit.</p>

		<form onsubmit={handleSubmit}>
			<label for="secret">Access secret</label>
			<input
				id="secret"
				name="secret"
				type="password"
				bind:value={secret}
				placeholder="Enter control room secret…"
				required
				autocomplete="current-password"
				autofocus
			/>

			{#if error}
				<div class="banner banner--error">{error}</div>
			{/if}

			{#if pendingId}
				<div class="banner banner--warning">
					<div class="banner__title">New device — approval required</div>
					<p>
						Password accepted, but this device isn't trusted yet. Run this from the repo root on
						the VPS, then sign in again.
					</p>
					<code>{approveCommand}</code>
					<Button type="button" variant="outline" size="sm" onclick={copyId}>
						{copied ? 'Copied' : 'Copy command'}
					</Button>
				</div>
			{/if}

			<Button type="submit" disabled={loading} class="w-full">
				{loading ? 'Signing in…' : 'Sign in'}
			</Button>
		</form>
	</div>
</div>

<style>
	.login-shell {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background:
			radial-gradient(circle at top left, rgba(34, 211, 238, 0.16), transparent 24%),
			radial-gradient(circle at 82% 15%, rgba(251, 146, 60, 0.14), transparent 18%),
			radial-gradient(circle at 50% 100%, rgba(168, 85, 247, 0.12), transparent 20%),
			var(--bg);
	}
	.login-card {
		width: 100%;
		max-width: 420px;
		border-radius: 2.25rem;
		border: 1px solid var(--border);
		padding: 32px;
	}
	.login-card h1 {
		font-size: 1.75rem;
		font-weight: 600;
		margin: 0 0 8px;
	}
	.login-sub {
		color: var(--ink-muted);
		font-size: 0.9rem;
		margin: 0 0 24px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	label {
		font-size: 0.85rem;
		font-weight: 500;
		color: #cbd5e1;
	}
	input {
		width: 100%;
		border-radius: 1.1rem;
		border: 1px solid var(--border);
		background: rgba(0, 0, 0, 0.2);
		color: white;
		padding: 12px 16px;
		font-size: 0.9rem;
	}
	input:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.5);
	}
	.banner {
		border-radius: 1rem;
		padding: 12px 14px;
		font-size: 0.85rem;
	}
	.banner--error {
		border: 1px solid rgba(244, 63, 94, 0.3);
		background: rgba(244, 63, 94, 0.1);
		color: #fecdd3;
	}
	.banner--warning {
		border: 1px solid rgba(245, 158, 11, 0.3);
		background: rgba(245, 158, 11, 0.1);
		color: #fde68a;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.banner__title {
		font-weight: 600;
	}
	code {
		word-break: break-all;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
		padding: 6px 8px;
		font-size: 0.75rem;
	}
</style>
