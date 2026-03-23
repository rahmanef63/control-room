'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  AppWindow,
  Bot,
  ChevronRight,
  Command,
  LayoutGrid,
  LogOut,
  ScrollText,
  Shield,
  Settings2,
  TerminalSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  kicker: string;
  icon: LucideIcon;
}> = [
  { href: '/', label: 'Overview', kicker: 'Host pulse', icon: LayoutGrid },
  { href: '/apps', label: 'Apps', kicker: 'Deploy surface', icon: AppWindow },
  { href: '/agents', label: 'Agents', kicker: 'Runtime map', icon: Bot },
  { href: '/profiles', label: 'Profiles', kicker: 'Env + agents', icon: Settings2 },
  { href: '/terminals', label: 'Terminals', kicker: 'Live control', icon: TerminalSquare },
  { href: '/security', label: 'Security', kicker: 'Exposure checks', icon: Shield },
  { href: '/events', label: 'Events', kicker: 'Realtime feed', icon: Activity },
  { href: '/actions', label: 'Actions', kicker: 'Command center', icon: Command },
  { href: '/audit', label: 'Audit', kicker: 'Paper trail', icon: ScrollText },
];

function useClock() {
  const [value, setValue] = useState(() =>
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    }).format(new Date())
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setValue(
        new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          month: 'short',
          day: 'numeric',
        }).format(new Date())
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return value;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clock = useClock();
  const currentItem =
    NAV_ITEMS.find((item) => item.href === pathname) ||
    NAV_ITEMS.find((item) => pathname.startsWith(item.href) && item.href !== '/') ||
    NAV_ITEMS[0];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="relative min-h-screen pb-24 md:pb-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(251,146,60,0.12),transparent_18%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1700px] gap-4 px-3 py-3 md:px-5 md:py-5">
        <aside className="glass-panel hidden w-[310px] shrink-0 flex-col rounded-[2rem] border border-white/10 p-4 shadow-[0_44px_130px_-80px_rgba(14,165,233,0.55)] xl:flex">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/30 to-orange-400/20 text-white">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">VPS Control Room</p>
                <h1 className="mt-1 text-lg font-semibold text-white">vps.rahmanef.com</h1>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Status</p>
                <p className="mt-2 text-sm font-medium text-emerald-300">Tailscale-only</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Clock</p>
                <p className="mt-2 text-sm font-medium text-white">{clock}</p>
              </div>
            </div>
          </div>

          <nav className="mt-4 flex-1 space-y-2">
            {NAV_ITEMS.map(({ href, label, kicker, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center justify-between rounded-[1.35rem] border px-4 py-3 transition-all ${
                    active
                      ? 'border-cyan-400/20 bg-cyan-400/10 text-white shadow-[0_18px_40px_-28px_rgba(34,211,238,0.75)]'
                      : 'border-white/5 bg-white/[0.03] text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-black/20">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{kicker}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </nav>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Operational note</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              UI deploys now refresh the frontend shell. Terminal sessions are being moved toward a
              gateway model so they survive browser reconnects better.
            </p>
            <button
              onClick={handleLogout}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="glass-panel rounded-[1.75rem] border border-white/10 px-4 py-4 shadow-[0_30px_80px_-65px_rgba(14,165,233,0.6)] md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                  {currentItem.kicker}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {currentItem.label}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  single-user cockpit
                </span>
                <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200">
                  pwa-ready shell
                </span>
              </div>
            </div>
          </header>

          <main className="app-shell-scrollbar min-h-[calc(100vh-8rem)] overflow-auto rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,31,0.75),rgba(8,17,31,0.58))] shadow-[0_40px_120px_-90px_rgba(14,165,233,0.45)]">
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-2 rounded-[1.6rem] border border-white/10 bg-[rgba(8,17,31,0.92)] p-2 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.6)] backdrop-blur xl:hidden">
        {NAV_ITEMS.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center rounded-[1.2rem] px-2 py-2 text-[11px] ${
                active ? 'bg-cyan-400/10 text-white' : 'text-slate-400'
              }`}
            >
              <Icon className="mb-1 h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
