import { mockDelay } from "./apiClient";
import { storage } from "./storage";
import type { Lead, LeadPriority, LeadStatus, Note } from "@/types/domain";
import { activityService } from "./activityService";

const KEY = "nexora.leads";
const load = (): Lead[] => storage.get(KEY, []);
const save = (l: Lead[]) => storage.set(KEY, l);

export interface LeadFilters {
  status?: LeadStatus[];
  priority?: LeadPriority[];
  agentId?: string | null;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
export type LeadSort = "newest" | "oldest" | "priority" | "status" | "name";

const PRIO_WEIGHT: Record<LeadPriority, number> = { High: 0, Medium: 1, Low: 2 };

export const leadService = {
  async list(filters?: LeadFilters, sort: LeadSort = "newest"): Promise<Lead[]> {
    let items = load();
    if (filters) {
      if (filters.status?.length) items = items.filter((l) => filters.status!.includes(l.status));
      if (filters.priority?.length) items = items.filter((l) => filters.priority!.includes(l.priority));
      if (filters.agentId !== undefined) items = items.filter((l) => l.assignedAgentId === filters.agentId);
      if (filters.dateFrom) items = items.filter((l) => l.dateAdded >= filters.dateFrom!);
      if (filters.dateTo) items = items.filter((l) => l.dateAdded <= filters.dateTo!);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter((l) =>
          l.clientName.toLowerCase().includes(q) ||
          l.phone.toLowerCase().includes(q) ||
          l.clientId.toLowerCase().includes(q),
        );
      }
    }
    items.sort((a, b) => {
      switch (sort) {
        case "oldest": return a.dateAdded.localeCompare(b.dateAdded);
        case "priority": return PRIO_WEIGHT[a.priority] - PRIO_WEIGHT[b.priority];
        case "status": return a.status.localeCompare(b.status);
        case "name": return a.clientName.localeCompare(b.clientName);
        case "newest":
        default: return b.dateAdded.localeCompare(a.dateAdded);
      }
    });
    return mockDelay(items);
  },

  async get(id: string): Promise<Lead | null> {
    return mockDelay(load().find((l) => l.id === id) ?? null);
  },

  async create(input: Omit<Lead, "id" | "notes" | "timeline" | "dateAdded"> & { dateAdded?: string }): Promise<Lead> {
    await mockDelay(null, 250);
    const lead: Lead = {
      ...input,
      id: crypto.randomUUID(),
      dateAdded: input.dateAdded ?? new Date().toISOString(),
      notes: [],
      timeline: [{
        id: crypto.randomUUID(),
        type: "created",
        message: `Lead created for ${input.clientName}`,
        createdAt: new Date().toISOString(),
      }],
    };
    const list = load();
    list.push(lead);
    save(list);
    activityService.log("created", `New lead created: ${lead.clientName}`, { leadId: lead.id });
    return lead;
  },

  async update(id: string, patch: Partial<Lead>): Promise<Lead> {
    await mockDelay(null, 250);
    const list = load();
    const idx = list.findIndex((l) => l.id === id);
    if (idx < 0) throw new Error("Lead not found.");
    const prev = list[idx];
    const next = { ...prev, ...patch };
    if (patch.status && patch.status !== prev.status) {
      next.timeline = [...next.timeline, {
        id: crypto.randomUUID(),
        type: "status_changed",
        message: `Status changed from ${prev.status} to ${patch.status}`,
        createdAt: new Date().toISOString(),
      }];
      activityService.log("status_changed", `${prev.clientName}: ${prev.status} → ${patch.status}`, { leadId: id });
    }
    list[idx] = next;
    save(list);
    return next;
  },

  async delete(id: string): Promise<void> {
    await mockDelay(null, 250);
    save(load().filter((l) => l.id !== id));
  },

  async addNote(leadId: string, author: string, text: string): Promise<Note> {
    await mockDelay(null, 200);
    const list = load();
    const lead = list.find((l) => l.id === leadId);
    if (!lead) throw new Error("Lead not found.");
    const note: Note = { id: crypto.randomUUID(), author, text, createdAt: new Date().toISOString() };
    lead.notes = [...lead.notes, note];
    lead.timeline = [...lead.timeline, {
      id: crypto.randomUUID(), type: "note_added",
      message: `${author} added a note`, createdAt: note.createdAt,
    }];
    save(list);
    return note;
  },

  async scheduleFollowUp(leadId: string, date: string, note: string) {
    await mockDelay(null, 200);
    const list = load();
    const lead = list.find((l) => l.id === leadId);
    if (!lead) throw new Error("Lead not found.");
    lead.nextFollowUp = date;
    lead.followUpNote = note;
    lead.timeline = [...lead.timeline, {
      id: crypto.randomUUID(), type: "followup_scheduled",
      message: `Follow-up scheduled for ${new Date(date).toLocaleString()}`,
      createdAt: new Date().toISOString(),
    }];
    save(list);
    return lead;
  },

  async assign(leadId: string, agentId: string | null) {
    return this.update(leadId, { assignedAgentId: agentId });
  },

  async roundRobinDistribute(agentIds: string[]): Promise<number> {
    await mockDelay(null, 500);
    if (agentIds.length === 0) return 0;
    const list = load();
    let assigned = 0;
    let i = 0;
    for (const lead of list) {
      if (!lead.assignedAgentId) {
        lead.assignedAgentId = agentIds[i % agentIds.length];
        i++; assigned++;
      }
    }
    save(list);
    activityService.log("assigned", `Round-robin distributed ${assigned} leads.`);
    return assigned;
  },
};
