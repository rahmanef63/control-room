'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Folder, Home, Search, X } from 'lucide-react';

interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface FsListResult {
  path: string;
  parent: string | null;
  roots: Array<{ label: string; path: string }>;
  entries: FsEntry[];
}

export function FileExplorerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (absolutePath: string) => void;
}) {
  const [result, setResult] = useState<FsListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (target?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = target ? `/api/fs/list?path=${encodeURIComponent(target)}` : '/api/fs/list';
      const response = await fetch(url);
      const payload = (await response.json()) as FsListResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'List failed');
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'List failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    if (!result) return [];
    const list = result.entries.filter((entry) => entry.isDir);
    if (!query.trim()) return list;
    const needle = query.trim().toLowerCase();
    return list.filter((entry) => entry.name.toLowerCase().includes(needle));
  }, [result, query]);

  if (!open) return null;

  const crumbs = result ? buildCrumbs(result.path, result.roots) : [];

  return (
    <div className="launcher-drawer-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="File explorer"
        onClick={(event) => event.stopPropagation()}
        className="launcher-drawer-sheet"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Change directory</p>
            <p className="text-[11px] text-muted-foreground">Browse home or projects. Pick a folder to cd into it.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
            aria-label="Close explorer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-border/60 px-3 py-2">
          <div className="flex items-center gap-1.5">
            {result?.roots.map((root) => (
              <button
                key={root.path}
                type="button"
                onClick={() => void load(root.path)}
                className="fs-root-chip"
              >
                {root.label === 'Home' ? <Home className="h-3 w-3" /> : <Folder className="h-3 w-3" />}
                {root.label}
              </button>
            ))}
          </div>
          <div className="fs-search">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter folders"
              className="fs-search-input"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            {result?.parent ? (
              <button
                type="button"
                onClick={() => void load(result.parent ?? undefined)}
                className="fs-crumb-btn"
                title="Go up"
              >
                <ArrowLeft className="h-3 w-3" />
                Up
              </button>
            ) : null}
            {crumbs.map((crumb, index) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3 w-3 opacity-60" /> : null}
                <button
                  type="button"
                  onClick={() => void load(crumb.path)}
                  className="fs-crumb-btn"
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="py-6 text-center text-xs text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No folders here</p>
          ) : (
            <ul className="grid gap-1.5">
              {filtered.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    onClick={() => void load(entry.path)}
                    onDoubleClick={() => {
                      onPick(entry.path);
                      onClose();
                    }}
                    className="fs-entry"
                  >
                    <Folder className="h-4 w-4 text-amber-300" />
                    <span className="flex-1 truncate text-sm font-medium text-foreground">{entry.name}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onPick(entry.path);
                        onClose();
                      }}
                      className="fs-entry-cd"
                    >
                      cd here
                    </button>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {result ? (
          <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2 text-[11px]">
            <span className="truncate font-mono text-muted-foreground" title={result.path}>
              {result.path}
            </span>
            <button
              type="button"
              onClick={() => {
                onPick(result.path);
                onClose();
              }}
              className="fs-cd-current"
            >
              cd here
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildCrumbs(
  currentPath: string,
  roots: Array<{ label: string; path: string }>
): Array<{ label: string; path: string }> {
  const rootMatch = [...roots].sort((a, b) => b.path.length - a.path.length).find(
    (root) => currentPath === root.path || currentPath.startsWith(`${root.path}/`)
  );
  if (!rootMatch) return [{ label: currentPath, path: currentPath }];

  const relative = currentPath.slice(rootMatch.path.length).split('/').filter(Boolean);
  const crumbs: Array<{ label: string; path: string }> = [{ label: rootMatch.label, path: rootMatch.path }];
  let running = rootMatch.path;
  for (const segment of relative) {
    running = `${running}/${segment}`;
    crumbs.push({ label: segment, path: running });
  }
  return crumbs;
}
