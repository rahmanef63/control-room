'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import type { SortDirection } from '@/lib/table-controls';

export function SortableTableHead({
  label,
  active = false,
  direction = 'asc',
  onToggle,
  align = 'left',
}: {
  label: string;
  active?: boolean;
  direction?: SortDirection;
  onToggle: () => void;
  align?: 'left' | 'right';
}) {
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground ${
        align === 'right' ? 'ml-auto' : ''
      }`}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
