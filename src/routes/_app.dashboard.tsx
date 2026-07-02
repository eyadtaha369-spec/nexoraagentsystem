import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeads, getMe, syncFromSheet } from "@/lib/crm.functions";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Users, Phone, Sparkles, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nexora CRM" }] }),
  component: DashboardPage,
});

const STATUSES = ["New", "Contacted", "Interested", "Won", "Lost"] as const;

function DashboardPage() {
  const meFn = useServerFn(getMe);
  const listFn = useServerFn(listLeads);
  const syncFn = useServerFn(syncFromSheet);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => listFn() });

  const isOwner = me?.roles.includes("owner");

  const counts: Record<string, number> = { New: 0, Contacted: 0, Interested: 0, Won: 0, Lost: 0 };
  leads.forEach((l: any) => { counts[l.status] = (counts[l.status] || 0) + 1; });
  const total = leads.length;
  const conv = total ? Math.round((counts.Won / total) * 1000) / 10 : 0;

  // Agent performance
  const byAgent: Record<string, { total: number; won: number; contacted: number }> = {};
  leads.forEach((l: any) => {
    const a = l.assigned_agent || "Unassigned";
    if (!byAgent[a]) byAgent[a] = { total: 0, won: 0, contacted: 0 };
    byAgent[a].total++;
    if (l.status === "Won") byAgent[a].won++;
    if (l.status === "Contacted" || l.status === "Interested") byAgent[a].contacted++;
  });
  const agentChart = Object.entries(byAgent).map(([name, v]) => ({ name: name.split(" ")[0], ...v }));

  // Weekly activity: leads by day (last 7 days by date_added)
  const days: { day: string; count: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = leads.filter((l: any) => (l.date_added || "").slice(0,10) === key).length;
    days.push({ day: d.toLocaleDateString("en", { weekday: "short" }), count });
  }

  async function runSync() {
    try {
      toast.info("Syncing from Google Sheet…");
      const r = await syncFn();
      toast.success(`Imported ${r.imported} / ${r.total} rows`);
      queryClient.invalidateQueries();
    } catch (e: any) { toast.error(e?.message || "Sync failed"); }
  }

  const kpis = [
    { label: "Total Leads", value: total, icon: <Users className="h-5 w-5" />, tint: "from-brand-blue/30 to-brand-purple/20" },
    { label: "New", value: counts.New, icon: <Sparkles className="h-5 w-5" />, tint: "from-brand-blue/30 to-brand-teal/20" },
    { label: "Contacted", value: counts.Contacted, icon: <Phone className="h-5 w-5" />, tint: "from-brand-teal/30 to-brand-blue/20" },
    { label: "Interested", value: counts.Interested, icon: <TrendingUp className="h-5 w-5" />, tint: "from-brand-purple/30 to-brand-blue/20" },
    { label: "Won", value: counts.Won, icon: <Trophy className="h-5 w-5" />, tint: "from-brand-teal/40 to-brand-purple/20" },
    { label: "Lost", value: counts.Lost, icon: <XCircle className="h-5 w-5" />, tint: "from-destructive/30 to-destructive/10" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">
            {isOwner ? "Owner overview" : "My performance"}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Welcome back, <span className="gradient-text">{me?.profile?.full_name?.split(" ")[0] || "team"}</span>
          </h1>
        </div>
        {isOwner && (
          <Button onClick={runSync} className="btn-brand hover:btn-brand-hover border-0 gap-2">
            <RefreshCw className="h-4 w-4" /> Sync from Google Sheet
          </Button>
        )}
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`glass-card p-4 relative overflow-hidden`}>
            <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-60 bg-gradient-to-br ${k.tint}`} />
            <div className="flex items-center justify-between relative">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <div className="text-muted-foreground">{k.icon}</div>
            </div>
            <div className="mt-3 text-3xl font-semibold relative" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{k.value}</div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        {/* Conversion */}
        <div className="glass-card p-6 lg:col-span-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Conversion rate</div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-5xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{conv}%</div>
            <div className="text-sm text-muted-foreground">{counts.Won} / {total}</div>
          </div>
          <div className="mt-6 space-y-2">
            {STATUSES.map(s => {
              const v = counts[s];
              const pct = total ? (v / total) * 100 : 0;
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1"><span>{s}</span><span className="text-muted-foreground">{v}</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gradient-brand)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Funnel */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Sales funnel</div>
          </div>
          <div className="mt-6 space-y-3">
            {STATUSES.map((s, i) => {
              const v = counts[s];
              const max = Math.max(...STATUSES.map(x => counts[x]), 1);
              const pct = (v / max) * 100;
              const inset = i * 4;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-muted-foreground text-right">{s}</div>
                  <div className="flex-1 h-9 rounded-lg overflow-hidden bg-muted/40" style={{ marginLeft: inset, marginRight: inset }}>
                    <div className="h-full flex items-center justify-end pr-3 text-sm font-medium"
                         style={{ width: `${Math.max(pct, 6)}%`, background: "var(--gradient-brand)" }}>
                      {v}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {isOwner && (
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="glass-card p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Agent performance</div>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={agentChart}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "rgba(15,20,35,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                  <Bar dataKey="total" fill="oklch(0.70 0.18 250)" radius={[6, 6, 0, 0]} name="Total" />
                  <Bar dataKey="won" fill="oklch(0.78 0.14 195)" radius={[6, 6, 0, 0]} name="Won" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Weekly activity</div>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={days}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "rgba(15,20,35,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="count" stroke="oklch(0.68 0.19 300)" strokeWidth={3} dot={{ r: 4, fill: "oklch(0.68 0.19 300)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
