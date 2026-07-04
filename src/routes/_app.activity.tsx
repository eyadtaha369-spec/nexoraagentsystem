import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { activityService } from "@/services/activityService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Activity } from "lucide-react";
import type { ActivityEvent } from "@/types/domain";

export const Route = createFileRoute("/_app/activity")({
  ssr: false,
  head: () => ({ meta: [{ title: "Activity — Nexora CRM" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (user && user.role !== "admin") nav({ to: "/agent-dashboard", replace: true }); }, [user, nav]);
  useEffect(() => { activityService.list(200).then((e) => { setEvents(e); setLoading(false); }); }, []);
  if (!user || user.role !== "admin") return null;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Audit" title="Activity log" description="Every action across your CRM." />
      {loading ? <div className="glass-card p-8 text-sm text-muted-foreground">Loading…</div>
       : events.length === 0 ? <EmptyState icon={<Activity className="h-6 w-6" />} title="No activity yet" description="Actions will show up here as your team uses the CRM." />
       : (
        <ol className="glass-card p-6 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 border-b border-border/40 last:border-0 pb-3 last:pb-0">
              <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ background: "var(--gradient-brand)" }} />
              <div className="flex-1">
                <p className="text-sm">{e.message}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()} · {e.type}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
