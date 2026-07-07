import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { request } from "@/services/apiClient";
import { PageHeader } from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Profile — Nexora CRM" }] }),
  component: ProfilePage,
});

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const { user, refresh } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");

  if (!user) return null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Please choose an image under 4MB.");
      return;
    }
    setUploading(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const res = await request<{ url: string }>({
        action: "media.upload",
        data: { imageBase64: base64, mimeType, target: "avatar", userId: user.id },
      });
      setAvatarUrl(res.url);
      toast.success("Profile picture updated");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await authService.updateAgent(user.id, { fullName: fullName.trim(), phone: phone.trim() });
      toast.success("Profile saved");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="My profile" description="Your personal information and preferences." />
      <div className="glass-card p-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full grid place-items-center text-xl font-semibold overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                fullName.slice(0, 1).toUpperCase()
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card border border-border/60 grid place-items-center hover:bg-accent transition-colors"
              aria-label="Change photo"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
          <div>
            <div className="text-lg font-semibold">{user.fullName}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{user.role}</div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" defaultValue={user.email} disabled /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <Button className="btn-brand hover:btn-brand-hover border-0" onClick={saveProfile} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

