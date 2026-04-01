import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AppWindow,
  Bot,
  Command,
  LayoutGrid,
  ScrollText,
  Settings2,
  Shield,
  TerminalSquare,
} from 'lucide-react';

export type DashboardSection = 'Workspace' | 'Operations';

export interface DashboardNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  section: DashboardSection;
  note: string;
}

export const DASHBOARD_SECTIONS: DashboardSection[] = ['Workspace', 'Operations'];

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { title: 'Overview', url: '/', icon: LayoutGrid, section: 'Workspace', note: 'Host pulse' },
  { title: 'Apps', url: '/apps', icon: AppWindow, section: 'Workspace', note: 'Deploy surface' },
  { title: 'Agents', url: '/agents', icon: Bot, section: 'Workspace', note: 'Runtime map' },
  { title: 'Profiles', url: '/profiles', icon: Settings2, section: 'Workspace', note: 'Env + agents' },
  { title: 'Terminals', url: '/terminals', icon: TerminalSquare, section: 'Workspace', note: 'Live control' },
  { title: 'Security', url: '/security', icon: Shield, section: 'Operations', note: 'Exposure checks' },
  { title: 'Events', url: '/events', icon: Activity, section: 'Operations', note: 'Realtime feed' },
  { title: 'Actions', url: '/actions', icon: Command, section: 'Operations', note: 'Command center' },
  { title: 'Audit', url: '/audit', icon: ScrollText, section: 'Operations', note: 'Paper trail' },
];

export function isDashboardPathActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(href));
}
