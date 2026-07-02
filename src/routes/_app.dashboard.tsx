import { createFileRoute, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/crm.functions";

// /dashboard redirects to the correct role-specific dashboard.
export const Route = createFileRoute("/_app/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const me = await getMe();
    const isAdmin = me.roles.includes("admin") || me.roles.includes("owner");
    throw redirect({ to: isAdmin ? "/admin-dashboard" : "/agent-dashboard" });
  },
});
