export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export type SortAccessor<T> = (item: T) => unknown;
export type SearchAccessor<T> = (item: T) => string;

function normalizeValue(value: unknown): string | number {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).toLowerCase();
}

export function toggleSort(current: SortState | null, key: string): SortState {
  if (!current || current.key !== key) {
    return { key, direction: 'asc' };
  }

  return {
    key,
    direction: current.direction === 'asc' ? 'desc' : 'asc',
  };
}

export function filterItems<T>(
  items: T[],
  query: string,
  getSearchText: SearchAccessor<T>
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => getSearchText(item).toLowerCase().includes(normalizedQuery));
}

export function sortItems<T>(
  items: T[],
  sortState: SortState | null,
  accessors: Record<string, SortAccessor<T>>
): T[] {
  if (!sortState) {
    return items;
  }

  const accessor = accessors[sortState.key];
  if (!accessor) {
    return items;
  }

  const direction = sortState.direction === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = normalizeValue(accessor(left));
    const rightValue = normalizeValue(accessor(right));

    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });
}
