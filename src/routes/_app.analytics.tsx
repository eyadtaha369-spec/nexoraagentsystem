import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { ChartPlaceholder } from "@/components/common/ChartPlaceholder";

export const Route = createFileRoute("/_app/analytics")({
  ssr: false,
  head: () => ({ meta: [{ title: "Analytics — Nexora CRM" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Analytics" description="Deep-dive metrics across the entire funnel." />
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartPlaceholder title="Monthly leads" />
        <ChartPlaceholder title="Conversion rate" />
        <ChartPlaceholder title="Won vs Lost" />
        <ChartPlaceholder title="Agent performance" />
        <ChartPlaceholder title="Lead sources" />
        <ChartPlaceholder title="Status distribution" />
      </div>
    </div>
  ),
});
