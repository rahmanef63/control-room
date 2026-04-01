'use client';

import { useState } from 'react';
import { FolderOpen, Zap } from 'lucide-react';

import type { RuntimeResolvedAgentProfile } from '@/shared/types/contracts';

import { TerminalProfileIcon } from '@/features/terminals/components/terminal-profile-icon';

export type AgentLaunchOptions = {
  dangerouslyAllow?: boolean;
  useActiveDir?: boolean;
};

export function AgentPresetCard({
  profile,
  busy,
  onLaunch,
}: {
  profile: RuntimeResolvedAgentProfile;
  busy: boolean;
  onLaunch: (opts: AgentLaunchOptions) => void;
}) {
  const [useActiveDir, setUseActiveDir] = useState(false);
  const skills = profile.skills ?? [];

  return (
    <div
      data-profile={profile.terminalProfile}
      className="dashboard-launch-card"
    >
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="dashboard-launch-icon">
            <TerminalProfileIcon profile={profile.terminalProfile} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="dashboard-chip" data-tone="accent">
              {profile.model}
            </span>
            <span className="dashboard-chip">
              {profile.terminalProfile}
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{profile.label}</p>
          <p className="dashboard-muted-copy mt-1 text-xs leading-5">{profile.description}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="dashboard-subpanel">
            <p className="dashboard-label">Bound environment</p>
            <p className="mt-2 text-sm text-foreground">{profile.environmentLabel ?? 'Not assigned'}</p>
          </div>
          <div className="dashboard-subpanel text-right">
            <p className="dashboard-label">Skills</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{skills.length}</p>
          </div>
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span key={skill} className="dashboard-chip" data-tone="muted">
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Controls: dir toggle + launch buttons */}
        <div className="space-y-2 border-t border-border/50 pt-3">
          {/* Dir toggle */}
          <button
            type="button"
            onClick={() => setUseActiveDir((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              useActiveDir
                ? 'border-blue-700/60 bg-blue-950/30 text-blue-400'
                : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
            }`}
            title={useActiveDir ? 'Opens in the active working directory' : 'Opens in the environment default directory'}
          >
            <FolderOpen className="h-3 w-3" />
            {useActiveDir ? 'Active dir' : 'Default dir'}
          </button>

          {/* Launch buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onLaunch({ useActiveDir })}
              disabled={busy}
              className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Starting…' : 'Default'}
            </button>
            <button
              type="button"
              onClick={() => onLaunch({ dangerouslyAllow: true, useActiveDir })}
              disabled={busy}
              title="YOLO mode: dangerously allow all tools, skip permission prompts"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-orange-700/50 bg-orange-950/20 px-3 py-2 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-950/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Zap className="h-3 w-3" />
              YOLO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
