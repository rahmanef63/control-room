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
import type {
  AlertRecord,
  AppStatus,
  EventRecord,
  OverviewData,
} from '@/shared/types/contracts';

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
    <article className="bento-card p-4 md:p-5">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent} to-transparent`} />
      <div className="relative">
        <p className="dashboard-label">{label}</p>
        <p className="dashboard-value">{value}</p>
        {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
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
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/60">
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
    return <div className="dashboard-page text-sm text-muted-foreground">Loading control room overview...</div>;
  }

  const snap = overview.snapshot;
  const ramPct = snap ? (snap.ram_used / snap.ram_total) * 100 : 0;
  const runningApps = apps?.filter((a) => a.runtime_status === 'running').length ?? 0;
  const degradedApps =
    apps?.filter((a) => a.runtime_status === 'stopped' || a.runtime_status === 'error').length ?? 0;
  const serviceStatusMap = new Map(apps?.map((a) => [a.name.toLowerCase(), a]) ?? []);

  const topDisk = snap?.disk?.find((entry) => entry.mount === '/') ?? snap?.disk?.[0];

  return (
    <div className="dashboard-page">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <article className="dashboard-hero">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="dashboard-hero-badge">
                <Sparkles className="h-3.5 w-3.5" />
                Live Host Pulse
              </div>
              <div>
                <h1 className="dashboard-hero-title">
                  One cockpit for the host, agents, apps, and risk surface.
                </h1>
                <p className="dashboard-hero-copy mt-3 max-w-2xl text-sm md:text-base">
                  This view compresses the entire VPS into a fast visual scan: host load, app health,
                  live alerts, and the last events emitted by the control plane.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/terminals"
                  className="dashboard-action-link"
                  data-tone="primary"
                >
                  <TerminalSquare className="h-4 w-4" />
                  Open terminals
                </Link>
                <Link href="/security" className="dashboard-action-link">
                  <Shield className="h-4 w-4" />
                  Review exposure
                </Link>
                <Link href="/profiles" className="dashboard-action-link">
                  <Bot className="h-4 w-4" />
                  Agent manifests
                </Link>
              </div>
            </div>

            <div className="grid min-w-[280px] grid-cols-2 gap-3">
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
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            Host footprint
          </div>
          {snap ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="dashboard-subpanel">
                <p className="dashboard-label">Disk layout</p>
                <div className="mt-4 space-y-3">
                  {snap.disk.map((disk) => {
                    const pct = (disk.used / disk.total) * 100;
                    return (
                      <div key={disk.mount} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{disk.mount}</span>
                          <span>
                            {formatBytes(disk.used)} / {formatBytes(disk.total)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/60">
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

              <div className="dashboard-subpanel">
                <p className="dashboard-label">CPU per core</p>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {snap.cpu_cores.map((core, index) => (
                    <div key={index} className="space-y-2 rounded-2xl border border-border/60 bg-accent/40 p-3">
                      <div
                        className="h-24 rounded-full bg-muted/60"
                        style={{
                          backgroundImage: `linear-gradient(to top, ${
                            core > 75 ? '#fb7185' : core > 50 ? '#fb923c' : '#22d3ee'
                          } ${Math.min(core, 100)}%, rgba(255,255,255,0.04) ${Math.min(core, 100)}%)`,
                        }}
                      />
                      <div className="text-center">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          c{index + 1}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">{core.toFixed(0)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for host metrics...</p>
          )}
        </article>

        <div className="grid gap-4">
          <article className="bento-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
              <Bot className="h-4 w-4 text-muted-foreground" />
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
                    className={`dashboard-chip ${tone}`}
                  >
                    {svc}
                  </span>
                );
              })}
            </div>
          </article>

          <article className="bento-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
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
              <p className="text-sm text-muted-foreground">No active alerts at the moment.</p>
            )}
          </article>
        </div>
      </section>

      <section className="bento-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Recent control-plane events
          </div>
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Open full timeline
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {events?.page?.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {events.page.map((event) => (
              <article key={event._id} className="dashboard-subpanel">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {event.source}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">{event.message}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {event.type} · {event.severity}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for event stream...</p>
        )}
      </section>
    </div>
  );
}
