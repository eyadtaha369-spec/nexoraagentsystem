import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { leadService, type LeadFilters, type LeadSort } from "@/services/leadService";
import { authService } from "@/services/authService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { StatusBadge, PriorityBadge } from "@/components/common/Badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import type { Lead, LeadPriority, LeadStatus, User } from "@/types/domain";
import { Copy, Eye, MapPin, MessageSquare, Phone, Plus, Facebook, Instagram } from "lucide-react";

export const Route = createFileRoute("/_app/leads")({
  ssr: false,
  head: () => ({ meta: [{ title: "Leads — Nexora CRM" }] }),
  component: LeadsPage,
});

const PAGE_SIZE = 20;

function LeadsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [prioFilter, setPrioFilter] = useState<LeadPriority | "all">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sort, setSort] = useState<LeadSort>("newest");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search, 250);

  useEffect(() => {
    if (!user) return;
    (async () => {
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
    })();
  }, [user, debounced, statusFilter, prioFilter, agentFilter, sort]);

  const pageLeads = useMemo(() => leads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [leads, page]);
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const agentName = (id: string | null) => id ? (agents.find((a) => a.id === id)?.fullName ?? (user?.id === id ? user?.fullName : "—")) : "Unassigned";

  async function copyPhone(phone: string) {
    await navigator.clipboard.writeText(phone);
    toast.success("Phone copied");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Leads"
        description={user?.role === "admin" ? "All leads across your organization." : "Your assigned leads."}
        actions={user?.role === "admin" ? (
          <Button className="btn-brand hover:btn-brand-hover border-0 gap-2" onClick={() => toast.info("Create-lead modal is scaffolded — wire once backend is ready.")}>
            <Plus className="h-4 w-4" /> New lead
          </Button>
        ) : null}
      />

      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, phone, client ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["New","Contacted","Interested","Follow Up","Won","Lost","No Answer","Wrong Number"] as LeadStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prioFilter} onValueChange={(v) => { setPrioFilter(v as any); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {(["High","Medium","Low"] as LeadPriority[]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
          action={<Button variant="outline">Import leads</Button>}
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
                      onClick={() => nav({ to: "/leads/$id", params: { id: l.id } })}>
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
                        <Link to="/leads/$id" params={{ id: l.id }} className="p-1.5 rounded hover:bg-accent" aria-label="View"><Eye className="h-4 w-4" /></Link>
                        <a href={`tel:${l.phone}`} className="p-1.5 rounded hover:bg-accent" aria-label="Call"><Phone className="h-4 w-4" /></a>
                        <a href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-accent" aria-label="WhatsApp"><MessageSquare className="h-4 w-4" /></a>
                        <button onClick={() => copyPhone(l.phone)} className="p-1.5 rounded hover:bg-accent" aria-label="Copy phone"><Copy className="h-4 w-4" /></button>
                        {l.mapsLink && <a href={l.mapsLink} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-accent" aria-label="Maps"><MapPin className="h-4 w-4" /></a>}
                        {l.facebook && <a href={l.facebook} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-accent" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>}
                        {l.instagram && <a href={l.instagram} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-accent" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
            <div className="text-xs text-muted-foreground">Page {page} of {totalPages} · {leads.length} results</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
