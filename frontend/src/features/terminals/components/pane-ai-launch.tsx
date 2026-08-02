'use client';

import { useEffect, useRef, useState } from 'react';
import { Power, Rocket, Shield, Sparkles, Zap } from 'lucide-react';

import type { RuntimeResolvedAgentProfile } from '@/shared/types/contracts';

const BYPASS_FLAGS: Record<string, string> = {
  codex: '--yolo',
  claude: '--dangerously-skip-permissions',
  gemini: '--yolo',
};

function buildCommand(profile: RuntimeResolvedAgentProfile, bypass: boolean): string {
  const base = profile.launchCommand || profile.terminalProfile;
  if (!bypass) return base;
  const flagForLaunch = '--dangerously-skip-permissions';
  if (profile.launchCommand) return `${base} ${flagForLaunch}`;
  const flag = BYPASS_FLAGS[profile.terminalProfile];
  return flag ? `${base} ${flag}` : base;
}

interface PaneAiLaunchProps {
  agentProfiles: RuntimeResolvedAgentProfile[];
  sessionId: string;
  cwd: string;
  canSendInput: boolean;
  boundAgentProfileId?: string;
  onInjectAgent: (sessionId: string, command: string, agentProfileId: string) => void;
  onUnbindAgent: (sessionId: string) => void;
  /** Controlled open state — lets the mobile cluster drive this menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in ✨ trigger and render the popover as a centered sheet
   *  (mobile cluster supplies the entry point). */
  hideTrigger?: boolean;
}

export function PaneAiLaunch({
  agentProfiles,
  sessionId,
  cwd,
  canSendInput,
  boundAgentProfileId,
  onInjectAgent,
  onUnbindAgent,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: PaneAiLaunchProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(open) : value;
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    // Sheet mode has its own backdrop; the document listener would also fire on
    // the cluster row that opened it, so skip it there.
    if (!hideTrigger) document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hideTrigger]);

  if (agentProfiles.length === 0) return null;

  const boundProfile = boundAgentProfileId
    ? agentProfiles.find((profile) => profile.id === boundAgentProfileId)
    : undefined;

  const popoverInner = (
    <>
      <div className="pane-ai-launch-header">
            <span className="pane-ai-launch-eyebrow">Run agent here</span>
            <span className="pane-ai-launch-cwd" title={cwd}>
              {cwd}
            </span>
            {boundProfile ? (
              <div className="pane-ai-launch-bound-row">
                <span className="pane-ai-launch-bound-chip">
                  Bound · {boundProfile.label}
                </span>
                <button
                  type="button"
                  className="pane-ai-launch-unbind-btn"
                  onClick={() => {
                    onUnbindAgent(sessionId);
                    setOpen(false);
                  }}
                >
                  <Power className="h-3 w-3" /> Unbind
                </button>
              </div>
            ) : null}
          </div>
          <div className="pane-ai-launch-list">
            {agentProfiles.map((profile) => {
              const isBound = profile.id === boundAgentProfileId;
              return (
                <div key={profile.id} className="pane-ai-launch-row" data-bound={isBound || undefined}>
                  <div className="pane-ai-launch-row-head">
                    <Rocket className="h-3.5 w-3.5 text-sky-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {profile.label}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {profile.model}
                      </p>
                    </div>
                  </div>
                  <div className="pane-ai-launch-row-actions">
                    <button
                      type="button"
                      disabled={!canSendInput}
                      onClick={() => {
                        onInjectAgent(sessionId, buildCommand(profile, false), profile.id);
                        setOpen(false);
                      }}
                      className="agent-inject-btn"
                      data-tone="regular"
                    >
                      <Shield className="h-3 w-3" /> Regular
                    </button>
                    <button
                      type="button"
                      disabled={!canSendInput}
                      onClick={() => {
                        onInjectAgent(sessionId, buildCommand(profile, true), profile.id);
                        setOpen(false);
                      }}
                      className="agent-inject-btn"
                      data-tone="bypass"
                    >
                      <Zap className="h-3 w-3" /> Bypass
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
      <p className="pane-ai-launch-footnote">
        Sends the agent command to this terminal and marks it as an agent pane
        (heartbeat + audio + patrol all start tracking it).
      </p>
    </>
  );

  return (
    <div ref={containerRef} className="pane-ai-launch">
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="pane-action-btn"
          data-tone="ai"
          data-active={open || undefined}
          data-bound={boundProfile ? 'true' : undefined}
          title={
            boundProfile
              ? `Bound to ${boundProfile.label} · ${cwd}`
              : `Run AI agent in this terminal · ${cwd}`
          }
          aria-label="Bind AI agent to this terminal"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}

      {open ? (
        hideTrigger ? (
          <div className="pane-sheet-overlay" role="dialog" aria-modal="true">
            <div className="pane-sheet-backdrop" onClick={() => setOpen(false)} />
            <div className="pane-sheet-panel pane-ai-launch-popover" role="menu">
              {popoverInner}
            </div>
          </div>
        ) : (
          <div className="pane-ai-launch-popover" role="menu">
            {popoverInner}
          </div>
        )
      ) : null}
    </div>
  );
}
