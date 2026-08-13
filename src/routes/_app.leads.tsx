import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { leadService, type LeadFilters, type LeadSort } from "@/services/leadService";
import { authService } from "@/services/authService";
import { callViaGoogleVoice } from "@/lib/googleVoice";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { StatusBadge, PriorityBadge } from "@/components/common/Badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import type { Lead, LeadPriority, LeadStatus, User } from "@/types/domain";
import { Copy, Eye, MapPin, MessageSquare, Phone, Plus, Facebook, Instagram, Loader2, Trash2, Pencil } from "lucide-react";

interface LeadsSearch {
  page?: number;
}

export const Route = createFileRoute("/_app/leads")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): LeadsSearch => ({
    page: search.page ? Number(search.page) || 1 : undefined,
  }),
  head: () => ({ meta: [{ title: "Leads — Nexora CRM" }] }),
  component: LeadsPage,
});

const PAGE_SIZE = 20;

const STATUSES: LeadStatus[] = ["New","Contacted","Interested","Follow Up","Won","Lost","No Answer","Wrong Number"];
const PRIORITIES: LeadPriority[] = ["High","Medium","Low"];

const EMPTY_FORM = {
  clientName: "", phone: "", mapsLink: "", instagram: "", facebook: "",
  status: "New" as LeadStatus, priority: "Medium" as LeadPriority,
  source: "", assignedAgentId: "" as string,
};

function LeadsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const search = Route.useSearch();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search_, setSearch_] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [prioFilter, setPrioFilter] = useState<LeadPriority | "all">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sort, setSort] = useState<LeadSort>("newest");
  const page = search.page ?? 1;
  const debounced = useDebounce(search_, 250);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function setPage(p: number) {
    nav({ to: "/leads", search: (prev) => ({ ...prev, page: p }), replace: true });
  }

  async function load() {
    if (!user) return;
    setLoading(true);
    const filters: LeadFilters = {
      status: statusFilter === "all" ? undefined : [statusFilter],
      priority: prioFilter === "all" ? undefined : [prioFilter],
      agentId: user.role === "admin" ? (agentFilter === "all" ? undefined : agentFilter) : user.id,
      search: debounced || undefined,
    };
    const [l, a] = await Promise.all([
      leadService.list(filters, sort),
      user.role === "admin" ? authService.listAgents() : Promise.resolve<User[]>([]),
    ]);
    setLeads(l); setAgents(a);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user, debounced, statusFilter, prioFilter, agentFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  // If the current page becomes out of range (e.g. after deleting the last item on it), snap back.
  // Only do this once loading has finished — otherwise the momentary empty list during
  // load() would incorrectly force the page back to 1 before data arrives.
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    if (!loading && page !== safePage) setPage(safePage);
  }, [loading, page, safePage]);

  const pageLeads = useMemo(() => leads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [leads, safePage]);
  const agentName = (id: string | null) => id ? (agents.find((a) => a.id === id)?.fullName ?? (user?.id === id ? user?.fullName : "—")) : "Unassigned";

  async function copyPhone(phone: string) {
    await navigator.clipboard.writeText(phone);
    toast.success("Phone copied");
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(l: Lead, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(l.id);
    setForm({
      clientName: l.clientName, phone: l.phone,
      mapsLink: l.mapsLink || "", instagram: l.instagram || "", facebook: l.facebook || "",
      status: l.status, priority: l.priority,
      source: l.source || "", assignedAgentId: l.assignedAgentId || "",
    });
    setModalOpen(true);
  }

  async function handleDelete(l: Lead, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${l.clientName}"? This can't be undone.`)) return;
    setDeletingId(l.id);
    try {
      await leadService.delete(l.id);
      toast.success("Lead deleted");
      setLeads((prev) => prev.filter((x) => x.id !== l.id));
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete lead.");
    } finally {
      setDeletingId(null);
    }
  }

  async function submitLead() {
    if (!form.clientName.trim() || !form.phone.trim()) {
      toast.error("Client name and phone are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const wasLost = form.status === "Lost";
        await leadService.update(editingId, {
          clientName: form.clientName.trim(),
          phone: form.phone.trim(),
          mapsLink: form.mapsLink.trim() || undefined,
          instagram: form.instagram.trim() || undefined,
          facebook: form.facebook.trim() || undefined,
          status: form.status,
          priority: form.priority,
          source: form.source.trim() || undefined,
          assignedAgentId: form.assignedAgentId || null,
        } as any);
        toast.success(wasLost ? "Lead marked Lost and removed" : "Lead updated");
      } else {
        await leadService.create({
          clientName: form.clientName.trim(),
          phone: form.phone.trim(),
          mapsLink: form.mapsLink.trim() || undefined,
          instagram: form.instagram.trim() || undefined,
          facebook: form.facebook.trim() || undefined,
          status: form.status,
          priority: form.priority,
          source: form.source.trim() || undefined,
          assignedAgentId: user?.role === "agent" ? user.id : (form.assignedAgentId || null),
          nextFollowUp: null,
          followUpNote: "",
        } as any);
        toast.success("Lead created");
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Leads"
        description={user?.role === "admin" ? "All leads across your organization." : "Your assigned leads."}
        actions={
          <Button className="btn-brand hover:btn-brand-hover border-0 gap-2" onClick={openCreateModal}>
            <Plus className="h-4 w-4" /> New lead
          </Button>
        }
      />

      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, phone, client ID…" value={search_} onChange={(e) => { setSearch_(e.target.value); setPage(1); }} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prioFilter} onValueChange={(v) => { setPrioFilter(v as any); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {user?.role === "admin" && (
          <Select value={agentFilter} onValueChange={(v) => { setAgentFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Agent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as LeadSort)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="name">Client name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Import leads from Google Sheets, upload a CSV, or create your first lead manually."
          action={<Button onClick={openCreateModal} className="btn-brand hover:btn-brand-hover border-0">New lead</Button>}
        />
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/80 backdrop-blur border-b border-border/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Client</th>
                  <th className="text-left px-4 py-3 font-medium">Phone</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Priority</th>
                  <th className="text-left px-4 py-3 font-medium">Agent</th>
                  <th className="text-left px-4 py-3 font-medium">Added</th>
                  <th className="text-left px-4 py-3 font-medium">Follow-up</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageLeads.map((l) => (
                  <tr key={l.id} className="border-b border-border/40 last:border-0 hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => nav({ to: "/leads/$id", params: { id: l.id }, search: { page: safePage } as any })}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.clientName}</div>
                      <div className="text-xs text-muted-foreground">{l.clientId}</div>
                    </td>
                    <td className="px-4 py-3">{l.phone}</td>
                    <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={l.priority} /></td>
                    <td className="px-4 py-3">{agentName(l.assignedAgentId)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(l.dateAdded).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Link to="/leads/$id" params={{ id: l.id }} search={{ page: safePage } as any} className="p-1.5 rounded hover:bg-accent" aria-label="View"><Eye className="h-4 w-4" /></Link>
                        <button onClick={(e) => openEditModal(l, e)} className="p-1.5 rounded hover:bg-accent" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => callViaGoogleVoice(l.phone)} className="p-1.5 rounded hover:bg-accent" aria-label="Call"><Phone className="h-4 w-4" /></button>
                        <a href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-accent" aria-label="WhatsApp"><MessageSquare className="h-4 w-4" /></a>
                        <button onClick={() => copyPhone(l.phone)} className="p-1.5 rounded hover:bg-accent" aria-label="Copy phone"><Copy className="h-4 w-4" /></button>
                        {l.mapsLink && <a href={l.mapsLink} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-accent" aria-label="Maps"><MapPin className="h-4 w-4" /></a>}
                        {l.facebook && <a href={l.facebook} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-accent" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>}
                        {l.instagram && <a href={l.instagram} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-accent" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>}
                        <button
                          onClick={(e) => handleDelete(l, e)}
                          disabled={deletingId === l.id}
                          className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                          aria-label="Delete"
                        >
                          {deletingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
            <div className="text-xs text-muted-foreground">Page {safePage} of {totalPages} · {leads.length} results</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit lead" : "New lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="clientName">Client name *</Label>
                <Input id="clientName" value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as LeadStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.status === "Lost" && (
                  <p className="text-xs text-destructive">Saving as "Lost" will permanently remove this lead.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as LeadPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {user?.role === "admin" && agents.length > 0 && (
              <div className="space-y-1.5">
                <Label>Assign to agent</Label>
                <Select value={form.assignedAgentId || "unassigned"} onValueChange={(v) => setForm((f) => ({ ...f, assignedAgentId: v === "unassigned" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Input id="source" placeholder="e.g. Facebook ad, referral, website" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mapsLink">Google Maps</Label>
                <Input id="mapsLink" value={form.mapsLink} onChange={(e) => setForm((f) => ({ ...f, mapsLink: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instagram">Instagram</Label>
                <Input id="instagram" value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="facebook">Facebook</Label>
                <Input id="facebook" value={form.facebook} onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submitLead} disabled={submitting} className="btn-brand hover:btn-brand-hover border-0">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : editingId ? "Save changes" : "Create lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

