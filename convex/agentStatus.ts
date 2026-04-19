import { mutation, query } from "./_generated/server";
import { agentStatusFields } from "./lib/validators";
import {
  listAgentsHandler,
  upsertAgentStatusHandler,
} from "./domains/agent-status";

export const upsertAgentStatus = mutation({
  args: {
    ...agentStatusFields,
  },
  handler: upsertAgentStatusHandler,
});

export const listAgents = query({
  args: {},
  handler: listAgentsHandler,
});
