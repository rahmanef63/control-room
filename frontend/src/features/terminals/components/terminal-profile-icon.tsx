'use client';

import { Bot, Boxes, Command, Sparkles, TerminalSquare } from 'lucide-react';

import type { TerminalProfile } from '@/shared/types/contracts';

export function TerminalProfileIcon({ profile }: { profile: TerminalProfile }) {
  if (profile === 'shell') {
    return <TerminalSquare className="h-5 w-5" />;
  }
  if (profile === 'openclaw') {
    return <Boxes className="h-5 w-5" />;
  }
  if (profile === 'codex') {
    return <Command className="h-5 w-5" />;
  }
  if (profile === 'claude') {
    return <Sparkles className="h-5 w-5" />;
  }
  return <Bot className="h-5 w-5" />;
}
