'use client';

import { Folder } from 'lucide-react';

import type { RuntimeEnvironmentSummary } from '@/shared/types/contracts';

export function EnvironmentCard({
  environment,
  busy,
  onLaunch,
}: {
  environment: RuntimeEnvironmentSummary;
  busy: boolean;
  onLaunch: () => void;
}) {
  return (
    <button
      onClick={onLaunch}
      disabled={busy}
      data-profile="shell"
      className="dashboard-launch-card group text-left disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="dashboard-launch-icon">
            <Folder className="h-5 w-5" />
          </div>
          <div className="dashboard-chip">
            {environment.envVarCount} env
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{busy ? 'Opening shell...' : environment.label}</p>
          <p className="dashboard-muted-copy mt-1 text-xs leading-5">{environment.description}</p>
        </div>
        <div className="dashboard-subpanel">
          <p className="truncate font-mono text-[11px] text-foreground">{environment.cwd}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {environment.tags.map((tag) => (
              <span key={tag} className="dashboard-chip">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Parsed keys: {environment.envKeys.slice(0, 5).join(', ') || 'none'}
        </p>
      </div>
    </button>
  );
}
