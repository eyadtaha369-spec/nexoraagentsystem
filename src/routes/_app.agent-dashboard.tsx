import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardService } from "@/services/dashboardService";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ChartPlaceholder } from "@/components/common/ChartPlaceholder";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Sparkles, Phone, Trophy, XCircle, Percent, Calendar, TrendingUp } from "lucide-react";
import type { DashboardStats } from "@/types/domain";

export const Route = createFileRoute("/_app/agent-dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Agent Dashboard — Nexora CRM" }] }),
  component: AgentDashboard,
});

function AgentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { setStats(await dashboardService.agentStats(user.id)); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [load]);

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
        <ChartPlaceholder title="My activity" />
        <ChartPlaceholder title="My conversion trend" />
      </section>
    </div>
  );
}
