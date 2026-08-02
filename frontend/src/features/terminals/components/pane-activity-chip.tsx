import { CheckCircle2, Loader2, MessageCircleQuestion } from 'lucide-react';

import type { ActivityState } from '@/features/terminals/lib/utils';

export function PaneActivityChip({
  state,
  label,
}: {
  state: ActivityState;
  label: string;
}) {
  return (
    <span className="activity-chip" data-state={state} title={label}>
      {state === 'working' || state === 'planning' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : null}
      {state === 'asking' || state === 'waiting' ? (
        <MessageCircleQuestion className="h-3 w-3" />
      ) : null}
      {state === 'done' ? <CheckCircle2 className="h-3 w-3" /> : null}
      <span>{label}</span>
    </span>
  );
}
