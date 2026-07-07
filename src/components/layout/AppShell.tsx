import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Contact, Settings, LogOut, Bell, Sun, Moon,
  BarChart3, FileText, Calendar, Trophy, CalendarClock, UserCircle, Activity, Search,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { notificationService } from "@/services/notificationService";

const ALL_NAV: { to: string; label: string; icon: ReactNode; adminOnly?: boolean }[] = [
  { to: "/dashboard",       label: "Dashboard",   icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/leads",           label: "Leads",       icon: <Contact className="h-4 w-4" /> },
  { to: "/follow-ups",      label: "Follow-ups",  icon: <CalendarClock className="h-4 w-4" /> },
  { to: "/calendar",        label: "Calendar",    icon: <Calendar className="h-4 w-4" /> },
  { to: "/analytics",       label: "Analytics",   icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/reports",         label: "Reports",     icon: <FileText className="h-4 w-4" /> },
  { to: "/leaderboard",     label: "Leaderboard", icon: <Trophy className="h-4 w-4" /> },
  { to: "/agents",          label: "Agents",      icon: <Users className="h-4 w-4" />, adminOnly: true },
  { to: "/activity",        label: "Activity",    icon: <Activity className="h-4 w-4" />, adminOnly: true },
  { to: "/settings",        label: "Settings",    icon: <Settings className="h-4 w-4" />, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => { const n = await notificationService.unreadCount(); if (alive) setUnread(n); };
    tick();
    const i = setInterval(tick, 15_000);
    return () => { alive = false; clearInterval(i); };
  }, [pathname]);

  const isAdmin = user?.role === "admin";
  const nav = ALL_NAV.filter((n) => !n.adminOnly || isAdmin);

  async function handleLogout() {
    await logout();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
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
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active ? "bg-accent text-accent-foreground shadow-inner"
                           : "text-muted-foreground hover:text-foreground hover:bg-accent/40"}`}>
                  {item.icon}{item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6">
            <Link to="/profile" className="glass-card p-3 flex items-center gap-3 hover:bg-accent/30 transition-colors">
              <div className="h-9 w-9 rounded-full grid place-items-center text-sm font-semibold shrink-0 overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
                ) : (
                  user?.fullName?.slice(0,1).toUpperCase() ?? "?"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.fullName}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {isAdmin ? "Admin" : "Agent"}
                </div>
              </div>
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border/60 bg-sidebar/60 backdrop-blur-xl px-4 md:px-8 py-3">
            <div className="md:hidden flex items-center gap-2">
              <Link to="/dashboard" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg btn-brand grid place-items-center text-sm font-bold">N</div>
                <span className="font-semibold">Nexora</span>
              </Link>
            </div>
            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
              <div className="flex items-center gap-2 w-full rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <input placeholder="Search leads, agents, notes…" className="bg-transparent outline-none flex-1 text-sm text-foreground" />
                <span className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded border border-border/60">⌘K</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Link to="/notifications" className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent/60" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[10px] grid place-items-center bg-destructive text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Link>
              <Link to="/profile" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent/60" aria-label="Profile">
                <UserCircle className="h-4 w-4" />
              </Link>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="md:hidden px-4 py-2 flex gap-2 overflow-x-auto border-b border-border/60">
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap ${
                  active ? "bg-accent text-accent-foreground" : "bg-card/40 text-muted-foreground"}`}>
                  {item.icon}{item.label}
                </Link>
              );
            })}
          </div>

          <main className="p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

