import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { settingsService } from "@/services/settingsService";
import { request } from "@/services/apiClient";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { SystemSettings } from "@/types/domain";
import { Upload, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — Nexora CRM" }] }),
  component: SettingsPage,
});

function resizeImageToBase64(file: File, maxDimension = 512, quality = 0.9): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/png", quality);
        resolve({ base64: dataUrl.split(",")[1], mimeType: "image/png" });
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [s, setS] = useState<SystemSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && user.role !== "admin") nav({ to: "/agent-dashboard", replace: true });
  }, [user, nav]);

  useEffect(() => {
    settingsService.get().then((data) => {
      setS(data);
      setLogoUrl((data as any).companyLogoUrl || "");
    });
  }, []);

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

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Please choose an image under 15MB.");
      return;
    }
    setUploadingLogo(true);
    try {
      const { base64, mimeType } = await resizeImageToBase64(file);
      const res = await request<{ url: string }>({
        action: "media.upload",
        data: { imageBase64: base64, mimeType, target: "logo" },
      });
      setLogoUrl(res.url);
      toast.success("Logo updated — it will appear across the site.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
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

          <div className="space-y-2 pt-2 border-t border-border/60">
            <Label>Company logo</Label>
            <div className="flex items-center gap-4 pt-1">
              <div className="h-14 w-14 rounded-xl grid place-items-center overflow-hidden border border-border/60" style={{ background: "var(--gradient-brand)" }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-lg font-bold">{s.companyName?.slice(0, 1).toUpperCase() || "N"}</span>
                )}
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingLogo ? "Uploading…" : "Upload logo"}
              </Button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
            <p className="text-xs text-muted-foreground">Square images work best. This replaces the "N" icon site-wide.</p>
          </div>
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

