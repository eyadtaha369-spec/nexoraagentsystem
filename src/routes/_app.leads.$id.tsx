import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { leadService } from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, PriorityBadge } from "@/components/common/Badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Lead } from "@/types/domain";
import { ArrowLeft, Copy, Facebook, Instagram, MapPin, MessageSquare, Phone } from "lucide-react";

export const Route = createFileRoute("/_app/leads/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Lead details — Nexora CRM" }] }),
  component: LeadDetails,
});

function LeadDetails() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");

  const load = async () => {
    setLoading(true);
    const l = await leadService.get(id);
    setLead(l);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function addNote() {
    if (!lead || !noteText.trim() || !user) return;
    await leadService.addNote(lead.id, user.fullName, noteText.trim());
    setNoteText("");
    toast.success("Note added");
    load();
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
      <Link to="/leads" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All leads</Link>
      <PageHeader eyebrow={lead.clientId} title={lead.clientName}
        actions={
          <div className="flex gap-2">
            <a href={`tel:${lead.phone}`}><Button variant="outline" className="gap-2"><Phone className="h-4 w-4" /> Call</Button></a>
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
            <Row label="Status" value={<StatusBadge status={lead.status} />} />
            <Row label="Priority" value={<PriorityBadge priority={lead.priority} />} />
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

        <div className="glass-card p-6 lg:col-span-2 space-y-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
          <div className="space-y-3">
            <Textarea placeholder="Write a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
            <Button onClick={addNote} disabled={!noteText.trim()} className="btn-brand hover:btn-brand-hover border-0">Add note</Button>
          </div>
          <div className="pt-2 space-y-3 max-h-72 overflow-y-auto">
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

      <div className="glass-card p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Timeline</div>
        <ol className="relative border-l border-border/60 space-y-4 pl-6">
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
