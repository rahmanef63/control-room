'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, ShieldCheck, Sparkles, TerminalSquare } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else if (res.status === 401) {
        setError('Invalid secret');
      } else if (res.status === 429) {
        setError('Too many attempts, try again later');
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
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter control room secret…"
                  required
                  autoFocus
                  className="w-full rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                />
              </div>

              {error ? (
                <div className="rounded-[1.1rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || !secret}
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
