import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Contact, LogOut, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const meFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const roles = (me?.roles || []) as string[];
  const isAdmin = roles.includes("admin") || roles.includes("owner");
  const isOwner = isAdmin;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav: { to: string; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/leads", label: "Leads", icon: <Contact className="h-4 w-4" /> },
    { to: "/team", label: "Team", icon: <Users className="h-4 w-4" />, ownerOnly: true },
    { to: "/settings", label: "Settings", icon: <Settings className="h-4 w-4" />, ownerOnly: true },
  ];

  return (
    <div className="min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-1 border-r border-border/60 bg-sidebar/50 backdrop-blur-xl px-4 py-6 min-h-screen sticky top-0">
          <Link to="/dashboard" className="flex items-center gap-2 px-2 pb-6">
            <div className="h-9 w-9 rounded-xl btn-brand grid place-items-center text-lg font-bold">N</div>
            <div>
              <div className="text-lg font-semibold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Nexora <span className="gradient-text">CRM</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Internal OS</div>
            </div>
          </Link>

          <nav className="flex flex-col gap-1">
            {nav.filter(n => !n.ownerOnly || isOwner).map(item => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground shadow-inner"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6">
            <div className="glass-card p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full grid place-items-center text-sm font-semibold" style={{ background: "var(--gradient-brand)" }}>
                {(me?.profile?.full_name || me?.profile?.email || "?").slice(0,1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{me?.profile?.full_name || me?.profile?.email}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {isAdmin ? "Admin" : "Agent"}
                  {me?.profile?.sheet_tab_name ? ` • ${me.profile.sheet_tab_name}` : ""}
                </div>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border/60 bg-sidebar/60 backdrop-blur-xl sticky top-0 z-10">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg btn-brand grid place-items-center text-sm font-bold">N</div>
            <span className="font-semibold">Nexora CRM</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4"/></Button>
        </div>

        {/* Content */}
        <main className="p-4 md:p-8 min-w-0">
          {/* Mobile nav pills */}
          <div className="md:hidden mb-4 flex gap-2 overflow-x-auto">
            {nav.filter(n => !n.ownerOnly || isOwner).map(item => {
              const active = pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap ${
                    active ? "bg-accent text-accent-foreground" : "bg-card/40 text-muted-foreground"
                  }`}>
                  {item.icon}{item.label}
                </Link>
              );
            })}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

