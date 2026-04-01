'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';

export function TableSearch({
  value,
  onChange,
  placeholder = 'Search…',
  resultCount,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {typeof resultCount === 'number' ? (
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {resultCount} results
        </p>
      ) : null}
    </div>
  );
}
