'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Folder, Save, Settings2, Sparkles } from 'lucide-react';

import type { RuntimeConfigResponse } from '@/lib/types';

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
    return <div className="p-6 text-sm text-slate-400">Loading runtime configuration...</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(8,17,31,0.96),rgba(30,41,59,0.9),rgba(8,17,31,0.98))] p-6 shadow-[0_40px_120px_-70px_rgba(14,165,233,0.45)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_75%_20%,rgba(251,146,60,0.14),transparent_18%)]" />
          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-300">
              <Settings2 className="h-3.5 w-3.5 text-cyan-300" />
              Runtime manifest
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Environments, agent presets, and skill mapping in one editable manifest.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                This page parses environment blocks into terminal-ready variables and binds each AI model preset to a workspace and skill list. Save here, then launch from the Terminals page.
              </p>
            </div>
            <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-slate-300">
              {payload?.configPath}
            </p>
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.55)]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-orange-300" />
              Parsed overview
            </div>
            <div className="grid gap-3">
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Environments</p>
                <p className="mt-2 text-3xl font-semibold text-white">{parsedStats.environmentCount}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Agent presets</p>
                <p className="mt-2 text-3xl font-semibold text-white">{parsedStats.agentCount}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Skill bindings</p>
                <p className="mt-2 text-3xl font-semibold text-white">{parsedStats.skillCount}</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.45)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
                Runtime JSON
              </h2>
              <p className="mt-1 text-sm text-slate-400">
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
            className="min-h-[680px] w-full rounded-[1.5rem] border border-white/10 bg-black/30 p-4 font-mono text-sm leading-6 text-slate-100 outline-none transition-colors focus:border-cyan-400/30"
          />

          {error ? (
            <div className="mt-4 rounded-[1.25rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
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
          <article className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.45)]">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
              <Folder className="h-4 w-4 text-cyan-300" />
              Parsed environments
            </div>
            <div className="space-y-3">
              {payload?.environments.map((environment) => (
                <div
                  key={environment.id}
                  className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{environment.label}</p>
                      <p className="mt-1 text-xs text-slate-400">{environment.description}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                      {environment.envVarCount} vars
                    </span>
                  </div>
                  <p className="mt-3 truncate font-mono text-[11px] text-cyan-200">{environment.cwd}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {environment.envKeys.map((key) => (
                      <span
                        key={key}
                        className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.45)]">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
              <Cpu className="h-4 w-4 text-orange-300" />
              Agent bindings
            </div>
            <div className="space-y-3">
              {payload?.agentProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{profile.label}</p>
                      <p className="mt-1 text-xs text-slate-400">{profile.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
                        {profile.model}
                      </span>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                        {profile.terminalProfile}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    Bound env: {profile.environmentLabel ?? 'Not assigned'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(profile.skills ?? []).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400"
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
