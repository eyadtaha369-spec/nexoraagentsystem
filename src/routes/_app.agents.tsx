import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/types/domain";

export const Route = createFileRoute("/_app/agents")({
  ssr: false,
  head: () => ({ meta: [{ title: "Agents — Nexora CRM" }] }),
  component: AgentsPage,
});

function AgentsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && user.role !== "admin") nav({ to: "/agent-dashboard", replace: true });
  }, [user, nav]);

  const load = async () => {
    setLoading(true);
    setAgents(await authService.listAgents());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) return toast.error("Fill all required fields.");
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters.");
    setSaving(true);
    try {
      await authService.createAgent(form);
      toast.success("Agent created");
      setOpen(false); setForm({ fullName: "", email: "", phone: "", password: "" });
      load();
    } catch (err: any) { toast.error(err?.message ?? "Failed to create agent"); }
    finally { setSaving(false); }
  }

  async function toggleStatus(a: User) {
    await authService.setStatus(a.id, a.status === "Active" ? "Disabled" : "Active");
    toast.success(`Agent ${a.status === "Active" ? "disabled" : "enabled"}`);
    load();
  }
  async function removeAgent(a: User) {
    await authService.deleteAgent(a.id);
    toast.success("Agent deleted");
    load();
  }
  async function resetPw(a: User) {
    const pw = crypto.randomUUID().slice(0, 12);
    await authService.resetPassword(a.id, pw);
    toast.success(`New password: ${pw}`);
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Team" title="Agents" description="Create, manage, and monitor your sales team."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-brand hover:btn-brand-hover border-0 gap-2"><Plus className="h-4 w-4" /> New agent</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create new agent</DialogTitle></DialogHeader>
              <form onSubmit={createAgent} className="space-y-4">
                <div className="space-y-2"><Label>Full name</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
                <DialogFooter>
                  <Button type="submit" disabled={saving} className="btn-brand hover:btn-brand-hover border-0">{saving ? "Creating…" : "Create agent"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="glass-card p-8 text-muted-foreground text-sm">Loading agents…</div>
      ) : agents.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No agents yet"
          description="Create your first agent to start distributing leads."
          action={<Button onClick={() => setOpen(true)} className="btn-brand hover:btn-brand-hover border-0">Create agent</Button>} />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Joined</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full grid place-items-center text-xs font-semibold" style={{ background: "var(--gradient-brand)" }}>
                        {a.fullName.slice(0,1).toUpperCase()}
                      </div>
                      <span className="font-medium">{a.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{a.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${a.status === "Active" ? "border-emerald-400/25 bg-emerald-500/15 text-emerald-300" : "border-rose-400/25 bg-rose-500/15 text-rose-300"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(a)}>{a.status === "Active" ? "Disable" : "Enable"}</Button>
                    <Button variant="outline" size="sm" onClick={() => resetPw(a)}>Reset password</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {a.fullName}?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone. Their assigned leads will need to be reassigned.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeAgent(a)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
