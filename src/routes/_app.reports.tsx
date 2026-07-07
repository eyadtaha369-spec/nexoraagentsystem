import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { leadService } from "@/services/leadService";
import { authService } from "@/services/authService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/Badges";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import type { Lead, User } from "@/types/domain";

export const Route = createFileRoute("/_app/reports")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reports — Nexora CRM" }] }),
  component: ReportsPage,
});

function csvEscape(val: unknown) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReportsPage() {
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
        leadService.list(filters, "newest"),
        user.role === "admin" ? authService.listAgents() : Promise.resolve<User[]>([]),
      ]);
      setLeads(l);
      setAgents(a);
      setLoading(false);
    })();
  }, [user]);

  const agentName = (id: string | null) => id ? (agents.find((a) => a.id === id)?.fullName ?? "—") : "Unassigned";

  const headers = ["Client ID", "Client Name", "Phone", "Status", "Priority", "Agent", "Source", "Date Added", "Next Follow-up"];
  const rows = () => leads.map((l) => [
    l.clientId, l.clientName, l.phone, l.status, l.priority, agentName(l.assignedAgentId),
    l.source || "", new Date(l.dateAdded).toLocaleDateString(),
    l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString() : "",
  ]);

  function exportCsv() {
    if (leads.length === 0) return toast.error("No leads to export.");
    const lines = [headers, ...rows()].map((r) => r.map(csvEscape).join(","));
    download(`nexora-leads-${Date.now()}.csv`, lines.join("\n"), "text/csv;charset=utf-8;");
    toast.success("CSV downloaded");
  }

  function exportExcel() {
    if (leads.length === 0) return toast.error("No leads to export.");
    const headRow = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
    const bodyRows = rows().map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`).join("");
    const html = `
      <html><head><meta charset="utf-8"></head>
      <body><table border="1">${headRow}${bodyRows}</table></body></html>
    `;
    download(`nexora-leads-${Date.now()}.xls`, html, "application/vnd.ms-excel");
    toast.success("Excel file downloaded");
  }

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data"
        title="Reports"
        description="Export snapshots of your pipeline for stakeholders."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" className="gap-2" onClick={exportExcel}><Download className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}><FileText className="h-4 w-4" /> Print</Button>
          </>
        }
      />

      {loading ? (
        <div className="glass-card p-8 text-sm text-muted-foreground">Loading…</div>
      ) : leads.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No leads yet"
          description="Once you have leads in the system, you'll be able to export and print reports here." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total leads</div>
              <div className="text-2xl font-semibold mt-1">{leads.length}</div>
            </div>
            {Object.entries(statusCounts).slice(0, 3).map(([status, count]) => (
              <div key={status} className="glass-card p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{status}</div>
                <div className="text-2xl font-semibold mt-1">{count}</div>
              </div>
            ))}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-card/80 text-xs uppercase text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-3">Client</th>
                    <th className="text-left px-4 py-3">Phone</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Agent</th>
                    <th className="text-left px-4 py-3">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-3">{l.clientName}</td>
                      <td className="px-4 py-3">{l.phone}</td>
                      <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                      <td className="px-4 py-3">{agentName(l.assignedAgentId)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(l.dateAdded).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
