import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { settingsService } from "@/services/settingsService";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { SystemSettings } from "@/types/domain";

export const Route = createFileRoute("/_app/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — Nexora CRM" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [s, setS] = useState<SystemSettings | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") nav({ to: "/agent-dashboard", replace: true });
  }, [user, nav]);

  useEffect(() => { settingsService.get().then(setS); }, []);

  async function save() {
    if (!s) return;
    await settingsService.update(s);
    toast.success("Settings saved");
  }
  async function testConn() {
    if (!s) return;
    try { const r = await settingsService.testConnection(s.appsScriptUrl); toast.success(`Connected in ${r.latencyMs}ms (mock)`); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  if (!user || user.role !== "admin" || !s) return null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Settings" description="Company details, connection, and preferences." />
      <div className="grid md:grid-cols-2 gap-4">
        <section className="glass-card p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Company</h2>
          <div className="space-y-2"><Label>Name</Label><Input value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={s.companyEmail} onChange={(e) => setS({ ...s, companyEmail: e.target.value })} /></div>
        </section>

        <section className="glass-card p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Google Apps Script connection</h2>
          <div className="space-y-2"><Label>Apps Script URL</Label><Input placeholder="https://script.google.com/macros/s/…" value={s.appsScriptUrl} onChange={(e) => setS({ ...s, appsScriptUrl: e.target.value })} /></div>
          <div className="space-y-2"><Label>Spreadsheet ID</Label><Input value={s.spreadsheetId} onChange={(e) => setS({ ...s, spreadsheetId: e.target.value })} /></div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={testConn}>Test connection</Button>
            <Button className="btn-brand hover:btn-brand-hover border-0" onClick={save}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">Status: <span className={s.appsScriptUrl ? "text-emerald-400" : "text-muted-foreground"}>{s.appsScriptUrl ? "Configured" : "Not configured"}</span></p>
        </section>

        <section className="glass-card p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Lead distribution</h2>
          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <Button variant={s.distributionMode === "manual" ? "default" : "outline"} size="sm" onClick={() => setS({ ...s, distributionMode: "manual" })}>Manual</Button>
              <Button variant={s.distributionMode === "round_robin" ? "default" : "outline"} size="sm" onClick={() => setS({ ...s, distributionMode: "round_robin" })}>Round-robin</Button>
            </div>
          </div>
        </section>

        <section className="glass-card p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Notifications</h2>
          <div className="flex items-center justify-between">
            <div><Label>Enabled</Label><p className="text-xs text-muted-foreground">Show in-app notifications for new events.</p></div>
            <Switch checked={s.notificationsEnabled} onCheckedChange={(v) => setS({ ...s, notificationsEnabled: v })} />
          </div>
        </section>
      </div>
    </div>
  );
}
