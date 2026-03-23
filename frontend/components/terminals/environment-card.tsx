'use client';

import { Folder } from 'lucide-react';

import type { RuntimeEnvironmentSummary } from '@/lib/types';

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
      className="group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(8,17,31,0.88))] px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.12),transparent_34%)]" />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-cyan-100">
            <Folder className="h-5 w-5" />
          </div>
          <div className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
            {environment.envVarCount} env
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{busy ? 'Opening shell...' : environment.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">{environment.description}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="truncate font-mono text-[11px] text-cyan-200">{environment.cwd}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {environment.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Parsed keys: {environment.envKeys.slice(0, 5).join(', ') || 'none'}
        </p>
      </div>
    </button>
  );
}
