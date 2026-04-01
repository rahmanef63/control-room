'use client';

import type { TerminalProfile } from '@/shared/types/contracts';

import { TerminalProfileIcon } from '@/features/terminals/components/terminal-profile-icon';

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
      data-profile={profile.profile}
      className="dashboard-launch-card group text-left disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="dashboard-launch-icon">
            <TerminalProfileIcon profile={profile.profile} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{busy ? 'Launching...' : profile.title}</p>
            <p className="dashboard-muted-copy mt-1 max-w-[22rem] text-xs leading-5">
              {profile.description}
            </p>
          </div>
        </div>
        <span className="dashboard-chip">
          {profile.profile}
        </span>
      </div>
    </button>
  );
}
