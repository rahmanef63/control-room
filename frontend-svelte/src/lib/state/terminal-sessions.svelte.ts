// Svelte 5 runes replacement for
// frontend/src/features/terminals/hooks/use-terminal-sessions.ts.
//
// Scope note (see README-MIGRATION.md): the original hook is 736 lines and
// also owns multi-workspace grouping, cross-browser sync via the agent's
// JSON state endpoint, drag-to-reorder, and session-color assignment. This
// port covers the core session lifecycle only — list / create / delete /
// rename against /api/terminals — as a real, working foundation. The rest
// is tracked as backlog, not silently dropped.
//
// Pattern: a class whose fields are $state, exported as a module-level
// singleton. This is the Svelte 5 runes way to share reactive state across
// components (see svelte.dev/docs/ai/overview) — it replaces both the old
// `writable()` store pattern AND the React `useSyncExternalStore` + custom
// hook the original used for the same job.
import type { TerminalCreateRequest, TerminalSession } from '$lib/features/terminals/types';

class TerminalSessionsState {
	sessions = $state<TerminalSession[]>([]);
	activeId = $state<string | null>(null);
	loading = $state(false);
	error = $state<string | null>(null);

	active = $derived(this.sessions.find((s) => s.id === this.activeId) ?? null);
	runningCount = $derived(this.sessions.filter((s) => s.status === 'running').length);

	async refresh(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			const res = await fetch('/api/terminals');
			if (!res.ok) throw new Error(`Failed to list terminals (${res.status})`);
			const payload = (await res.json()) as { sessions?: TerminalSession[] };
			this.sessions = payload.sessions ?? [];
			if (!this.activeId && this.sessions.length > 0) {
				this.activeId = this.sessions[0].id;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load terminals';
		} finally {
			this.loading = false;
		}
	}

	async create(request: TerminalCreateRequest = {}): Promise<TerminalSession | null> {
		this.error = null;
		try {
			const res = await fetch('/api/terminals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(request)
			});
			const payload = (await res.json()) as { session?: TerminalSession; error?: string };
			if (!res.ok || !payload.session) {
				throw new Error(payload.error ?? `Failed to create terminal (${res.status})`);
			}
			const session = payload.session;
			this.sessions = [...this.sessions, session];
			this.activeId = session.id;
			return session;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to create terminal';
			return null;
		}
	}

	async duplicate(source: TerminalSession): Promise<TerminalSession | null> {
		let live = source;
		try {
			const fresh = await fetch(`/api/terminals/${encodeURIComponent(source.id)}`);
			if (fresh.ok) {
				const payload = (await fresh.json()) as { session?: TerminalSession };
				if (payload.session) live = payload.session;
			}
		} catch {
			// Fall back to the last session snapshot already held by the client.
		}

		const created = await this.create({
			profile: live.profile,
			cwd: live.cwd,
			...(live.agent_profile_id ? { agentProfileId: live.agent_profile_id } : {}),
			...(live.environment_id ? { environmentId: live.environment_id } : {})
		});
		if (!created) return null;

		if (live.title && live.title !== created.title) {
			await this.rename(created.id, live.title);
		}
		return this.sessions.find((session) => session.id === created.id) ?? created;
	}

	async close(id: string): Promise<void> {
		this.error = null;
		try {
			const res = await fetch(`/api/terminals/${encodeURIComponent(id)}`, { method: 'DELETE' });
			if (!res.ok && res.status !== 204) throw new Error(`Failed to close terminal (${res.status})`);
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to close terminal';
		} finally {
			this.sessions = this.sessions.filter((s) => s.id !== id);
			if (this.activeId === id) {
				this.activeId = this.sessions.at(0)?.id ?? null;
			}
		}
	}

	async rename(id: string, title: string): Promise<void> {
		const res = await fetch(`/api/terminals/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title })
		});
		const payload = (await res.json()) as { session?: TerminalSession };
		if (!res.ok || !payload.session) return;
		this.sessions = this.sessions.map((s) => (s.id === id ? payload.session! : s));
	}

	setActive(id: string): void {
		this.activeId = id;
	}

	/** Merge a fresher session object pushed from a pane's SSE stream (bootstrap/status events). */
	patchFromStream(updated: TerminalSession): void {
		this.sessions = this.sessions.map((s) => (s.id === updated.id ? updated : s));
	}
}

export const terminalSessions = new TerminalSessionsState();
