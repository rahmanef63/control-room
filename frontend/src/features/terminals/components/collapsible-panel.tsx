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
    <section className="dashboard-panel">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
            {title}
          </h2>
          {description ? <p className="dashboard-muted-copy mt-1.5 hidden text-sm md:block">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <span className="dashboard-chip px-2.5 py-2 text-foreground">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>

      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
