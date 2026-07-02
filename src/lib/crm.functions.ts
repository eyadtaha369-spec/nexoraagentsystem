import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["New", "Contacted", "Interested", "Won", "Lost"] as const;

// URL fields must be http/https only (or empty) to prevent javascript: / data: XSS via anchor hrefs.
const safeUrl = z.string().trim().max(500).refine(
  (v) => v === "" || /^https?:\/\//i.test(v),
  { message: "URL must start with http:// or https://" },
);
function sanitizeUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = String(v).trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : null;
}

async function assertOwner(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data || []).map((r: any) => r.role);
  if (!roles.includes("owner")) throw new Error("Forbidden: owner only");
}

// -----------------------------------------------------------
// Read current user + role + assigned tab
// -----------------------------------------------------------
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile,
      roles: (roles || []).map((r: any) => r.role as "owner" | "agent"),
    };
  });

// -----------------------------------------------------------
// List leads (RLS enforces owner/agent visibility)
// -----------------------------------------------------------
export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("*")
      .order("date_added", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

// -----------------------------------------------------------
// List agents (owner view)
// -----------------------------------------------------------
export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { AGENT_TABS } = await import("./sheets.server");
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, sheet_tab_name, created_at");
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    return {
      agentTabs: AGENT_TABS,
      profiles: profiles ?? [],
      roles: roles ?? [],
    };
  });

// -----------------------------------------------------------
// Update lead status/notes → writes back to Google Sheet
// -----------------------------------------------------------
export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; notes: string }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(STATUSES),
      notes: z.string().max(4000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS ensures the caller can only update leads they own (agent) or all (owner)
    const { data: updated, error } = await supabase
      .from("leads")
      .update({ status: data.status, notes: data.notes })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;

    // Write back to sheet
    if (updated?.sheet_row && updated?.assigned_agent) {
      const { updateLeadRow, AGENT_TABS } = await import("./sheets.server");
      if ((AGENT_TABS as readonly string[]).includes(updated.assigned_agent)) {
        try {
          await updateLeadRow(updated.assigned_agent as any, updated.sheet_row, data.status, data.notes);
        } catch (e) {
          console.error("Sheet writeback failed", e);
        }
      }
    }
    return updated;
  });

// -----------------------------------------------------------
// Reassign lead (owner only) → moves row between sheet tabs
// -----------------------------------------------------------
export const reassignLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; newAgent: string }) =>
    z.object({ id: z.string().uuid(), newAgent: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { AGENT_TABS, clearLeadRow, appendLeadRow } = await import("./sheets.server");
    if (!(AGENT_TABS as readonly string[]).includes(data.newAgent)) {
      throw new Error(`Unknown agent tab: ${data.newAgent}`);
    }
    const { supabase } = context;
    const { data: lead, error: e1 } = await supabase.from("leads").select("*").eq("id", data.id).single();
    if (e1 || !lead) throw new Error("Lead not found");
    if (lead.assigned_agent === data.newAgent) return lead;

    // Move in sheet
    let newRow = 0;
    try {
      newRow = await appendLeadRow(data.newAgent as any, {
        clientId: lead.client_id,
        clientName: lead.client_name ?? "",
        phone: lead.phone ?? "",
        mapsLink: lead.maps_link ?? "",
        instagramLink: lead.instagram_link ?? "",
        facebookLink: lead.facebook_link ?? "",
        status: lead.status,
        notes: lead.notes ?? "",
        dateAdded: lead.date_added ? new Date(lead.date_added).toISOString().replace("T", " ").slice(0, 16) : "",
      });
      if (lead.sheet_row) await clearLeadRow(lead.assigned_agent as any, lead.sheet_row);
    } catch (e) {
      console.error("Sheet move failed", e);
    }

    const { data: updated, error: e2 } = await supabase
      .from("leads")
      .update({ assigned_agent: data.newAgent, sheet_row: newRow || null })
      .eq("id", data.id)
      .select()
      .single();
    if (e2) throw e2;
    return updated;
  });

// -----------------------------------------------------------
// Sync from Google Sheet (owner only)
// -----------------------------------------------------------
export const syncFromSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { readAllTabs } = await import("./sheets.server");
    const rows = await readAllTabs();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let upserts = 0;
    for (const r of rows) {
      const { error } = await supabaseAdmin.from("leads").upsert(
        {
          client_id: r.clientId,
          client_name: r.clientName || null,
          phone: r.phone || null,
          maps_link: r.mapsLink || null,
          instagram_link: r.instagramLink || null,
          facebook_link: r.facebookLink || null,
          status: r.status || "New",
          notes: r.notes || null,
          date_added: r.dateAdded ? new Date(r.dateAdded).toISOString() : new Date().toISOString(),
          assigned_agent: r.assignedAgent,
          sheet_row: r.sheetRow,
        },
        { onConflict: "assigned_agent,client_id" },
      );
      if (!error) upserts++;
      else console.error("upsert failed", r.clientId, error);
    }
    return { imported: upserts, total: rows.length };
  });

// -----------------------------------------------------------
// Create new lead (owner only) → also appends to Sheet
// -----------------------------------------------------------
export const createLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    clientName: string; phone: string; mapsLink: string; instagramLink: string; facebookLink: string;
    assignedAgent: string; notes: string;
  }) =>
    z.object({
      clientName: z.string().max(200),
      phone: z.string().max(50),
      mapsLink: z.string().max(500),
      instagramLink: z.string().max(500),
      facebookLink: z.string().max(500),
      assignedAgent: z.string(),
      notes: z.string().max(4000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { AGENT_TABS, appendLeadRow } = await import("./sheets.server");
    if (!(AGENT_TABS as readonly string[]).includes(data.assignedAgent)) throw new Error("Unknown agent tab");

    // Compute next client id for this tab
    const { data: existing } = await context.supabase
      .from("leads")
      .select("client_id")
      .eq("assigned_agent", data.assignedAgent);
    const maxNum = (existing ?? []).reduce((m: number, row: any) => {
      const n = parseInt(String(row.client_id).replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    const nextId = `CL-${String(maxNum + 1).padStart(4, "0")}`;
    const dateAdded = new Date();
    const dateStr = dateAdded.toISOString().replace("T", " ").slice(0, 16);

    let sheetRow = 0;
    try {
      sheetRow = await appendLeadRow(data.assignedAgent as any, {
        clientId: nextId,
        clientName: data.clientName,
        phone: data.phone,
        mapsLink: data.mapsLink,
        instagramLink: data.instagramLink,
        facebookLink: data.facebookLink,
        status: "New",
        notes: data.notes,
        dateAdded: dateStr,
      });
    } catch (e) { console.error("append failed", e); }

    const { data: inserted, error } = await context.supabase.from("leads").insert({
      client_id: nextId,
      client_name: data.clientName,
      phone: data.phone,
      maps_link: data.mapsLink,
      instagram_link: data.instagramLink,
      facebook_link: data.facebookLink,
      status: "New",
      notes: data.notes,
      date_added: dateAdded.toISOString(),
      assigned_agent: data.assignedAgent,
      sheet_row: sheetRow || null,
    }).select().single();
    if (error) throw error;
    return inserted;
  });

// -----------------------------------------------------------
// Delete lead (owner only) → also clears the Sheet row
// -----------------------------------------------------------
export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { data: lead } = await context.supabase.from("leads").select("*").eq("id", data.id).single();
    if (lead?.sheet_row && lead?.assigned_agent) {
      const { AGENT_TABS, clearLeadRow } = await import("./sheets.server");
      if ((AGENT_TABS as readonly string[]).includes(lead.assigned_agent)) {
        try { await clearLeadRow(lead.assigned_agent as any, lead.sheet_row); } catch (e) { console.error(e); }
      }
    }
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -----------------------------------------------------------
// Assign a user to an agent tab (owner only)
// -----------------------------------------------------------
export const assignAgentTab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; tab: string | null }) =>
    z.object({ userId: z.string().uuid(), tab: z.string().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { AGENT_TABS } = await import("./sheets.server");
    if (data.tab !== null && !(AGENT_TABS as readonly string[]).includes(data.tab)) throw new Error("Unknown tab");
    const { error } = await context.supabase.from("profiles").update({ sheet_tab_name: data.tab }).eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

// -----------------------------------------------------------
// Change user role (owner only)
// -----------------------------------------------------------
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "owner" | "agent" }) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["owner", "agent"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    return { ok: true };
  });
