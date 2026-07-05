import { ACTIONS } from "@/config/api";
import { request } from "./apiClient";
import type { DashboardStats } from "@/types/domain";

export const dashboardService = {
  async adminStats(): Promise<DashboardStats> {
    return request<DashboardStats>({ action: ACTIONS.dashboardAdmin });
  },
  async agentStats(agentId: string): Promise<DashboardStats> {
    return request<DashboardStats>({ action: ACTIONS.dashboardAgent, data: { agentId } });
  },
};
