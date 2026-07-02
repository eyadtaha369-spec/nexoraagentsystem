import { createFileRoute, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/crm.functions";

// /dashboard redirects to the correct role-specific dashboard.
export const Route = createFileRoute("/_app/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const me = await getMe();
    const roles = me.roles as string[];
    const isAdmin = roles.includes("admin") || roles.includes("owner");
    throw redirect({ to: isAdmin ? "/admin-dashboard" : "/agent-dashboard" });
  },
});
