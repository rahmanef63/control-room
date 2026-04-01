import { makeFunctionReference } from 'convex/server';
import type { FunctionReference } from 'convex/server';

import type {
  AgentStatus,
  AlertRecord,
  AppStatus,
  AuditRecord,
  CommandRecord,
  EventRecord,
  OverviewData,
} from '@/shared/types/contracts';
import type {
  EnqueueCommandInput,
  PaginatedQueryResult,
} from '@/shared/convex/contracts';

type NoArgs = Record<string, never>;
type ConvexArgs<T extends object> = T & Record<string, unknown>;

interface PaginationArgs {
  paginationOpts: {
    cursor: string | null;
    numItems: number;
  };
}

interface ListEventsArgs extends PaginationArgs {
  type?: string;
  severity?: EventRecord['severity'];
}

interface ListAuditLogsArgs extends PaginationArgs {
  target?: string;
  action?: string;
}

type ListCommandsArgs = PaginationArgs;

interface FrontendApi {
  snapshots: {
    getOverview: FunctionReference<'query', 'public', NoArgs, OverviewData>;
  };
  appStatus: {
    listApps: FunctionReference<'query', 'public', NoArgs, AppStatus[]>;
  };
  alerts: {
    listActiveAlerts: FunctionReference<'query', 'public', NoArgs, AlertRecord[]>;
  };
  events: {
    listEvents: FunctionReference<'query', 'public', ConvexArgs<ListEventsArgs>, PaginatedQueryResult<EventRecord>>;
  };
  audit: {
    listAuditLogs: FunctionReference<'query', 'public', ConvexArgs<ListAuditLogsArgs>, PaginatedQueryResult<AuditRecord>>;
  };
  commands: {
    listCommands: FunctionReference<'query', 'public', ConvexArgs<ListCommandsArgs>, PaginatedQueryResult<CommandRecord>>;
    enqueueCommand: FunctionReference<'mutation', 'public', ConvexArgs<EnqueueCommandInput>, string>;
  };
  agentStatus: {
    listAgents: FunctionReference<'query', 'public', NoArgs, AgentStatus[]>;
  };
}

export const api: FrontendApi = {
  snapshots: {
    getOverview: makeFunctionReference('snapshots:getOverview'),
  },
  appStatus: {
    listApps: makeFunctionReference('appStatus:listApps'),
  },
  alerts: {
    listActiveAlerts: makeFunctionReference('alerts:listActiveAlerts'),
  },
  events: {
    listEvents: makeFunctionReference('events:listEvents'),
  },
  audit: {
    listAuditLogs: makeFunctionReference('audit:listAuditLogs'),
  },
  commands: {
    listCommands: makeFunctionReference('commands:listCommands'),
    enqueueCommand: makeFunctionReference('commands:enqueueCommand'),
  },
  agentStatus: {
    listAgents: makeFunctionReference('agentStatus:listAgents'),
  },
};

export const internal = {};
export const components = {};
