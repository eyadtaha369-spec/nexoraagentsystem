import { ACTIONS } from "@/config/api";
import { request } from "./apiClient";
import type { Lead, LeadPriority, LeadStatus, Note } from "@/types/domain";

export interface LeadFilters {
  status?: LeadStatus[];
  priority?: LeadPriority[];
  agentId?: string | null;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export type LeadSort = "newest" | "oldest" | "priority" | "status" | "name";

export const leadService = {
  async list(filters?: LeadFilters, sort: LeadSort = "newest"): Promise<Lead[]> {
    return request<Lead[]>({ action: ACTIONS.leadsList, data: { filters, sort } });
  },
  async get(id: string): Promise<Lead | null> {
    return request<Lead | null>({ action: ACTIONS.leadsGet, data: { id } });
  },
  async create(
    input: Omit<Lead, "id" | "notes" | "timeline" | "dateAdded"> & { dateAdded?: string },
  ): Promise<Lead> {
    return request<Lead>({ action: ACTIONS.leadsCreate, data: input });
  },
  async update(id: string, patch: Partial<Lead>): Promise<Lead> {
    return request<Lead>({ action: ACTIONS.leadsUpdate, data: { id, patch } });
  },
  async delete(id: string): Promise<void> {
    await request({ action: ACTIONS.leadsDelete, data: { id } });
  },
  async addNote(leadId: string, author: string, text: string): Promise<Note> {
    return request<Note>({ action: ACTIONS.leadsAddNote, data: { leadId, author, text } });
  },
  async scheduleFollowUp(leadId: string, date: string, note: string): Promise<Lead> {
    return request<Lead>({ action: ACTIONS.leadsScheduleFollowUp, data: { leadId, date, note } });
  },
  async assign(leadId: string, agentId: string | null): Promise<Lead> {
    return request<Lead>({ action: ACTIONS.leadsAssign, data: { leadId, agentId } });
  },
  async roundRobinDistribute(agentIds: string[]): Promise<number> {
    const res = await request<{ assigned: number }>({
      action: ACTIONS.leadsRoundRobin,
      data: { agentIds },
    });
    return res.assigned;
  },
  async bulkDelete(ids: string[]): Promise<number> {
    const res = await request<{ deleted: number }>({
      action: ACTIONS.leadsBulkDelete, data: { ids },
    });
    return res.deleted;
  },
};
