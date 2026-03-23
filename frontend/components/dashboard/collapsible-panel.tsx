'use client';

import { ChevronDown } from 'lucide-react';
import { ReactNode } from 'react';

export function CollapsiblePanel({
  title,
  description,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.45)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {badge}
          <span className="rounded-full border border-white/10 bg-black/20 p-2 text-slate-300">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>

      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
