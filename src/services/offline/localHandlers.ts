// Re-implements the Google Apps Script action handlers against the local
// IndexedDB cache, so leads.list/create/update/etc. keep working with no
// internet connection. Mirrors apps-script/Code.gs logic 1:1 where it matters
// (filtering, sorting, stat computation) so behavior doesn't drift offline vs online.
import { ACTIONS } from "@/config/api";
import { ApiError } from "../apiClient";
import { session } from "../session";
import {
  leadsCache,
  agentsCache,
  notificationsCache,
  activityCache,
  settingsCache,
  syncQueue,
} from "./db";
import type {
  Lead,
  User,
  DashboardStats,
  ActivityEvent,
  SystemSettings,
} from "@/types/domain";

function uuid(): string {
  return crypto.randomUUID();
}
function nowIso(): string {
  return new Date().toISOString();
}

function currentUser() {
  const s = session.get();
  if (!s) throw new ApiError("UNAUTHORIZED", "Not signed in (offline)");
  return s;
}

function computeStats(leads: Lead[], agents: User[]): DashboardStats {
  const todayKey = nowIso().slice(0, 10);
  const monthKey = nowIso().slice(0, 7);
  const won = leads.filter((l) => l.status === "Won").length;
  const conclusive = leads.filter((l) => l.status === "Won" || l.status === "Lost").length;
  return {
    total: leads.length,
    new: leads.filter((l) => l.status === "New").length,
    contacted: leads.filter((l) => l.status === "Contacted").length,
    followUp: leads.filter((l) => l.status === "Follow Up").length,
    won,
    lost: leads.filter((l) => l.status === "Lost").length,
    today: leads.filter((l) => String(l.dateAdded).slice(0, 10) === todayKey).length,
    monthly: leads.filter((l) => String(l.dateAdded).slice(0, 7) === monthKey).length,
    activeAgents: agents.filter((a) => a.status === "Active").length,
    disabledAgents: agents.filter((a) => a.status === "Disabled").length,
    conversionRate: conclusive ? Math.round((won / conclusive) * 1000) / 10 : 0,
  };
}

async function logActivity(userId: string, type: ActivityEvent["type"], message: string, leadId?: string) {
  const event: ActivityEvent = { id: uuid(), type, message, leadId, userId, createdAt: nowIso() };
  await activityCache.put(event);
  return event;
}

async function pushNotification(userId: string, title: string, body: string, type: "info" | "success" | "warning" | "error") {
  await notificationsCache.put({ id: uuid(), title, body, type, read: false, createdAt: nowIso() });
}

async function queueMutation(action: string, payload: unknown) {
  await syncQueue.push({ action, payload, createdAt: nowIso() });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (payload: any) => Promise<unknown>;

export const localHandlers: Record<string, Handler> = {
  // ---------------- Leads ----------------
  async [ACTIONS.leadsList](p) {
    const me = currentUser();
    let leads = await leadsCache.all();
    if (me.role !== "admin") leads = leads.filter((l) => l.assignedAgentId === me.userId);
    const f = p?.filters ?? {};
    if (f.status?.length) leads = leads.filter((l) => f.status.includes(l.status));
    if (f.priority?.length) leads = leads.filter((l) => f.priority.includes(l.priority));
    if (f.agentId !== undefined && me.role === "admin") leads = leads.filter((l) => l.assignedAgentId === f.agentId);
    if (f.dateFrom) leads = leads.filter((l) => l.dateAdded >= f.dateFrom);
    if (f.dateTo) leads = leads.filter((l) => l.dateAdded <= f.dateTo);
    if (f.search) {
      const q = String(f.search).toLowerCase();
      leads = leads.filter(
        (l) =>
          l.clientName?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.clientId?.toLowerCase().includes(q),
      );
    }
    const sort = p?.sort ?? "newest";
    const W: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    leads = [...leads].sort((a, b) => {
      if (sort === "oldest") return String(a.dateAdded).localeCompare(String(b.dateAdded));
      if (sort === "priority") return (W[a.priority] ?? 9) - (W[b.priority] ?? 9);
      if (sort === "status") return String(a.status).localeCompare(String(b.status));
      if (sort === "name") return String(a.clientName).localeCompare(String(b.clientName));
      return String(b.dateAdded).localeCompare(String(a.dateAdded));
    });
    return leads;
  },

  async [ACTIONS.leadsGet](p) {
    const me = currentUser();
    const lead = (await leadsCache.all()).find((l) => l.id === p.id) ?? null;
    if (!lead) return null;
    if (me.role !== "admin" && lead.assignedAgentId !== me.userId) throw new ApiError("FORBIDDEN", "Not your lead.");
    return lead;
  },

  async [ACTIONS.leadsCreate](p) {
    const me = currentUser();
    const lead: Lead = {
      id: uuid(),
      clientId: p.clientId || `C-${Date.now()}`,
      clientName: p.clientName,
      phone: p.phone || "",
      mapsLink: p.mapsLink || "",
      instagram: p.instagram || "",
      facebook: p.facebook || "",
      source: p.source || "",
      status: p.status || "New",
      priority: p.priority || "Medium",
      assignedAgentId: p.assignedAgentId || (me.role === "agent" ? me.userId : null),
      dateAdded: p.dateAdded || nowIso(),
      nextFollowUp: p.nextFollowUp || null,
      followUpNote: p.followUpNote || "",
      notes: [],
      timeline: [{ id: uuid(), type: "created", message: `Lead created for ${p.clientName}`, createdAt: nowIso(), leadId: "" }],
    };
    lead.timeline[0].leadId = lead.id;
    await leadsCache.put(lead);
    await logActivity(me.userId, "created", `New lead: ${lead.clientName}`, lead.id);
    if (lead.assignedAgentId && lead.assignedAgentId !== me.userId) {
      await pushNotification(lead.assignedAgentId, "New lead assigned", lead.clientName, "info");
    }
    await queueMutation(ACTIONS.leadsCreate, { ...p, id: lead.id });
    return lead;
  },

  async [ACTIONS.leadsUpdate](p) {
    const me = currentUser();
    const leads = await leadsCache.all();
    const current = leads.find((l) => l.id === p.id);
    if (!current) throw new ApiError("NOT_FOUND", "Lead not found.");
    if (me.role !== "admin" && current.assignedAgentId !== me.userId) throw new ApiError("FORBIDDEN", "Forbidden.");
    const next: Lead = { ...current, ...p.patch };
    if (p.patch.status && p.patch.status !== current.status) {
      next.timeline = [
        ...current.timeline,
        { id: uuid(), leadId: p.id, type: "status_changed", message: `Status: ${current.status} → ${p.patch.status}`, createdAt: nowIso() },
      ];
      await logActivity(me.userId, "status_changed", `${current.clientName}: ${current.status} → ${p.patch.status}`, p.id);
    }
    if (p.patch.assignedAgentId && p.patch.assignedAgentId !== current.assignedAgentId) {
      next.timeline = [...next.timeline, { id: uuid(), leadId: p.id, type: "assigned", message: "Reassigned", createdAt: nowIso() }];
      await logActivity(me.userId, "assigned", `Reassigned: ${current.clientName}`, p.id);
      await pushNotification(p.patch.assignedAgentId, "Lead assigned", current.clientName, "info");
    }
    await leadsCache.put(next);
    await queueMutation(ACTIONS.leadsUpdate, p);
    return next;
  },

  async [ACTIONS.leadsDelete](p) {
    const me = currentUser();
    if (me.role !== "admin") throw new ApiError("FORBIDDEN", "Admins only.");
    await leadsCache.delete(p.id);
    await logActivity(me.userId, "created", `Lead deleted: ${p.id}`, p.id);
    await queueMutation(ACTIONS.leadsDelete, p);
    return { ok: true };
  },

  async [ACTIONS.leadsBulkDelete](p) {
    const me = currentUser();
    if (me.role !== "admin") throw new ApiError("FORBIDDEN", "Admins only.");
    for (const id of p.ids || []) await leadsCache.delete(id);
    await queueMutation(ACTIONS.leadsBulkDelete, p);
    return { deleted: (p.ids || []).length };
  },

  async [ACTIONS.leadsAddNote](p) {
    const me = currentUser();
    const leads = await leadsCache.all();
    const lead = leads.find((l) => l.id === p.leadId);
    if (!lead) throw new ApiError("NOT_FOUND", "Lead not found.");
    if (me.role !== "admin" && lead.assignedAgentId !== me.userId) throw new ApiError("FORBIDDEN", "Forbidden.");
    const note = { id: uuid(), author: p.author || me.fullName, text: p.text, createdAt: nowIso() };
    const next: Lead = {
      ...lead,
      notes: [...lead.notes, note],
      timeline: [...lead.timeline, { id: uuid(), leadId: p.leadId, type: "note_added", message: `${note.author} added a note`, createdAt: note.createdAt }],
    };
    await leadsCache.put(next);
    await queueMutation(ACTIONS.leadsAddNote, p);
    return note;
  },

  async [ACTIONS.leadsScheduleFollowUp](p) {
    const me = currentUser();
    const leads = await leadsCache.all();
    const current = leads.find((l) => l.id === p.leadId);
    if (!current) throw new ApiError("NOT_FOUND", "Lead not found.");
    const next: Lead = {
      ...current,
      nextFollowUp: p.date,
      followUpNote: p.note,
      timeline: [...current.timeline, { id: uuid(), leadId: p.leadId, type: "followup_scheduled", message: `Follow-up scheduled for ${p.date}`, createdAt: nowIso() }],
    };
    await leadsCache.put(next);
    await logActivity(me.userId, "followup_scheduled", `Follow-up: ${next.clientName}`, p.leadId);
    await queueMutation(ACTIONS.leadsScheduleFollowUp, p);
    return next;
  },

  async [ACTIONS.leadsAssign](p) {
    const me = currentUser();
    if (me.role !== "admin") throw new ApiError("FORBIDDEN", "Admins only.");
    const leads = await leadsCache.all();
    const current = leads.find((l) => l.id === p.leadId);
    if (!current) throw new ApiError("NOT_FOUND", "Lead not found.");
    const next: Lead = {
      ...current,
      assignedAgentId: p.agentId || null,
      timeline: [...current.timeline, { id: uuid(), leadId: p.leadId, type: "assigned", message: `Assigned to ${p.agentId || "unassigned"}`, createdAt: nowIso() }],
    };
    await leadsCache.put(next);
    if (p.agentId) await pushNotification(p.agentId, "Lead assigned", next.clientName, "info");
    await queueMutation(ACTIONS.leadsAssign, p);
    return next;
  },

  async [ACTIONS.leadsRoundRobin](p) {
    const me = currentUser();
    if (me.role !== "admin") throw new ApiError("FORBIDDEN", "Admins only.");
    const agentIds: string[] = p.agentIds || [];
    if (!agentIds.length) return { assigned: 0 };
    const leads = await leadsCache.all();
    let assigned = 0;
    let i = 0;
    for (const lead of leads) {
      if (!lead.assignedAgentId) {
        const agentId = agentIds[i % agentIds.length];
        await leadsCache.put({ ...lead, assignedAgentId: agentId });
        i++;
        assigned++;
      }
    }
    await logActivity(me.userId, "assigned", `Round-robin distributed ${assigned} leads.`);
    await queueMutation(ACTIONS.leadsRoundRobin, p);
    return { assigned };
  },

  // ---------------- Dashboard (computed from cache — refreshes fully once back online) ----------------
  async [ACTIONS.dashboardAdmin]() {
    const me = currentUser();
    if (me.role !== "admin") throw new ApiError("FORBIDDEN", "Admins only.");
    return computeStats(await leadsCache.all(), await agentsCache.all());
  },
  async [ACTIONS.dashboardAgent](p) {
    const me = currentUser();
    const agentId = me.role === "admin" ? p?.agentId || me.userId : me.userId;
    const mine = (await leadsCache.all()).filter((l) => l.assignedAgentId === agentId);
    return computeStats(mine, []);
  },

  // ---------------- Agents (read-only offline; edits require connection) ----------------
  async [ACTIONS.agentsList]() {
    return agentsCache.all();
  },

  // ---------------- Activity ----------------
  async [ACTIONS.activityList](p) {
    const me = currentUser();
    let items = await activityCache.all();
    if (me.role !== "admin") items = items.filter((a) => a.userId === me.userId);
    items = [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return items.slice(0, Math.min(500, p?.limit || 100));
  },

  // ---------------- Notifications ----------------
  async [ACTIONS.notificationsList]() {
    const items = await notificationsCache.all();
    return [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200);
  },
  async [ACTIONS.notificationsUnread]() {
    const items = await notificationsCache.all();
    return { count: items.filter((n) => !n.read).length };
  },
  async [ACTIONS.notificationsMarkRead](p) {
    const items = await notificationsCache.all();
    const n = items.find((x) => x.id === p.id);
    if (n) await notificationsCache.put({ ...n, read: true });
    await queueMutation(ACTIONS.notificationsMarkRead, p);
    return { ok: true };
  },
  async [ACTIONS.notificationsMarkAllRead]() {
    const items = await notificationsCache.all();
    for (const n of items) if (!n.read) await notificationsCache.put({ ...n, read: true });
    await queueMutation(ACTIONS.notificationsMarkAllRead, {});
    return { ok: true };
  },

  // ---------------- Settings (read-only offline) ----------------
  async [ACTIONS.settingsGet]() {
    const s = await settingsCache.get();
    if (!s) throw new ApiError("NOT_CONFIGURED", "Settings not cached yet — connect once online first.");
    return s as SystemSettings;
  },
};

export function hasLocalHandler(action: string): boolean {
  return action in localHandlers;
}

export async function runLocalHandler<T>(action: string, payload: unknown): Promise<T> {
  const fn = localHandlers[action];
  if (!fn) throw new ApiError("OFFLINE_UNSUPPORTED", `"${action}" needs an internet connection.`);
  return fn(payload) as Promise<T>;
}
