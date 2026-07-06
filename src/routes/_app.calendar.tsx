import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { leadService } from "@/services/leadService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/Badges";
import { Calendar as CalIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { Lead } from "@/types/domain";

export const Route = createFileRoute("/_app/calendar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Calendar — Nexora CRM" }] }),
  component: CalendarPage,
});

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const filters = user.role === "admin" ? {} : { agentId: user.id };
      const l = await leadService.list(filters, "newest");
      setLeads(l.filter((x) => !!x.nextFollowUp));
      setLoading(false);
    })();
  }, [user]);

  const byDay = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const l of leads) {
      if (!l.nextFollowUp) continue;
      const d = new Date(l.nextFollowUp);
      if (isNaN(d.getTime())) continue;
      const key = dateKey(d);
      (map[key] ||= []).push(l);
    }
    return map;
  }, [leads]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { date: Date | null; key: string | null }[] = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null, key: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      cells.push({ date, key: dateKey(date) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, key: null });
    return cells;
  }, [cursor]);

  const todayKey = dateKey(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        description="Follow-ups and meetings, laid out by day."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium w-36 text-center">{monthLabel}</div>
            <Button variant="outline" size="icon" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : leads.length === 0 ? (
        <EmptyState icon={<CalIcon className="h-6 w-6" />} title="No follow-ups scheduled"
          description="Schedule a follow-up from any lead's detail page and it will show up here." />
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="glass-card p-4">
            <div className="grid grid-cols-7 gap-1 text-xs uppercase text-muted-foreground mb-2">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                <div key={d} className="text-center py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((cell, i) => {
                if (!cell.date) return <div key={i} className="aspect-square rounded-lg bg-transparent" />;
                const items = byDay[cell.key!] || [];
                const isToday = cell.key === todayKey;
                const isSelected = cell.key === selectedDay;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(cell.key)}
                    className={`aspect-square rounded-lg p-1.5 text-left border transition-colors flex flex-col gap-0.5 overflow-hidden
                      ${isSelected ? "border-primary bg-accent" : "border-border/40 hover:bg-accent/40"}
                      ${isToday ? "ring-1 ring-primary/60" : ""}`}
                  >
                    <span className="text-xs font-medium">{cell.date.getDate()}</span>
                    {items.slice(0, 2).map((l) => (
                      <span key={l.id} className="text-[10px] truncate rounded px-1 py-0.5" style={{ background: "var(--gradient-brand)" }}>
                        {l.clientName}
                      </span>
                    ))}
                    {items.length > 2 && <span className="text-[10px] text-muted-foreground">+{items.length - 2} more</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {selectedDay ? new Date(selectedDay).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Select a day"}
            </div>
            {!selectedDay ? (
              <p className="text-sm text-muted-foreground">Click a day with a follow-up to see details.</p>
            ) : (byDay[selectedDay] || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups on this day.</p>
            ) : (
              <ul className="space-y-3">
                {(byDay[selectedDay] || []).map((l) => (
                  <li key={l.id}>
                    <Link to="/leads/$id" params={{ id: l.id }} className="block p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{l.clientName}</span>
                        <StatusBadge status={l.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{l.phone}</div>
                      {l.followUpNote && <div className="text-xs text-muted-foreground mt-1 italic">"{l.followUpNote}"</div>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

