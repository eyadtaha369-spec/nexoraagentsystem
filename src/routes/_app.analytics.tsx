import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { leadService } from "@/services/leadService";
import { authService } from "@/services/authService";
import { PageHeader } from "@/components/common/PageHeader";
import type { Lead, User } from "@/types/domain";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/analytics")({
  ssr: false,
  head: () => ({ meta: [{ title: "Analytics — Nexora CRM" }] }),
  component: AnalyticsPage,
});

const STATUS_COLORS: Record<string, string> = {
  New: "#60a5fa", Contacted: "#38bdf8", Interested: "#a78bfa",
  "Follow Up": "#f59e0b", Won: "#34d399", Lost: "#f87171",
  "No Answer": "#94a3b8", "Wrong Number": "#64748b",
};
const PIE_COLORS = ["#60a5fa", "#a78bfa", "#34d399", "#f59e0b", "#f87171", "#38bdf8", "#94a3b8"];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">{title}</div>
      <div style={{ height: 260 }}>{children}</div>
    </div>
  );
}

function Empty() {
  return <div className="h-full grid place-items-center text-sm text-muted-foreground">Not enough data yet.</div>;
}

function AnalyticsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const filters = user.role === "admin" ? {} : { agentId: user.id };
      const [l, a] = await Promise.all([
        leadService.list(filters),
        user.role === "admin" ? authService.listAgents() : Promise.resolve<User[]>([]),
      ]);
      setLeads(l);
      setAgents(a);
      setLoading(false);
    })();
  }, [user]);

  const monthly = useMemo(() => {
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

  const statusDist = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => { map[l.status] = (map[l.status] || 0) + 1; });
    return Object.entries(map).map(([status, value]) => ({ status, value }));
  }, [leads]);

  const wonLost = useMemo(() => {
    const won = leads.filter((l) => l.status === "Won").length;
    const lost = leads.filter((l) => l.status === "Lost").length;
    return [{ name: "Won", value: won }, { name: "Lost", value: lost }];
  }, [leads]);

  const conversionRate = useMemo(() => {
    const won = leads.filter((l) => l.status === "Won").length;
    const lost = leads.filter((l) => l.status === "Lost").length;
    const conclusive = won + lost;
    return conclusive ? Math.round((won / conclusive) * 1000) / 10 : 0;
  }, [leads]);

  const agentPerf = useMemo(() => {
    return agents.map((a) => ({
      name: a.fullName.split(" ")[0],
      leads: leads.filter((l) => l.assignedAgentId === a.id).length,
      won: leads.filter((l) => l.assignedAgentId === a.id && l.status === "Won").length,
    }));
  }, [agents, leads]);

  const sources = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => { const s = l.source || "Unspecified"; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([source, value]) => ({ source, value }));
  }, [leads]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Analytics" description="Deep-dive metrics across the entire funnel." />
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Monthly leads">
          {leads.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Conversion rate">
          {leads.length === 0 ? <Empty /> : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl font-bold gradient-text">{conversionRate}%</div>
                <p className="text-sm text-muted-foreground mt-2">Won ÷ (Won + Lost)</p>
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Won vs Lost">
          {wonLost.every((x) => x.value === 0) ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={wonLost} dataKey="value" nameKey="name" outerRadius={90} label>
                  <Cell fill="#34d399" />
                  <Cell fill="#f87171" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Agent performance">
          {agentPerf.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" fill="#60a5fa" name="Total leads" />
                <Bar dataKey="won" fill="#34d399" name="Won" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Lead sources">
          {sources.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sources} dataKey="value" nameKey="source" outerRadius={90} label>
                  {sources.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Status distribution">
          {statusDist.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDist} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="status" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value">
                  {statusDist.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status] || "#60a5fa"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

