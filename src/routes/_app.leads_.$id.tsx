import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { leadService } from "@/services/leadService";
import { authService } from "@/services/authService";
import { callViaGoogleVoice } from "@/lib/googleVoice";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, PriorityBadge } from "@/components/common/Badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Lead, LeadPriority, LeadStatus, User } from "@/types/domain";
import { ArrowLeft, Copy, Facebook, Instagram, MapPin, MessageSquare, Phone, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_app/leads_/$id")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { page?: number } => ({
    page: search.page ? Number(search.page) || undefined : undefined,
  }),
  head: () => ({ meta: [{ title: "Lead details — Nexora CRM" }] }),
  component: LeadDetails,
});

const STATUSES: LeadStatus[] = ["New","Contacted","Interested","Follow Up","Won","Lost","No Answer","Wrong Number"];
const PRIORITIES: LeadPriority[] = ["High","Medium","Low"];

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LeadDetails() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { user } = useAuth();
  const nav = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);

  const [fuDate, setFuDate] = useState("");
  const [fuNote, setFuNote] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const load = async () => {
    setLoading(true);
    const [l, a] = await Promise.all([
      leadService.get(id),
      user?.role === "admin" ? authService.listAgents() : Promise.resolve<User[]>([]),
    ]);
    setLead(l);
    setAgents(a);
    if (l) {
      setFuDate(toLocalInputValue(l.nextFollowUp));
      setFuNote(l.followUpNote || "");
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, user]);

  async function addNote() {
    if (!lead || !noteText.trim() || !user) return;
    await leadService.addNote(lead.id, user.fullName, noteText.trim());
    setNoteText("");
    toast.success("Note added");
    load();
  }

  async function updateField(field: "status" | "priority" | "assignedAgentId", value: string) {
    if (!lead) return;
    setSavingField(field);
    try {
      const patch: any = field === "assignedAgentId" ? { assignedAgentId: value || null } : { [field]: value };
      const updated = await leadService.update(lead.id, patch);
      setLead(updated);
      toast.success("Updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update.");
    } finally {
      setSavingField(null);
    }
  }

  async function saveFollowUp() {
    if (!lead || !fuDate) {
      toast.error("Pick a date first.");
      return;
    }
    setSavingFollowUp(true);
    try {
      const iso = new Date(fuDate).toISOString();
      const updated = await leadService.scheduleFollowUp(lead.id, iso, fuNote.trim());
      setLead(updated);
      toast.success("Follow-up scheduled");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to schedule follow-up.");
    } finally {
      setSavingFollowUp(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!lead) return (
    <EmptyState
      title="Lead not found"
      description="This lead may have been deleted or reassigned."
      action={<Button variant="outline" onClick={() => nav({ to: "/leads" })}>Back to leads</Button>}
    />
  );

  return (
    <div className="space-y-6">
      <Link to="/leads" search={{ page: search.page ?? 1 } as any} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All leads</Link>
      <PageHeader eyebrow={lead.clientId} title={lead.clientName}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => callViaGoogleVoice(lead.phone)}><Phone className="h-4 w-4" /> Call</Button>
            <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer"><Button variant="outline" className="gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp</Button></a>
            <Button variant="outline" className="gap-2" onClick={() => { navigator.clipboard.writeText(lead.phone); toast.success("Phone copied"); }}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass-card p-6 lg:col-span-1 space-y-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Client information</div>
          <div className="space-y-3 text-sm">
            <Row label="Phone" value={lead.phone} />

            <div className="flex justify-between items-center gap-4">
              <span className="text-muted-foreground">Status</span>
              <Select value={lead.status} onValueChange={(v) => updateField("status", v)} disabled={savingField === "status"}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between items-center gap-4">
              <span className="text-muted-foreground">Priority</span>
              <Select value={lead.priority} onValueChange={(v) => updateField("priority", v)} disabled={savingField === "priority"}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {user?.role === "admin" && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-muted-foreground">Agent</span>
                <Select value={lead.assignedAgentId || "unassigned"} onValueChange={(v) => updateField("assignedAgentId", v === "unassigned" ? "" : v)} disabled={savingField === "assignedAgentId"}>
                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Row label="Date added" value={new Date(lead.dateAdded).toLocaleString()} />
            <Row label="Next follow-up" value={lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleString() : "—"} />
            {lead.source && <Row label="Source" value={lead.source} />}
          </div>
          <div className="pt-3 border-t border-border/60 flex flex-wrap gap-2">
            {lead.mapsLink && <a href={lead.mapsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><MapPin className="h-3 w-3" /> Maps</a>}
            {lead.facebook && <a href={lead.facebook} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Facebook className="h-3 w-3" /> Facebook</a>}
            {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Instagram className="h-3 w-3" /> Instagram</a>}
          </div>
        </div>

        <div className="glass-card p-6 lg:col-span-2 space-y-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5" /> Schedule follow-up
            </div>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="fuDate" className="text-xs">Date & time</Label>
                <Input id="fuDate" type="datetime-local" value={fuDate} onChange={(e) => setFuDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fuNote" className="text-xs">Note</Label>
                <Input id="fuNote" placeholder="What to discuss…" value={fuNote} onChange={(e) => setFuNote(e.target.value)} />
              </div>
              <Button onClick={saveFollowUp} disabled={savingFollowUp || !fuDate} className="btn-brand hover:btn-brand-hover border-0">
                {savingFollowUp ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Notes</div>
            <div className="space-y-3">
              <Textarea placeholder="Write a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
              <Button onClick={addNote} disabled={!noteText.trim()} className="btn-brand hover:btn-brand-hover border-0">Add note</Button>
            </div>
            <div className="pt-4 space-y-3 max-h-72 overflow-y-auto">
              {lead.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
              {[...lead.notes].reverse().map((n) => (
                <div key={n.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{n.author}</span><span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm">{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Timeline</div>
        <ol className="relative border-l border-border/60 space-y-4 pl-6">
          {lead.timeline.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          {lead.timeline.slice().reverse().map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background" style={{ background: "var(--gradient-brand)" }} />
              <p className="text-sm">{e.message}</p>
              <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

