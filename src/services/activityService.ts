import { ACTIONS } from "@/config/api";
import { request } from "./apiClient";
import type { ActivityEvent } from "@/types/domain";

export const activityService = {
  async list(limit = 100): Promise<ActivityEvent[]> {
    return request<ActivityEvent[]>({ action: ACTIONS.activityList, data: { limit } });
  },
  // Retained for API compatibility with callers that used to log locally.
  // The server records activity as a side-effect of leads/agents/auth actions,
  // so this is a no-op on the client.
  log(_type: ActivityEvent["type"], _message: string, _meta?: { leadId?: string; userId?: string }) {
    /* server-side */
  },
};
