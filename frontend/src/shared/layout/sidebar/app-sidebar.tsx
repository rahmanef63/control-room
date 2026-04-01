'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  LogOut,
} from 'lucide-react';

import {
  DASHBOARD_NAV_ITEMS,
  DASHBOARD_SECTIONS,
  isDashboardPathActive,
} from '@/shared/config/dashboard-navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-auto items-start gap-3 rounded-xl px-2.5 py-3"
              render={<Link href="/" />}
            >
              <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-sidebar-accent text-sidebar-foreground">
                <LayoutGrid className="size-4" />
              </div>
              <div className="grid flex-1 text-left">
                <span className="text-sm font-semibold tracking-tight">VPS Control Room</span>
                <span className="text-xs text-sidebar-foreground/70">Notion-like operations workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="px-2 pt-1">
          <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/55 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/60">
                Environment
              </span>
              <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px]">
                Active
              </Badge>
            </div>
            <p className="mt-2 text-sm font-medium text-sidebar-foreground">{process.env.NEXT_PUBLIC_APP_HOST ?? 'vps.local'}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {DASHBOARD_SECTIONS.map((section) => (
          <SidebarGroup key={section}>
            <SidebarGroupLabel>{section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {DASHBOARD_NAV_ITEMS
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const active = isDashboardPathActive(pathname, item.url);
                    const Icon = item.icon;

                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.title}
                          className="h-auto items-start gap-3 rounded-xl px-2.5 py-2.5"
                          render={<Link href={item.url} />}
                        >
                          <Icon className="mt-0.5 size-4" />
                          <div className="grid min-w-0 flex-1 text-left">
                            <span className="truncate text-sm font-medium">{item.title}</span>
                            <span className="truncate text-[11px] text-sidebar-foreground/60">{item.note}</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <div className="px-2 py-1">
          <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/60">
              Session
            </p>
            <p className="mt-2 text-sm font-medium text-sidebar-foreground">Single-user operator</p>
            <Button
              variant="outline"
              className="mt-3 w-full justify-start rounded-xl"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
