'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, LockKeyhole, ShieldCheck, Smartphone, Sparkles, TerminalSquare } from 'lucide-react';

const DEVICE_ID_KEY = 'vps.device.id';

// Stable per-device id (the strong second factor). 128-bit, generated once and
// kept in localStorage. The server only issues a session if this id has been
// approved out-of-band, so a leaked password alone is not enough.
function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id || !/^[a-f0-9]{16,}$/i.test(id)) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'unknown device';
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'device';
  const browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'browser';
  return `${os} · ${browser}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The owner of this box IS the admin, so hand them the exact command instead
  // of a bare id they then have to look up how to use.
  const approveCommand = pendingId ? `vps-cr acc ${pendingId}` : '';

  async function copyId() {
    if (!pendingId) return;
    try {
      await navigator.clipboard.writeText(approveCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard blocked — copy the id manually');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedSecret = secret.trim();
    if (!normalizedSecret || loading) {
      return;
    }

    setError(null);
    setPendingId(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: normalizedSecret,
          deviceId: getOrCreateDeviceId(),
          deviceLabel: deviceLabel(),
        }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else if (res.status === 403) {
        // Password ok, device not approved yet.
        const payload = (await res.json().catch(() => ({}))) as { deviceId?: string };
        setPendingId(payload.deviceId ?? getOrCreateDeviceId());
      } else if (res.status === 401) {
        setError('Invalid secret');
      } else if (res.status === 429) {
        setError('Too many attempts, try again later');
      } else if (res.status === 400) {
        setError('Device id could not be generated (enable storage)');
      } else {
        setError('An unexpected error occurred');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),radial-gradient(circle_at_82%_15%,rgba(251,146,60,0.14),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.12),transparent_20%)]" />

      <div className="relative grid w-full max-w-6xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel hidden rounded-[2.25rem] border border-white/10 p-8 shadow-[0_40px_130px_-70px_rgba(14,165,233,0.65)] xl:flex xl:flex-col xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Operational cockpit
            </div>
            <h1 className="mt-6 max-w-2xl text-5xl font-semibold tracking-tight text-white">
              One place to drive the VPS, the agents, and the terminals.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Built for direct control: host metrics, deploy state, security surface, and
              multi-agent terminal access from one PWA-ready shell.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: TerminalSquare,
                title: 'Terminal-first',
                text: 'Launch empty shells or jump straight into Codex, Claude, Gemini, and OpenClaw.',
              },
              {
                icon: ShieldCheck,
                title: 'Single-user secure',
                text: 'Tailscale-only and protected by the shared control room secret.',
              },
              {
                icon: LockKeyhole,
                title: 'Ops visibility',
                text: 'See the host, apps, alerts, audit trail, and live control plane events.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-medium text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-[2.25rem] border border-white/10 p-6 shadow-[0_40px_130px_-70px_rgba(14,165,233,0.55)] md:p-8">
          <div className="mx-auto max-w-md">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-[1.4rem] border border-white/10 bg-gradient-to-br from-cyan-400/25 to-orange-400/15 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">
              Enter the control room
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Authenticate with the shared secret to access the live VPS cockpit.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <label htmlFor="secret" className="text-sm font-medium text-slate-200">
                  Access secret
                </label>
                <input
                  id="secret"
                  name="secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  onInput={(e) => setSecret((e.target as HTMLInputElement).value)}
                  placeholder="Enter control room secret…"
                  required
                  autoComplete="current-password"
                  enterKeyHint="go"
                  autoFocus
                  className="w-full rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                />
              </div>

              {error ? (
                <div className="rounded-[1.1rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              {pendingId ? (
                <div className="space-y-3 rounded-[1.1rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <div className="flex items-center gap-2 font-medium">
                    <Smartphone className="h-4 w-4" />
                    New device — approval required
                  </div>
                  <p className="text-[13px] leading-5 text-amber-100/80">
                    Password accepted, but this device isn&apos;t trusted yet. Run this on the VPS
                    (or any shell with the repo), then sign in again.
                  </p>
                  {/* break-all, not truncate: a hidden half of the id is useless to
                      someone retyping it on a phone. */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="flex-1 break-all rounded-lg border border-amber-500/30 bg-black/30 px-2 py-1.5 font-mono text-[11px] text-amber-50">
                      {approveCommand}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyId()}
                      className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/15 px-2.5 py-1.5 text-[12px] font-medium text-amber-50"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy command'}
                    </button>
                  </div>
                  <p className="text-[11px] leading-4 text-amber-100/60">
                    No <code className="font-mono">vps-cr</code> on PATH? From the repo root:{' '}
                    <code className="font-mono break-all">
                      node scripts/approve-device.js {pendingId}
                    </code>
                  </p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[1.25rem] bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Authenticating…' : 'Unlock control room'}
              </button>
            </form>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Access mode</p>
                <p className="mt-2 text-sm font-medium text-white">Tailscale only</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Installable</p>
                <p className="mt-2 text-sm font-medium text-white">PWA-ready shell</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
