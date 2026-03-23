'use client';

import type { TerminalProfile } from '@/lib/types';

import { TerminalProfileIcon } from '@/components/terminals/terminal-profile-icon';
import { profileAccent } from '@/components/terminals/utils';

export interface TerminalProfileOption {
  profile: TerminalProfile;
  title: string;
  description: string;
}

export function LauncherCard({
  profile,
  busy,
  onLaunch,
}: {
  profile: TerminalProfileOption;
  busy: boolean;
  onLaunch: () => void;
}) {
  return (
    <button
      onClick={onLaunch}
      disabled={busy}
      className={`group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${profileAccent(
        profile.profile
      )} px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_80px_-40px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_45%)] opacity-70" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white">
            <TerminalProfileIcon profile={profile.profile} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{busy ? 'Launching...' : profile.title}</p>
            <p className="mt-1 max-w-[22rem] text-xs leading-5 text-slate-300">
              {profile.description}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
          {profile.profile}
        </span>
      </div>
    </button>
  );
}
