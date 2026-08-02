'use client';

import { useCallback, useEffect, useState } from 'react';

import { TEMPLATES_STORAGE_KEY } from '@/features/terminals/lib/utils';
import type {
  TemplateCreateInput,
  TemplateUpdateInput,
  TerminalTemplate,
} from '@/features/templates/types';

const TEMPLATE_COLORS = ['#38bdf8', '#a855f7', '#f59e0b', '#34d399', '#fb7185', '#818cf8'];

function readAll(): TerminalTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TerminalTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === 'string');
  } catch {
    return [];
  }
}

function writeAll(entries: TerminalTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function makeId(): string {
  return `tmpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickColor(existing: TerminalTemplate[]): string {
  const used = new Set(existing.map((t) => t.color).filter(Boolean));
  return (
    TEMPLATE_COLORS.find((c) => !used.has(c)) ??
    TEMPLATE_COLORS[existing.length % TEMPLATE_COLORS.length]
  );
}

export interface UseTemplatesResult {
  templates: TerminalTemplate[];
  hydrated: boolean;
  createTemplate: (input: TemplateCreateInput) => TerminalTemplate;
  updateTemplate: (id: string, input: TemplateUpdateInput) => TerminalTemplate | null;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => TerminalTemplate | null;
}

export function useTemplates(): UseTemplatesResult {
  const [templates, setTemplates] = useState<TerminalTemplate[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTemplates(readAll());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeAll(templates);
  }, [templates, hydrated]);

  const createTemplate = useCallback((input: TemplateCreateInput): TerminalTemplate => {
    let next: TerminalTemplate | null = null;
    setTemplates((current) => {
      next = {
        id: makeId(),
        name: input.name.trim() || 'untitled',
        description: input.description?.trim() || undefined,
        color: input.color || pickColor(current),
        profile: input.profile,
        agentProfileId: input.agentProfileId || undefined,
        environmentId: input.environmentId || undefined,
        cwd: input.cwd?.trim() || undefined,
        initialCommand: input.initialCommand?.trim() || undefined,
        customTitle: input.customTitle?.trim() || undefined,
        workspaceId: input.workspaceId || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return [...current, next];
    });
    return next!;
  }, []);

  const updateTemplate = useCallback(
    (id: string, input: TemplateUpdateInput): TerminalTemplate | null => {
      let updated: TerminalTemplate | null = null;
      setTemplates((current) => {
        const idx = current.findIndex((t) => t.id === id);
        if (idx === -1) return current;
        const next: TerminalTemplate = {
          ...current[idx],
          ...input,
          updatedAt: Date.now(),
        };
        updated = next;
        const arr = current.slice();
        arr[idx] = next;
        return arr;
      });
      return updated;
    },
    []
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((current) => current.filter((t) => t.id !== id));
  }, []);

  const duplicateTemplate = useCallback((id: string): TerminalTemplate | null => {
    let dup: TerminalTemplate | null = null;
    setTemplates((current) => {
      const source = current.find((t) => t.id === id);
      if (!source) return current;
      dup = {
        ...source,
        id: makeId(),
        name: `${source.name} (copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return [...current, dup];
    });
    return dup;
  }, []);

  return {
    templates,
    hydrated,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  };
}
