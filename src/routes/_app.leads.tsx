import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listLeads, getMe, listAgents, updateLead, reassignLead, deleteLead, createLead } from "@/lib/crm.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Phone, MessageCircle, Map, Instagram, Facebook, Trash2, Plus, Search, UserCog } from "lucide-react";

export const Route = createFileRoute("/_app/leads")({
  head: () => ({ meta: [{ title: "Leads — Nexora CRM" }] }),
  component: LeadsPage,
});

const STATUSES = ["New", "Contacted", "Interested", "Won", "Lost"] as const;
type Status = typeof STATUSES[number];

const statusStyle: Record<Status, string> = {
  New: "bg-brand-blue/20 text-brand-blue border-brand-blue/30",
  Contacted: "bg-brand-teal/20 text-brand-teal border-brand-teal/30",
  Interested: "bg-brand-purple/20 text-brand-purple border-brand-purple/30",
  Won: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Lost: "bg-destructive/20 text-destructive border-destructive/30",
};

function LeadsPage() {
  const meFn = useServerFn(getMe);
  const listFn = useServerFn(listLeads);
  const agentsFn = useServerFn(listAgents);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => listFn() });
  const { data: agents } = useQuery({ queryKey: ["agents"], queryFn: () => agentsFn(), enabled: !!me?.roles.includes("owner") });

  const isOwner = me?.roles.includes("owner");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [agent, setAgent] = useState<string>("all");

  const filtered = useMemo(() => {
    return leads.filter((l: any) => {
      if (status !== "all" && l.status !== status) return false;
      if (agent !== "all" && l.assigned_agent !== agent) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!(`${l.client_name} ${l.phone} ${l.client_id}`).toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [leads, q, status, agent]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Pipeline</p>
          <h1 className="text-3xl md:text-4xl font-semibold mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {isOwner ? "All leads" : "My leads"}
          </h1>
        </div>
        {isOwner && <NewLeadDialog agents={agents} />}
      </header>

      {/* Filters */}
      <div className="glass-card p-3 flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone, or client ID" className="pl-9 bg-transparent" />
        </div>
        <Select value={status} onValueChange={v => setStatus(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {isOwner && agents && (
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Agent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.agentTabs.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-10 text-center text-muted-foreground">
          {leads.length === 0
            ? isOwner
              ? "No leads yet. Click 'Sync from Google Sheet' on the dashboard to import."
              : "You don't have any leads assigned yet. Ask your Owner to assign you."
            : "No leads match those filters."}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((l: any) => (
          <LeadCard key={l.id} lead={l} isOwner={!!isOwner} agents={agents?.agentTabs || []} />
        ))}
      </div>
    </div>
  );
}

function LeadCard({ lead, isOwner, agents }: { lead: any; isOwner: boolean; agents: readonly string[] }) {
  const updateFn = useServerFn(updateLead);
  const reassignFn = useServerFn(reassignLead);
  const deleteFn = useServerFn(deleteLead);
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<Status>(lead.status);
  const [notes, setNotes] = useState<string>(lead.notes || "");
  const [saving, setSaving] = useState(false);

  const dirty = status !== lead.status || (notes || "") !== (lead.notes || "");

  async function save() {
    setSaving(true);
    try {
      await updateFn({ data: { id: lead.id, status, notes } });
      toast.success("Saved & synced to Sheet");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
    finally { setSaving(false); }
  }

  async function onReassign(v: string) {
    try {
      await reassignFn({ data: { id: lead.id, newAgent: v } });
      toast.success(`Reassigned to ${v}`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (e: any) { toast.error(e?.message || "Reassign failed"); }
  }

  async function onDelete() {
    if (!confirm(`Delete lead ${lead.client_id}?`)) return;
    try {
      await deleteFn({ data: { id: lead.id } });
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (e: any) { toast.error(e?.message || "Delete failed"); }
  }

  const phoneClean = (lead.phone || "").replace(/[^\d+]/g, "");
  const waLink = phoneClean ? `https://wa.me/${phoneClean.replace(/^\+/, "")}` : "";
  const telLink = phoneClean ? `tel:${phoneClean}` : "";

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{lead.client_id}</div>
          <div className="text-lg font-semibold truncate">{lead.client_name || "Unnamed lead"}</div>
          <div className="text-sm text-muted-foreground truncate">{lead.phone || "No phone"}</div>
        </div>
        <Badge className={`border ${statusStyle[status]}`} variant="outline">{status}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {telLink && <a href={telLink} className="inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2.5 py-1.5 text-xs hover:bg-accent"><Phone className="h-3.5 w-3.5"/>Call</a>}
        {waLink && <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 text-emerald-300 px-2.5 py-1.5 text-xs hover:bg-emerald-500/30"><MessageCircle className="h-3.5 w-3.5"/>WhatsApp</a>}
        {lead.maps_link && <a href={lead.maps_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2.5 py-1.5 text-xs hover:bg-accent"><Map className="h-3.5 w-3.5"/>Maps</a>}
        {lead.instagram_link && <a href={lead.instagram_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2.5 py-1.5 text-xs hover:bg-accent"><Instagram className="h-3.5 w-3.5"/>IG</a>}
        {lead.facebook_link && <a href={lead.facebook_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2.5 py-1.5 text-xs hover:bg-accent"><Facebook className="h-3.5 w-3.5"/>FB</a>}
      </div>

      <div className="grid gap-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
        <Select value={status} onValueChange={v => setStatus(v as Status)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add call notes, next step, objection…" />
      </div>

      {isOwner && (
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><UserCog className="h-3 w-3"/>Assigned agent</Label>
          <Select value={lead.assigned_agent} onValueChange={onReassign}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{agents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="text-[10px] text-muted-foreground">
          Added {lead.date_added ? new Date(lead.date_added).toLocaleDateString() : "—"}
          {isOwner && <> · {lead.assigned_agent}</>}
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></Button>
          )}
          <Button size="sm" disabled={!dirty || saving} onClick={save} className="btn-brand hover:btn-brand-hover border-0 disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewLeadDialog({ agents }: { agents: any }) {
  const createFn = useServerFn(createLead);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assigned, setAssigned] = useState<string>(agents?.agentTabs?.[0] || "");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await createFn({ data: {
        clientName: String(fd.get("clientName") || ""),
        phone: String(fd.get("phone") || ""),
        mapsLink: String(fd.get("mapsLink") || ""),
        instagramLink: String(fd.get("instagramLink") || ""),
        facebookLink: String(fd.get("facebookLink") || ""),
        notes: String(fd.get("notes") || ""),
        assignedAgent: assigned,
      }});
      toast.success("Lead created & pushed to Sheet");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
    } catch (e: any) { toast.error(e?.message || "Create failed"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-brand hover:btn-brand-hover border-0 gap-2"><Plus className="h-4 w-4"/>New lead</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create new lead</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2"><Label>Client name</Label><Input name="clientName" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Phone</Label><Input name="phone" placeholder="+20…" /></div>
            <div className="grid gap-2">
              <Label>Assigned agent</Label>
              <Select value={assigned} onValueChange={setAssigned}>
                <SelectTrigger><SelectValue placeholder="Choose"/></SelectTrigger>
                <SelectContent>{agents?.agentTabs?.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2"><Label>Google Maps link</Label><Input name="mapsLink" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Instagram</Label><Input name="instagramLink" /></div>
            <div className="grid gap-2"><Label>Facebook</Label><Input name="facebookLink" /></div>
          </div>
          <div className="grid gap-2"><Label>Notes</Label><Textarea name="notes" rows={2}/></div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !assigned} className="btn-brand hover:btn-brand-hover border-0">
              {busy ? "Creating…" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
