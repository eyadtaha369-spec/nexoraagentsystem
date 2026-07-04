import { leadService } from "./leadService";
import { authService } from "./authService";
import type { DashboardStats, Lead } from "@/types/domain";

function computeStats(leads: Lead[], agents: { status: string }[]): DashboardStats {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const monthKey = now.toISOString().slice(0, 7);
  const total = leads.length;
  const won = leads.filter((l) => l.status === "Won").length;
  const conclusive = leads.filter((l) => l.status === "Won" || l.status === "Lost").length;
  return {
    total,
    new: leads.filter((l) => l.status === "New").length,
    contacted: leads.filter((l) => l.status === "Contacted").length,
    followUp: leads.filter((l) => l.status === "Follow Up").length,
    won,
    lost: leads.filter((l) => l.status === "Lost").length,
    today: leads.filter((l) => l.dateAdded.startsWith(todayKey)).length,
    monthly: leads.filter((l) => l.dateAdded.startsWith(monthKey)).length,
    activeAgents: agents.filter((a) => a.status === "Active").length,
    disabledAgents: agents.filter((a) => a.status === "Disabled").length,
    conversionRate: conclusive ? Math.round((won / conclusive) * 1000) / 10 : 0,
  };
}

export const dashboardService = {
  async adminStats(): Promise<DashboardStats> {
    const [leads, agents] = await Promise.all([leadService.list(), authService.listAgents()]);
    return computeStats(leads, agents);
  },
  async agentStats(agentId: string): Promise<DashboardStats> {
    const leads = await leadService.list({ agentId });
    return computeStats(leads, []);
  },
};
