import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, syncFromSheet } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Nexora CRM" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const meFn = useServerFn(getMe);
  const syncFn = useServerFn(syncFromSheet);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!me?.roles.includes("owner")) return <div className="glass-card p-6">Owner-only page.</div>;

  async function runSync() {
    setBusy(true);
    try {
      toast.info("Syncing…");
      const r = await syncFn();
      toast.success(`Imported ${r.imported} of ${r.total} rows`);
      queryClient.invalidateQueries();
    } catch (e: any) { toast.error(e?.message || "Sync failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Settings</p>
        <h1 className="text-3xl md:text-4xl font-semibold mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Google Sheet <span className="gradient-text">integration</span>
        </h1>
      </header>

      <div className="glass-card p-6 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Connected sheet</div>
          <div className="mt-1 font-medium">Nexora LIVE Spreadsheet</div>
          <a
            href="https://docs.google.com/spreadsheets/d/1omumAlkdPwxPOx7sQ3TfwbuVOThdUp3OZ3oR9GD795Y/edit"
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline mt-1"
          >
            Open in Google Sheets <ExternalLink className="h-3 w-3"/>
          </a>
        </div>

        <div className="border-t border-border/40 pt-4">
          <h3 className="font-medium">Manual sync</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Pull every lead row from every agent tab. This upserts by (agent, Client ID) and
            never deletes local rows. Status, notes, and reassigns you make in the CRM push to
            the Sheet immediately — no sync needed for those.
          </p>
          <Button onClick={runSync} disabled={busy} className="btn-brand hover:btn-brand-hover border-0 gap-2 mt-4">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}/>
            {busy ? "Syncing…" : "Sync from Google Sheet"}
          </Button>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="font-medium">How sync works</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Each agent tab in the Sheet is one agent's inbox — the tab name is the agent identity.</li>
          <li>Rows are matched by <code className="text-foreground">Client ID</code> per agent.</li>
          <li>Status &amp; notes changes from the CRM write back to the exact row.</li>
          <li>Reassigning a lead removes it from the old tab and appends to the new one.</li>
          <li>Client IDs auto-generate on lead creation: <code className="text-foreground">CL-0001</code>, <code className="text-foreground">CL-0002</code>, …</li>
        </ul>
      </div>
    </div>
  );
}
