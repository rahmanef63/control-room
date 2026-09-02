<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AlertTriangle,
		Cable,
		Check,
		CircleDot,
		KeyRound,
		Plus,
		RefreshCw,
		ShieldCheck,
		Terminal,
		Trash2,
		UserRound,
		X
	} from 'lucide-svelte';

	import { Button } from '$lib/components/ui/button';
	import {
		callSiCoderTool,
		chooseInitialSiCoderUser,
		loadSiCoderSurface,
		providerStateTone,
		type SiCoderConnectionRequest,
		type SiCoderConnectionStatus,
		type SiCoderCredentialRequest,
		type SiCoderProviderStatus,
		type SiCoderToolSurface,
		type SiCoderUserResolution,
		type SiCoderUsersResponse
	} from './si-coder';

	interface Props {
		cwd?: string;
		onClose: () => void;
		onOpenSecureTerminal: (command: string) => void | Promise<void>;
	}

	let { cwd, onClose, onOpenSecureTerminal }: Props = $props();
	let surface = $state<SiCoderToolSurface | null>(null);
	let usersData = $state<SiCoderUsersResponse | null>(null);
	let selectedUser = $state<string | null>(null);
	let providers = $state<SiCoderProviderStatus[]>([]);
	let selectedProviderId = $state<string | null>(null);
	let connections = $state<SiCoderConnectionStatus[]>([]);
	let connectionRequest = $state<SiCoderConnectionRequest | null>(null);
	let search = $state('');
	let loading = $state(true);
	let detailLoading = $state(false);
	let busy = $state<string | null>(null);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let createConnectionOpen = $state(false);
	let newConnectionLabel = $state('');
	let newAuthMethod = $state('');
	let newConnectionDefault = $state(false);

	let selectedProvider = $derived(
		providers.find((provider) => provider.id === selectedProviderId) ?? null
	);
	let filteredProviders = $derived.by(() => {
		const needle = search.trim().toLowerCase();
		if (!needle) return providers;
		return providers.filter((provider) =>
			`${provider.title} ${provider.id} ${provider.blurb}`.toLowerCase().includes(needle)
		);
	});

	function messageOf(value: unknown): string {
		if (typeof value === 'string') return value;
		if (value && typeof value === 'object') {
			const record = value as Record<string, unknown>;
			if (typeof record.output === 'string') return record.output;
			if (typeof record.message === 'string') return record.message;
		}
		return 'Done';
	}

	async function loadBootstrap(): Promise<void> {
		loading = true;
		error = null;
		try {
			const nextSurface = await loadSiCoderSurface();
			surface = nextSurface;
			if (!nextSurface.installed) {
				usersData = null;
				selectedUser = null;
				providers = [];
				connections = [];
				return;
			}
			const [nextUsers, resolution] = await Promise.all([
				callSiCoderTool<SiCoderUsersResponse>('sc.user.list'),
				cwd
					? callSiCoderTool<SiCoderUserResolution>('sc.user.which', { cwd })
					: Promise.resolve<SiCoderUserResolution | null>(null)
			]);
			usersData = nextUsers;
			selectedUser = chooseInitialSiCoderUser(nextUsers, resolution?.user ?? null);
			if (selectedUser) await loadUser(selectedUser);
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			loading = false;
		}
	}

	async function loadUser(user: string): Promise<void> {
		selectedUser = user;
		detailLoading = true;
		error = null;
		try {
			const payload = await callSiCoderTool<{ user: string; providers: SiCoderProviderStatus[] }>(
				'sc.user.providers.list',
				{ user }
			);
			providers = payload.providers;
			const nextProvider = providers.some((provider) => provider.id === selectedProviderId)
				? selectedProviderId
				: providers[0]?.id ?? null;
			selectedProviderId = nextProvider;
			if (nextProvider) await loadProvider(nextProvider);
			else connections = [];
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			detailLoading = false;
		}
	}

	async function loadProvider(providerId: string): Promise<void> {
		if (!selectedUser) return;
		selectedProviderId = providerId;
		detailLoading = true;
		error = null;
		createConnectionOpen = false;
		connectionRequest = null;
		try {
			const payload = await callSiCoderTool<{ user: string; connections: SiCoderConnectionStatus[] }>(
				'sc.user.connections.list',
				{ user: selectedUser, provider: providerId }
			);
			connections = payload.connections;
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
			connections = [];
		} finally {
			detailLoading = false;
		}
	}

	async function refreshCurrent(): Promise<void> {
		if (!selectedUser) return void loadBootstrap();
		await loadUser(selectedUser);
	}

	async function setDefaultUser(user: string): Promise<void> {
		busy = `user:${user}`;
		error = null;
		try {
			await callSiCoderTool('sc.user.default', { user, confirm: true });
			notice = `${user} is now the default SI-Coder user.`;
			const nextUsers = await callSiCoderTool<SiCoderUsersResponse>('sc.user.list');
			usersData = nextUsers;
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			busy = null;
		}
	}

	async function verifyProvider(): Promise<void> {
		if (!selectedUser || !selectedProviderId) return;
		busy = 'verify';
		error = null;
		notice = null;
		try {
			const result = await callSiCoderTool<unknown>('sc.user.provider.verify', {
				user: selectedUser,
				provider: selectedProviderId,
				...(selectedProvider?.connection ? { connection: selectedProvider.connection } : {})
			});
			await loadUser(selectedUser);
			notice = messageOf(result);
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			busy = null;
		}
	}

	async function setDefaultConnection(connection: SiCoderConnectionStatus): Promise<void> {
		if (!selectedUser || !selectedProviderId || connection.isDefault) return;
		busy = `connection:${connection.id}`;
		error = null;
		try {
			await callSiCoderTool('sc.user.connection.manage', {
				user: selectedUser,
				provider: selectedProviderId,
				action: 'set-default',
				connection: connection.id,
				confirm: true
			});
			await loadUser(selectedUser);
			notice = `${connection.label} is now the default connection.`;
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			busy = null;
		}
	}

	async function beginCreateConnection(): Promise<void> {
		if (!selectedUser || !selectedProviderId) return;
		busy = 'connection-request';
		error = null;
		try {
			connectionRequest = await callSiCoderTool<SiCoderConnectionRequest>(
				'sc.user.connection.request',
				{ user: selectedUser, provider: selectedProviderId }
			);
			newAuthMethod = connectionRequest.authMethods?.find((method) => method.recommended)?.id
				?? connectionRequest.authMethods?.[0]?.id
				?? '';
			newConnectionLabel = '';
			newConnectionDefault = connections.length === 0;
			createConnectionOpen = true;
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			busy = null;
		}
	}

	async function createConnection(): Promise<void> {
		if (!selectedUser || !selectedProviderId || !newConnectionLabel.trim() || !newAuthMethod) return;
		busy = 'connection-create';
		error = null;
		try {
			await callSiCoderTool('sc.user.connection.manage', {
				user: selectedUser,
				provider: selectedProviderId,
				action: 'create',
				label: newConnectionLabel.trim(),
				authMethod: newAuthMethod,
				setDefault: newConnectionDefault,
				confirm: true
			});
			const createdLabel = newConnectionLabel.trim();
			createConnectionOpen = false;
			await loadUser(selectedUser);
			notice = `Created ${createdLabel}.`;
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			busy = null;
		}
	}

	async function deleteConnection(connection: SiCoderConnectionStatus): Promise<void> {
		if (!selectedUser || !selectedProviderId) return;
		if (!confirm(`Delete SI-Coder connection “${connection.label}”? Its managed credential file will also be removed.`)) return;
		busy = `delete:${connection.id}`;
		error = null;
		try {
			await callSiCoderTool('sc.user.connection.manage', {
				user: selectedUser,
				provider: selectedProviderId,
				action: 'delete',
				connection: connection.id,
				confirm: true
			});
			await loadUser(selectedUser);
			notice = `Deleted ${connection.label}.`;
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			busy = null;
		}
	}

	async function openCredentialTerminal(
		credential: SiCoderConnectionStatus['credentials'][number],
		connection: string | null
	): Promise<void> {
		if (!selectedUser || !selectedProviderId) return;
		busy = `credential:${connection ?? 'legacy'}:${credential.key}`;
		error = null;
		try {
			const request = await callSiCoderTool<SiCoderCredentialRequest>(
				'sc.user.credential.request',
				{
					user: selectedUser,
					provider: selectedProviderId,
					key: credential.key,
					...(connection ? { connection } : {})
				}
			);
			if (!request.command) throw new Error('SI-Coder did not return a secure terminal handoff');
			await onOpenSecureTerminal(request.command);
		} catch (reason) {
			error = reason instanceof Error ? reason.message : String(reason);
		} finally {
			busy = null;
		}
	}

	onMount(() => void loadBootstrap());
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<button class="provider-backdrop" type="button" aria-label="Close provider store" onclick={onClose}></button>
<div class="provider-sheet" role="dialog" aria-modal="true" aria-label="SI-Coder provider store">
	<header class="provider-header">
		<div class="provider-title">
			<KeyRound size={18} />
			<div>
				<strong>Provider Store</strong>
				<small>
					{#if surface?.installed}
						SI-Coder v{surface.version} · SSOT · {surface.tools.length} safe tools
					{:else if loading}
						Detecting SI-Coder…
					{:else}
						SI-Coder is not available
					{/if}
				</small>
			</div>
		</div>
		<div class="provider-header-actions">
			<button type="button" class="icon-button" aria-label="Refresh provider store" onclick={() => void refreshCurrent()} disabled={Boolean(busy)}><RefreshCw size={15} /></button>
			<button type="button" class="icon-button" aria-label="Close provider store" onclick={onClose}><X size={16} /></button>
		</div>
	</header>

	<div class="provider-safety">
		<ShieldCheck size={14} />
		<span>Control Room does not store or read provider secrets. Credential values stay inside SI-Coder’s local 0600 connection store.</span>
	</div>

	{#if error}<div class="provider-alert provider-alert--error"><AlertTriangle size={14} /><span>{error}</span></div>{/if}
	{#if notice}<div class="provider-alert provider-alert--ok"><Check size={14} /><span>{notice}</span></div>{/if}

	{#if loading}
		<div class="provider-empty">Loading SI-Coder provider state…</div>
	{:else if !surface?.installed}
		<div class="provider-empty">Install SI-Coder locally or set <code>SI_CODER_ROOT</code> on the Control Room agent.</div>
	{:else if !usersData?.users.length}
		<div class="provider-empty">No SI-Coder users exist yet. Create one with the SC CLI or tool-calling surface first.</div>
	{:else}
		<div class="provider-userbar">
			<label>
				<span><UserRound size={13} /> User</span>
				<select value={selectedUser ?? ''} onchange={(event) => void loadUser(event.currentTarget.value)}>
					{#each usersData.users as user (user.name)}
						<option value={user.name}>{user.owner || user.name}{user.isDefault ? ' · default' : ''}</option>
					{/each}
				</select>
			</label>
			{#if selectedUser && !usersData.users.find((user) => user.name === selectedUser)?.isDefault}
				<Button variant="outline" size="sm" onclick={() => void setDefaultUser(selectedUser!)} disabled={busy === `user:${selectedUser}`}>Make default</Button>
			{/if}
			<span class="provider-user-summary">
				{usersData.users.find((user) => user.name === selectedUser)?.connectionCount ?? 0} connections ·
				{usersData.users.find((user) => user.name === selectedUser)?.credentialCount ?? 0} fields
			</span>
		</div>

		<div class="provider-layout">
			<aside class="provider-list-panel">
				<div class="provider-filter"><input placeholder="Search providers…" bind:value={search} /></div>
				<div class="provider-list" aria-label="Providers">
					{#each filteredProviders as provider (provider.id)}
						<button
							type="button"
							class="provider-row"
							data-selected={provider.id === selectedProviderId || undefined}
							onclick={() => void loadProvider(provider.id)}
						>
							<span class="provider-state" data-tone={providerStateTone(provider.state)}><CircleDot size={11} /></span>
							<span class="provider-row-copy">
								<strong>{provider.title}</strong>
								<small>{provider.id} · {provider.stored}/{provider.total} stored</small>
							</span>
							<span class="provider-count">{provider.connectionCount}</span>
						</button>
					{/each}
				</div>
			</aside>

			<main class="provider-detail">
				{#if detailLoading && !selectedProvider}
					<div class="provider-empty">Loading provider…</div>
				{:else if selectedProvider}
					<header class="provider-detail-header">
						<div>
							<div class="provider-detail-title">
								<strong>{selectedProvider.title}</strong>
								<span class="state-pill" data-tone={providerStateTone(selectedProvider.state)}>{selectedProvider.state}</span>
							</div>
							<p>{selectedProvider.blurb}</p>
						</div>
						<div class="provider-detail-actions">
							<Button variant="outline" size="sm" onclick={() => void verifyProvider()} disabled={busy === 'verify'}><ShieldCheck size={13} /> Verify</Button>
							<Button variant="outline" size="sm" onclick={() => void beginCreateConnection()} disabled={busy === 'connection-request'}><Plus size={13} /> Connection</Button>
						</div>
					</header>

					<div class="provider-stats">
						<span>Stored <strong>{selectedProvider.stored}/{selectedProvider.total}</strong></span>
						<span>Connections <strong>{selectedProvider.connectionCount}</strong></span>
						<span>Auth <strong>{selectedProvider.authMethod || '—'}</strong></span>
						<span>Scope <strong>{selectedProvider.scope || '—'}</strong></span>
					</div>

					{#if createConnectionOpen}
						<section class="connection-create">
							<header><strong>New named connection</strong><button type="button" onclick={() => (createConnectionOpen = false)} aria-label="Cancel connection creation"><X size={14} /></button></header>
							<div class="connection-create-grid">
								<label><span>Label</span><input placeholder="e.g. Client A Production" bind:value={newConnectionLabel} /></label>
								<label><span>Authentication</span><select bind:value={newAuthMethod}>{#each connectionRequest?.authMethods ?? [] as method (method.id)}<option value={method.id}>{method.label} · {method.scope}</option>{/each}</select></label>
							</div>
							<label class="checkbox-row"><input type="checkbox" bind:checked={newConnectionDefault} /><span>Use as default connection</span></label>
							{#if connectionRequest?.authMethods?.find((method) => method.id === newAuthMethod)?.external}
								<p class="connection-note">This auth method is externally managed. SI-Coder stores only the connection alias/scope; OAuth/provider tokens remain with the connected-account system.</p>
							{:else}
								<p class="connection-note">After creation, missing fields can be entered through a secure terminal handoff. No credential value is accepted here.</p>
							{/if}
							<Button size="sm" onclick={() => void createConnection()} disabled={!newConnectionLabel.trim() || !newAuthMethod || busy === 'connection-create'}>Create connection</Button>
						</section>
					{/if}

					<section class="connection-section">
						<div class="section-heading"><Cable size={14} /><strong>Named connections</strong></div>
						{#if connections.length === 0}
							<div class="provider-empty provider-empty--compact">No named connection yet. Legacy/profile state remains visible, but named connections are the preferred SI-Coder boundary.</div>
						{:else}
							<div class="connection-list">
								{#each connections as connection (connection.id)}
									<article class="connection-card">
										<header>
											<div class="connection-title">
												<strong>{connection.label}</strong>
												<code>{connection.id}</code>
												{#if connection.isDefault}<span class="default-pill">default</span>{/if}
											</div>
											<div class="connection-actions">
												{#if !connection.isDefault}<button type="button" onclick={() => void setDefaultConnection(connection)} disabled={busy === `connection:${connection.id}`}>Set default</button>{/if}
												<button class="danger-link" type="button" onclick={() => void deleteConnection(connection)} disabled={busy === `delete:${connection.id}`}><Trash2 size={12} /> Delete</button>
											</div>
										</header>
										<div class="connection-meta"><span>{connection.authMethod}</span><span>{connection.scheme}</span><span>{connection.scope}</span>{#if connection.external}<span>external auth</span>{/if}</div>
										<div class="credential-list">
											{#each connection.credentials as credential (credential.key)}
												<div class="credential-row">
													<div class="credential-copy">
														<strong>{credential.key}</strong>
														<small>{credential.secret ? 'secret' : 'config'} · {credential.required ? 'required' : 'optional'} · value unreadable</small>
													</div>
													<span class="credential-state" data-valid={credential.valid || undefined}>{credential.state}</span>
													{#if !connection.external && (!credential.stored || !credential.valid)}
														<button class="secure-terminal" type="button" onclick={() => void openCredentialTerminal(credential, connection.id)} disabled={busy === `credential:${connection.id}:${credential.key}`}><Terminal size={12} /> Set securely</button>
													{/if}
												</div>
											{/each}
											{#if connection.external && connection.credentials.length === 0}
												<div class="external-note">Authorization is externally managed. Use the connection alias <code>{connection.id}</code> when selecting the connected account; no OAuth token is copied into SI-Coder.</div>
											{/if}
										</div>
									</article>
								{/each}
							</div>
						{/if}
					</section>

					{#if selectedProvider.legacy && selectedProvider.credentials.length > 0}
						<section class="connection-section">
							<div class="section-heading"><KeyRound size={14} /><strong>Legacy/profile fields</strong></div>
							<div class="credential-list credential-list--legacy">
								{#each selectedProvider.credentials as credential (credential.key)}
									<div class="credential-row">
										<div class="credential-copy"><strong>{credential.key}</strong><small>{credential.required ? 'required' : 'optional'} · migration-compatible store</small></div>
										<span class="credential-state" data-valid={credential.valid || undefined}>{credential.state}</span>
										{#if !credential.stored || !credential.valid}<button class="secure-terminal" type="button" onclick={() => void openCredentialTerminal(credential, null)} disabled={busy === `credential:legacy:${credential.key}`}><Terminal size={12} /> Set securely</button>{/if}
									</div>
								{/each}
							</div>
						</section>
					{/if}
				{:else}
					<div class="provider-empty">Choose a provider.</div>
				{/if}
			</main>
		</div>
	{/if}
</div>

<style>
	.provider-backdrop { position: fixed; inset: 0; z-index: 92; border: 0; background: rgb(3 7 18 / .72); backdrop-filter: blur(6px); }
	.provider-sheet { position: fixed; z-index: 93; inset: 18px; display: flex; max-width: 1120px; margin: auto; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: 17px; background: color-mix(in srgb, var(--surface) 98%, #07101d); box-shadow: 0 28px 90px rgb(0 0 0 / .58); color: var(--ink); }
	.provider-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
	.provider-title { display: flex; min-width: 0; align-items: center; gap: 9px; }
	.provider-title > div { display: grid; min-width: 0; }
	.provider-title strong { font-size: 13px; }
	.provider-title small { overflow: hidden; color: var(--ink-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.provider-header-actions { display: flex; gap: 6px; }
	.icon-button { display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--ink-muted); cursor: pointer; }
	.icon-button:disabled { opacity: .45; cursor: wait; }
	.provider-safety { display: flex; align-items: flex-start; gap: 7px; padding: 8px 14px; border-bottom: 1px solid var(--border); background: rgb(34 211 238 / .05); color: #a5f3fc; font-size: 10px; line-height: 1.45; }
	.provider-alert { display: flex; align-items: flex-start; gap: 7px; margin: 8px 12px 0; padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px; font-size: 10px; white-space: pre-wrap; }
	.provider-alert--error { border-color: rgb(251 113 133 / .35); background: rgb(251 113 133 / .08); color: #fecdd3; }
	.provider-alert--ok { border-color: rgb(52 211 153 / .3); background: rgb(52 211 153 / .07); color: #a7f3d0; }
	.provider-userbar { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
	.provider-userbar label { display: grid; min-width: 190px; gap: 4px; }
	.provider-userbar label > span { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-muted); font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
	.provider-userbar select, .provider-filter input, .connection-create input, .connection-create select { min-width: 0; border: 1px solid var(--border); border-radius: 7px; outline: none; background: var(--surface-2); padding: 7px 9px; color: var(--ink); font: inherit; font-size: 11px; }
	.provider-user-summary { margin-left: auto; align-self: center; color: var(--ink-muted); font-size: 9px; }
	.provider-layout { display: grid; min-height: 0; flex: 1; grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); }
	.provider-list-panel { display: flex; min-height: 0; flex-direction: column; border-right: 1px solid var(--border); }
	.provider-filter { padding: 9px; border-bottom: 1px solid var(--border); }
	.provider-filter input { width: 100%; }
	.provider-list { min-height: 0; overflow-y: auto; padding: 5px; }
	.provider-row { display: grid; width: 100%; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: 9px; background: transparent; padding: 8px; text-align: left; color: inherit; cursor: pointer; }
	.provider-row:hover, .provider-row[data-selected='true'] { border-color: var(--border); background: color-mix(in srgb, var(--surface-2) 84%, transparent); }
	.provider-state { display: inline-flex; color: var(--ink-muted); }
	.provider-state[data-tone='ready'] { color: #34d399; }
	.provider-state[data-tone='warn'] { color: #fbbf24; }
	.provider-state[data-tone='danger'] { color: #fb7185; }
	.provider-row-copy { display: grid; min-width: 0; gap: 2px; }
	.provider-row-copy strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.provider-row-copy small { overflow: hidden; color: var(--ink-muted); font: 9px var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
	.provider-count { min-width: 20px; border-radius: 999px; background: rgb(255 255 255 / .06); padding: 2px 5px; text-align: center; color: var(--ink-muted); font: 9px var(--font-mono); }
	.provider-detail { min-height: 0; overflow-y: auto; padding: 12px; }
	.provider-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
	.provider-detail-header > div:first-child { min-width: 0; }
	.provider-detail-title { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
	.provider-detail-title strong { font-size: 15px; }
	.provider-detail-header p { margin: 4px 0 0; color: var(--ink-muted); font-size: 10px; }
	.provider-detail-actions { display: flex; flex: 0 0 auto; gap: 6px; }
	.state-pill, .default-pill { border: 1px solid var(--border); border-radius: 999px; padding: 2px 6px; color: var(--ink-muted); font: 8px var(--font-mono); text-transform: uppercase; }
	.state-pill[data-tone='ready'] { border-color: rgb(52 211 153 / .35); color: #6ee7b7; }
	.state-pill[data-tone='warn'] { border-color: rgb(251 191 36 / .35); color: #fcd34d; }
	.state-pill[data-tone='danger'] { border-color: rgb(251 113 133 / .35); color: #fda4af; }
	.default-pill { border-color: rgb(34 211 238 / .3); color: #67e8f9; }
	.provider-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-top: 10px; }
	.provider-stats span { display: grid; gap: 2px; border: 1px solid var(--border); border-radius: 8px; background: rgb(255 255 255 / .025); padding: 7px 8px; color: var(--ink-muted); font-size: 9px; }
	.provider-stats strong { overflow: hidden; color: var(--ink); font: 10px var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
	.connection-section { display: grid; gap: 7px; margin-top: 12px; }
	.section-heading { display: flex; align-items: center; gap: 6px; color: var(--ink-muted); font-size: 10px; }
	.section-heading strong { color: var(--ink); }
	.connection-list { display: grid; gap: 8px; }
	.connection-card { display: grid; gap: 8px; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--surface-2) 74%, transparent); padding: 9px; }
	.connection-card > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
	.connection-title { display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: 6px; }
	.connection-title strong { font-size: 11px; }
	.connection-title code, .external-note code { color: var(--ink-muted); font-size: 9px; }
	.connection-actions { display: flex; flex: 0 0 auto; gap: 8px; }
	.connection-actions button { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; padding: 2px; color: #67e8f9; font-size: 9px; cursor: pointer; }
	.connection-actions .danger-link { color: #fda4af; }
	.connection-actions button:disabled { opacity: .45; cursor: wait; }
	.connection-meta { display: flex; flex-wrap: wrap; gap: 5px; }
	.connection-meta span { border-radius: 5px; background: rgb(255 255 255 / .05); padding: 2px 5px; color: var(--ink-muted); font: 8px var(--font-mono); }
	.credential-list { display: grid; gap: 5px; }
	.credential-list--legacy { border: 1px solid var(--border); border-radius: 9px; padding: 7px; }
	.credential-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px; border-top: 1px solid rgb(255 255 255 / .05); padding-top: 5px; }
	.credential-row:first-child { border-top: 0; padding-top: 0; }
	.credential-copy { display: grid; min-width: 0; gap: 2px; }
	.credential-copy strong { overflow: hidden; font: 9px var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
	.credential-copy small { color: var(--ink-muted); font-size: 8px; }
	.credential-state { color: #fbbf24; font: 8px var(--font-mono); text-transform: uppercase; }
	.credential-state[data-valid='true'] { color: #6ee7b7; }
	.secure-terminal { display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgb(34 211 238 / .22); border-radius: 6px; background: rgb(34 211 238 / .06); padding: 4px 6px; color: #67e8f9; font-size: 8px; cursor: pointer; }
	.secure-terminal:disabled { opacity: .45; cursor: wait; }
	.external-note, .connection-note { margin: 0; border-radius: 7px; background: rgb(34 211 238 / .05); padding: 7px 8px; color: var(--ink-muted); font-size: 9px; line-height: 1.45; }
	.connection-create { display: grid; gap: 8px; margin-top: 11px; border: 1px solid rgb(34 211 238 / .22); border-radius: 10px; background: rgb(34 211 238 / .04); padding: 9px; }
	.connection-create > header { display: flex; align-items: center; justify-content: space-between; }
	.connection-create > header strong { font-size: 10px; }
	.connection-create > header button { border: 0; background: transparent; color: var(--ink-muted); cursor: pointer; }
	.connection-create-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 7px; }
	.connection-create-grid label { display: grid; gap: 4px; }
	.connection-create-grid label > span { color: var(--ink-muted); font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
	.checkbox-row { display: flex; align-items: center; gap: 6px; color: var(--ink-muted); font-size: 9px; }
	.provider-empty { display: grid; min-height: 140px; place-items: center; padding: 20px; text-align: center; color: var(--ink-muted); font-size: 10px; }
	.provider-empty--compact { min-height: 0; border: 1px dashed var(--border); border-radius: 9px; padding: 12px; }
	.provider-empty code { color: var(--ink); }
	@media (max-width: 760px) {
		.provider-sheet { inset: max(8px, env(safe-area-inset-top)) 0 0; max-width: none; margin: 0; border-right: 0; border-bottom: 0; border-left: 0; border-radius: 18px 18px 0 0; padding-bottom: env(safe-area-inset-bottom); }
		.provider-userbar { align-items: stretch; flex-wrap: wrap; }
		.provider-userbar label { min-width: 0; flex: 1 1 180px; }
		.provider-user-summary { width: 100%; margin-left: 0; }
		.provider-layout { grid-template-columns: 1fr; overflow-y: auto; }
		.provider-list-panel { max-height: 205px; border-right: 0; border-bottom: 1px solid var(--border); }
		.provider-detail { overflow: visible; }
		.provider-detail-header { flex-direction: column; }
		.provider-detail-actions { width: 100%; }
		.provider-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.connection-create-grid { grid-template-columns: 1fr; }
		.connection-card > header { flex-direction: column; }
		.connection-actions { width: 100%; justify-content: flex-end; }
		.credential-row { grid-template-columns: minmax(0, 1fr) auto; }
		.secure-terminal { grid-column: 1 / -1; justify-content: center; }
	}
</style>
