import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reports — Nexora CRM" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader eyebrow="Data" title="Reports" description="Export snapshots of your pipeline for stakeholders."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => toast.info("CSV export will be wired to the API.")}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" className="gap-2" onClick={() => toast.info("Excel export will be wired to the API.")}><Download className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}><FileText className="h-4 w-4" /> Print</Button>
          </>
        }
      />
      <EmptyState icon={<FileText className="h-6 w-6" />} title="No saved reports yet"
        description="Once the backend is connected, generated reports will appear here." />
    </div>
  ),
});
