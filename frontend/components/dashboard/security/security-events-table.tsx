'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { SortableTableHead } from '@/components/dashboard/sortable-table-head';
import { TableSearch } from '@/components/dashboard/table-search';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EventRecord } from '@/lib/types';
import { filterItems, sortItems, toggleSort, type SortState } from '@/lib/table-controls';

interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => ReactNode;
  sortValue: (item: T) => unknown;
}

const COMMON_SORTERS = {
  time: (event: EventRecord) => event.timestamp,
  message: (event: EventRecord) => event.message,
  source: (event: EventRecord) => event.source,
};

export function SecurityEventsTable({
  title,
  placeholder,
  emptyText,
  events,
  columns,
}: {
  title: string;
  placeholder: string;
  emptyText: string;
  events: EventRecord[];
  columns: Array<Column<EventRecord>>;
}) {
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<SortState>({ key: 'time', direction: 'desc' });

  const sorters = useMemo(
    () => ({
      ...COMMON_SORTERS,
      ...Object.fromEntries(columns.map((column) => [column.key, column.sortValue])),
    }),
    [columns]
  );

  const visibleEvents = useMemo(() => {
    const filtered = filterItems(events, search, (event) =>
      [event.message, event.source, event.type, JSON.stringify(event.metadata ?? {})].join(' ')
    );
    return sortItems(filtered, sortState, sorters);
  }, [events, search, sortState, sorters]);

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <TableSearch value={search} onChange={setSearch} placeholder={placeholder} resultCount={visibleEvents.length} />
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {columns.map((column) => (
                <TableHead key={column.key}>
                  <SortableTableHead
                    label={column.label}
                    active={sortState.key === column.key}
                    direction={sortState.direction}
                    onToggle={() => setSortState((current) => toggleSort(current, column.key))}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              visibleEvents.map((event) => (
                <TableRow key={event._id} className="hover:bg-muted/10">
                  {columns.map((column) => (
                    <TableCell key={`${event._id}:${column.key}`}>{column.render(event)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
