import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/DashboardView";

// Any authenticated user can visit their agent dashboard. RLS + client-side scope
// ensure they only ever see leads assigned to them.
export const Route = createFileRoute("/_app/agent-dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Agent Dashboard — Nexora CRM" }] }),
  component: () => <DashboardView mode="agent" />,
});
