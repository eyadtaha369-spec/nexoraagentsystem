import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

// Routes that only admins may open. Agents get bounced to their dashboard.
const ADMIN_ONLY_PREFIXES = [
  "/admin-dashboard",
  "/agents",
  "/activity",
  "/settings",
  "/reports",
];

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/login", replace: true });
      return;
    }
    if (user.role === "agent" && ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
      nav({ to: "/agent-dashboard", replace: true });
    }
  }, [user, loading, nav, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  return <AppShell><Outlet /></AppShell>;
}
