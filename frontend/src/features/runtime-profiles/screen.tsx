'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Folder, Save, Settings2, Sparkles } from 'lucide-react';

import type { RuntimeConfigResponse } from '@/shared/types/contracts';

export default function ProfilesPage() {
  const [payload, setPayload] = useState<RuntimeConfigResponse | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/runtime-config', { cache: 'no-store' });
        const nextPayload = (await response.json()) as RuntimeConfigResponse;
        if (cancelled) return;

        setPayload(nextPayload);
        setEditorValue(`${JSON.stringify(nextPayload.config, null, 2)}\n`);
      } catch {
        if (!cancelled) {
          setError('Failed to load runtime configuration');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const parsedStats = useMemo(() => {
    return {
      environmentCount: payload?.environments.length ?? 0,
      agentCount: payload?.agentProfiles.length ?? 0,
      skillCount:
        payload?.agentProfiles.reduce((total, profile) => total + (profile.skills?.length ?? 0), 0) ?? 0,
    };
  }, [payload]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const parsed = JSON.parse(editorValue) as RuntimeConfigResponse['config'];
      const response = await fetch('/api/runtime-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const nextPayload = (await response.json()) as RuntimeConfigResponse & { error?: string };
      if (!response.ok) {
        throw new Error(nextPayload.error || 'Failed to save runtime config');
      }

      setPayload(nextPayload);
      setEditorValue(`${JSON.stringify(nextPayload.config, null, 2)}\n`);
      setSuccess('Runtime config saved. New launches will use the updated environments and agent presets.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save runtime config');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="dashboard-page text-sm text-muted-foreground">Loading runtime configuration...</div>;
  }

  return (
    <div className="dashboard-page">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="dashboard-hero">
          <div className="relative space-y-4">
            <div className="dashboard-chip" data-tone="accent">
              <Settings2 className="h-3.5 w-3.5" />
              Runtime manifest
            </div>
            <div>
              <h1 className="dashboard-hero-title">
                Environments, agent presets, and skill mapping in one editable manifest.
              </h1>
              <p className="dashboard-hero-copy mt-3 max-w-3xl text-sm md:text-base">
                This page parses environment blocks into terminal-ready variables and binds each AI model preset to a workspace and skill list. Save here, then launch from the Terminals page.
              </p>
            </div>
            <p className="rounded-2xl border border-border/20 bg-card/20 px-4 py-3 font-mono text-xs text-muted-foreground">
              {payload?.configPath}
            </p>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-orange-300" />
              Parsed overview
            </div>
            <div className="grid gap-3">
              <div className="dashboard-kpi-card">
                <p className="dashboard-label">Environments</p>
                <p className="dashboard-value">{parsedStats.environmentCount}</p>
              </div>
              <div className="dashboard-kpi-card">
                <p className="dashboard-label">Agent presets</p>
                <p className="dashboard-value">{parsedStats.agentCount}</p>
              </div>
              <div className="dashboard-kpi-card">
                <p className="dashboard-label">Skill bindings</p>
                <p className="dashboard-value">{parsedStats.skillCount}</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="dashboard-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="dashboard-label">Runtime JSON</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit the manifest directly. Save writes back to the VPS config file immediately.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save config'}
            </button>
          </div>

          <textarea
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            spellCheck={false}
            className="min-h-[680px] w-full rounded-[1.5rem] border border-border/30 bg-card/20 p-4 font-mono text-sm leading-6 text-foreground outline-none transition-colors focus:border-cyan-400/30"
          />

          {error ? (
            <div className="mt-4 dashboard-empty-state border-destructive/20 bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}
        </article>

        <div className="space-y-4">
          <article className="dashboard-panel">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Folder className="h-4 w-4 text-cyan-300" />
              Parsed environments
            </div>
            <div className="space-y-3">
              {payload?.environments.map((environment) => (
                <div
                  key={environment.id}
                  className="dashboard-subpanel"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{environment.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{environment.description}</p>
                    </div>
                    <span className="dashboard-chip">
                      {environment.envVarCount} vars
                    </span>
                  </div>
                  <p className="mt-3 truncate font-mono text-[11px] text-cyan-200">{environment.cwd}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {environment.envKeys.map((key) => (
                      <span
                        key={key}
                        className="dashboard-chip"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Cpu className="h-4 w-4 text-orange-300" />
              Agent bindings
            </div>
            <div className="space-y-3">
              {payload?.agentProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="dashboard-subpanel"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{profile.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{profile.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="dashboard-chip" data-tone="accent">
                        {profile.model}
                      </span>
                      <span className="dashboard-chip">
                        {profile.terminalProfile}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Bound env: {profile.environmentLabel ?? 'Not assigned'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(profile.skills ?? []).map((skill) => (
                      <span
                        key={skill}
                        className="dashboard-chip"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
