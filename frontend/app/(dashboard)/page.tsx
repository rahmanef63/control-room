// @ts-nocheck — stub API types; remove after `npx convex deploy` generates real types
'use client';

import { useQuery } from 'convex/react';
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, color = 'bg-primary' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

const SERVICE_BADGES = [
  'dokploy',
  'convex',
  'n8n',
  'ollama',
  'sshd',
  'fail2ban',
];

export default function OverviewPage() {
  const overview = useQuery(api.snapshots.getOverview);
  const apps = useQuery(api.appStatus.listApps);
  const alerts = useQuery(api.alerts.listActiveAlerts);

  if (overview === undefined) {
    return (
      <div className="p-6 text-muted-foreground text-sm">Loading overview...</div>
    );
  }

  const snap = overview.snapshot;

  const ramPct = snap ? (snap.ram_used / snap.ram_total) * 100 : 0;
  const cpuColor =
    snap && snap.cpu_total > 80
      ? 'bg-red-500'
      : snap && snap.cpu_total > 60
      ? 'bg-yellow-500'
      : 'bg-emerald-500';
  const ramColor =
    ramPct > 85 ? 'bg-red-500' : ramPct > 65 ? 'bg-yellow-500' : 'bg-emerald-500';

  const runningApps = apps?.filter((a) => a.runtime_status === 'running').length ?? 0;
  const stoppedApps = apps?.filter((a) => a.runtime_status === 'stopped' || a.runtime_status === 'error').length ?? 0;

  const serviceStatusMap = new Map(apps?.map((a) => [a.name.toLowerCase(), a]) ?? []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Overview</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {snap
            ? `Last updated ${new Date(snap.timestamp).toLocaleTimeString()}`
            : 'Waiting for agent data...'}
        </p>
      </div>

      {/* Host stats */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Host</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="CPU"
            value={snap ? `${snap.cpu_total.toFixed(1)}%` : '—'}
            sub={snap ? `Load: ${snap.load_average[0]?.toFixed(2) ?? '—'}` : undefined}
          />
          <StatCard
            label="Memory"
            value={snap ? `${ramPct.toFixed(0)}%` : '—'}
            sub={
              snap
                ? `${formatBytes(snap.ram_used)} / ${formatBytes(snap.ram_total)}`
                : undefined
            }
          />
          <StatCard
            label="Uptime"
            value={snap ? formatUptime(snap.uptime_seconds) : '—'}
          />
          <StatCard
            label="Network"
            value={snap ? `↓${formatBytes(snap.network.rx_rate)}/s` : '—'}
            sub={snap ? `↑${formatBytes(snap.network.tx_rate)}/s` : undefined}
          />
        </div>

        {snap && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>CPU</span>
                <span>{snap.cpu_total.toFixed(1)}%</span>
              </div>
              <ProgressBar value={snap.cpu_total} color={cpuColor} />
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>RAM</span>
                <span>{ramPct.toFixed(0)}%</span>
              </div>
              <ProgressBar value={ramPct} color={ramColor} />
            </div>
          </div>
        )}

        {snap && snap.disk.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Disk</p>
            <div className="space-y-2">
              {snap.disk.map((d) => {
                const pct = (d.used / d.total) * 100;
                const diskColor = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-yellow-500' : 'bg-emerald-500';
                return (
                  <div key={d.mount} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{d.mount}</span>
                      <span>
                        {formatBytes(d.used)} / {formatBytes(d.total)}
                      </span>
                    </div>
                    <ProgressBar value={pct} color={diskColor} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Summary counts */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Apps running" value={String(runningApps)} />
          <StatCard label="Apps stopped/error" value={String(stoppedApps)} />
          <StatCard label="Active agents" value={String(overview.agent_count)} />
          <StatCard
            label="Active alerts"
            value={String(overview.active_alert_count)}
          />
        </div>
      </section>

      {/* Service quick badges */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service Status</h3>
        <div className="flex flex-wrap gap-2">
          {SERVICE_BADGES.map((svc) => {
            const app = serviceStatusMap.get(svc);
            const status = app?.runtime_status ?? 'unknown';
            const dot =
              status === 'running'
                ? 'bg-emerald-500'
                : status === 'stopped' || status === 'error'
                ? 'bg-red-500'
                : 'bg-yellow-500';
            return (
              <div
                key={svc}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
              >
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {svc}
              </div>
            );
          })}
        </div>
      </section>

      {/* Active alerts */}
      {alerts && alerts.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Alerts ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert._id}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  alert.severity === 'critical'
                    ? 'border-red-800 bg-red-950/20 text-red-400'
                    : alert.severity === 'error'
                    ? 'border-orange-800 bg-orange-950/20 text-orange-400'
                    : 'border-yellow-800 bg-yellow-950/20 text-yellow-400'
                }`}
              >
                <span className="font-medium capitalize">[{alert.severity}]</span>{' '}
                {alert.message}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
