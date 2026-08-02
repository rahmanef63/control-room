'use client';

import { useEffect, useState } from 'react';
import { Activity, Cpu, Gauge, HardDrive, MemoryStick, Network, Server, X } from 'lucide-react';

export interface OverviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Telemetry {
  cpu_total: number;
  cpu_cores: number[];
  ram_total: number;
  ram_used: number;
  ram_available: number;
  disk: Array<{ mount: string; total: number; used: number; available: number }>;
  network: { rx_bytes: number; tx_bytes: number; rx_rate: number; tx_rate: number };
  uptime_seconds: number;
  load_average: number[];
}

interface Overview {
  status?: string;
  runtime?: {
    terminal_sessions: number;
    terminal_profiles: number;
    environments: number;
    agent_profiles: number;
  };
  telemetry?: Telemetry | null;
}

function fmtBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtUptime(s: number): string {
  if (!s) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function toneFor(pct: number): string {
  if (pct >= 90) return 'bg-rose-400';
  if (pct >= 70) return 'bg-amber-400';
  return 'bg-emerald-400';
}

function Bar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50">
      <div className={`h-full rounded-full ${toneFor(clamped)}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/**
 * Read-only host overview. Surfaces the telemetry the agent already samples
 * every ~15s (CPU / RAM / disk / load / net / uptime) so the operator doesn't
 * have to open a shell and run htop. Polls every 5s while open.
 */
export function OverviewDrawer({ open, onOpenChange }: OverviewDrawerProps) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/overview', { cache: 'no-store' });
        if (!res.ok) throw new Error('bad');
        const json = (await res.json()) as Overview;
        if (active) {
          setData(json);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [open]);

  if (!open) return null;

  const t = data?.telemetry ?? null;
  const ramPct = t && t.ram_total ? (t.ram_used / t.ram_total) * 100 : 0;

  return (
    <div className="launcher-drawer-backdrop" onClick={() => onOpenChange(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="System overview"
        onClick={(event) => event.stopPropagation()}
        className="launcher-drawer-sheet"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-sky-300" />
            <div>
              <p className="text-sm font-semibold text-foreground">System overview</p>
              <p className="text-[11px] text-muted-foreground">
                {error
                  ? 'Agent unreachable'
                  : t
                    ? `Uptime ${fmtUptime(t.uptime_seconds)} · live`
                    : 'Loading…'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
            aria-label="Close overview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-3 py-3">
          {error ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Couldn&apos;t reach the agent. Check it&apos;s running on the host
              (<span className="font-mono">systemctl status vps-control-room-agent</span>).
            </p>
          ) : !t ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Loading host metrics…</p>
          ) : (
            <>
              <section className="rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Cpu className="h-3.5 w-3.5 text-sky-300" /> CPU
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {t.cpu_total.toFixed(0)}% · {t.cpu_cores.length} cores
                  </span>
                </div>
                <Bar pct={t.cpu_total} />
              </section>

              <section className="rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <MemoryStick className="h-3.5 w-3.5 text-violet-300" /> Memory
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {fmtBytes(t.ram_used)} / {fmtBytes(t.ram_total)}
                  </span>
                </div>
                <Bar pct={ramPct} />
              </section>

              <section className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Activity className="h-3.5 w-3.5 text-amber-300" /> Load avg
                  </p>
                  <p className="mt-1 font-mono text-sm text-foreground">
                    {t.load_average.map((n) => n.toFixed(2)).join('  ')}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Server className="h-3.5 w-3.5 text-emerald-300" /> Uptime
                  </p>
                  <p className="mt-1 font-mono text-sm text-foreground">{fmtUptime(t.uptime_seconds)}</p>
                </div>
              </section>

              <section className="rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Network className="h-3.5 w-3.5 text-cyan-300" /> Network
                  </span>
                  <span className="font-mono text-muted-foreground">
                    ↓ {fmtBytes(t.network.rx_rate)}/s · ↑ {fmtBytes(t.network.tx_rate)}/s
                  </span>
                </div>
              </section>

              {t.disk.length > 0 ? (
                <section className="rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <HardDrive className="h-3.5 w-3.5 text-slate-300" /> Disk
                  </p>
                  <ul className="grid gap-2">
                    {t.disk.map((d) => {
                      const pct = d.total ? (d.used / d.total) * 100 : 0;
                      return (
                        <li key={d.mount}>
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="font-mono text-muted-foreground">{d.mount}</span>
                            <span className="font-mono text-muted-foreground">
                              {fmtBytes(d.used)} / {fmtBytes(d.total)}
                            </span>
                          </div>
                          <Bar pct={pct} />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {data?.runtime ? (
                <section className="grid grid-cols-2 gap-2 px-1 pt-1 text-[11px] text-muted-foreground">
                  <span>
                    Sessions: <span className="font-mono text-foreground">{data.runtime.terminal_sessions}</span>
                  </span>
                  <span>
                    Agents: <span className="font-mono text-foreground">{data.runtime.agent_profiles}</span>
                  </span>
                  <span>
                    Profiles: <span className="font-mono text-foreground">{data.runtime.terminal_profiles}</span>
                  </span>
                  <span>
                    Envs: <span className="font-mono text-foreground">{data.runtime.environments}</span>
                  </span>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
