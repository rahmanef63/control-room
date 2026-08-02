'use client';

import { useState } from 'react';
import { Check, ShieldCheck, ShieldQuestion, Smartphone, Trash2, X } from 'lucide-react';

import { useDevices } from '@/features/terminals/hooks/use-devices';

export interface DevicesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

/**
 * In-app trusted-device manager. Lets an already-logged-in (already-trusted)
 * device approve a new device's pending request, or revoke trust — no CLI on
 * the box needed. Polls while open so a fresh request appears on its own.
 */
export function DevicesDrawer({ open, onOpenChange }: DevicesDrawerProps) {
  const { approved, pending, pendingCount, loading, approve, revoke } = useDevices(open);
  const [busy, setBusy] = useState<string | null>(null);

  if (!open) return null;

  async function act(fn: () => Promise<void>, id: string) {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const pendingEntries = Object.entries(pending).sort((a, b) => b[1].lastSeen - a[1].lastSeen);
  const approvedEntries = Object.entries(approved).sort(
    (a, b) => b[1].approvedAt - a[1].approvedAt
  );

  return (
    <div className="launcher-drawer-backdrop" onClick={() => onOpenChange(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trusted devices"
        onClick={(event) => event.stopPropagation()}
        className="launcher-drawer-sheet"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-300" />
            <div>
              <p className="text-sm font-semibold text-foreground">Trusted devices</p>
              <p className="text-[11px] text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} awaiting approval`
                  : 'Approve or revoke devices that can sign in'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
            aria-label="Close devices"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-3 py-3">
          <section>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              <ShieldQuestion className="h-3.5 w-3.5" /> Pending approval
            </p>
            {pendingEntries.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {loading ? 'Loading…' : 'No devices waiting.'}
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {pendingEntries.map(([id, d]) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2"
                  >
                    <Smartphone className="h-4 w-4 shrink-0 text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-amber-50">{d.label}</p>
                      <p className="truncate font-mono text-[10px] text-amber-100/70">{id}</p>
                      <p className="text-[10px] text-amber-100/60">
                        ip {d.ip} · {d.attempts} attempt{d.attempts === 1 ? '' : 's'} ·{' '}
                        {relativeTime(d.lastSeen)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy === id}
                      onClick={() => void act(() => approve(id, d.label), id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[12px] font-medium text-emerald-100 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Approved ({approvedEntries.length})
            </p>
            {approvedEntries.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No trusted devices yet.
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {approvedEntries.map(([id, d]) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-2.5 py-2"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{d.label}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{id}</p>
                      <p className="text-[10px] text-muted-foreground">
                        approved {relativeTime(d.approvedAt)}
                        {d.lastSeen ? ` · last seen ${relativeTime(d.lastSeen)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy === id}
                      onClick={() => void act(() => revoke(id), id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-rose-300 disabled:opacity-50"
                      aria-label="Revoke device"
                      title="Revoke trust"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
