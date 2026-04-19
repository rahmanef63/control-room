'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Cpu, Rocket, Shield, Zap } from 'lucide-react';

import type { RuntimeResolvedAgentProfile } from '@/shared/types/contracts';

export interface AgentInjectMenuProps {
  agentProfiles: RuntimeResolvedAgentProfile[];
  disabled: boolean;
  onInject: (command: string) => void;
}

const BYPASS_FLAGS: Record<string, string> = {
  codex: '--yolo',
  claude: '--dangerously-skip-permissions',
  gemini: '--yolo',
};

function buildCommand(profile: RuntimeResolvedAgentProfile, bypass: boolean): string {
  const base = profile.launchCommand || profile.terminalProfile;
  if (!bypass) return base;

  const flagForLaunch = '--dangerously-skip-permissions';
  if (profile.launchCommand) {
    return `${base} ${flagForLaunch}`;
  }

  const flag = BYPASS_FLAGS[profile.terminalProfile];
  return flag ? `${base} ${flag}` : base;
}

export function AgentInjectMenu({ agentProfiles, disabled, onInject }: AgentInjectMenuProps) {
  const [open, setOpen] = useState(false);
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

  if (agentProfiles.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        className="pane-action-btn"
        title="Run AI in this terminal"
        aria-expanded={open}
        aria-label="Run AI in this terminal"
        data-tone="ai"
      >
        <Cpu className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open ? (
        <div className="agent-inject-menu">
          <p className="folder-menu-header">Run AI here</p>
          <div className="folder-menu-list">
            {agentProfiles.map((profile) => (
              <div key={profile.id} className="agent-inject-row">
                <div className="agent-inject-row-head">
                  <Rocket className="h-3.5 w-3.5 text-sky-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{profile.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{profile.model}</p>
                  </div>
                </div>
                <div className="agent-inject-row-actions">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onInject(buildCommand(profile, false));
                      setOpen(false);
                    }}
                    className="agent-inject-btn"
                    data-tone="regular"
                  >
                    <Shield className="h-3 w-3" />
                    Regular
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onInject(buildCommand(profile, true));
                      setOpen(false);
                    }}
                    className="agent-inject-btn"
                    data-tone="bypass"
                  >
                    <Zap className="h-3 w-3" />
                    Bypass
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
