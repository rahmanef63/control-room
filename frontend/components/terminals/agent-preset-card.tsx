'use client';

import type { RuntimeResolvedAgentProfile } from '@/lib/types';

import { TerminalProfileIcon } from '@/components/terminals/terminal-profile-icon';
import { profileAccent } from '@/components/terminals/utils';

export function AgentPresetCard({
  profile,
  busy,
  onLaunch,
}: {
  profile: RuntimeResolvedAgentProfile;
  busy: boolean;
  onLaunch: () => void;
}) {
  const skills = profile.skills ?? [];

  return (
    <button
      onClick={onLaunch}
      disabled={busy}
      className={`group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br ${profileAccent(
        profile.terminalProfile
      )} px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_28px_80px_-44px_rgba(34,211,238,0.42)] disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_40%)]" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white">
            <TerminalProfileIcon profile={profile.terminalProfile} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
              {profile.model}
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
              {profile.terminalProfile}
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">{busy ? 'Starting agent...' : profile.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">{profile.description}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Bound environment</p>
            <p className="mt-2 text-sm text-cyan-100">{profile.environmentLabel ?? 'Not assigned'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Skills</p>
            <p className="mt-2 text-xl font-semibold text-white">{skills.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
