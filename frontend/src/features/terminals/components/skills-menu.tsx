'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, ChevronDown, Loader2, Sparkles } from 'lucide-react';

interface SkillSummary {
  id: string;
  name: string;
  description: string;
  invocation: string;
}

export function SkillsMenu({
  disabled,
  onInject,
}: {
  disabled: boolean;
  onInject: (invocation: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/skills')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload?.skills)) {
          setSkills(payload.skills);
        } else if (payload?.error) {
          setError(String(payload.error));
        }
        setLoaded(true);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Skills failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        className="pane-action-btn"
        title="Insert skill"
        aria-expanded={open}
        aria-label="Insert skill"
      >
        <BookOpenCheck className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open ? (
        <div className="folder-menu">
          <p className="folder-menu-header">Quick skills</p>
          <div className="folder-menu-list">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : error ? (
              <p className="py-3 text-center text-[11px] text-destructive">{error}</p>
            ) : skills.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-muted-foreground">No skills installed</p>
            ) : (
              skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => {
                    onInject(skill.invocation);
                    setOpen(false);
                  }}
                  className="folder-menu-item"
                  data-kind="agent"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-fuchsia-300" />
                    <span className="folder-menu-label">{skill.name}</span>
                  </span>
                  {skill.description ? (
                    <span className="folder-menu-path line-clamp-2">{skill.description}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
