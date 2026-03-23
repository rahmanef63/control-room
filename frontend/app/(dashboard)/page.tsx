// @ts-nocheck — stub API types; remove after `npx convex deploy` generates real types
'use client';

import Link from 'next/link';
import { useQuery } from 'convex/react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  HardDrive,
  Shield,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';

import { api } from '@/_generated/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function BentoStat({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent: string;
}) {
  return (
    <article className="bento-card p-5">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent} to-transparent`} />
      <div className="relative">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <p className="mt-3 text-4xl font-semibold tracking-tight text-white">{value}</p>
        {detail ? <p className="mt-2 text-sm text-slate-400">{detail}</p> : null}
      </div>
    </article>
  );
}

function ProgressRail({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

const SERVICE_BADGES = ['dokploy', 'convex', 'n8n', 'ollama', 'sshd', 'fail2ban'];

export default function OverviewPage() {
  const overview = useQuery(api.snapshots.getOverview);
  const apps = useQuery(api.appStatus.listApps);
  const alerts = useQuery(api.alerts.listActiveAlerts);
  const events = useQuery(api.events.listEvents, {
    paginationOpts: { numItems: 6, cursor: null },
  });

  if (overview === undefined) {
    return <div className="p-6 text-sm text-slate-400">Loading control room overview...</div>;
  }

  const snap = overview.snapshot;
  const ramPct = snap ? (snap.ram_used / snap.ram_total) * 100 : 0;
  const runningApps = apps?.filter((a) => a.runtime_status === 'running').length ?? 0;
  const degradedApps =
    apps?.filter((a) => a.runtime_status === 'stopped' || a.runtime_status === 'error').length ?? 0;
  const serviceStatusMap = new Map(apps?.map((a) => [a.name.toLowerCase(), a]) ?? []);

  const topDisk = snap?.disk?.find((entry) => entry.mount === '/') ?? snap?.disk?.[0];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(8,17,31,0.96),rgba(15,23,42,0.92),rgba(8,17,31,0.98))] p-6 shadow-[0_40px_120px_-70px_rgba(14,165,233,0.6)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(251,146,60,0.14),transparent_18%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Live Host Pulse
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  One cockpit for the host, agents, apps, and risk surface.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  This view compresses the entire VPS into a fast visual scan: host load, app health,
                  live alerts, and the last events emitted by the control plane.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/terminals"
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-400/15"
                >
                  <TerminalSquare className="h-4 w-4" />
                  Open terminals
                </Link>
                <Link
                  href="/security"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  <Shield className="h-4 w-4" />
                  Review exposure
                </Link>
                <Link
                  href="/profiles"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  <Bot className="h-4 w-4" />
                  Agent manifests
                </Link>
              </div>
            </div>

            <div className="grid min-w-[300px] grid-cols-2 gap-3">
              <BentoStat
                label="Uptime"
                value={snap ? formatUptime(snap.uptime_seconds) : '—'}
                detail={snap ? `Updated ${new Date(snap.timestamp).toLocaleTimeString()}` : undefined}
                accent="from-cyan-400/20"
              />
              <BentoStat
                label="Open alerts"
                value={String(overview.active_alert_count)}
                detail={overview.active_alert_count > 0 ? 'Action recommended' : 'No active alert'}
                accent="from-orange-400/20"
              />
            </div>
          </div>
        </article>

        <article className="bento-card p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-orange-400/15 to-transparent" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Activity className="h-4 w-4 text-orange-300" />
              Resource rails
            </div>
            {snap ? (
              <div className="space-y-4">
                <ProgressRail label="CPU total" value={snap.cpu_total} color="bg-cyan-400" />
                <ProgressRail label="Memory" value={ramPct} color="bg-orange-400" />
                <ProgressRail
                  label={`Disk ${topDisk?.mount ?? '/'}`}
                  value={topDisk ? (topDisk.used / topDisk.total) * 100 : 0}
                  color="bg-emerald-400"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-400">Waiting for agent data…</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <BentoStat
          label="CPU"
          value={snap ? `${snap.cpu_total.toFixed(1)}%` : '—'}
          detail={snap ? `Load ${snap.load_average[0]?.toFixed(2) ?? '—'}` : undefined}
          accent="from-cyan-400/18"
        />
        <BentoStat
          label="Memory"
          value={snap ? `${ramPct.toFixed(0)}%` : '—'}
          detail={snap ? `${formatBytes(snap.ram_used)} / ${formatBytes(snap.ram_total)}` : undefined}
          accent="from-orange-400/18"
        />
        <BentoStat
          label="Apps healthy"
          value={String(runningApps)}
          detail={`${degradedApps} degraded or stopped`}
          accent="from-emerald-400/18"
        />
        <BentoStat
          label="Agents active"
          value={String(overview.agent_count)}
          detail="Collectors + control workers"
          accent="from-fuchsia-400/18"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="bento-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
            <HardDrive className="h-4 w-4 text-cyan-300" />
            Host footprint
          </div>
          {snap ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Disk layout</p>
                <div className="mt-4 space-y-3">
                  {snap.disk.map((disk) => {
                    const pct = (disk.used / disk.total) * 100;
                    return (
                      <div key={disk.mount} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{disk.mount}</span>
                          <span>
                            {formatBytes(disk.used)} / {formatBytes(disk.total)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full rounded-full ${
                              pct > 85 ? 'bg-rose-400' : pct > 65 ? 'bg-orange-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">CPU per core</p>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {snap.cpu_cores.map((core, index) => (
                    <div key={index} className="space-y-2 rounded-2xl border border-white/5 bg-white/5 p-3">
                      <div
                        className="h-24 rounded-full bg-white/5"
                        style={{
                          backgroundImage: `linear-gradient(to top, ${
                            core > 75 ? '#fb7185' : core > 50 ? '#fb923c' : '#22d3ee'
                          } ${Math.min(core, 100)}%, rgba(255,255,255,0.04) ${Math.min(core, 100)}%)`,
                        }}
                      />
                      <div className="text-center">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          c{index + 1}
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">{core.toFixed(0)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Waiting for host metrics…</p>
          )}
        </article>

        <div className="grid gap-4">
          <article className="bento-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Bot className="h-4 w-4 text-cyan-300" />
              Service presence
            </div>
            <div className="flex flex-wrap gap-2">
              {SERVICE_BADGES.map((svc) => {
                const app = serviceStatusMap.get(svc);
                const status = app?.runtime_status ?? 'unknown';
                const tone =
                  status === 'running'
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                    : status === 'error' || status === 'stopped'
                    ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
                    : 'border-white/10 bg-white/5 text-slate-300';
                return (
                  <span
                    key={svc}
                    className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${tone}`}
                  >
                    {svc}
                  </span>
                );
              })}
            </div>
          </article>

          <article className="bento-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <AlertTriangle className="h-4 w-4 text-orange-300" />
              Live alerts
            </div>
            {alerts && alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert._id}
                    className={`rounded-[1.2rem] border px-4 py-3 ${
                      alert.severity === 'critical'
                        ? 'border-rose-400/20 bg-rose-500/10 text-rose-100'
                        : alert.severity === 'error'
                        ? 'border-orange-400/20 bg-orange-500/10 text-orange-100'
                        : 'border-yellow-400/20 bg-yellow-500/10 text-yellow-100'
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">{alert.severity}</p>
                    <p className="mt-2 text-sm leading-6">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No active alerts at the moment.</p>
            )}
          </article>
        </div>
      </section>

      <section className="bento-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Activity className="h-4 w-4 text-cyan-300" />
            Recent control-plane events
          </div>
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-sm text-cyan-200 transition-colors hover:text-white"
          >
            Open full timeline
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {events?.page?.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {events.page.map((event) => (
              <article key={event._id} className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    {event.source}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-white">{event.message}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {event.type} · {event.severity}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Waiting for event stream…</p>
        )}
      </section>
    </div>
  );
}
