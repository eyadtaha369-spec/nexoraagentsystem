import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { notificationService } from "@/services/notificationService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import type { AppNotification } from "@/types/domain";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({
  ssr: false,
  head: () => ({ meta: [{ title: "Notifications — Nexora CRM" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); setItems(await notificationService.list()); setLoading(false); };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Inbox" title="Notifications" description="Everything that happens in your CRM in one place."
        actions={<Button variant="outline" onClick={async () => { await notificationService.markAllRead(); load(); }}>Mark all read</Button>}
      />
      {loading ? <div className="glass-card p-8 text-sm text-muted-foreground">Loading…</div>
       : items.length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" />} title="You're all caught up" description="Notifications will appear here when leads are assigned, imported, or their status changes." />
       : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`glass-card p-4 flex items-start gap-3 ${!n.read ? "ring-1 ring-primary/30" : ""}`}>
              <span className="mt-1 h-2 w-2 rounded-full" style={{ background: n.read ? "var(--color-muted-foreground)" : "var(--gradient-brand)" }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-3">
                  <h4 className="font-medium">{n.title}</h4>
                  <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
              </div>
              {!n.read && <Button size="sm" variant="ghost" onClick={async () => { await notificationService.markRead(n.id); load(); }}>Mark read</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
