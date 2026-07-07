import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardService } from "@/services/dashboardService";
import { activityService } from "@/services/activityService";
import { leadService } from "@/services/leadService";
import { authService } from "@/services/authService";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Sparkles, Phone, TrendingUp, Trophy, XCircle, Calendar, Percent, UserCheck, UserX, Plus } from "lucide-react";
import type { DashboardStats, ActivityEvent, Lead, User } from "@/types/domain";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/admin-dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin Dashboard — Nexora CRM" }] }),
  component: AdminDashboard,
});

const STATUS_COLORS: Record<string, string> = {
  New: "#60a5fa", Contacted: "#38bdf8", Interested: "#a78bfa",
  "Follow Up": "#f59e0b", Won: "#34d399", Lost: "#f87171",
  "No Answer": "#94a3b8", "Wrong Number": "#64748b",
};

function MiniChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">{title}</div>
      <div style={{ height: 240 }}>{children}</div>
    </div>
  );
}

function Empty() {
  return <div className="h-full grid place-items-center text-sm text-muted-foreground">Not enough data yet.</div>;
}

function AdminDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "admin") nav({ to: "/agent-dashboard", replace: true });
  }, [user, nav]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, l, ag] = await Promise.all([
        dashboardService.adminStats(),
        activityService.list(8),
        leadService.list(),
        authService.listAgents(),
      ]);
      setStats(s); setEvents(a); setLeads(l); setAgents(ag);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [load]);

  const leadsPerMonth = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      map[`${d.toLocaleString(undefined, { month: "short" })} ${d.getFullYear()}`] = 0;
    }
    leads.forEach((l) => {
      const d = new Date(l.dateAdded);
      if (isNaN(d.getTime())) return;
      const key = `${d.toLocaleString(undefined, { month: "short" })} ${d.getFullYear()}`;
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([month, count]) => ({ month, count }));
  }, [leads]);

  const leadsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => { map[l.status] = (map[l.status] || 0) + 1; });
    return Object.entries(map).map(([status, value]) => ({ status, value }));
  }, [leads]);

  const leadsByAgent = useMemo(() => {
    return agents.map((a) => ({
      name: a.fullName.split(" ")[0],
      leads: leads.filter((l) => l.assignedAgentId === a.id).length,
    }));
  }, [agents, leads]);

  const dailyActivity = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      map[d.toLocaleDateString(undefined, { weekday: "short" })] = 0;
    }
    events.forEach((e) => {
      const d = new Date(e.createdAt);
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleDateString(undefined, { weekday: "short" });
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([day, count]) => ({ day, count }));
  }, [events]);

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
        <MiniChartCard title="Leads per month">
          {leads.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsPerMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </MiniChartCard>

        <MiniChartCard title="Leads by status">
          {leadsByStatus.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leadsByStatus} dataKey="value" nameKey="status" outerRadius={85} label>
                  {leadsByStatus.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status] || "#60a5fa"} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </MiniChartCard>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <MiniChartCard title="Leads by agent">
          {leadsByAgent.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsByAgent}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </MiniChartCard>

        <MiniChartCard title="Daily activity">
          {events.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </MiniChartCard>
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

