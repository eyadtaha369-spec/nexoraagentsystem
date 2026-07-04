import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Profile — Nexora CRM" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="My profile" description="Your personal information and preferences." />
      <div className="glass-card p-6 max-w-2xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full grid place-items-center text-xl font-semibold" style={{ background: "var(--gradient-brand)" }}>
            {user.fullName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-semibold">{user.fullName}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{user.role}</div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Full name</Label><Input defaultValue={user.fullName} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" defaultValue={user.email} disabled /></div>
          <div className="space-y-2"><Label>Phone</Label><Input defaultValue={user.phone ?? ""} /></div>
        </div>
        <Button className="btn-brand hover:btn-brand-hover border-0" onClick={() => toast.success("Profile saved (mock)")}>Save changes</Button>
      </div>
    </div>
  );
}
