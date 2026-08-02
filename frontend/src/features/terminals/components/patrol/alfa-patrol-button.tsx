'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface AlfaPatrolButtonProps {
  patrolActiveCount: number;
  pendingPingsCount: number;
  onClick: () => void;
}

export function AlfaPatrolButton({
  patrolActiveCount,
  pendingPingsCount,
  onClick,
}: AlfaPatrolButtonProps) {
  const active = patrolActiveCount > 0;
  const Icon = active ? ShieldCheck : ShieldAlert;
  const label = active
    ? `Alfa patrol · ${patrolActiveCount} watched${pendingPingsCount > 0 ? ` · ${pendingPingsCount} pending` : ''}`
    : 'Open Alfa patrol';

  return (
    <button
      type="button"
      onClick={onClick}
      className="topbar-icon-button alfa-patrol-trigger"
      data-active={active || undefined}
      data-pending={pendingPingsCount > 0 || undefined}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
      {active ? <span className="alfa-patrol-trigger-count">{patrolActiveCount}</span> : null}
      {pendingPingsCount > 0 ? (
        <span className="alfa-patrol-trigger-pending" aria-label={`${pendingPingsCount} pending pings`}>
          {pendingPingsCount}
        </span>
      ) : null}
    </button>
  );
}
