import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardService } from "@/services/dashboardService";
import { activityService } from "@/services/activityService";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ChartPlaceholder } from "@/components/common/ChartPlaceholder";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Sparkles, Phone, TrendingUp, Trophy, XCircle, Calendar, Percent, UserCheck, UserX, Plus } from "lucide-react";
import type { DashboardStats, ActivityEvent } from "@/types/domain";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin-dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin Dashboard — Nexora CRM" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "admin") nav({ to: "/agent-dashboard", replace: true });
  }, [user, nav]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([dashboardService.adminStats(), activityService.list(8)]);
      setStats(s); setEvents(a);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [load]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin overview"
        title={<>Welcome back, <span className="gradient-text">{user.fullName.split(" ")[0]}</span></> as any}
        description="Real-time snapshot of your entire pipeline, team performance, and system activity."
        actions={
          <>
            <Button variant="outline" onClick={() => { load(); toast.success("Dashboard refreshed"); }} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button asChild className="btn-brand hover:btn-brand-hover border-0 gap-2">
              <Link to="/leads"><Plus className="h-4 w-4" />New lead</Link>
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total leads"    value={loading ? "—" : stats?.total ?? 0}    icon={<Users className="h-5 w-5" />} />
        <StatCard label="New"            value={loading ? "—" : stats?.new ?? 0}      icon={<Sparkles className="h-5 w-5" />} tint="from-brand-blue/30 to-brand-teal/20" />
        <StatCard label="Contacted"      value={loading ? "—" : stats?.contacted ?? 0} icon={<Phone className="h-5 w-5" />} tint="from-brand-teal/30 to-brand-blue/20" />
        <StatCard label="Follow-up"      value={loading ? "—" : stats?.followUp ?? 0}  icon={<Calendar className="h-5 w-5" />} tint="from-brand-purple/30 to-brand-blue/20" />
        <StatCard label="Won"            value={loading ? "—" : stats?.won ?? 0}       icon={<Trophy className="h-5 w-5" />} tint="from-brand-teal/40 to-brand-purple/20" />
        <StatCard label="Lost"           value={loading ? "—" : stats?.lost ?? 0}      icon={<XCircle className="h-5 w-5" />} tint="from-destructive/30 to-destructive/10" />
        <StatCard label="Today"          value={loading ? "—" : stats?.today ?? 0}     icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="This month"     value={loading ? "—" : stats?.monthly ?? 0}   icon={<Calendar className="h-5 w-5" />} />
        <StatCard label="Active agents"  value={loading ? "—" : stats?.activeAgents ?? 0} icon={<UserCheck className="h-5 w-5" />} />
        <StatCard label="Disabled"       value={loading ? "—" : stats?.disabledAgents ?? 0} icon={<UserX className="h-5 w-5" />} />
        <StatCard label="Conversion"     value={loading ? "—" : `${stats?.conversionRate ?? 0}%`} icon={<Percent className="h-5 w-5" />} tint="from-brand-teal/30 to-brand-purple/20" />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <ChartPlaceholder title="Leads per month" />
        <ChartPlaceholder title="Leads by status" />
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <ChartPlaceholder title="Leads by agent" />
        <ChartPlaceholder title="Daily activity" />
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="glass-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Recent activity</div>
            <Link to="/activity" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No activity yet. Import your first leads to get started.</div>
          ) : (
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full" style={{ background: "var(--gradient-brand)" }} />
                  <div className="flex-1">
                    <p className="text-sm">{e.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass-card p-6">
          <div className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">Quick actions</div>
          <div className="grid gap-2">
            <Button asChild variant="outline" className="justify-start"><Link to="/leads">Manage leads</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to="/agents">Manage agents</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to="/analytics">Open analytics</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to="/settings">Connection settings</Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}
