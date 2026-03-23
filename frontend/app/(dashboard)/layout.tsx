'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: '⬡' },
  { href: '/apps', label: 'Apps & Services', icon: '⬢' },
  { href: '/agents', label: 'Agents', icon: '◈' },
  { href: '/terminals', label: 'Terminals', icon: '⌘' },
  { href: '/security', label: 'Security', icon: '⊗' },
  { href: '/events', label: 'Events', icon: '◷' },
  { href: '/actions', label: 'Actions', icon: '▶' },
  { href: '/audit', label: 'Audit Log', icon: '◫' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <h1 className="text-sm font-bold text-foreground tracking-wider uppercase">
            VPS Control Room
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">vps.rahmanef.com</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
