import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authService } from "@/services/authService";
import { leadService } from "@/services/leadService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Trophy } from "lucide-react";
import type { User } from "@/types/domain";

export const Route = createFileRoute("/_app/leaderboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Leaderboard — Nexora CRM" }] }),
  component: Leaderboard,
});

interface Row { agent: User; total: number; won: number; conversion: number }

function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [agents, leads] = await Promise.all([authService.listAgents(), leadService.list()]);
      const r = agents.map((a) => {
        const my = leads.filter((l) => l.assignedAgentId === a.id);
        const won = my.filter((l) => l.status === "Won").length;
        const conclusive = my.filter((l) => l.status === "Won" || l.status === "Lost").length;
        return { agent: a, total: my.length, won, conversion: conclusive ? Math.round((won / conclusive) * 1000) / 10 : 0 };
      }).sort((a, b) => b.won - a.won || b.conversion - a.conversion);
      setRows(r); setLoading(false);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Competition" title="Leaderboard" description="Ranked agent performance." />
      {loading ? <div className="glass-card p-8 text-sm text-muted-foreground">Loading…</div>
       : rows.length === 0 ? <EmptyState icon={<Trophy className="h-6 w-6" />} title="No agents yet" description="Create agents to see rankings." />
       : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-4 py-3">Agent</th>
                <th className="text-right px-4 py-3">Total leads</th>
                <th className="text-right px-4 py-3">Won</th>
                <th className="text-right px-4 py-3">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.agent.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-semibold">{i + 1}</td>
                  <td className="px-4 py-3">{r.agent.fullName}</td>
                  <td className="px-4 py-3 text-right">{r.total}</td>
                  <td className="px-4 py-3 text-right">{r.won}</td>
                  <td className="px-4 py-3 text-right">{r.conversion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
