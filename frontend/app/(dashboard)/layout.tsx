import { SiteHeader } from '@/shared/layout/header/site-header';
import { AppSidebar } from '@/shared/layout/sidebar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '15.75rem',
          '--header-height': '3.5rem',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="min-h-svh">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">
            <div className="flex flex-1 flex-col px-2 py-2 md:px-3 md:py-3">
              <div className="min-h-full rounded-[calc(var(--radius)+0.4rem)] border border-border/70 bg-card/72 shadow-[0_24px_80px_-56px_rgba(0,0,0,0.7)]">
                {children}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
