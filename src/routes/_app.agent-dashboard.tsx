import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardService } from "@/services/dashboardService";
import { activityService } from "@/services/activityService";
import { leadService } from "@/services/leadService";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Sparkles, Phone, Trophy, XCircle, Percent, Calendar, TrendingUp } from "lucide-react";
import type { DashboardStats, ActivityEvent, Lead } from "@/types/domain";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/agent-dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Agent Dashboard — Nexora CRM" }] }),
  component: AgentDashboard,
});

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

function AgentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [s, a, l] = await Promise.all([
        dashboardService.agentStats(user.id),
        activityService.list(100),
        leadService.list({ agentId: user.id }),
      ]);
      setStats(s);
      setEvents(a.filter((e) => e.userId === user.id));
      setLeads(l);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [load]);

  const myActivity = useMemo(() => {
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

  const conversionTrend = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString(undefined, { month: "short" }) });
    }
    return months.map(({ key, label }) => {
      const [y, m] = key.split("-").map(Number);
      const inMonth = leads.filter((l) => {
        const d = new Date(l.dateAdded);
        return d.getFullYear() === y && d.getMonth() === m;
      });
      const won = inMonth.filter((l) => l.status === "Won").length;
      const lost = inMonth.filter((l) => l.status === "Lost").length;
      const conclusive = won + lost;
      return { month: label, rate: conclusive ? Math.round((won / conclusive) * 1000) / 10 : 0 };
    });
  }, [leads]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My performance"
        title={<>Hi, <span className="gradient-text">{user.fullName.split(" ")[0]}</span></> as any}
        description="Your personal pipeline — only leads assigned to you."
        actions={<Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="My leads"      value={loading ? "—" : stats?.total ?? 0}      icon={<Users className="h-5 w-5" />} />
        <StatCard label="New"           value={loading ? "—" : stats?.new ?? 0}        icon={<Sparkles className="h-5 w-5" />} />
        <StatCard label="Contacted"     value={loading ? "—" : stats?.contacted ?? 0}  icon={<Phone className="h-5 w-5" />} />
        <StatCard label="Follow-up"     value={loading ? "—" : stats?.followUp ?? 0}   icon={<Calendar className="h-5 w-5" />} />
        <StatCard label="Won"           value={loading ? "—" : stats?.won ?? 0}        icon={<Trophy className="h-5 w-5" />} />
        <StatCard label="Lost"          value={loading ? "—" : stats?.lost ?? 0}       icon={<XCircle className="h-5 w-5" />} />
      </section>
      <section className="grid md:grid-cols-3 gap-4">
        <StatCard label="Today"       value={loading ? "—" : stats?.today ?? 0}      icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="This month"  value={loading ? "—" : stats?.monthly ?? 0}    icon={<Calendar className="h-5 w-5" />} />
        <StatCard label="Conversion"  value={loading ? "—" : `${stats?.conversionRate ?? 0}%`} icon={<Percent className="h-5 w-5" />} />
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <MiniChartCard title="My activity">
          {events.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={myActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </MiniChartCard>

        <MiniChartCard title="My conversion trend">
          {leads.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </MiniChartCard>
      </section>
    </div>
  );
}

