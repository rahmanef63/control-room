'use client';

import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { MoreVertical, Palette, Settings2, Sparkles } from 'lucide-react';

import { PaneActionsMenu } from '@/features/terminals/components/pane-actions-menu';
import { PaneAiLaunch } from '@/features/terminals/components/pane-ai-launch';
import { SessionColorPicker } from '@/features/terminals/components/session-color-picker';
import { useIsMobile } from '@/features/terminals/hooks/use-media-query';

type Sub = 'color' | 'ai' | 'actions';

export interface PaneMenuClusterProps {
  colorProps: ComponentProps<typeof SessionColorPicker>;
  aiProps: ComponentProps<typeof PaneAiLaunch>;
  actionsProps: ComponentProps<typeof PaneActionsMenu>;
}

/**
 * Header action cluster. On desktop the three pane menus (color, AI launch,
 * actions) sit side by side as today. On mobile they collapse behind a single
 * ⋮ trigger whose rows open each menu as a centered sheet — keeps the cramped
 * mobile header to one button without losing any capability.
 */
export function PaneMenuCluster({ colorProps, aiProps, actionsProps }: PaneMenuClusterProps) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sub, setSub] = useState<Sub | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Desktop: three discrete triggers, behavior unchanged.
  if (!isMobile) {
    return (
      <>
        <SessionColorPicker {...colorProps} />
        <PaneAiLaunch {...aiProps} />
        <PaneActionsMenu {...actionsProps} />
      </>
    );
  }

  const showColor = !colorProps.disabled;
  const showAi = aiProps.agentProfiles.length > 0;

  function openSub(next: Sub) {
    setSub(next);
    setMenuOpen(false);
  }

  return (
    <>
      <div className="pane-menu-cluster" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className="pane-action-btn"
          data-tone="ai"
          data-active={menuOpen || undefined}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Pane menu"
          title="Pane menu"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen ? (
          <div className="pane-cluster-menu" role="menu">
            {showColor ? (
              <button type="button" className="pane-cluster-item" onClick={() => openSub('color')}>
                <Palette className="h-4 w-4" />
                <span>Color</span>
                <span className="pane-cluster-chevron">▸</span>
              </button>
            ) : null}
            {showAi ? (
              <button type="button" className="pane-cluster-item" onClick={() => openSub('ai')}>
                <Sparkles className="h-4 w-4" />
                <span>AI agents</span>
                <span className="pane-cluster-chevron">▸</span>
              </button>
            ) : null}
            <button type="button" className="pane-cluster-item" onClick={() => openSub('actions')}>
              <Settings2 className="h-4 w-4" />
              <span>Actions · skills · zoom</span>
              <span className="pane-cluster-chevron">▸</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Each menu rendered controlled + trigger-less; opens as a sheet. */}
      <SessionColorPicker
        {...colorProps}
        hideTrigger
        open={sub === 'color'}
        onOpenChange={(next) => setSub(next ? 'color' : null)}
      />
      <PaneAiLaunch
        {...aiProps}
        hideTrigger
        open={sub === 'ai'}
        onOpenChange={(next) => setSub(next ? 'ai' : null)}
      />
      <PaneActionsMenu
        {...actionsProps}
        hideTrigger
        open={sub === 'actions'}
        onOpenChange={(next) => setSub(next ? 'actions' : null)}
      />
    </>
  );
}
