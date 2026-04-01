'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Download, RefreshCcw } from 'lucide-react';
import { useTransition } from 'react';

import { getDashboardPageMeta } from '@/shared/config/dashboard-page-meta';
import { usePwaInstall } from '@/shared/pwa/use-pwa-install';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const meta = getDashboardPageMeta(pathname);
  const { canInstall, install } = usePwaInstall();

  return (
    <header className="site-header-shell">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 rounded-lg" />
        <Separator orientation="vertical" className="mx-1 hidden h-4 md:block" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink asChild>
                <Link href="/">Control Room</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{meta.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="min-w-0 flex-1 px-1 md:px-2">
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">
          {meta.title}
        </h1>
        <p className="hidden truncate text-sm text-muted-foreground md:block">
          {meta.description}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="hidden rounded-md px-2.5 py-1 text-[11px] md:inline-flex">
          notion-style shell
        </Badge>
        {canInstall && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden rounded-xl sm:flex"
            onClick={() => void install()}
            title="Install as app"
          >
            <Download className="mr-2 size-3.5" />
            Install
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => startRefreshTransition(() => router.refresh())}
          disabled={isRefreshing}
        >
          <RefreshCcw className={`mr-2 size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
        </Button>
      </div>
    </header>
  );
}
