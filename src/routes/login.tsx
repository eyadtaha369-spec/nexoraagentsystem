import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Nexora CRM" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      nav({ to: user.role === "admin" ? "/admin-dashboard" : "/agent-dashboard", replace: true });
    }
  }, [user, loading, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter your email and password.");
    setSubmitting(true);
    try {
      const u = await login(email, password, remember);
      toast.success(`Welcome back, ${u.fullName.split(" ")[0]}`);
      nav({ to: u.role === "admin" ? "/admin-dashboard" : "/agent-dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center gap-2 group">
            <div className="h-10 w-10 rounded-xl btn-brand grid place-items-center text-lg font-bold shadow-lg transition-transform group-hover:scale-105">N</div>
            <span className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Nexora <span className="gradient-text">CRM</span>
            </span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">Enterprise sales operating system</p>
        </div>

        <div className="glass-card p-6 md:p-7">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@nexora.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <div className="relative">
                <Input id="pw" type={showPw ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground" aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                Remember me
              </label>
              <button type="button" onClick={() => toast.info("Password reset is not enabled yet. Ask your admin.")} className="text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </button>
            </div>
            <Button type="submit" disabled={submitting} className="w-full btn-brand hover:btn-brand-hover border-0">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground pt-3 border-t border-border/50">
              Accounts are provisioned by the admin. New agents cannot self-register.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
