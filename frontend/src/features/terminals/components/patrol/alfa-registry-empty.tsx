'use client';

import { Sparkles } from 'lucide-react';

interface AlfaRegistryEmptyProps {
  hasPromotable: boolean;
}

export function AlfaRegistryEmpty({ hasPromotable }: AlfaRegistryEmptyProps) {
  return (
    <div className="alfa-registry-empty">
      <Sparkles className="h-5 w-5 text-sky-300" />
      <p className="alfa-registry-empty-title">No alfa registered yet</p>
      <p className="alfa-registry-empty-help">
        Open a terminal, run an AI agent (Claude / Codex / Gemini), then inside it
        invoke <code>/vps-alfa</code>. The skill self-registers and asks which
        terminals to watch.
      </p>
      {hasPromotable ? (
        <p className="alfa-registry-empty-hint">
          Or use the <strong>Promote</strong> section below to register a running
          AI terminal manually.
        </p>
      ) : (
        <p className="alfa-registry-empty-hint">
          Tip: launch an AI terminal first (AI button in the topbar) so you can
          promote it from here.
        </p>
      )}
    </div>
  );
}
