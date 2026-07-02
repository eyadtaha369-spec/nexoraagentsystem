import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardView } from "@/components/DashboardView";
import { getMe } from "@/lib/crm.functions";

export const Route = createFileRoute("/_app/admin-dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin Dashboard — Nexora CRM" }] }),
  beforeLoad: async () => {
    const me = await getMe();
    const roles = me.roles as string[];
    const isAdmin = roles.includes("admin") || roles.includes("owner");
    if (!isAdmin) throw redirect({ to: "/agent-dashboard" });
  },
  component: () => <DashboardView mode="admin" />,
});
