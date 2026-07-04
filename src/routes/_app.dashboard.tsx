import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/dashboard")({
  ssr: false,
  component: RedirectDashboard,
});

function RedirectDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (user) nav({ to: user.role === "admin" ? "/admin-dashboard" : "/agent-dashboard", replace: true });
  }, [user, nav]);
  return null;
}
