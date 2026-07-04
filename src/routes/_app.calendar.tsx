import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Calendar as CalIcon } from "lucide-react";

export const Route = createFileRoute("/_app/calendar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Calendar — Nexora CRM" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader eyebrow="Schedule" title="Calendar" description="Month, week, and day views for follow-ups and meetings." />
      <EmptyState icon={<CalIcon className="h-6 w-6" />} title="Calendar view coming online"
        description="Once follow-ups are scheduled and the backend is connected, they will populate here in month, week, and day views." />
    </div>
  ),
});
