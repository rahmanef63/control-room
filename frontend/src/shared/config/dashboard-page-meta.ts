export interface DashboardPageMeta {
  title: string;
  description: string;
}

const DASHBOARD_PAGE_META: Record<string, DashboardPageMeta> = {
  '/': {
    title: 'Overview',
    description: 'Host pulse, app health, and current operational state.',
  },
  '/apps': {
    title: 'Apps',
    description: 'Deploy surface and runtime status across the VPS.',
  },
  '/agents': {
    title: 'Agents',
    description: 'Collector and worker topology for the control plane.',
  },
  '/profiles': {
    title: 'Profiles',
    description: 'Environment manifests, runtime profiles, and agent wiring.',
  },
  '/terminals': {
    title: 'Terminals',
    description: 'Live shell access with compact mobile controls.',
  },
  '/security': {
    title: 'Security',
    description: 'Exposure checks, alerts, and defensive posture.',
  },
  '/events': {
    title: 'Events',
    description: 'Realtime feed of operational changes and signals.',
  },
  '/actions': {
    title: 'Actions',
    description: 'Triggered operations and command workflow history.',
  },
  '/audit': {
    title: 'Audit',
    description: 'Traceable record of deployments and control actions.',
  },
};

export function getDashboardPageMeta(pathname: string): DashboardPageMeta {
  return (
    DASHBOARD_PAGE_META[pathname] ??
    Object.entries(DASHBOARD_PAGE_META).find(([href]) => href !== '/' && pathname.startsWith(href))?.[1] ??
    DASHBOARD_PAGE_META['/']
  );
}
