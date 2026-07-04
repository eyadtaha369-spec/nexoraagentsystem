import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { leadService } from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { PriorityBadge } from "@/components/common/Badges";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/types/domain";
import { CalendarClock, MessageSquare, Phone } from "lucide-react";

export const Route = createFileRoute("/_app/follow-ups")({
  ssr: false,
  head: () => ({ meta: [{ title: "Follow-ups — Nexora CRM" }] }),
  component: FollowUps,
});

function bucket(date: string) {
  const d = new Date(date);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1);
  const endTomorrow = new Date(startTomorrow); endTomorrow.setDate(endTomorrow.getDate() + 1);
  const endWeek = new Date(startToday); endWeek.setDate(endWeek.getDate() + 7);
  if (d < startToday) return "Overdue";
  if (d < startTomorrow) return "Today";
  if (d < endTomorrow) return "Tomorrow";
  if (d < endWeek) return "This Week";
  return "Later";
}

function FollowUps() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const l = await leadService.list(user.role === "admin" ? undefined : { agentId: user.id });
      setLeads(l.filter((x) => x.nextFollowUp));
      setLoading(false);
    })();
  }, [user]);

  const buckets = ["Overdue", "Today", "Tomorrow", "This Week", "Later"];
  const grouped = buckets.map((b) => ({ name: b, items: leads.filter((l) => bucket(l.nextFollowUp!) === b) }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pipeline" title="Follow-ups" description="Never miss a scheduled touchpoint." />
      {loading ? (
        <div className="glass-card p-8 text-muted-foreground text-sm">Loading…</div>
      ) : leads.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No follow-ups scheduled"
          description="Schedule a follow-up from any lead's detail page." />
      ) : (
        <div className="space-y-6">
          {grouped.filter((g) => g.items.length > 0).map((g) => (
            <section key={g.name} className="space-y-3">
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">{g.name} · {g.items.length}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.items.map((l) => (
                  <div key={l.id} className="glass-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{l.clientName}</div>
                        <div className="text-xs text-muted-foreground">{l.phone}</div>
                      </div>
                      <PriorityBadge priority={l.priority} />
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(l.nextFollowUp!).toLocaleString()}</div>
                    {l.followUpNote && <p className="text-sm">{l.followUpNote}</p>}
                    <div className="flex gap-2 pt-2">
                      <a href={`tel:${l.phone}`}><Button variant="outline" size="sm" className="gap-1"><Phone className="h-3 w-3" /> Call</Button></a>
                      <a href={`https://wa.me/${l.phone.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</Button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
