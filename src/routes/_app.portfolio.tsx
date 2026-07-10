import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { request } from "@/services/apiClient";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Briefcase, Loader2, Trash2, Upload, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/portfolio")({
  ssr: false,
  head: () => ({ meta: [{ title: "Portfolio — Nexora CRM" }] }),
  component: PortfolioPage,
});

interface Project {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  description: string;
  link: string;
  createdAt: string;
}

function resizeImageToBase64(file: File, maxDimension = 1400, quality = 0.85): Promise<{ base64: string; mimeType: string }> {
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
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

const EMPTY_FORM = { title: "", category: "", description: "", link: "" };

function PortfolioPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [imageMime, setImageMime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && user.role !== "admin") nav({ to: "/agent-dashboard", replace: true });
  }, [user, nav]);

  async function load() {
    setLoading(true);
    try {
      const data = await request<Project[]>({ action: "projects.list" });
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Please choose an image under 15MB.");
      return;
    }
    try {
      const { base64, mimeType } = await resizeImageToBase64(file);
      setImageBase64(base64);
      setImageMime(mimeType);
      setImagePreview(`data:${mimeType};base64,${base64}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load image.");
    }
  }

  async function submitProject() {
    if (!form.title.trim()) return toast.error("Please enter a project title.");
    if (!imageBase64) return toast.error("Please choose an image for this project.");

    setSubmitting(true);
    try {
      const uploadRes = await request<{ url: string }>({
        action: "media.upload",
        data: { imageBase64, mimeType: imageMime, target: "project" },
      });

      await request({
        action: "projects.create",
        data: {
          title: form.title.trim(),
          category: form.category.trim(),
          description: form.description.trim(),
          link: form.link.trim(),
          imageUrl: uploadRes.url,
        },
      });

      toast.success("Project added — it's now live on your website.");
      setForm(EMPTY_FORM);
      setImageBase64("");
      setImagePreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add project.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteProject(id: string) {
    if (!confirm("Remove this project from your website?")) return;
    try {
      await request({ action: "projects.delete", data: { id } });
      toast.success("Project removed");
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to remove project.");
    }
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Website" title="Portfolio" description="Add finished projects to show off on your marketing site." />

      <div className="glass-card p-6 max-w-2xl space-y-4">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Add a project</h2>

        <div className="flex items-center gap-4">
          <div className="h-24 w-24 rounded-xl overflow-hidden border border-border/60 bg-card/40 grid place-items-center shrink-0">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <Briefcase className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Choose image
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Goya Pharmacy Website" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. E-commerce, Restaurant…" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What you built and the results…" />
        </div>

        <div className="space-y-1.5">
          <Label>Live link (optional)</Label>
          <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://…" />
        </div>

        <Button onClick={submitProject} disabled={submitting} className="btn-brand hover:btn-brand-hover border-0">
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : "Add project"}
        </Button>
      </div>

      <div>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Live on your website ({projects.length})</h2>
        {loading ? (
          <div className="glass-card p-8 text-sm text-muted-foreground">Loading…</div>
        ) : projects.length === 0 ? (
          <EmptyState icon={<Briefcase className="h-6 w-6" />} title="No projects yet" description="Add your first project above to feature it on your website." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div key={p.id} className="glass-card overflow-hidden">
                <div className="h-36 overflow-hidden">
                  <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.category || "—"}</div>
                  <div className="font-medium">{p.title}</div>
                  {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between pt-2">
                    {p.link ? (
                      <a href={p.link} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" /> View live
                      </a>
                    ) : <span />}
                    <button onClick={() => deleteProject(p.id)} className="text-xs inline-flex items-center gap-1 text-destructive hover:opacity-80">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

